'use strict';
const { strictKeys, id } = require('../membership-core/model');
const { check } = require('../membership-payment/protocol');
const { hash, hmac, equal } = require('../membership-payment/crypto');
const { createTeacherIdentity } = require('../membership-payment/identity');
const { createWechatApi } = require('../membership-payment/wechat-api');
const { createPaymentEngine } = require('../membership-payment/engine');
const { createNotificationHandler, createClientHandler } = require('../membership-payment/handlers');
const { credentialProviders, internalHandler } = require('../membership-payment/runtime');
const { createAccessService } = require('../membership-access/service');
const { createStage5Repository, createLedgerRepository } = require('./repository');
const { fromEnvironment } = require('./policy');
const { timerRequest } = require('./timer');

function clientEnvelope(event) {
  check(event && typeof event === 'object' && !Array.isArray(event),'INVALID_REQUEST');
  const {userInfo,tcbContext,...input}=event; // deliberately unused, even if forged
  strictKeys(input,['action','request']);
  check(typeof input.action === 'string' && input.request && typeof input.request === 'object' && !Array.isArray(input.request),'INVALID_REQUEST');
  return input;
}
function secret(environment,name) {
  const value=environment[name];check(typeof value==='string' && Buffer.byteLength(value)>=32,'STAGE5_SECRET_NOT_CONFIGURED');return value;
}
// Reads only signed, independently recorded official-order evidence. A client or
// administrator passing {verified:true} cannot create an evidence record here.
function reviewEvidenceProvider(repository,policy,environment) {
  return async (reference,operatorId)=>{
    policy.administrator(operatorId);id(reference);
    const key=secret(environment,'STAGE5_EVIDENCE_KEY');
    const row=await repository.get('audits',`evidence_${hash(reference)}`);
    check(row?.kind==='official_order_evidence' && row.reference===reference,'REVIEW_EVIDENCE_REQUIRED');
    policy.administrator(row.reviewerId); policy.teacher(row.evidence?.teacherId);
    check(typeof row.sourceReference==='string' && row.sourceReference.length>0 && row.evidence.reference===reference,'REVIEW_EVIDENCE_REQUIRED');
    check(equal(hmac(key,JSON.stringify({scopeId:policy.scopeId,reference,reviewerId:row.reviewerId,sourceReference:row.sourceReference,evidence:row.evidence})),row.signature),'REVIEW_EVIDENCE_SIGNATURE_INVALID');
    return row.evidence;
  };
}
function createStage5Runtime({db,wxCloud,policy,environment={},clock=Date.now,fetchImpl,api:injectedApi}) {
  const repository=createStage5Repository(db,policy);
  const c=policy.config;
  const credentials=credentialProviders(environment,{appId:c.appId,fetchImpl,clock});
  const api=injectedApi || createWechatApi({...credentials,fetchImpl}); // tests explicitly inject; bootstrap never does
  async function identity(admin=false) {
    const caller=wxCloud.getWXContext();
    check(caller?.APPID===c.appId && typeof caller.OPENID==='string','IDENTITY_NOT_VERIFIED');
    if(admin) { policy.administrator(caller.OPENID);return {teacherId:caller.OPENID,operatorId:caller.OPENID,isAdmin:true}; }
    policy.teacher(caller.OPENID);
    return createTeacherIdentity({db,appId:c.appId,wxCloud:{getWXContext:()=>caller}})();
  }
  // Instantiate per invocation. Never retain caller identity across warm invocations.
  function engine(who,adminWho=null) {
    return createPaymentEngine({repository,api,config:{...c,orderScope:policy.scopeId,purchaseEnabled:c.purchaseEnabled&&!c.batchClosed},clock,
      getIdentity:async()=>who,
      getAdminIdentity:async()=>{check(adminWho,'STAGE5_ADMIN_REQUIRED');policy.administrator(adminWho.operatorId);return adminWho;},getReviewEvidence:reviewEvidenceProvider(repository,policy,environment)});
  }
  function access(who,initializeEmpty=true) {
    return createAccessService({repository:createLedgerRepository(repository,policy,clock,{initializeEmpty}),getIdentity:async()=>who,clock,administrators:c.administrators});
  }
  async function security(code) {
    // Fixed ring of 384 records per scope; no raw body, signature, identity or ID.
    try {
      const slot=`security_${Math.floor(clock()/3600000)%24}_${parseInt(hash(code).slice(0,2),16)%16}`;
      await repository.transaction(tx=>tx.put('events',slot,{kind:'security_rejection',code,recordedAt:clock()}));
    } catch { /* response remains rejection */ }
  }
  return Object.freeze({
    async orders(event) {
      const {action,request}=clientEnvelope(event);const who=await identity();
      if(['createOrder','parameters'].includes(action)) {
        policy.buyer(who.teacherId);
        if(!injectedApi) {await credentials.getAppKey(c.env);await credentials.getAppSecret();}
      }
      return createClientHandler(engine(who))({action,request});
    },
    async payment_notify(request) {
      try {
        policy.real();
        const payment=engine(null);
        const handler=createNotificationHandler({config:{...c,...credentials.notification()},engine:{
          async authenticatedEvent(event) {
            // Lookup inside the isolated repository before engine failure logging.
            const orderId=event?.OutTradeNo || event?.MchOrderId;
            check(typeof orderId==='string' && await repository.get('orders',orderId),'STAGE5_ORDER_REQUIRED');
            return payment.authenticatedEvent(event);
          }
        }});
        const result=await handler(request);
        if(result.statusCode!==200) await security('NOTIFICATION_REJECTED');
        return result;
      } catch { await security('NOTIFICATION_UNAVAILABLE');return {statusCode:503,body:'retry'}; }
    },
    async compensate(event) {
      policy.real();
      const context=wxCloud.getWXContext();
      const isTimer=context?.SOURCE==='wx_trigger' || event?.Type==='Timer';
      const {userInfo,tcbContext,...envelope}=event || {};
      const internal={internal:()=>hmac(secret(environment,'STAGE5_INTERNAL_KEY'),policy.scopeId)};
      // Signature is scoped, so an authorized request cannot be replayed in another batch.
      try {
        const request=isTimer ? timerRequest({event,context,policy,environment,clock}) : envelope;
        return await internalHandler({engine:engine(null),repository,credentials:internal,clock})(request);
      }
      catch(error) { await security('INTERNAL_REJECTED');throw error; }
    },
    async access(event) {
      const {action,request}=clientEnvelope(event);const who=await identity();
      const service=access(who);
      const allowed=['getMembershipAccess','authorizeLearning','authorizeReview','addStudent','selectRetainedStudent','correctProfile','deleteStudent'];
      check(allowed.includes(action),'ACTION_NOT_ALLOWED');return service[action](request);
    },
    async admin(event) {
      const {action,request}=clientEnvelope(event);const who=await identity(true);
      if(action==='confirmPaidAndGrant') {
        strictKeys(request,['orderId','evidence','reason']);policy.real();
        const order=await repository.get('orders',id(request.orderId));check(order,'UNKNOWN_ORDER');policy.teacher(order.teacherId);
        return engine(null,who).confirmPaidAndGrant(request.orderId,null,request.evidence,request.reason);
      }
      check(['initialize','previewGrant','applyGrant','correctRetainedStudent','correctFreeSlot'].includes(action),'ACTION_NOT_ALLOWED');
      policy.teacher(request.teacherId);
      if(action==='initialize') check(c.source==='synthetic','STAGE5_SYNTHETIC_INITIALIZATION_ONLY');
      return access(who,action!=='initialize').admin[action](request);
    }
  });
}
// SCF HTTP gateway JSON adapter preserves the exact encrypted body string.
function httpRequest(event) {
  check(event && ['GET','POST'].includes(event.httpMethod),'INVALID_HTTP_REQUEST');
  const body=event.httpMethod==='GET' && event.body===undefined ? '' : event.body;
  check(typeof body==='string' && Buffer.byteLength(body)<=90000,'INVALID_ENVELOPE');
  check(!(event.queryString && event.queryStringParameters),'AMBIGUOUS_HTTP_QUERY');
  return {method:event.httpMethod,query:event.queryStringParameters || event.queryString || {},body:event.isBase64Encoded ? Buffer.from(body,'base64').toString('utf8') : body};
}
function makeMain(entry,loadSdk=()=>({cloudbase:require('@cloudbase/node-sdk'),wxCloud:require('wx-server-sdk')})) {
  check(['orders','payment_notify','compensate','access','admin'].includes(entry),'INVALID_STAGE5_ENTRY');
  return async event=>{
    // Fail closed before SDK initialization when protected deployment config is absent.
    const policy=fromEnvironment(process.env);const {cloudbase,wxCloud}=loadSdk();
    wxCloud.init({env:policy.config.cloudEnvId});
    const db=cloudbase.init({env:policy.config.cloudEnvId}).database();
    const runtime=createStage5Runtime({db,wxCloud,policy,environment:process.env});
    return runtime[entry](entry==='payment_notify' ? httpRequest(event) : event);
  };
}
module.exports={createStage5Runtime,reviewEvidenceProvider,clientEnvelope,httpRequest,makeMain};
