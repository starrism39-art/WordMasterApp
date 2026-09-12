'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {setup,BASE,encrypt,cryptoConfig}=require('../membership-stage3/fixtures');
const {award}=require('../membership-stage2/fixtures');
const {initializeAccess}=require('../../cloudfunctions/membership-core/access');
const {addMonths}=require('../../cloudfunctions/membership-core/time');
const {createFormalRuntime}=require('../../cloudfunctions/membership-formal/runtime');
const {createFormalRepository}=require('../../cloudfunctions/membership-formal/repository');
const {configuration}=require('../../cloudfunctions/membership-formal/policy');
const {APP_ID,ENV_ID}=require('../../cloudfunctions/membership-presentation/config');
const {hmac}=require('../../cloudfunctions/membership-payment/crypto');
function fixture(patch={}){
  const f=setup({config:{appId:APP_ID,originalId:'gh_localfixture'},product:{productId:'teacher_member_12m',testOnly:false,price:39900,allowedTestAccounts:[]}});
  f.sdk.seed('products',f.item.productId,{product:f.item,appId:APP_ID,offerId:f.config.offerId,env:0,platformProductId:f.item.productId});
  f.sdk.seed('ledgers','teacher',{teacherId:'teacher',revision:0,grants:[],students:[],studentRefs:{},operations:{legacy:'keep'},audits:[],initialization:{state:'ready'},access:initializeAccess({teacherId:'teacher',students:[],registeredAt:BASE,launchAt:BASE,now:BASE})});
  const c={appId:APP_ID,cloudEnvId:ENV_ID,offerId:f.config.offerId,originalId:f.config.originalId,formalPurchaseEnabled:false,controlledPreparationEnabled:true,controlledTeachers:['teacher'],allowedPlatforms:['android'],allowedProductId:f.item.productId,ordersReady:true,...patch};
  const environment={MEMBERSHIP_FORMAL_CONFIG:JSON.stringify(c),MEMBERSHIP_INTERNAL_KEY:'LOCAL_INTERNAL_KEY_'.repeat(3),MEMBERSHIP_NOTIFICATION_TOKEN:cryptoConfig.token,MEMBERSHIP_NOTIFICATION_AES_KEY:cryptoConfig.encodingAESKey};
  let actor='teacher';
  const db={collection:()=>({where:filter=>({limit:()=>({get:async()=>({data:filter.teacher_id==='teacher'?[{teacher_id:'teacher'}]:[]})})})})};
  const repo=createFormalRepository(null,configuration(environment),{base:f.repo,clock:()=>f.state.clock});
  const runtime=createFormalRuntime({db,wxCloud:{getWXContext:()=>({APPID:APP_ID,OPENID:actor,SOURCE:'wx_client'})},environment,repository:repo,api:f.api,clock:()=>f.state.clock});
  const call=(action,request)=>runtime.orders({action,request});
  const create=(requestId='first')=>call('createOrder',{requestId,platform:'android'});
  return {...f,repo,runtime,environment,call,create,setActor:v=>{actor=v;}};
}
test('release master gate admits non-whitelisted Android buyer with fixed formal terms only',async()=>{
  const f=fixture({formalPurchaseEnabled:true,controlledPreparationEnabled:false,controlledPaymentEnabled:false,controlledTeachers:[]});
  const o=await f.create(),row=await f.repo.get('orders',o.orderId);
  assert.equal(row.platformProductId,'teacher_member_12m');assert.equal(row.amount,39900);assert.equal(row.currency,'CNY');assert.equal(row.productSnapshot.duration.months,12);assert.equal(row.productSnapshot.autoRenew,false);
  const p=await f.call('parameters',{orderId:o.orderId,loginCode:'local',platform:'android'});assert.equal(p.paymentInvocationAllowed,true);
  for(const platform of ['ios','windows','ohos','harmony','unknown','',undefined])await assert.rejects(f.call('createOrder',{requestId:'blocked_'+platform,platform}),/FORMAL_PURCHASE_NOT_RELEASED/);
  assert.equal([...f.sdk.rows.keys()].filter(k=>k.startsWith('membership_orders/')).length,1);
});

test('formal fixed product and preparation-only parameters cannot authorize payment',async()=>{
  const f=fixture(),o=await f.create(),row=await f.repo.get('orders',o.orderId);
  assert.equal(row.amount,39900);assert.equal(row.productSnapshot.duration.months,12);assert.equal(row.productSnapshot.autoRenew,false);assert.equal(row.productSnapshot.testOnly,false);assert.equal(row.purchaseDomain,'formal_android_v1');
  const p=await f.call('parameters',{orderId:o.orderId,loginCode:'local',platform:'android'});
  assert.equal(p.paymentInvocationAllowed,false);assert.equal(JSON.parse(p.signData).productId,'teacher_member_12m');assert.equal(JSON.parse(p.signData).goodsPrice,39900);
});
test('closed ordinary gate, non Android platforms and identity spoofing cannot write',async()=>{
  for(const patch of [{controlledPreparationEnabled:false},{controlledTeachers:[]}]){const f=fixture(patch),before=structuredClone(f.sdk.rows);await assert.rejects(f.create(),/FORMAL_PURCHASE_NOT_RELEASED/);assert.deepEqual(f.sdk.rows,before);}
  for(const platform of ['ios','windows','ohos','devtools','',undefined]){const f=fixture();await assert.rejects(f.call('createOrder',{requestId:'a',platform}),/FORMAL_PURCHASE_NOT_RELEASED/);assert.equal(f.sdk.starts,0);}
  const f=fixture();f.setActor('unknown');await assert.rejects(f.runtime.orders({action:'createOrder',request:{requestId:'a',platform:'android'},userInfo:{OPENID:'teacher'}}),/FORMAL_PURCHASE_NOT_RELEASED/);
});
test('client price duration product identity and scope injection reject before writes',async()=>{
  for(const patch of [{price:1},{duration:{months:120}},{productId:'TEST_teacher_12m_a'},{teacherId:'other'},{openid:'other'},{scope:'test'},{grant:{months:12}}]){
    const f=fixture();await assert.rejects(f.call('createOrder',{requestId:'a',platform:'android',...patch}),/UNEXPECTED_FIELDS/);assert.equal(f.sdk.starts,0);
  }
});
test('duplicate request is idempotent and different pending requests are bounded under concurrency',async()=>{
  const f=fixture();const pair=await Promise.all([f.create(),f.create()]);assert.equal(pair[0].orderId,pair[1].orderId);
  await assert.rejects(f.create('different'),/FORMAL_ORDER_PENDING/);
  assert.equal([...f.sdk.rows.keys()].filter(k=>k.startsWith('membership_orders/')).length,1);
});
test('long term and uninitialized ledgers refuse order creation',async()=>{
  const f=fixture(),row=await f.repo.get('ledgers','teacher');row.grants=[award('permanent',BASE,{sourceType:'internal_long_term'})];f.sdk.seed('ledgers','teacher',row);
  await assert.rejects(f.create(),/LONG_TERM_PURCHASE_DISABLED/);
  f.sdk.rows.delete('membership_ledgers/teacher');await assert.rejects(f.create(),/FORMAL_LEDGER_NOT_READY/);
});
test('formal signed notification grants once via existing algorithm and preserves legacy fields',async()=>{
  const f=fixture(),before=await f.repo.get('ledgers','teacher'),o=await f.create();
  const event=await f.event(o.orderId),request=encrypt(event,{...cryptoConfig,appId:APP_ID});
  for(let n=0;n<2;n++)assert.equal((await f.runtime.notification(request)).statusCode,200);
  const row=await f.repo.get('ledgers','teacher');assert.equal(row.grants.length,1);assert.equal(row.grants[0].sourceType,'payment');assert.equal(row.account.effectiveExpiresAt,addMonths(BASE,12));
  for(const key of ['students','studentRefs','operations','audits','initialization','access'])assert.deepEqual(row[key],before[key]);
  assert.deepEqual(await f.repo.get('accounts','teacher'),row.account);
});
test('active renewal extends expiry and expired repurchase begins at verified paidAt',async()=>{
  for(const active of [true,false]){const f=fixture(),row=await f.repo.get('ledgers','teacher');row.grants=[award('previous',active?BASE: BASE-730*86400000)];f.sdk.seed('ledgers','teacher',row);
    const o=await f.create();assert.equal((await f.runtime.notification(encrypt(await f.event(o.orderId),{...cryptoConfig,appId:APP_ID}))).statusCode,200);
    assert.equal((await f.repo.get('accounts','teacher')).effectiveExpiresAt,addMonths(BASE,active?24:12));
  }
});
test('official query without goods evidence stays pending review; compensation authenticates and rejects replay',async()=>{
  const f=fixture(),o=await f.create();const state=await f.call('queryOrder',{orderId:o.orderId});assert.equal(state.userStatus,'PAYMENT_PENDING_REVIEW');assert.equal((await f.repo.get('ledgers','teacher')).grants.length,0);
  const body=JSON.stringify({limit:1}),timestamp=BASE,nonce='formal_local_nonce_001',signature=hmac(f.environment.MEMBERSHIP_INTERNAL_KEY,`${timestamp}\n${nonce}\n${body}`);
  await f.runtime.compensate({body,timestamp,nonce,signature});await assert.rejects(f.runtime.compensate({body,timestamp,nonce,signature}),/INTERNAL_REPLAY_REJECTED/);
});
test('formal repository rejects TEST orders/products and forged signed product facts',async()=>{
  const f=fixture(),o=await f.create(),row=await f.repo.get('orders',o.orderId);
  f.sdk.seed('orders',o.orderId,{...row,productSnapshot:{...row.productSnapshot,testOnly:true,price:1,allowedTestAccounts:['teacher']},amount:1});
  await assert.rejects(f.call('queryOrder',{orderId:o.orderId}),/FORMAL_PRODUCT_MISMATCH/);assert.equal(f.state.queryCalls,0);
  const g=fixture(),p=await g.create(),event=await g.event(p.orderId);event.GoodsInfo.ProductId='TEST_teacher_12m_a';
  assert.notEqual((await g.runtime.notification(encrypt(event,{...cryptoConfig,appId:APP_ID}))).statusCode,200);assert.equal((await g.repo.get('ledgers','teacher')).grants.length,0);
});
test('foreign order ownership fails before official query',async()=>{
  const f=fixture(),o=await f.create(),row=await f.repo.get('orders',o.orderId);f.sdk.seed('orders',o.orderId,{...row,teacherId:'other',openId:'other'});
  await assert.rejects(f.call('queryOrder',{orderId:o.orderId}),/ORDER_NOT_OWNED/);assert.equal(f.state.queryCalls,0);
});
module.exports={fixture};
test('authenticated callback router selects formal only for persisted formal orders; TEST stays on legacy runtime',async()=>{
  const {createNotificationRouter}=require('../../cloudfunctions/membership-formal/notification-router');
  const f=fixture(),o=await f.create();let legacyCalls=0;
  const route=createNotificationRouter({formal:f.runtime,environment:f.environment,legacy:async()=>{legacyCalls++;return {statusCode:200,body:'legacy'};}});
  const req=encrypt(await f.event(o.orderId),{...cryptoConfig,appId:APP_ID});
  const envelope={httpMethod:'POST',body:req.body,queryStringParameters:req.query};
  assert.equal((await route(envelope)).statusCode,200);assert.equal(legacyCalls,0);
  const testEvent={...await f.event(o.orderId),OutTradeNo:'test_order'};const testReq=encrypt(testEvent,{...cryptoConfig,appId:APP_ID});
  assert.equal((await route({...envelope,body:testReq.body,queryStringParameters:testReq.query})).body,'legacy');assert.equal(legacyCalls,1);
  assert.equal((await route({...envelope,body:'{}'})).statusCode,503);assert.equal(legacyCalls,1);
});
test('sealed TEST policy refuses a formal snapshot (direct isolation boundary only)',async()=>{
  const {createPolicy}=require('../../cloudfunctions/membership-stage5/policy');
  const f=fixture(),o=await f.create();const policy=createPolicy({appId:APP_ID,cloudEnvId:ENV_ID,offerId:f.config.offerId,originalId:'gh_localfixture',env:0,batchId:'local',source:'real_payment',processingTeachers:['teacher'],purchaseTeachers:[],administrators:[],enabledChannels:['wechat'],purchaseEnabled:false,batchClosed:true,launchAt:BASE});
  assert.throws(()=>policy.orderRecord({...f.sdk.rows.get('membership_orders/'+o.orderId)}),/STAGE5_TEST_PRODUCT_REQUIRED/);
});
test('real parameter adapter signs only formal server snapshot and rejects wrong session owner',async()=>{
  const {createWechatApi}=require('../../cloudfunctions/membership-payment/wechat-api');
  const {paySignature}=require('../../cloudfunctions/membership-payment/crypto');
  const f=fixture(),o=await f.create(),order=await f.repo.get('orders',o.orderId);let owner='teacher';
  const api=createWechatApi({getAppSecret:async()=> 'LOCAL_ONLY_SECRET',getAppKey:async()=> 'LOCAL_ONLY_KEY',fetchImpl:async()=>({ok:true,text:async()=>JSON.stringify({openid:owner,session_key:'LOCAL_ONLY_SESSION'})})});
  const p=await api.parameters(order,{teacherId:'teacher',openId:'teacher',appId:APP_ID},'localcode');
  assert.equal(p.paySig,paySignature('LOCAL_ONLY_KEY','requestVirtualPayment',order.signData));assert.equal(p.signature,hmac('LOCAL_ONLY_SESSION',order.signData));
  owner='other';await assert.rejects(api.parameters(order,{teacherId:'teacher',openId:'teacher',appId:APP_ID},'code'),/SESSION_IDENTITY_MISMATCH/);
});
test('formal timer rejects client spoofing before compensation',()=>{
  const {timerRequest,capability,TRIGGER_NAME}=require('../../cloudfunctions/membership-formal/timer');const f=fixture();
  assert.throws(()=>timerRequest({event:{Type:'Timer',TriggerName:TRIGGER_NAME,Message:capability(f.environment.MEMBERSHIP_INTERNAL_KEY)},context:{SOURCE:'wx_client',OPENID:'teacher'},environment:{...f.environment,MEMBERSHIP_FORMAL_SCHEDULE_ENABLED:'true'},config:f.runtime.config,clock:()=>BASE}),/FORMAL_TIMER_AUTH_REQUIRED/);
});
test('long-term activation after order creation blocks parameters; review state blocks another order',async()=>{
  const f=fixture(),o=await f.create(),ledger=await f.repo.get('ledgers','teacher');ledger.grants=[award('permanent',BASE,{sourceType:'internal_long_term'})];f.sdk.seed('ledgers','teacher',ledger);
  await assert.rejects(f.call('parameters',{orderId:o.orderId,platform:'android',loginCode:'local'}),/LONG_TERM_PURCHASE_DISABLED/);
  const g=fixture(),prior=await g.create(),record=await g.repo.get('orders',prior.orderId);g.sdk.seed('orders',prior.orderId,{...record,paymentStatus:'refund_pending',grantStatus:'granted',reviewRequired:'PLATFORM_REFUND_REQUIRES_REVIEW'});
  await assert.rejects(g.create('new'),/FORMAL_ORDER_PENDING/);
});
test('missing credentials fail closed before a formal order write',async()=>{
  const f=fixture(),runtime=createFormalRuntime({db:{collection:()=>({where:()=>({limit:()=>({get:async()=>({data:[{teacher_id:'teacher'}]})})})})},wxCloud:{getWXContext:()=>({APPID:APP_ID,OPENID:'teacher',SOURCE:'wx_client'})},environment:f.environment,repository:f.repo,clock:()=>BASE});
  await assert.rejects(runtime.orders({action:'createOrder',request:{requestId:'a',platform:'android'}}),/CREDENTIAL_NOT_CONFIGURED/);assert.equal(f.sdk.starts,0);
});
test('separate explicitly authorized controlled payment flag never opens ordinary buyers',async()=>{
  const f=fixture({controlledPreparationEnabled:false,controlledPaymentEnabled:true}),o=await f.create();
  assert.equal(f.runtime.config.formalPurchaseEnabled,false);assert.equal((await f.call('parameters',{orderId:o.orderId,platform:'android',loginCode:'local'})).paymentInvocationAllowed,true);
  f.setActor('ordinary');await assert.rejects(f.create('ordinary'),/FORMAL_PURCHASE_NOT_RELEASED/);
});
