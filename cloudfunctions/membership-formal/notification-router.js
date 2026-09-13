'use strict';
const {decryptNotification}=require('../membership-payment/crypto');
const {credentialProviders}=require('../membership-payment/runtime');
const {httpRequest,makeMain}=require('../membership-stage5/runtime');
const {createFormalRuntime}=require('./runtime');
const {APP_ID,ENV_ID}=require('../membership-presentation/config');
const {resolveBusinessOrder}=require('./ios-attempts');
const {hash}=require('../membership-payment/crypto');
// Keep the existing official URL and sealed TEST runtime. Route only after
// authentication; a raw client product/domain field is never a routing input.
function createNotificationRouter({formal,legacy,environment}){
  return async event=>{
    if(!environment.MEMBERSHIP_FORMAL_CONFIG)return legacy(event);
    try{
      const request=httpRequest(event);
      if(request.method==='GET')return legacy(event);
      const fact=decryptNotification(request,{...formal.config,...credentialProviders(environment).notification()});
      const orderId=fact.OutTradeNo||fact.MchOrderId;
      if(typeof orderId!=='string')return {statusCode:503,body:'retry'};
      const order=await resolveBusinessOrder(formal.repository,orderId);
      if(order?.iosAttempts){
        // Archive the authenticated ciphertext for exact idempotency replay.
        // No plaintext buyer data, keys or session material is stored here.
        const key='ios_callback_'+hash(request.body);
        await formal.repository.transaction(async tx=>{
          if(!await tx.get('audits',key))await tx.put('audits',key,{kind:'ios_authenticated_callback',orderId:order.orderId,teacherId:order.teacherId,attemptId:orderId,eventType:fact.Event,request,receivedAt:Date.now()});
        });
      }
      return order?formal.notification(request):legacy(event);
    }catch{return {statusCode:503,body:'retry'};}
  };
}
function makeRouter(){
  const legacy=makeMain('payment_notify');
  return async event=>{
    if(!process.env.MEMBERSHIP_FORMAL_CONFIG)return legacy(event);
    const wxCloud=require('wx-server-sdk');wxCloud.init({env:ENV_ID});
    const db=require('@cloudbase/node-sdk').init({env:ENV_ID}).database();
    const formal=createFormalRuntime({db,wxCloud,environment:process.env});
    return createNotificationRouter({formal,legacy,environment:process.env})(event);
  };
}
module.exports={createNotificationRouter,makeRouter};
