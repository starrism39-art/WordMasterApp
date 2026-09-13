'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture,BASE,encrypt,cryptoConfig,APP_ID,hmac}=require('./fixtures');
const {createNotificationRouter}=require('../../cloudfunctions/membership-formal/notification-router');
const {hash}=require('../../cloudfunctions/membership-payment/crypto');
async function setup(){
  const f=fixture({iosTeacher:'teacher',iosPaymentEnabled:true,iosPlatformReady:true,iosExpiresAt:BASE+3600000,iosAttemptRetriesEnabled:true});
  const order=await f.call('createOrder',{requestId:'routing_business',platform:'ios'});f.state.clock=BASE+120000;
  const originalQuery=f.api.query;f.api.query=async o=>{const r=await originalQuery(o);r.order.status=o.orderId===order.orderId?1:3;r.order.paid_time=f.state.clock/1000;return r;};
  const p=await f.call('parameters',{orderId:order.orderId,loginCode:'route_login',platform:'ios'}),attemptId=JSON.parse(p.signData).outTradeNo;
  let legacyCalls=0;
  const router=createNotificationRouter({formal:f.runtime,legacy:async()=>{legacyCalls++;return {statusCode:503,body:'legacy'};},environment:f.environment});
  const event={...await f.event(order.orderId),OutTradeNo:attemptId};
  const envelope=e=>{const r=encrypt(e,{...cryptoConfig,appId:APP_ID});return {httpMethod:'POST',body:r.body,queryStringParameters:r.query};};
  const compensate=nonce=>{const body=JSON.stringify({reviewOrderIds:[attemptId],limit:1}),timestamp=f.state.clock,signature=hmac(f.environment.MEMBERSHIP_INTERNAL_KEY,`${timestamp}\n${nonce}\n${body}`);return f.runtime.compensate({body,timestamp,nonce,signature});};
  return {...f,order,attemptId,event,envelope,router,compensate,legacyCalls:()=>legacyCalls};
}
test('real HTTP router resolves attempt index, recovers reviewed payment and archives replayable ciphertext',async()=>{
  const f=await setup();await f.call('queryOrder',{orderId:f.attemptId});
  assert.equal((await f.repo.get('orders',f.order.orderId)).reviewRequired,'PRODUCT_EVIDENCE_REQUIRED');
  const request=f.envelope(f.event);for(let i=0;i<2;i++)assert.equal((await f.router(request)).statusCode,200);
  assert.equal(f.legacyCalls(),0);assert.equal((await f.repo.get('ledgers','teacher')).grants.length,1);
  const rows=[...f.sdk.rows.values()].filter(r=>r.kind==='ios_authenticated_callback');assert.equal(rows.length,1);
  assert.equal(rows[0].attemptId,f.attemptId);assert.equal(rows[0].orderId,f.order.orderId);assert.equal(rows[0].request.body,request.body);
  assert.equal((await f.repo.get('orders',f.order.orderId)).grantStatus,'granted');
});
test('attempt query and signed targeted compensation keep the original business grant and do not sweep other jobs',async()=>{
  const f=await setup();await f.router(f.envelope(f.event));
  f.sdk.seed('work','unrelated',{orderId:'unrelated',purchaseDomain:'formal_android_v1',state:'pending',nextAt:0});
  for(let i=0;i<2;i++){
    const view=await f.call('queryOrder',{orderId:f.attemptId});assert.equal(view.orderId,f.order.orderId);assert.equal(view.grantStatus,'granted');
    const r=await f.compensate('routing_compensation_'+i);assert.equal(r.reviews[0].grantStatus,'granted');assert.deepEqual(r.compensation,[]);
  }
  const grants=(await f.repo.get('ledgers','teacher')).grants;assert.equal(grants.length,1);assert.equal(grants[0].sourceId,'payment_'+f.order.orderId);
  assert.equal((await f.repo.get('work','unrelated')).nextAt,0);
});
test('a corrupt cross-teacher attempt index is rejected before any official query',async()=>{
  const f=await setup(),key='ios_attempt_'+hash(f.attemptId);
  await f.repo.transaction(async tx=>{const r=await tx.get('intents',key);r.teacherId='other';await tx.put('intents',key,r);});
  const calls=f.state.queryCalls;await assert.rejects(f.call('queryOrder',{orderId:f.attemptId}),/IOS_ATTEMPT_INDEX_MISMATCH/);
  assert.equal((await f.router(f.envelope(f.event))).statusCode,503);assert.equal(f.state.queryCalls,calls);assert.equal(f.legacyCalls(),0);
});
test('unknown orders retain legacy routing; a tampered signature never routes or grants',async()=>{
  const f=await setup();assert.equal((await f.router(f.envelope({...f.event,OutTradeNo:'unknown'}))).body,'legacy');
  const bad=f.envelope(f.event);bad.queryStringParameters.msg_signature='bad';assert.equal((await f.router(bad)).statusCode,503);
  assert.equal(f.legacyCalls(),1);assert.equal((await f.repo.get('ledgers','teacher')).grants.length,0);
});
test('routing fixes never treat the superseded unpaid attempt as payment evidence',async()=>{
  const f=await setup();const oldEvent={...f.event,OutTradeNo:f.order.orderId};assert.equal((await f.router(f.envelope(oldEvent))).statusCode,503);
  assert.equal((await f.repo.get('ledgers','teacher')).grants.length,0);
  assert.equal((await f.router(f.envelope(f.event))).statusCode,200);
  const o=await f.repo.get('orders',f.order.orderId);assert.equal(o.iosWinningAttemptId,f.attemptId);assert.equal(o.iosAttempts[0].state,'superseded');assert.equal(o.iosAttempts[0].cash,undefined);
});
