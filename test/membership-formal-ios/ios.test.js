'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture,BASE,encrypt,cryptoConfig,APP_ID,hmac}=require('./fixtures');
const {configuration,mayPrepare}=require('../../cloudfunctions/membership-formal/policy');
const {gateDisplay,purchaseChannel}=require('../../utils/membership-channel-gates');
const {addMonths}=require('../../cloudfunctions/membership-core/time');
const {models}=require('../membership-final-b/fixtures');
const gate={iosTeacher:'teacher',iosPreparationEnabled:true,iosPlatformReady:true,iosExpiresAt:BASE+3600000};
const ios=(f,id='ios_first')=>f.call('createOrder',{requestId:id,platform:'ios'});
const parameters=(f,o,platform='ios')=>f.call('parameters',{orderId:o.orderId,loginCode:'local',platform});
const notice=async(f,o)=>encrypt(await f.event(o.orderId),{...cryptoConfig,appId:APP_ID});

test('iOS default denied even with Android master release and Android whitelist',async()=>{
  for(const patch of [{},{formalPurchaseEnabled:true},{controlledPaymentEnabled:true}]){
    const f=fixture(patch),before=structuredClone(f.sdk.rows);
    await assert.rejects(ios(f),/FORMAL_PURCHASE_NOT_RELEASED/);assert.deepEqual(f.sdk.rows,before);
  }
});
test('iOS requires one trusted teacher, platform readiness and a live time window',async()=>{
  for(const patch of [{iosTeacher:'other'},{iosExpiresAt:BASE},{iosExpiresAt:BASE-1}]){
    const f=fixture({...gate,...patch});await assert.rejects(ios(f),/FORMAL_PURCHASE_NOT_RELEASED/);assert.equal(f.sdk.starts,0);
  }
  for(const patch of [{iosTeacher:''},{iosPlatformReady:false},{iosExpiresAt:0}])assert.throws(()=>fixture({...gate,...patch}),/FORMAL_INVALID_IOS_GATE/);
  const f=fixture(gate);f.setActor('ordinary');await assert.rejects(ios(f),/FORMAL_PURCHASE_NOT_RELEASED/);
  for(const platform of ['windows','ohos','harmony','unknown'])await assert.rejects(f.call('createOrder',{requestId:'x',platform}),/FORMAL_PURCHASE_NOT_RELEASED/);
});
test('same official product, env zero and fixed price; preparation cannot invoke payment',async()=>{
  const f=fixture({...gate,formalPurchaseEnabled:true,controlledPaymentEnabled:true}),catalog=await f.repo.get('products','teacher_member_12m');
  const o=await ios(f),row=await f.repo.get('orders',o.orderId),p=await parameters(f,o),s=JSON.parse(p.signData);
  assert.equal(row.channel,'apple_iap');assert.equal(row.productSnapshot.channel,'apple_iap');assert.equal(row.purchaseDomain,'formal_android_v1');
  assert.equal(s.env,0);assert.equal(s.productId,'teacher_member_12m');assert.equal(s.goodsPrice,39900);assert.equal(s.currencyType,'CNY');assert.equal(s.buyQuantity,1);
  assert.deepEqual(row.productSnapshot.duration,{months:12});assert.equal(row.productSnapshot.autoRenew,false);assert.equal(row.productSnapshot.testOnly,false);
  assert.equal(p.mode,'short_series_goods');assert.equal(p.paymentInvocationAllowed,false);assert.deepEqual(await f.repo.get('products','teacher_member_12m'),catalog);
});
test('payment permission is independent, expires, and cannot resume across channels',async()=>{
  const f=fixture({...gate,iosPaymentEnabled:true}),o=await ios(f);assert.equal((await parameters(f,o)).paymentInvocationAllowed,true);
  await assert.rejects(parameters(f,o,'android'),/FORMAL_ORDER_CHANNEL_MISMATCH/);
  await assert.rejects(f.create('ios_first'),/FORMAL_ORDER_CHANNEL_MISMATCH/);
  f.state.clock=gate.iosExpiresAt;await assert.rejects(parameters(f,o),/FORMAL_PURCHASE_NOT_RELEASED/);
  const a=fixture(gate),android=await a.create();await assert.rejects(parameters(a,android),/FORMAL_ORDER_CHANNEL_MISMATCH/);
});
test('cross-device pending lock and request idempotency remain shared',async()=>{
  const f=fixture(gate),pair=await Promise.all([ios(f),ios(f)]);assert.equal(pair[0].orderId,pair[1].orderId);
  await assert.rejects(f.create('different'),/FORMAL_ORDER_PENDING/);
  assert.equal([...f.sdk.rows.keys()].filter(k=>k.startsWith('membership_orders/')).length,1);
});
test('Apple goods without WeChatPayInfo plus query type 7 grants once; gate closure preserves recovery',async()=>{
  const f=fixture(gate),before=await f.repo.get('ledgers','teacher'),o=await ios(f),req=await notice(f,o);
  assert.equal((await f.call('queryOrder',{orderId:o.orderId})).userStatus,'PAYMENT_PENDING_REVIEW');
  assert.equal((await f.repo.get('ledgers','teacher')).grants.length,0);
  f.state.clock=gate.iosExpiresAt;
  for(let n=0;n<2;n++)assert.equal((await f.runtime.notification(req)).statusCode,200);
  for(let n=0;n<2;n++)assert.equal((await f.call('queryOrder',{orderId:o.orderId})).grantStatus,'granted');
  const body=JSON.stringify({limit:5}),timestamp=f.state.clock,nonce='ios_compensation_local_001',signature=hmac(f.environment.MEMBERSHIP_INTERNAL_KEY,`${timestamp}\n${nonce}\n${body}`);
  await f.runtime.compensate({body,timestamp,nonce,signature});
  const row=await f.repo.get('ledgers','teacher');assert.equal(row.grants.length,1);assert.equal(row.account.effectiveExpiresAt,addMonths(BASE,12));
  for(const key of ['students','studentRefs','operations','audits','initialization','access'])assert.deepEqual(row[key],before[key]);
  assert.equal((await f.repo.get('orders',o.orderId)).fact.channel,'apple_iap');
});
test('Apple order rejects wrong official channel, amount and TEST product without grants',async()=>{
  for(const patch of [{order_type:0},{paid_fee:1}]){
    const f=fixture(gate),o=await ios(f);f.state.queryChanges=patch;
    assert.notEqual((await f.runtime.notification(await notice(f,o))).statusCode,200);assert.equal((await f.repo.get('ledgers','teacher')).grants.length,0);
  }
  const f=fixture(gate);await assert.rejects(f.call('createOrder',{requestId:'x',platform:'ios',productId:'TEST_teacher_12m_a'}),/UNEXPECTED_FIELDS/);
  const o=await ios(f),event=await f.event(o.orderId);event.GoodsInfo.ProductId='TEST_teacher_12m_a';
  assert.notEqual((await f.runtime.notification(encrypt(event,{...cryptoConfig,appId:APP_ID}))).statusCode,200);
  assert.equal((await f.repo.get('ledgers','teacher')).grants.length,0);
});
test('iOS transition display smoke preserves access/status and needs explicit server gate',()=>{
  const wxApi={getDeviceInfo:()=>({platform:'ios'}),requestVirtualPayment(){}};
  assert.equal(purchaseChannel(wxApi),'ios');const m=models().transition,before=structuredClone(m),closed=gateDisplay(m,wxApi);
  for(const key of Object.keys(m))if(!['showPurchase','canPurchase','canRenew','canResumePayment','resumeOrderId'].includes(key))assert.deepEqual(closed[key],m[key]);
  assert.equal(closed.canPurchase,false);assert.deepEqual(m,before);
  const allowed={...m,iosPurchaseAllowed:true,canPurchase:true};assert.deepEqual(gateDisplay(allowed,wxApi),allowed);
  const c=configuration({});assert.equal(mayPrepare(c,'teacher','ios',BASE),false);
});
test('iOS presentation grants only the controlled display flag and reads transition without writes',async()=>{
  const {ReadDb,row,NOW}=require('../membership-final-b/fixtures');
  const {createPresentationRuntime}=require('../../cloudfunctions/membership-presentation/runtime');
  const db=new ReadDb(row('transition'));
  const f=fixture({...gate,iosExpiresAt:NOW+3600000});
  const display=createPresentationRuntime({db,wxCloud:{getWXContext:()=>({APPID:APP_ID,OPENID:'teacher',SOURCE:'wx_client'})},environment:f.environment,clock:()=>NOW});
  const iosModel=await display({action:'getDisplay',request:{platform:'ios'}}),androidModel=await display({action:'getDisplay',request:{platform:'android'}});
  assert.equal(iosModel.iosPurchaseAllowed,true);assert.equal(iosModel.canPurchase,true);assert.equal(iosModel.displayState,'transition');
  assert.equal(iosModel.entrySubtitle,androidModel.entrySubtitle);assert.equal(db.writes,0);
});
test('Apple formal parameters use the sealed signing adapter unchanged',async()=>{
  const {createWechatApi}=require('../../cloudfunctions/membership-payment/wechat-api');
  const {paySignature}=require('../../cloudfunctions/membership-payment/crypto');
  const f=fixture(gate),o=await ios(f),order=await f.repo.get('orders',o.orderId);
  const api=createWechatApi({getAppSecret:async()=> 'SYNTHETIC_SECRET',getAppKey:async env=>{assert.equal(env,0);return 'SYNTHETIC_KEY';},fetchImpl:async()=>({ok:true,text:async()=>JSON.stringify({openid:'teacher',session_key:'SYNTHETIC_SESSION'})})});
  const p=await api.parameters(order,{teacherId:'teacher',openId:'teacher',appId:APP_ID},'local');
  assert.equal(p.paySig,paySignature('SYNTHETIC_KEY','requestVirtualPayment',order.signData));assert.equal(p.signature,hmac('SYNTHETIC_SESSION',order.signData));
});
