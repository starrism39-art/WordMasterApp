'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture,BASE,encrypt,cryptoConfig,APP_ID,hmac}=require('./fixtures');
async function setup(){
  const f=fixture({iosTeacher:'teacher',iosPaymentEnabled:true,iosPlatformReady:true,iosExpiresAt:BASE+3600000,iosAttemptRetriesEnabled:true});
  const order=await f.call('createOrder',{requestId:'one_business_order',platform:'ios'});
  const states=new Map(),queries=[],signed=[];
  f.api.query=async o=>{queries.push(o.orderId);const patch=states.get(o.orderId)||{status:1};if(patch.error)throw Error(patch.error);
    return {errcode:0,order:{order_id:o.orderId,order_type:7,env_type:1,order_fee:39900,paid_fee:39900,left_fee:39900,wx_order_id:'tx_'+o.orderId,paid_time:f.state.clock/1000,...patch}};
  };
  f.api.parameters=async o=>{signed.push(o.orderId);return {mode:'short_series_goods',signData:o.signData,paySig:'LOCAL',signature:'LOCAL'};};
  f.state.clock=BASE+120000;
  const parameters=(code='login_one')=>f.call('parameters',{orderId:order.orderId,loginCode:code,platform:'ios'});
  const row=()=>f.repo.get('orders',order.orderId);
  const notify=async(attemptId,changes={})=>{
    const event={...await f.event(order.orderId),OutTradeNo:attemptId,...changes};
    return f.runtime.notification(encrypt(event,{...cryptoConfig,appId:APP_ID}));
  };
  return {...f,order,states,queries,signed,parameters,row,notify};
}
test('continue retains one business order; old pending attempt is audited and attempt 2 is unique',async()=>{
  const f=await setup(),before=await f.row(),p=await f.parameters(),s=JSON.parse(p.signData),o=await f.row();
  assert.equal(p.paymentInvocationAllowed,true);assert.notEqual(s.outTradeNo,o.orderId);assert.match(s.outTradeNo,/^wi[0-9a-f]{30}$/);
  assert.equal(o.iosAttempts.length,2);assert.equal(o.iosAttempts[0].state,'superseded');assert.equal(o.iosAttempts[0].platformStatus,1);
  assert.equal(o.iosActiveAttemptId,s.outTradeNo);assert.equal(o.iosAttempts.filter(a=>a.state==='active').length,1);
  assert.deepEqual(JSON.parse(before.signData),{...s,outTradeNo:before.orderId});
  assert.deepEqual(o.productSnapshot,before.productSnapshot);assert.equal(o.teacherId,before.teacherId);
  assert.equal([...f.sdk.rows.keys()].filter(k=>k.startsWith('membership_orders/')).length,1);
  assert.deepEqual(f.queries,[o.orderId]);assert.equal((await f.repo.get('ledgers','teacher')).grants.length,0);
});
test('concurrent continues and fast repeats sign only one new attempt',async()=>{
  const f=await setup(),r=await Promise.allSettled([f.parameters('one'),f.parameters('two')]);
  assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(f.signed.length,1);assert.equal((await f.row()).iosAttempts.length,2);
  await assert.rejects(f.parameters('three'),/IOS_PAYMENT_IN_PROGRESS/);assert.equal(f.signed.length,1);
});
test('unknown query, wrong channel, amount or environment never creates a replacement',async()=>{
  for(const patch of [{error:'PLATFORM_TRANSPORT_FAILED'},{order_type:0},{env_type:2},{status:2,paid_fee:1}]){
    const f=await setup();f.states.set(f.order.orderId,patch);await assert.rejects(f.parameters());
    assert.equal((await f.row()).iosAttempts.length,1);assert.equal(f.signed.length,0);
  }
});
test('all attempts are queried before another continuation, including superseded attempts',async()=>{
  const f=await setup();await f.parameters();const a2=(await f.row()).iosActiveAttemptId;
  f.state.clock+=61000;f.queries.length=0;await f.parameters('second_click');
  assert.deepEqual(f.queries.sort(),[f.order.orderId,a2].sort());
  assert.equal((await f.row()).iosAttempts.length,3);assert.equal((await f.row()).iosAttempts.filter(a=>a.state==='active').length,1);
});
test('any paid attempt blocks replacement; authenticated goods restores exactly one business grant',async()=>{
  const f=await setup();await f.parameters();const a2=(await f.row()).iosActiveAttemptId;
  f.states.set(f.order.orderId,{status:2});assert.equal((await f.notify(f.order.orderId)).statusCode,200);
  const p=await f.parameters('after_paid');assert.equal(p.paymentInvocationAllowed,false);assert.equal(f.signed.length,1);
  assert.equal((await f.row()).iosWinningAttemptId,f.order.orderId);assert.equal((await f.row()).iosActiveAttemptId,null);
  assert.equal((await f.row()).iosAttempts.length,2);assert.notEqual(a2,f.order.orderId);
  assert.equal((await f.repo.get('ledgers','teacher')).grants.length,1);
});
test('attempt 2 payment wins, old late payment enters duplicate review without another grant',async()=>{
  const f=await setup();await f.parameters();const a2=(await f.row()).iosActiveAttemptId;
  f.states.set(a2,{status:2});assert.equal((await f.notify(a2)).statusCode,200);
  const grant=(await f.repo.get('ledgers','teacher')).grants[0];assert.equal(grant.sourceId,'payment_'+f.order.orderId);
  assert.equal((await f.notify(a2)).statusCode,200);
  f.states.set(f.order.orderId,{status:2});assert.equal((await f.notify(f.order.orderId)).statusCode,200);
  const o=await f.row();assert.equal(o.iosWinningAttemptId,a2);assert.equal(o.iosDuplicatePaymentReviewRequired,true);
  assert.equal(o.iosAttempts[0].duplicatePaymentReview.state,'manual_refund_review');
  assert.deepEqual((await f.repo.get('ledgers','teacher')).grants,[grant]);
  assert.ok([...f.sdk.rows.values()].some(x=>x.code==='IOS_DUPLICATE_PAYMENT'&&x.state==='review_required'));
});
test('paid query without product evidence holds review, never signs or grants on status alone',async()=>{
  const f=await setup();f.states.set(f.order.orderId,{status:2});const p=await f.parameters();
  assert.equal(p.paymentInvocationAllowed,false);assert.equal(f.signed.length,0);
  assert.equal((await f.row()).reviewRequired,'PRODUCT_EVIDENCE_REQUIRED');
  assert.equal((await f.repo.get('ledgers','teacher')).grants.length,0);
  assert.equal((await f.notify(f.order.orderId)).statusCode,200);assert.equal((await f.repo.get('ledgers','teacher')).grants.length,1);
});
test('duplicate payment refund does not revoke winning entitlement; winner refund does',async()=>{
  const f=await setup();await f.parameters();const a2=(await f.row()).iosActiveAttemptId;
  f.states.set(a2,{status:2});await f.notify(a2);f.states.set(f.order.orderId,{status:2});await f.notify(f.order.orderId);
  const refund=async attemptId=>f.runtime.notification(encrypt({...await f.refundEvent(f.order.orderId),MchOrderId:attemptId,WxOrderId:'tx_'+attemptId,WxRefundId:'refund_'+attemptId},{...cryptoConfig,appId:APP_ID}));
  assert.equal((await refund(f.order.orderId)).statusCode,200);assert.equal((await f.repo.get('ledgers','teacher')).grants.length,1);
  assert.equal((await f.row()).grantStatus,'granted');assert.equal((await refund(a2)).statusCode,200);
  assert.equal((await f.row()).grantStatus,'revoked');assert.equal((await f.repo.get('ledgers','teacher')).grants.length,2);
  assert.equal((await f.repo.get('work',f.order.orderId)).state,'pending');
});
test('notification identity/product mismatch and unindexed attempts never grant',async()=>{
  const f=await setup();await f.parameters();const a2=(await f.row()).iosActiveAttemptId;f.states.set(a2,{status:2});
  for(const changes of [{OpenId:'other'},{ToUserName:'gh_wrong'},{GoodsInfo:{ProductId:'TEST_teacher_12m_a'}}])assert.notEqual((await f.notify(a2,changes)).statusCode,200);
  assert.notEqual((await f.notify('wi_unknown')).statusCode,200);assert.equal((await f.repo.get('ledgers','teacher')).grants.length,0);
});
test('expired gates block signing but compensation still finds a superseded late payment',async()=>{
  const f=await setup();await f.parameters();const a2=(await f.row()).iosActiveAttemptId;f.states.set(a2,{status:2,paid_time:f.state.clock/1000});await f.notify(a2);
  f.state.clock=BASE+3600000;await assert.rejects(f.parameters('expired'),/FORMAL_PURCHASE_NOT_RELEASED/);
  f.states.set(f.order.orderId,{status:2,paid_time:f.state.clock/1000});
  const body=JSON.stringify({limit:5}),timestamp=f.state.clock,nonce='attempt_compensation_local',signature=hmac(f.environment.MEMBERSHIP_INTERNAL_KEY,`${timestamp}\n${nonce}\n${body}`);
  await f.runtime.compensate({body,timestamp,nonce,signature});
  assert.equal((await f.row()).iosDuplicatePaymentReviewRequired,true);assert.equal((await f.repo.get('ledgers','teacher')).grants.length,1);
  assert.equal((await f.repo.get('work',f.order.orderId)).state,'pending');
});
test('simultaneously paid callbacks converge to one grant and one duplicate review',async()=>{
  const f=await setup();await f.parameters();const a2=(await f.row()).iosActiveAttemptId;
  f.states.set(f.order.orderId,{status:2});f.states.set(a2,{status:2});
  await Promise.all([f.notify(f.order.orderId),f.notify(a2)]);
  for(const a of [f.order.orderId,a2])assert.equal((await f.notify(a)).statusCode,200);
  assert.equal((await f.repo.get('ledgers','teacher')).grants.length,1);assert.equal((await f.row()).iosActiveAttemptId,null);
  assert.equal((await f.row()).iosAttempts.filter(a=>a.duplicatePaymentReview).length,1);
});
test('an authenticated refund before a paid query cannot resurrect that attempt',async()=>{
  const f=await setup();await f.parameters();
  const event=await f.refundEvent(f.order.orderId);
  assert.equal((await f.runtime.notification(encrypt(event,{...cryptoConfig,appId:APP_ID}))).statusCode,200);
  f.states.set(f.order.orderId,{status:2});await f.notify(f.order.orderId);
  assert.equal((await f.repo.get('ledgers','teacher')).grants.length,0);assert.equal((await f.row()).iosWinningAttemptId,undefined);
});
test('an old attempt goods envelope cannot authorize a different paid attempt',async()=>{
  const f=await setup();await f.parameters();const a2=(await f.row()).iosActiveAttemptId;
  const old=await f.event(f.order.orderId);
  const goods=require('../../cloudfunctions/membership-payment/protocol').goodsEvidence(await f.row(),old);
  await f.repo.transaction(async tx=>{const o=await tx.get('orders',f.order.orderId);o.goods=goods;await tx.put('orders',o.orderId,o);});
  f.states.set(a2,{status:2});await f.call('queryOrder',{orderId:f.order.orderId});
  assert.equal((await f.repo.get('ledgers','teacher')).grants.length,0);assert.equal((await f.row()).reviewRequired,'PRODUCT_EVIDENCE_REQUIRED');
  assert.equal((await f.notify(a2)).statusCode,200);assert.equal((await f.repo.get('ledgers','teacher')).grants.length,1);
});
