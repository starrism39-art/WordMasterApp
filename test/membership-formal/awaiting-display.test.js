'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {row,order,ReadDb,NOW}=require('../membership-final-b/fixtures');
const {DEFAULTS,APP_ID}=require('../../cloudfunctions/membership-presentation/config');
const {orderModel}=require('../../cloudfunctions/membership-presentation/model');
const {createPresentationRuntime}=require('../../cloudfunctions/membership-presentation/runtime');
const awaiting=()=>order({paymentStatus:'awaiting_payment',grantStatus:'none',fact:undefined,grantId:undefined,platformProductId:'teacher_member_12m',productSnapshot:{...order().productSnapshot,productId:'teacher_member_12m'}});
test('unpaid preparation is stable waiting, not payment confirmation; order remains blocked',()=>{
 const model=orderModel(awaiting(),row('expired_selection'),DEFAULTS,NOW);
 assert.equal(model.pending,false);assert.equal(model.awaitingPayment,true);assert.equal(model.purchaseBlocked,true);assert.equal(model.statusText,'待付款（未确认扣款）');
});
test('existing unpaid order blocks another purchase even when preparation is enabled',async()=>{
 const db=new ReadDb(row('expired_selection'),[awaiting()]);
 const runtime=createPresentationRuntime({db,wxCloud:{getWXContext:()=>({APPID:APP_ID,OPENID:'teacher',SOURCE:'wx_client'})},clock:()=>NOW,environment:{MEMBERSHIP_FORMAL_CONFIG:JSON.stringify({ordersReady:true,controlledPreparationEnabled:true,controlledTeachers:['teacher']})}});
 const m=await runtime({action:'getDisplay',request:{platform:'android'}});
 assert.equal(m.pending,false);assert.equal(m.awaitingPayment,true);assert.equal(m.canPurchase,false);assert.equal(m.canRenew,false);assert.equal(m.canResumePayment,true);assert.equal(m.resumeOrderId,awaiting().orderId);assert.equal(m.purchaseLabel,'继续支付');assert.equal(db.writes,0);
});
test('verified but ungranted payment remains pending; paid and closed display unchanged',()=>{
 const pending=orderModel(order({grantStatus:'pending',grantId:undefined}),row('active'),DEFAULTS,NOW);assert.equal(pending.pending,true);
 const paid=orderModel(order(),row('active'),DEFAULTS,NOW);assert.equal(paid.statusText,'支付成功');assert.equal(paid.purchaseBlocked,false);
 const closed=orderModel(order({paymentStatus:'closed',grantStatus:'none',fact:undefined,grantId:undefined}),row(),DEFAULTS,NOW);assert.equal(closed.pending,false);assert.equal(closed.purchaseBlocked,false);
});
test('multiple unfinished orders and a non-Android channel never expose resume',async()=>{
 for(const [orders,platform] of [[[awaiting(),{...awaiting(),orderId:'second_unfinished'}],'android'],[[awaiting()],'windows']]){
  const db=new ReadDb(row('expired_selection'),orders);
  const runtime=createPresentationRuntime({db,wxCloud:{getWXContext:()=>({APPID:APP_ID,OPENID:'teacher',SOURCE:'wx_client'})},clock:()=>NOW,environment:{MEMBERSHIP_FORMAL_CONFIG:JSON.stringify({ordersReady:true,controlledPreparationEnabled:true,controlledTeachers:['teacher']})}});
  const m=await runtime({action:'getDisplay',request:{platform}});assert.equal(m.canResumePayment,false);assert.equal(m.resumeOrderId,'');assert.equal(m.canPurchase,false);
 }
});
test('a different product is never classified as the resumable formal order',()=>{const m=orderModel({...awaiting(),platformProductId:'TEST_teacher_12m_a'},row(),DEFAULTS,NOW);assert.equal(m.awaitingPayment,false);assert.equal(m.purchaseBlocked,true);});
