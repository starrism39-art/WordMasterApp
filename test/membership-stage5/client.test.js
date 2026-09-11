'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createStage5PaymentClient } = require('../../utils/membership-stage5-client');
const { invalidateAccountSession } = require('../../utils/account-session');
function setup(options={}) {
  const state={account:'LOCAL_A',calls:[],launches:0,logins:0};
  global.wx={getStorageSync:()=>state.account}; invalidateAccountSession();
  const api={cloud:{async callFunction(arg){
    state.calls.push(arg);options.onCall?.(arg,state);
    if(options.reject)throw new Error(options.error || 'STAGE5_PURCHASE_DISABLED');
    const action=arg.data.action;
    if(action==='parameters')return {result:{mode:'short_series_goods',signData:'LOCAL_SIGN_DATA',paySig:'LOCAL_PAY_SIG',signature:'LOCAL_SIGNATURE'}};
    return {result:{orderId:'LOCAL_ORDER',paymentStatus:'awaiting_payment',grantStatus:'none'}};
  }},login({success}){state.logins++;success({code:'LOCAL_LOGIN_CODE'});},requestVirtualPayment(p){state.launches++;p.fail({errMsg:'cancel'});}};
  return {state,client:createStage5PaymentClient(api)};
}
test('construction does not call cloud or payment',()=>{const {state}=setup();assert.equal(state.calls.length,0);assert.equal(state.launches,0);});
test('fixed cloud routing, login code and signed parameters use normal flow',async()=>{
  const {client,state}=setup();assert.equal((await client.purchase({requestId:'LOCAL_INTENT'})).status,'cancelled');
  assert.deepEqual(state.calls.map(x=>x.data.action),['createOrder','parameters','queryOrder']);
  for(const call of state.calls){assert.equal(call.name,'stage5_orders');assert.deepEqual(call.config,{env:'cloudbase-4gafzdch60ad597b'});}
  assert.deepEqual(state.calls[0].data.request,{productId:'TEST_teacher_12m_a',requestId:'LOCAL_INTENT'});
  assert.deepEqual(state.calls[1].data.request,{orderId:'LOCAL_ORDER',loginCode:'LOCAL_LOGIN_CODE'});
});
test('purchase closure stops before login or payment',async()=>{const {client,state}=setup({reject:true});assert.equal((await client.purchase({requestId:'LOCAL_INTENT'})).status,'unknown');assert.equal(state.logins,0);assert.equal(state.launches,0);});
test('request cannot select teacher, environment, collection, batch or product',async()=>{
  const {client,state}=setup();for(const field of ['teacherId','openid','env','collection','batch','productId'])await assert.rejects(client.purchase({requestId:'LOCAL_INTENT',[field]:'forged'}),/INVALID_REQUEST/);assert.equal(state.calls.length,0);
});
test('query only sends order id and propagates ownership denial',async()=>{
  const {client,state}=setup({reject:true,error:'ORDER_NOT_OWNED'});await assert.rejects(client.queryOrder({orderId:'LOCAL_OTHER'}),/ORDER_NOT_OWNED/);
  assert.deepEqual(state.calls[0].data,{action:'queryOrder',request:{orderId:'LOCAL_OTHER'}});
  await assert.rejects(client.queryOrder({orderId:'LOCAL_OTHER',teacherId:'LOCAL_OTHER'}),/INVALID_REQUEST/);
});
test('A to B to A invalidation before parameters prevents payment',async()=>{
  const {client,state}=setup({onCall(arg,s){if(arg.data.action==='parameters'){s.account='LOCAL_B';invalidateAccountSession();s.account='LOCAL_A';invalidateAccountSession();}}});
  assert.equal((await client.purchase({requestId:'LOCAL_INTENT'})).status,'account_changed');assert.equal(state.launches,0);
});
test('query result is rejected after account generation changes',async()=>{
  const {client}=setup({onCall(){invalidateAccountSession();}});await assert.rejects(client.queryOrder({orderId:'LOCAL_ORDER'}),/ACCOUNT_CHANGED/);
});
test('missing local login is rejected before cloud call',async()=>{
  const {client,state}=setup();state.account='';await assert.rejects(client.purchase({requestId:'LOCAL_INTENT'}),/LOGIN_REQUIRED/);assert.equal(state.calls.length,0);
});
