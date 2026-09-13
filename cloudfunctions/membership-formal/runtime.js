'use strict';
const {strictKeys,id}=require('../membership-core/model');
const {check}=require('../membership-payment/protocol');
const {createPaymentEngine}=require('../membership-payment/engine');
const {createWechatApi}=require('../membership-payment/wechat-api');
const {credentialProviders,internalHandler}=require('../membership-payment/runtime');
const {createTeacherIdentity}=require('../membership-payment/identity');
const {createNotificationHandler}=require('../membership-payment/handlers');
const {rebuildAccount}=require('../membership-core/ledger');
const {configuration,buyer,ready,mayPrepare,mayPay}=require('./policy');
const {forIos}=require('./ios-repository');
const {createFormalRepository}=require('./repository');
function createFormalRuntime({db,wxCloud,environment={},clock=Date.now,api:injectedApi,repository:injectedRepository}){
  const config=configuration(environment),repository=injectedRepository||createFormalRepository(db,config,{clock});
  const credentials=credentialProviders(environment,{appId:config.appId,clock});
  const platformApi=injectedApi||require('./delivery').withConfirmedDelivery(createWechatApi({...credentials}),{clock});
  const attempts=require('./ios-attempts').createIosAttempts({repository,api:platformApi,clock});
  const api=attempts.api;
  const identity=createTeacherIdentity({db,wxCloud,appId:config.appId});
  function engine(who,enabled=false,platform){
    const selected=platform==='ios'?forIos(repository):repository;
    const payment=createPaymentEngine({repository:{...selected,async due(now,limit){
      const jobs=await selected.due(now,limit),legacy=[];
      for(const job of jobs)if(!(await selected.get('orders',job.orderId)).iosAttempts)legacy.push(job);
      return legacy;
    }},api,clock,config:{...config,purchaseEnabled:enabled},getIdentity:async()=>who});
    return {...payment,reconcile:(orderId,options)=>attempts.reconcile(payment,orderId,options),
      authenticatedEvent:event=>attempts.notification(payment,event),
      async compensate({limit=20}={}){
        check(Number.isInteger(limit)&&limit>0&&limit<=50,'INVALID_BATCH');
        const jobs=await repository.due(clock(),limit),iosJobs=[];
        for(const job of jobs)if((await repository.get('orders',job.orderId)).iosAttempts)iosJobs.push(job);
        return [...await attempts.compensate(payment,iosJobs),...await payment.compensate({limit})];
      }};
  }
  return {config,repository,
    canPrepare:(teacherId,platform)=>config.ordersReady&&mayPrepare(config,teacherId,platform,clock()),
    async orders(event){
      strictKeys(event,['action','request','userInfo','tcbContext']);
      const allowed={createOrder:['requestId','platform'],parameters:['orderId','loginCode','platform'],queryOrder:['orderId']};
      check(allowed[event.action],'ACTION_NOT_ALLOWED');const r=event.request||{};strictKeys(r,allowed[event.action]);
      const context=wxCloud.getWXContext();check(['wx_client','wx_devtools'].includes(context?.SOURCE||'wx_client'),'IDENTITY_NOT_VERIFIED');
      // No database or platform calls for an ordinary caller while purchase is closed.
      if(event.action!=='queryOrder')buyer(config,context?.OPENID,r.platform,clock());
      const who=await identity();const payment=engine(who,event.action!=='queryOrder',r.platform);
      if(event.action==='queryOrder'){
        ready(config);const order=await attempts.resolve(r.orderId);check(order,'UNKNOWN_ORDER');
        await payment.queryOrder({orderId:order.orderId});
        // Ownership is checked before the official query or any write.
        await payment.reconcile(order.orderId);return payment.queryOrder({orderId:order.orderId});
      }
      if(!injectedApi){await credentials.getAppKey(0);await credentials.getAppSecret();}
      const row=await repository.get('ledgers',who.teacherId);check(row,'FORMAL_LEDGER_NOT_READY');
      check(rebuildAccount(who.teacherId,row.grants,row.access,clock()).status!=='long_term','LONG_TERM_PURCHASE_DISABLED');
      if(event.action==='createOrder'){
        const created=await payment.createOrder({requestId:r.requestId,productId:config.allowedProductId});
        const order=await repository.get('orders',created.orderId);
        check(order.channel===(r.platform==='ios'?'apple_iap':'wechat'),'FORMAL_ORDER_CHANNEL_MISMATCH');
        return created;
      }
      const order=await repository.get('orders',id(r.orderId));
      check(order&&order.channel===(r.platform==='ios'?'apple_iap':'wechat'),'FORMAL_ORDER_CHANNEL_MISMATCH');
      // Verify ownership before any platform query or attempt mutation.
      await payment.queryOrder({orderId:r.orderId});
      if(r.platform==='ios'&&config.iosAttemptRetriesEnabled){
        check(mayPay(config,who.teacherId,r.platform,clock()),'FORMAL_PURCHASE_NOT_RELEASED');
        const prepared=await attempts.prepare(r.orderId,r.loginCode);
        if(prepared.paid){await payment.reconcile(r.orderId);return {paymentInvocationAllowed:false};}
      }
      const parameters=await payment.parameters({orderId:id(r.orderId),loginCode:r.loginCode});
      // Preparation can never authorize the client to launch a real payment.
      return {...parameters,paymentInvocationAllowed:mayPay(config,who.teacherId,r.platform,clock())};
    },
    async notification(request){
      try{ready(config);return await createNotificationHandler({config:{...config,...credentials.notification()},engine:{authenticatedEvent:async event=>{
        check(event?.ToUserName===config.originalId&&event.MsgType==='event','WRONG_APPLICATION');
        return engine(null).authenticatedEvent(event);
      }}})(request);}catch{return {statusCode:503,body:'retry'};}
    },
    async compensate(event){
      ready(config);
      const request=event?.Type==='Timer'?require('./timer').timerRequest({event,context:wxCloud.getWXContext(),environment,config,clock}):event;
      const payment=engine(null);
      // Explicit signed review targets must not sweep unrelated due orders.
      // Authentication and request validation still run in internalHandler.
      const targeted=typeof request?.body==='string'&&Buffer.byteLength(request.body)<=4096&&Array.isArray(JSON.parse(request.body).reviewOrderIds);
      return internalHandler({engine:targeted?{...payment,compensate:async()=>[]}:payment,repository,credentials,clock})(request);
    }
  };
}
module.exports={createFormalRuntime};
