'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createPaymentService}=require('../../utils/membership-payment-service');
const {membershipModel}=require('../../cloudfunctions/membership-presentation/model');
const {row,NOW,ReadDb}=require('../membership-final-b/fixtures');
const {configuration,APP_ID}=require('../../cloudfunctions/membership-presentation/config');
const {createPresentationRuntime}=require('../../cloudfunctions/membership-presentation/runtime');
const {makePage}=require('../../subpages/membership/page');
test('formal service stops before payment when parameter preparation is not released',async()=>{
  for(const permission of [false,undefined]){let pays=0;const service=createPaymentService({requireInvocationPermission:true,sessionRevision:()=>1,wxApi:{login:r=>r.success({code:'local'}),requestVirtualPayment(){pays++;}},callServer:async action=>action==='createOrder'?{orderId:'formal_order'}:{mode:'short_series_goods',paymentInvocationAllowed:permission}});
    assert.equal((await service.purchase({requestId:'r'})).status,'prepared');assert.equal(pays,0);
  }
});
test('explicit released formal parameters reuse bridge but client success cannot grant',async()=>{
  let pays=0;const service=createPaymentService({requireInvocationPermission:true,sessionRevision:()=>1,wxApi:{login:r=>r.success({code:'local'}),requestVirtualPayment:r=>{pays++;assert.equal(Object.hasOwn(r,'paymentInvocationAllowed'),false);r.success();}},callServer:async action=>action==='createOrder'?{orderId:'order'}:action==='parameters'?{mode:'short_series_goods',paymentInvocationAllowed:true}:{paymentStatus:'awaiting_payment',grantStatus:'none'}});
  assert.equal((await service.purchase({requestId:'r'})).status,'processing');assert.equal(pays,1);
});
test('closed Android page click gives natural Chinese without orders or payment',async()=>{
  const page=makePage('index');page.data={...page.data,loading:false,model:membershipModel(row(),NOW,configuration())};page.setData=v=>Object.assign(page.data,v);
  global.wx={cloud:{callFunction(){throw Error('CLOUD_FORBIDDEN');}},requestVirtualPayment(){throw Error('PAYMENT_FORBIDDEN');}};
  await page.buy();assert.equal(page.data.message,'会员购买暂未开放');assert.equal(page.data.localPending,false);
});
test('formal display free active expired long-term and platform request remain read-only',async()=>{
  for(const state of ['free','active','expired_retained','long_term']){
    const db=new ReadDb(row(state));const runtime=createPresentationRuntime({db,wxCloud:{getWXContext:()=>({APPID:APP_ID,OPENID:'teacher',SOURCE:'wx_client'})},clock:()=>NOW});
    const model=await runtime({action:'getDisplay',request:{platform:'android'}});assert.equal(model.priceText,'399元');assert.equal(model.durationText,'12个月');assert.equal(model.canPurchase,false);assert.equal(model.canRenew,false);assert.equal(model.showPurchase,state!=='long_term');assert.equal(db.writes,0);
  }
});
test('existing TEST bridge default contract remains compatible without formal permission field',async()=>{
  let pays=0;const service=createPaymentService({sessionRevision:()=>1,wxApi:{login:r=>r.success({code:'local'}),requestVirtualPayment:r=>{pays++;assert.equal(r.signData,'TEST_LOCAL_ONLY');r.fail({errMsg:'cancel'});}},callServer:async action=>action==='createOrder'?{orderId:'test_local'}:action==='parameters'?{mode:'short_series_goods',signData:'TEST_LOCAL_ONLY',paySig:'LOCAL',signature:'LOCAL'}:{paymentStatus:'awaiting_payment',grantStatus:'none'}});
  assert.equal((await service.purchase({productId:'TEST_local',requestId:'local'})).status,'cancelled');assert.equal(pays,1);
});
