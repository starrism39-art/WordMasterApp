'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {withConfirmedDelivery}=require('../../cloudfunctions/membership-formal/delivery');
const {queryEvidence}=require('../../cloudfunctions/membership-payment/protocol');
const {row,ReadDb,NOW}=require('../membership-final-b/fixtures');
const {APP_ID}=require('../../cloudfunctions/membership-presentation/config');
const {createPresentationRuntime}=require('../../cloudfunctions/membership-presentation/runtime');
function fixture(status=4){
 const o={orderId:'formal_order',teacherId:'teacher',openId:'teacher',appId:APP_ID,env:0,channel:'wechat',amount:39900,platformProductId:'teacher_member_12m',attach:'fixed',createdAt:1000};
 o.goods={orderId:o.orderId,openId:o.openId,env:0,productId:o.platformProductId,amount:39900,attach:o.attach,paidAt:2000,wxpayOrderId:'wxpay'};
 const r={errcode:0,order:{order_id:o.orderId,env_type:1,order_type:0,status,order_fee:39900,paid_fee:39900,left_fee:39900,paid_time:2,wx_order_id:'transaction',wxpay_order_id:'wxpay'}};
 o.fact=queryEvidence(o,r,o.goods,3000);return {o,r};
}
test('officially delivered formal order ends fallback without another delivery notice',async()=>{const {o,r}=fixture();let notices=0;const api=withConfirmedDelivery({query:async()=>r,delivered:async()=>notices++},{clock:()=>3000});await api.delivered(o);await api.delivered(o);assert.equal(notices,0);});
test('paid but not delivered still invokes the existing official fallback',async()=>{const {o,r}=fixture(2);let notices=0;await withConfirmedDelivery({query:async()=>r,delivered:async()=>notices++},{clock:()=>3000}).delivered(o);assert.equal(notices,1);});
test('delivery confirmation rejects wrong transaction, amount, refund and identity',async()=>{for(const change of [{wx_order_id:'other'},{paid_fee:1},{status:5},{order_id:'other'}]){const {o,r}=fixture();Object.assign(r.order,change);let notices=0;await assert.rejects(withConfirmedDelivery({query:async()=>r,delivered:async()=>notices++},{clock:()=>3000}).delivered(o));assert.equal(notices,0);}});
test('closed purchase hides renewal panel for paid member without hiding membership',async()=>{const db=new ReadDb(row('active'),[]);const run=createPresentationRuntime({db,wxCloud:{getWXContext:()=>({APPID:APP_ID,OPENID:'teacher',SOURCE:'wx_client'})},clock:()=>NOW});const m=await run({action:'getDisplay',request:{platform:'android'}});assert.equal(m.displayState,'active');assert.equal(m.showPurchase,false);assert.equal(m.canPurchase,false);assert.equal(m.canRenew,false);assert.equal(db.writes,0);});
