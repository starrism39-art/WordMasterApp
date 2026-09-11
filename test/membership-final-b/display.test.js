'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {row,order,models,NOW,ReadDb}=require('./fixtures');
const {membershipModel,orderModel}=require('../../cloudfunctions/membership-presentation/model');
const {DEFAULTS,APP_ID,configuration,publicConfig}=require('../../cloudfunctions/membership-presentation/config');
const {createPresentationRuntime}=require('../../cloudfunctions/membership-presentation/runtime');
test('eight states use frozen authority and server-only copy; purchases safely closed',()=>{
 for(const [state,m] of Object.entries(models())){assert.equal(m.displayState,state);assert.ok(m.statusLabel);assert.ok(m.entrySubtitle);assert.equal(m.canPurchase,false);assert.equal(m.canRenew,false);assert.equal(m.priceText,'399元');}
 const all=models();assert.equal(all.long_term.showPurchase,false);assert.equal(all.long_term.showRules,false);assert.equal(all.transition.transitionRemainingDays,4);
 assert.equal(all.active.purchaseLabel,'提前续费');assert.equal(all.expired_selection.needsRetentionSelection,true);assert.equal(all.expired_retained.retainedStudentName,'林同学');assert.equal(all.expired_retained.retentionAllowed,false);
 assert.equal(all.free.freeStudentLimit,1);assert.match(all.expiring.notice,/不会删除/);
});
test('missing and malformed authority never defaults to free',()=>{
 assert.throws(()=>membershipModel(null,NOW,DEFAULTS));const r=row();delete r.access;assert.throws(()=>membershipModel(r,NOW,DEFAULTS));
});
test('order presentation hides internal identifiers and maps paid, pending, closed, refunded',()=>{
 const r=row('active'),o=order({transactionId:'private-platform-id',source:'hidden'});
 const m=orderModel(o,r,DEFAULTS,NOW);assert.equal(m.statusText,'支付成功');assert.equal(m.amountText,'399.00元');assert.match(m.membershipPeriodText,/2026/);assert.ok(!m.maskedOrderId.includes(o.orderId));
 assert.ok(!JSON.stringify(m).includes('private-platform-id'));assert.ok(!Object.hasOwn(m,'grantStatus'));
 for(const [paymentStatus,grantStatus,label] of [['awaiting_payment','pending','正在确认'],['closed','pending','已关闭'],['refunded','revoked','已退款'],['paid','pending','正在确认']]) assert.equal(orderModel(order({paymentStatus,grantStatus}),r,DEFAULTS,NOW).statusText,label);
 assert.throws(()=>orderModel(order({teacherId:'other'}),r,DEFAULTS,NOW));assert.throws(()=>orderModel(order({_stage5:{}}),r,DEFAULTS,NOW));
 assert.equal(orderModel(order({grantId:'not_in_authoritative_ledger'}),r,DEFAULTS,NOW).pending,true);
 assert.throws(()=>orderModel(order({env:1}),r,DEFAULTS,NOW));
});
test('support absent/present and exactly five public rules with no internal sources',()=>{
 assert.equal(publicConfig(configuration()).supportAvailable,false);
 assert.equal(publicConfig(configuration({MEMBERSHIP_UI_CONFIG:JSON.stringify({support:{type:'phone',value:'00000000000'}})})).supportAvailable,true);
 assert.equal(publicConfig(DEFAULTS).rules.length,5);assert.doesNotMatch(JSON.stringify(publicConfig(DEFAULTS).rules),/Stage5|long_term|gift|historical|管理员|长期会员/);
 assert.throws(()=>configuration({MEMBERSHIP_UI_CONFIG:'{"purchaseEnabled":true}'}));
});
function runtime(value,orders=[]){const db=new ReadDb(value,orders),who={APPID:APP_ID,OPENID:'teacher',SOURCE:'wx_devtools'};return {db,who,run:createPresentationRuntime({db,wxCloud:{getWXContext:()=>who},environment:{MEMBERSHIP_UI_CONFIG:'{"ordersReady":true}'},clock:()=>NOW})};}
test('queryOrder honors sealed payment contract only after authoritative ledger confirmation',async()=>{
 const {createPaymentService}=require('../../utils/membership-payment-service');
 for(const [overrides,expected] of [[{},'granted'],[{grantId:'missing'},'processing'],[{grantStatus:'pending'},'processing'],[{paymentStatus:'refunded'},'refunded']]) {
  const o=order(overrides),s=runtime(row('active'),[o]);const before=structuredClone(s.db.rows);
  const service=createPaymentService({sessionRevision:()=>1,wxApi:{login:options=>options.success({code:'synthetic'}),requestVirtualPayment:options=>options.success()},callServer:async(action,request)=>action==='createOrder'?{orderId:o.orderId}:action==='parameters'?{}:s.run({action,request})});
  assert.equal((await service.purchase({requestId:'synthetic'})).status,expected);
  assert.deepEqual(s.db.rows,before);assert.equal(s.db.writes,0);
  const detail=await s.run({action:'getOrderDetail',request:{orderId:o.orderId}});assert.ok(detail.orderDetail);assert.equal(detail.paymentStatus,undefined);
 }
});
test('read display cannot initialize ledger or start transition; data unchanged',async()=>{
 const s=runtime(row('transition'));const before=structuredClone(s.db.rows);
 assert.equal((await s.run({action:'getDisplay'})).displayState,'transition');assert.deepEqual(s.db.rows,before);assert.equal(s.db.writes,0);
 s.db.rows.delete('membership_ledgers/teacher');await assert.rejects(s.run({action:'getDisplay'}));assert.equal(s.db.writes,0);
});
test('native identity and ownership required; forged request IDs cannot read another teacher',async()=>{
 const s=runtime(row('active'),[order(),order({orderId:'foreign',teacherId:'other',openId:'other'})]);
 await assert.rejects(s.run({action:'getDisplay',request:{teacherId:'other'}}));
 await assert.rejects(s.run({action:'getOrderDetail',request:{orderId:'foreign'}}));
 s.who.SOURCE='wx_http';await assert.rejects(s.run({action:'getOrders'}));s.who.SOURCE='wx_devtools';s.who.OPENID='other';await assert.rejects(s.run({action:'getOrders'}));
});
test('pending is found across devices without a local order ID, and no create is possible',async()=>{
 const s=runtime(row('active'),[order({paymentStatus:'paid',grantStatus:'pending'})]);assert.equal((await s.run({action:'getDisplay'})).pending,true);
 assert.equal((await s.run({action:'getOrders'})).orders[0].pending,true);
 await assert.rejects(s.run({action:'createOrder',request:{requestId:'click'}}));assert.equal(s.db.writes,0);
});
test('orders empty, pagination, unavailable detail, and live deleted student never recreated',async()=>{
 const s=runtime(row('active'));assert.deepEqual((await s.run({action:'getOrders'})).orders,[]);await assert.rejects(s.run({action:'getOrderDetail',request:{orderId:'unknown'}}));
 for(let i=0;i<23;i++)s.db.rows.set('membership_orders/order_'+i,order({orderId:'order_'+i}));
 const first=await s.run({action:'getOrders'});assert.equal(first.orders.length,20);assert.equal(first.nextOffset,20);assert.equal((await s.run({action:'getOrders',request:{offset:20}})).orders.length,3);
 s.db.rows.delete('students/one');const before=structuredClone(s.db.rows);assert.equal((await s.run({action:'getDisplay'})).studentCount,0);assert.deepEqual(s.db.rows,before);
});
