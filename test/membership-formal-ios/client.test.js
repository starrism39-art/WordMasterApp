'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const client=require('../../utils/membership-ui-client');
const {models}=require('../membership-final-b/fixtures');
function setup({allowed=true,invocation=false}={}){
 const calls=[];let payments=0;
 global.getApp=()=>({globalData:{cloudReadOnly:false}});
 global.wx={getStorageSync:()=> 'ios_fixture',getDeviceInfo:()=>({platform:'ios'}),login:({success})=>success({code:'fresh_code'}),requestVirtualPayment:({success})=>{payments++;success();},cloud:{callFunction:async options=>{
  const {action,request}=options.data;calls.push({action,request});
  if(action==='createOrder')throw Error('SECOND_ORDER_FORBIDDEN');
  const result=action==='getDisplay'?{...models().free,iosPurchaseAllowed:allowed,canPurchase:false,canRenew:false,awaitingPayment:true,canResumePayment:allowed,resumeOrderId:allowed?'existing_ios_order':'',pending:false}:action==='parameters'?{paymentInvocationAllowed:invocation,mode:'short_series_goods',signData:'server_data',paySig:'synthetic',signature:'synthetic'}:{paymentStatus:'awaiting_payment',grantStatus:'none'};
  return {result:{ok:true,result}};
 }}};
 return {calls,payments:()=>payments};
}
test('controlled iOS preparation/resume forwards platform and fresh login, never creates a second order',async()=>{
 const s=setup();assert.equal((await client.purchase('ios_request')).status,'prepared');assert.equal(s.payments(),0);
 assert.deepEqual(s.calls.find(c=>c.action==='parameters').request,{orderId:'existing_ios_order',loginCode:'fresh_code',platform:'ios'});
 assert.equal(s.calls.some(c=>c.action==='createOrder'),false);
});
test('ordinary iOS never reaches parameters or payment',async()=>{
 const s=setup({allowed:false,invocation:true});await assert.rejects(client.purchase('ordinary'),/PURCHASE_DISABLED/);
 assert.equal(s.payments(),0);assert.deepEqual(s.calls.map(c=>c.action),['getDisplay']);
});
test('authorized iOS client success still waits for server fact and one in-flight invocation',async()=>{
 const s=setup({invocation:true});const results=await Promise.all([client.purchase('one'),client.purchase('two')]);
 assert.equal(s.payments(),1);assert.equal(results[0].status,'processing');assert.equal(results[1].status,'processing');
 assert.equal(s.calls.filter(c=>c.action==='queryOrder').length,1);
});
