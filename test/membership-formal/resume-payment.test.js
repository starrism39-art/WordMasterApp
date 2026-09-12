'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const client=require('../../utils/membership-ui-client');
const {models}=require('../membership-final-b/fixtures');
function setup({platform='android',allowed=true,invocation=true}={}){
 const calls=[];let payments=0;
 global.getApp=()=>({globalData:{cloudReadOnly:false}});
 global.wx={getStorageSync:()=> 'resume_test_teacher',getDeviceInfo:()=>({platform}),login:({success})=>success({code:'new_login_code'}),requestVirtualPayment:({fail})=>{payments++;fail({errMsg:'cancel'});},cloud:{callFunction:async options=>{
  const {action,request}=options.data;calls.push({action,request});
  if(action==='createOrder')throw Error('SECOND_ORDER_FORBIDDEN');
  const result=action==='getDisplay'?{...models().free,canPurchase:false,canRenew:false,awaitingPayment:true,canResumePayment:allowed,resumeOrderId:allowed?'existing_formal_order':'',pending:false}:action==='parameters'?{paymentInvocationAllowed:invocation,mode:'short_series_goods',signData:'fixed_server_sign_data',paySig:'signed',signature:'signed'}:{paymentStatus:'awaiting_payment',grantStatus:'none'};
  return {result:{ok:true,result}};
 }}};
 return {calls,payments:()=>payments};
}
test('resume uses existing order, fresh login and single invocation without createOrder',async()=>{const s=setup();await Promise.all([client.purchase('request_a'),client.purchase('request_b')]);assert.equal(s.calls.filter(x=>x.action==='createOrder').length,0);assert.deepEqual(s.calls.find(x=>x.action==='parameters').request,{orderId:'existing_formal_order',loginCode:'new_login_code',platform:'android'});assert.equal(s.payments(),1);});
test('preparation alone does not invoke real payment',async()=>{const s=setup({invocation:false});const r=await client.purchase('prepare');assert.equal(r.status,'prepared');assert.equal(s.payments(),0);});
test('closed gate and unsupported channels do not create orders or invoke payment',async()=>{for(const platform of ['android','ios','windows','ohos','harmony','unknown']){const s=setup({platform,allowed:false});await assert.rejects(client.purchase('blocked'));assert.equal(s.payments(),0);assert.equal(s.calls.some(x=>x.action==='parameters'||x.action==='createOrder'),false);}});
