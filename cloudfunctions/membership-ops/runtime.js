'use strict';
const {id,reason,strictKeys,canonical,product}=require('../membership-core/model');
const {rebuildAccount}=require('../membership-core/ledger');
const {hash,hmac,equal,decryptNotification}=require('../membership-payment/crypto');
const {queryCashEvidence,queryState,check}=require('../membership-payment/protocol');
const {createPaymentEngine}=require('../membership-payment/engine');
const {createWechatApi}=require('../membership-payment/wechat-api');
const {credentialProviders}=require('../membership-payment/runtime');
const {createOpsRepository,validate}=require('./repository');
const {createGrantOperations}=require('./grants');
const APP_ID='wx930eccb9442dc8f3',ENV_ID='cloudbase-4gafzdch60ad597b';
function configuration(environment) {
  let c;try{c=JSON.parse(environment.MEMBERSHIP_OPS_CONFIG);}catch{throw Error('OPS_NOT_CONFIGURED');}
  strictKeys(c,['appId','envId','administrators','internalOperators','writeTeachers','originalId','offerId','paymentEnv']);
  check(c.appId===APP_ID&&c.envId===ENV_ID&&[0,1].includes(c.paymentEnv),'OPS_CONFIG_INVALID');
  for(const k of ['administrators','internalOperators','writeTeachers']){check(Array.isArray(c[k]),'OPS_CONFIG_INVALID');c[k].forEach(x=>id(x));}
  check(typeof c.originalId==='string'&&c.originalId.length>0&&typeof c.offerId==='string'&&c.offerId.length>0,'OPS_CONFIG_INVALID');
  return Object.freeze(c);
}
function secret(env,key){check(typeof env[key]==='string'&&Buffer.byteLength(env[key])>=32,'OPS_SECRET_REQUIRED');return env[key];}
function orderView(o){return {orderId:o.orderId,teacherFingerprint:hash(o.teacherId).slice(0,16),amount:o.amount,productId:o.productSnapshot?.productId,paymentStatus:o.paymentStatus,grantStatus:o.grantStatus,reviewRequired:o.reviewRequired||null,paidAt:o.fact?.paidAt||o.review?.candidate?.paidAt||null,refund:o.refund?{refundedAt:o.refund.refundedAt,amount:o.refund.amount}:null,reviewDecision:o.opsReview?.decision||null};}
function auditView(a){return {auditId:a.auditId||null,action:a.action||a.actionType||'confirm_paid_and_grant',operatorFingerprint:hash(a.operator||'platform').slice(0,16),teacherFingerprint:a.teacherId?hash(a.teacherId).slice(0,16):null,orderId:a.orderId||null,grantId:a.grantId||null,reason:a.reason||null,createdAt:a.createdAt,before:a.before?.status||a.before?.account?.status||null,after:a.after?.status||a.after?.account?.status||null,evidenceHash:a.evidenceHash||null};}
function createOpsRuntime({db,wxCloud,environment={},clock=Date.now,api:injectedApi,repository:injectedRepository}) {
  const config=configuration(environment),repo=injectedRepository||createOpsRepository(db);
  const scope={appId:APP_ID,envId:ENV_ID,function:'membership_ops'};
  const previewKey=secret(environment,'MEMBERSHIP_OPS_PREVIEW_KEY');
  const credentials=credentialProviders(environment,{appId:APP_ID,clock});
  const api=injectedApi||createWechatApi({...credentials});
  async function authenticate(event) {
    if(event?.body!==undefined){
      strictKeys(event,['body','timestamp','nonce','signature','userInfo','tcbContext']);
      check(typeof event.body==='string'&&Buffer.byteLength(event.body)<=24000&&Number.isSafeInteger(event.timestamp)&&Math.abs(clock()-event.timestamp)<=300000&&/^[A-Za-z0-9_-]{16,128}$/.test(event.nonce||''),'ADMIN_REQUIRED');
      const message=canonical({scope,body:event.body,timestamp:event.timestamp,nonce:event.nonce});
      check(equal(hmac(secret(environment,'MEMBERSHIP_OPS_INTERNAL_KEY'),message),event.signature),'ADMIN_REQUIRED');
      const body=JSON.parse(event.body);strictKeys(body,['operator','action','request']);id(body.operator);
      check(config.internalOperators.includes(body.operator),'ADMIN_REQUIRED');
      const key=`nonce_${hash(event.nonce)}`;
      await repo.transaction(async tx=>{check(!await tx.get('operations',key),'INTERNAL_REPLAY_REJECTED');await tx.put('operations',key,{kind:'invocation',operator:body.operator,action:body.action,createdAt:clock(),requestHash:hash(body.request)});});
      return {...body,internal:true};
    }
    strictKeys(event,['action','request','userInfo','tcbContext']);
    const who=wxCloud.getWXContext();
    check(who?.APPID===APP_ID&&['wx_client','wx_devtools'].includes(who.SOURCE)&&config.administrators.includes(who.OPENID),'ADMIN_REQUIRED');
    return {operator:id(who.OPENID),action:event.action,request:event.request,internal:false};
  }
  async function teacher(teacherId){
    id(teacherId);const r=await db.collection('teachers').where({teacher_id:teacherId}).limit(2).get();
    check(r.data?.length===1&&r.data[0].teacher_id===teacherId,'TEACHER_IDENTITY_REQUIRED');
  }
  function writable(teacherId){check(config.writeTeachers.includes(teacherId),'TEACHER_WRITE_NOT_ENABLED');}
  async function order(orderId){
    const o=await repo.get('orders',id(orderId));check(o&&o.orderId===orderId&&!o._stage5,'UNKNOWN_ORDER');
    check(o.appId===APP_ID&&o.offerId===config.offerId&&o.env===config.paymentEnv&&o.teacherId===o.openId,'FORMAL_ORDER_MISMATCH');
    const p=product(o.productSnapshot);
    check(!p.testOnly&&p.productId==='teacher_member_12m'&&o.platformProductId===p.productId&&o.amount===p.price&&o.currency===p.currency&&o.channel===p.channel&&o.quantity===1&&o.unit==='fen','FORMAL_ORDER_MISMATCH');
    validate(await repo.get('ledgers',o.teacherId),o.teacherId);return o;
  }
  async function evidence(reference,kind){
    const e=await repo.get('evidence',id(reference));check(e?.kind===kind&&e.reference===reference,'REVIEW_EVIDENCE_REQUIRED');
    check(config.internalOperators.includes(e.operator),'EVIDENCE_OPERATOR_REVOKED');
    const {signature,...body}=e;
    check(equal(hmac(secret(environment,'MEMBERSHIP_OPS_EVIDENCE_KEY'),canonical({scope,...body})),signature),'EVIDENCE_SIGNATURE_INVALID');
    return e;
  }
  async function execute({operator,action,request:r,internal}) {
    check(r&&typeof r==='object'&&!Array.isArray(r),'INVALID_REQUEST');
    const grants=createGrantOperations({repository:repo,clock,operator,previewKey,resolveTeacher:teacher});
    if(action==='getTeacher'){
      strictKeys(r,['teacherId']);await teacher(r.teacherId);const row=validate(await repo.get('ledgers',r.teacherId),r.teacherId);
      return {teacherId:r.teacherId,initialized:row?.initialization?.state==='ready',account:rebuildAccount(r.teacherId,row?.grants||[],row?.access||null,clock()),grants:(row?.grants||[]).map(g=>({grantId:g.grantId,source:g.sourceType,startsAt:g.startsAt,endsAt:g.endsAt,longTerm:g.longTerm,operation:g.operation})),revision:row?.revision||0};
    }
    if(action==='previewGrant')return grants.preview(r);
    if(action==='applyGrant'){writable(id(r.request?.teacherId));return grants.apply(r);}
    if(action==='getOrder'){strictKeys(r,['orderId']);return orderView(await order(r.orderId));}
    if(action==='listHistoricalReviews'){
      strictKeys(r,['offset','teacherId']);const offset=r.offset||0;check(Number.isSafeInteger(offset)&&offset>=0&&offset<=10000,'INVALID_OFFSET');
      const filter={kind:'historical_review',state:'review'};if(r.teacherId)filter.teacherId=id(r.teacherId);
      const rows=await repo.list('operations',filter,offset,21);return {items:rows.slice(0,20),nextOffset:rows.length>20?offset+20:null};
    }
    if(['listReview','listAudit'].includes(action)){
      strictKeys(r,['offset','teacherId','orderId']);const offset=r.offset||0;check(Number.isSafeInteger(offset)&&offset>=0&&offset<=10000,'INVALID_OFFSET');
      const filter={};if(r.teacherId)filter.teacherId=id(r.teacherId);if(r.orderId)filter.orderId=id(r.orderId);
      if(action==='listReview'){
        // Bounded pagination over orders also includes exceptions lacking a review flag.
        const rows=await repo.list('orders',{...filter,appId:APP_ID},offset,21);
        return {items:rows.slice(0,20).filter(o=>!o.refund&&o.paymentStatus!=='refunded'&&(o.reviewRequired||['review_required','exception','refund_pending'].includes(o.paymentStatus))).map(orderView),nextOffset:rows.length>20?offset+20:null};
      }
      const rows=await repo.list('audits',filter,offset,21);return {items:rows.slice(0,20).map(auditView),nextOffset:rows.length>20?offset+20:null};
    }
    // Evidence is recorded only by the signed internal operator tool. Its input
    // must be an independently obtained official record, not a client success flag.
    if(action==='recordEvidence'){
      check(internal,'INTERNAL_EVIDENCE_OPERATOR_REQUIRED');strictKeys(r,['reference','kind','orderId','sourceReference','payload','reason']);
      id(r.reference);reason(r.sourceReference);reason(r.reason);check(['official_order','official_refund'].includes(r.kind),'INVALID_EVIDENCE_KIND');
      const o=await order(r.orderId);writable(o.teacherId);
      let payload=r.payload;
      if(r.kind==='official_refund'){
        // An administrator's plain JSON assertion is not a platform final fact.
        // Reuse the sealed WeChat security-mode verifier before recording proof.
        try{payload=decryptNotification(r.payload,{appId:APP_ID,originalId:config.originalId,...credentials.notification()});}
        catch(error){
          const code='AUTHENTICATED_REFUND_EVIDENCE_REQUIRED',key=`evidence_review_${hash(r.reference)}`;
          await repo.transaction(async tx=>{if(!await tx.get('audits',key))await tx.put('audits',key,{auditId:key,action:'refund_evidence_review',teacherId:o.teacherId,orderId:o.orderId,operator,reason:r.reason,code,evidenceHash:hash(r.payload),createdAt:clock()});const latest=await tx.get('orders',o.orderId);if(!latest.refund){latest.reviewRequired='PLATFORM_REFUND_REQUIRES_REVIEW';await tx.put('orders',o.orderId,latest);}});
          return {state:'review',code};
        }
      }
      const normalized={...r,payload};
      const body={...normalized,teacherId:o.teacherId,operator,createdAt:clock(),...(r.kind==='official_refund'?{verification:'wechat_security_mode',envelopeHash:hash(r.payload)}:{})};
      return repo.transaction(async tx=>{
        const old=await tx.get('evidence',r.reference);if(old){check(hash({kind:old.kind,orderId:old.orderId,sourceReference:old.sourceReference,payload:old.payload})===hash({kind:r.kind,orderId:r.orderId,sourceReference:r.sourceReference,payload}),'IDEMPOTENCY_CONFLICT');return {reference:r.reference,recorded:true};}
        await tx.put('evidence',r.reference,{...body,signature:hmac(secret(environment,'MEMBERSHIP_OPS_EVIDENCE_KEY'),canonical({scope,...body}))});
        await tx.put('audits',`evidence_${hash(r.reference)}`,{auditId:`evidence_${hash(r.reference)}`,action:'record_evidence',teacherId:o.teacherId,orderId:o.orderId,operator,reason:r.reason,evidenceHash:hash(r.payload),createdAt:clock()});
        return {reference:r.reference,recorded:true};
      });
    }
    check(['queryOfficial','reviewDecision','confirmPaidAndGrant','processRefund'].includes(action),'ACTION_NOT_ALLOWED');
    strictKeys(r,['orderId','requestId','reason','reference','decision']);id(r.requestId);reason(r.reason);
    const o=await order(r.orderId);writable(o.teacherId);
    if(action==='reviewDecision'){
      check(['reject','hold'].includes(r.decision),'INVALID_REVIEW_DECISION');
      return repo.transaction(async tx=>{
        const key=`decision_${hash({orderId:o.orderId,requestId:r.requestId})}`,old=await tx.get('audits',key);
        if(old){check(old.requestHash===hash(r),'IDEMPOTENCY_CONFLICT');return {state:old.after};}
        const latest=await tx.get('orders',o.orderId);check(latest.reviewRequired&&!latest.refund&&latest.grantStatus!=='granted','ORDER_NOT_REVIEWABLE');
        const before=orderView(latest);latest.opsReview={decision:r.decision,operator,reason:r.reason,at:clock()};
        // Reject the proposed manual grant, not the platform payment fact. Keep
        // pending status to avoid encouraging another payment or hiding evidence.
        await tx.put('orders',o.orderId,latest);await tx.put('audits',key,{auditId:key,action,operator,teacherId:o.teacherId,orderId:o.orderId,reason:r.reason,requestHash:hash(r),before,after:r.decision,createdAt:clock()});return {state:r.decision};
      });
    }
    const auditedRepo={...repo,transaction:fn=>repo.transaction(async tx=>{
      const beforeOrder=await tx.get('orders',o.orderId),beforeAccount=await tx.get('accounts',o.teacherId);
      const result=await fn(tx),afterOrder=await tx.get('orders',o.orderId);
      if(!beforeOrder.refund&&afterOrder.refund){
        await tx.put('audits',`refund_${hash(o.orderId)}`,{auditId:`refund_${hash(o.orderId)}`,action:'refund',teacherId:o.teacherId,orderId:o.orderId,operator,reason:r.reason,evidenceReference:r.reference,evidenceHash:hash(afterOrder.refund),before:{order:orderView(beforeOrder),account:beforeAccount},after:{order:orderView(afterOrder),account:await tx.get('accounts',o.teacherId)},createdAt:clock()});
      }return result;
    })};
    const engine=createPaymentEngine({repository:auditedRepo,api,config:{appId:APP_ID,originalId:config.originalId,offerId:config.offerId,env:config.paymentEnv,purchaseEnabled:false},clock,
      getIdentity:async()=>{throw Error('CLIENT_NOT_ALLOWED');},getAdminIdentity:async()=>({isAdmin:true,operatorId:operator}),
      getReviewEvidence:async reference=>{const e=await evidence(reference,'official_order');check(e.orderId===o.orderId,'REVIEW_EVIDENCE_MISMATCH');return {...e.payload,reference};}});
    if(action==='queryOfficial'){
      const response=await api.query(o);let state,code=null;try{state=queryState(o,response).kind;if(state==='paid')queryCashEvidence(o,response,clock());}catch(e){state='review';code=/^[A-Z_]+$/.test(e.message)?e.message:'QUERY_FAILED';}
      const key=`query_${hash({orderId:o.orderId,requestId:r.requestId})}`;
      await repo.transaction(async tx=>{
        const old=await tx.get('audits',key);if(old)check(old.requestHash===hash(r),'IDEMPOTENCY_CONFLICT');
        if(!old)await tx.put('audits',key,{auditId:key,action,teacherId:o.teacherId,orderId:o.orderId,operator,reason:r.reason,requestHash:hash(r),evidenceHash:hash(response),state,code,createdAt:clock()});
        if(['review','refund_review'].includes(state)){const latest=await tx.get('orders',o.orderId);if(!latest.refund){latest.reviewRequired='PLATFORM_REFUND_REQUIRES_REVIEW';await tx.put('orders',o.orderId,latest);}}
      });
      return {orderId:o.orderId,state,code,evidenceHash:hash(response)};
    }
    if(action==='confirmPaidAndGrant'){
      check(!o.refund&&o.paymentStatus!=='refunded','ORDER_NOT_REVIEWABLE');
      // Fresh official cash/balance check prevents stale paid evidence after refund.
      const current=queryCashEvidence(o,await api.query(o),clock()),candidate=o.review?.candidate||o.fact;
      check(candidate&&canonical(current)===canonical(candidate),'REVIEW_EVIDENCE_MISMATCH');
      return engine.confirmPaidAndGrant(o.orderId,null,{reference:id(r.reference)},r.reason);
    }
    const e=await evidence(id(r.reference),'official_refund');check(e.verification==='wechat_security_mode'&&e.orderId===o.orderId&&e.payload?.Event==='xpay_refund_notify'&&e.payload.MchOrderId===o.orderId,'REFUND_IDENTITY_MISMATCH');
    // This only consumes a final official fact. It never submits a refund request.
    try{
      const result=await engine.authenticatedEvent(e.payload);
      if(e.payload.RetCode!==0){const key=`refund_failed_${hash({orderId:o.orderId,reference:r.reference})}`;await repo.transaction(async tx=>{if(!await tx.get('audits',key))await tx.put('audits',key,{auditId:key,action:'refund_failed',teacherId:o.teacherId,orderId:o.orderId,operator,reason:r.reason,evidenceHash:hash(e.payload),createdAt:clock()});});}
      return result;
    }
    catch(error){
      const code=/^[A-Z_]+$/.test(error.message)?error.message:'REFUND_REQUIRES_REVIEW';
      await repo.transaction(async tx=>{const key=`refund_review_${hash({orderId:o.orderId,requestId:r.requestId})}`;if(!await tx.get('audits',key))await tx.put('audits',key,{auditId:key,action:'refund_review',teacherId:o.teacherId,orderId:o.orderId,operator,reason:r.reason,code,evidenceHash:hash(e.payload),createdAt:clock()});const latest=await tx.get('orders',o.orderId);if(!latest.refund){latest.reviewRequired='PLATFORM_REFUND_REQUIRES_REVIEW';await tx.put('orders',o.orderId,latest);}});
      return {state:'review',code};
    }
  }
  return async event=>{
    const who=await authenticate(event);
    // Record all authenticated reads and attempted writes before execution. A
    // missing audit collection fails closed; mutation audits remain atomic below.
    const auditId=`invocation_${require('node:crypto').randomUUID()}`;
    const audit={auditId,action:`invoke_${who.action}`,operator:who.operator,requestHash:hash(who.request),createdAt:clock(),state:'started'};
    await repo.transaction(tx=>tx.put('audits',auditId,audit));
    try{const result=await execute(who);await repo.transaction(tx=>tx.put('audits',auditId,{...audit,state:'completed'}));return result;}
    catch(error){await repo.transaction(tx=>tx.put('audits',auditId,{...audit,state:'failed',code:/^[A-Z_]+$/.test(error.message)?error.message:'OPERATION_FAILED'}));throw error;}
  };
}
module.exports={createOpsRuntime,configuration,APP_ID,ENV_ID};
