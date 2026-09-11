'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {createMembershipAuthorizer}=require('../../cloudfunctions/membership-access/service');
const {createPaymentEngine}=require('../../cloudfunctions/membership-payment/engine');
const {initializeAccess}=require('../../cloudfunctions/membership-core/access');
const {setup,BASE}=require('../membership-stage3/fixtures');
const {student}=require('../membership-stage2/fixtures');
function reader(s){
 const students=[student('a'),student('b')];const access=initializeAccess({teacherId:'teacher',students,registeredAt:BASE,launchAt:BASE,now:BASE});
 return createMembershipAuthorizer({getIdentity:async()=>s.state.actor,clock:()=>s.state.clock,
  readSnapshot:(teacherId,evaluate)=>s.repo.transaction(async tx=>{const ledger=await tx.get('ledgers',teacherId);return evaluate({grants:ledger?.grants||[],access,students});})});
}
for(const paymentStatus of ['PAYMENT_PROCESSING','PAYMENT_PENDING_REVIEW','PAYMENT_CANCELLED','PAYMENT_FAILED','paid'])test(`payment status ${paymentStatus} alone never grants access`,async()=>{
 const s=setup();const a=await s.create();const order=await s.repo.get('orders',a.orderId);order.paymentStatus=paymentStatus;s.sdk.seed('orders',a.orderId,order);
 const result=await reader(s).authorizeLearning({studentId:'a'});assert.equal(result.membershipStatus,'free');assert.equal(result.allowed,false);
});
test('Stage3 authenticated notification grants -> unified permission restores every student',async()=>{
 const s=setup();const a=await s.create();const authorizer=reader(s);assert.equal((await authorizer.authorizeLearning({studentId:'b'})).allowed,false);
 await s.engine.authenticatedEvent(await s.event(a.orderId));assert.equal((await authorizer.authorizeLearning({studentId:'b'})).allowed,true);assert.equal((await authorizer.authorizeReview({studentId:'a'})).allowed,true);
});
test('Stage3 review does not unlock access; controlled admin grant is recognized through actual ledger',async()=>{
 const s=setup();const a=await s.create();await s.engine.reconcile(a.orderId);const authorizer=reader(s);assert.equal((await authorizer.authorizeLearning({studentId:'a'})).allowed,false);
 const order=await s.repo.get('orders',a.orderId);const proof={...order.review.candidate,reference:'official_fixture',mode:'short_series_goods',status:'paid',offerId:order.offerId,quantity:1};
 const admin=createPaymentEngine({repository:s.repo,api:s.api,config:s.config,getIdentity:async()=>s.state.actor,clock:()=>s.state.clock,getAdminIdentity:async()=>({isAdmin:true,operatorId:'admin_fixture'}),getReviewEvidence:async()=>proof});
 await admin.confirmPaidAndGrant(a.orderId,{}, {reference:proof.reference},'Official fixture checked');assert.equal((await authorizer.authorizeReview({studentId:'b'})).allowed,true);
});
test('Stage3 refund removes only entitlement authority; learning/student data untouched',async()=>{
 const s=setup();const a=await s.create();await s.engine.authenticatedEvent(await s.event(a.orderId));await s.engine.authenticatedEvent(await s.refundEvent(a.orderId));
 assert.equal((await reader(s).authorizeLearning({studentId:'a'})).allowed,false);
});
