'use strict';
const {strictKeys,id}=require('../membership-core/model');
const {check}=require('../membership-payment/protocol');
const {createPaymentEngine}=require('../membership-payment/engine');
const {createWechatApi}=require('../membership-payment/wechat-api');
const {credentialProviders,internalHandler}=require('../membership-payment/runtime');
const {createTeacherIdentity}=require('../membership-payment/identity');
const {createNotificationHandler}=require('../membership-payment/handlers');
const {rebuildAccount}=require('../membership-core/ledger');
const {configuration,buyer,ready,mayPrepare}=require('./policy');
const {createFormalRepository}=require('./repository');
function createFormalRuntime({db,wxCloud,environment={},clock=Date.now,api:injectedApi,repository:injectedRepository}){
  const config=configuration(environment),repository=injectedRepository||createFormalRepository(db,config,{clock});
  const credentials=credentialProviders(environment,{appId:config.appId,clock});
  const api=injectedApi||require('./delivery').withConfirmedDelivery(createWechatApi({...credentials}),{clock});
  const identity=createTeacherIdentity({db,wxCloud,appId:config.appId});
  function engine(who,enabled=false){return createPaymentEngine({repository,api,clock,config:{...config,purchaseEnabled:enabled},getIdentity:async()=>who});}
  return {config,repository,
    canPrepare:(teacherId,platform)=>config.ordersReady&&mayPrepare(config,teacherId,platform),
    async orders(event){
      strictKeys(event,['action','request','userInfo','tcbContext']);
      const allowed={createOrder:['requestId','platform'],parameters:['orderId','loginCode','platform'],queryOrder:['orderId']};
      check(allowed[event.action],'ACTION_NOT_ALLOWED');const r=event.request||{};strictKeys(r,allowed[event.action]);
      const context=wxCloud.getWXContext();check(['wx_client','wx_devtools'].includes(context?.SOURCE||'wx_client'),'IDENTITY_NOT_VERIFIED');
      // No database or platform calls for an ordinary caller while purchase is closed.
      if(event.action!=='queryOrder')buyer(config,context?.OPENID,r.platform);
      const who=await identity();const payment=engine(who,event.action!=='queryOrder');
      if(event.action==='queryOrder'){
        ready(config);await payment.queryOrder({orderId:r.orderId});
        // Ownership is checked before the official query or any write.
        await payment.reconcile(r.orderId);return payment.queryOrder({orderId:r.orderId});
      }
      if(!injectedApi){await credentials.getAppKey(0);await credentials.getAppSecret();}
      const row=await repository.get('ledgers',who.teacherId);check(row,'FORMAL_LEDGER_NOT_READY');
      check(rebuildAccount(who.teacherId,row.grants,row.access,clock()).status!=='long_term','LONG_TERM_PURCHASE_DISABLED');
      if(event.action==='createOrder')return payment.createOrder({requestId:r.requestId,productId:config.allowedProductId});
      const parameters=await payment.parameters({orderId:id(r.orderId),loginCode:r.loginCode});
      // Preparation can never authorize the client to launch a real payment.
      return {...parameters,paymentInvocationAllowed:config.formalPurchaseEnabled===true||(config.controlledPaymentEnabled===true&&config.controlledTeachers.includes(who.teacherId))};
    },
    async notification(request){
      try{ready(config);return await createNotificationHandler({config:{...config,...credentials.notification()},engine:{authenticatedEvent:async event=>{
        const orderId=event?.OutTradeNo||event?.MchOrderId;check(await repository.get('orders',id(orderId)),'FORMAL_ORDER_REQUIRED');
        return engine(null).authenticatedEvent(event);
      }}})(request);}catch{return {statusCode:503,body:'retry'};}
    },
    async compensate(event){
      ready(config);
      const request=event?.Type==='Timer'?require('./timer').timerRequest({event,context:wxCloud.getWXContext(),environment,config,clock}):event;
      return internalHandler({engine:engine(null),repository,credentials,clock})(request);
    }
  };
}
module.exports={createFormalRuntime};
