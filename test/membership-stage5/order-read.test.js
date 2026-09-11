'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {Stage5Sdk,config,BASE,COLLECTIONS,hash}=require('./isolation-fixtures');
const {product}=require('../membership-stage2/fixtures');
const {createPolicy}=require('../../cloudfunctions/membership-stage5/policy');
const {createStage5Runtime}=require('../../cloudfunctions/membership-stage5/runtime');
const {createStage5Repository}=require('../../cloudfunctions/membership-stage5/repository');
const {createPaymentEngine}=require('../../cloudfunctions/membership-payment/engine');

function setup(overrides={}) {
  const policy=createPolicy(config({source:'synthetic',offerId:null,originalId:null,purchaseEnabled:false,purchaseTeachers:[],administrators:[],enabledChannels:[],...overrides}));
  const db=new Stage5Sdk();const state={actor:'teacher',appId:policy.config.appId};
  const runtime=createStage5Runtime({db,policy,wxCloud:{getWXContext:()=>({APPID:state.appId,OPENID:state.actor})},environment:{},fetchImpl:()=>{throw Error('EXTERNAL_API_FORBIDDEN');}});
  const rows={};
  for(const owner of ['teacher','second']) {
    const orderId=`readonly_${owner}`;
    const row={orderId,teacherId:owner,openId:owner,appId:policy.config.appId,offerId:policy.config.offerId,env:policy.config.env,
      productSnapshot:product({channel:'wechat',enabled:false,allowedTestAccounts:['teacher','second']}),amount:100,currency:'CNY',unit:'fen',quantity:1,
      paymentStatus:'awaiting_payment',grantStatus:'none',createdAt:BASE,updatedAt:BASE,_stage5:policy.stamp};
    const address=`${COLLECTIONS.orders}/${hash({role:'orders',scopeId:policy.scopeId,key:orderId})}`;
    db.rows.set(address,row);rows[owner]=row;
  }
  const query=(orderId='readonly_teacher',extra={})=>runtime.orders({action:'queryOrder',request:{orderId,...extra}});
  return {db,policy,state,runtime,rows,query};
}

test('normal My Orders returns only own persisted view without payment credentials or purchase permission',async()=>{
  const s=setup();const before=structuredClone(s.db.rows);const r=await s.query();
  assert.deepEqual(r,{orderId:'readonly_teacher',productId:'test_annual',amount:100,currency:'CNY',unit:'fen',paymentStatus:'awaiting_payment',grantStatus:'none',status:'awaiting_payment',userStatus:'PAYMENT_PROCESSING'});
  assert.deepEqual(s.db.rows,before);assert.equal(s.db.starts,0);assert.deepEqual(new Set(s.db.targets),new Set([COLLECTIONS.orders]));
});
test('both real-caller slots read their own order and reject the other order, including warm instance switches',async()=>{
  const s=setup();await assert.rejects(()=>s.query('readonly_second'),/ORDER_NOT_OWNED/);
  s.state.actor='second';assert.equal((await s.query('readonly_second')).orderId,'readonly_second');
  await assert.rejects(()=>s.query(),/ORDER_NOT_OWNED/);s.state.actor='teacher';assert.equal((await s.query()).orderId,'readonly_teacher');
});
test('missing order is UNKNOWN_ORDER rather than an ownership denial',async()=>{await assert.rejects(()=>setup().query('missing'),/^Error: UNKNOWN_ORDER$/);});
for(const field of ['teacherId','openid','openId','isAdmin','collection','env','batchId','testOnly']) {
  test(`client cannot select ${field} in My Orders`,async()=>{await assert.rejects(()=>setup().query('readonly_teacher',{[field]:'second'}),/UNEXPECTED_FIELDS/);});
}
test('untrusted envelope identity cannot replace native context',async()=>{
  const s=setup();s.state.actor='second';
  await assert.rejects(()=>s.runtime.orders({action:'queryOrder',request:{orderId:'readonly_teacher'},userInfo:{openId:'teacher',isAdmin:true},tcbContext:{OPENID:'teacher'}}),/ORDER_NOT_OWNED/);
});
test('wrong app, unknown teacher and member administrator do not bypass caller verification',async()=>{
  const s=setup();s.state.appId='wrong';await assert.rejects(s.query,/IDENTITY_NOT_VERIFIED/);
  s.state.appId=s.policy.config.appId;s.state.actor='outsider';await assert.rejects(s.query,/STAGE5_ACCOUNT_DENIED/);
  s.state.actor='admin';await assert.rejects(s.query,/STAGE5_ACCOUNT_DENIED/);
});
for(const field of ['batchId','scopeId','source','appId','cloudEnvId','offerId','paymentEnv']) {
  test(`stored ${field} mismatch rejected with no fallback collection`,async()=>{
    const s=setup();s.rows.teacher._stage5={...s.policy.stamp,[field]:'wrong'};
    await assert.rejects(s.query,/STAGE5_SCOPE_MISMATCH/);assert.deepEqual(new Set(s.db.targets),new Set([COLLECTIONS.orders]));
  });
}
test('order id and owner pairing must match the stored record',async()=>{
  const s=setup();s.rows.teacher.orderId='different';await assert.rejects(s.query,/ORDER_ID_MISMATCH/);
  s.rows.teacher.orderId='readonly_teacher';s.rows.teacher.openId='second';await assert.rejects(s.query,/STAGE5_ORDER_OWNER_MISMATCH/);
});
test('invalid stored price and incomplete record are rejected',async()=>{
  const s=setup();s.rows.teacher.amount=101;await assert.rejects(s.query,/INVALID_ORDER_RECORD/);
  s.rows.teacher.amount=100;delete s.rows.teacher.productSnapshot;await assert.rejects(s.query,/STAGE5_TEST_PRODUCT_REQUIRED/);
});
test('readonly reader does not relax mutation repository or any payment entry',async()=>{
  const s=setup();const repo=createStage5Repository(s.db,s.policy);const before=structuredClone(s.db.rows);
  await assert.rejects(()=>repo.get('orders','readonly_teacher'),/STAGE5_REAL_PAYMENT_ONLY/);
  await assert.rejects(()=>repo.transaction(tx=>tx.put('orders','readonly_teacher',{})),/STAGE5_REAL_PAYMENT_ONLY/);
  for(const action of ['createOrder','parameters'])await assert.rejects(()=>s.runtime.orders({action,request:{orderId:'readonly_teacher'}}),/STAGE5_REAL_PAYMENT_ONLY/);
  await assert.rejects(()=>s.runtime.compensate({}),/STAGE5_REAL_PAYMENT_ONLY/);
  await assert.rejects(()=>s.runtime.admin({action:'confirmPaidAndGrant',request:{orderId:'readonly_teacher'}}),/STAGE5_ADMIN_REQUIRED/);
  assert.deepEqual(s.db.rows,before);
});
test('real domain closed purchasing still serves normal My Orders without a credential provider',async()=>{
  const s=setup({source:'real_payment',offerId:'123',originalId:'gh_fixture',batchClosed:true});
  assert.equal((await s.query()).orderId,'readonly_teacher');
  await assert.rejects(()=>s.runtime.orders({action:'parameters',request:{orderId:'readonly_teacher'}}),/STAGE5_PURCHASE_DISABLED/);
});
test('payment engine normal repository uses identical ownership check and does not require payment secrets',async()=>{
  const s=setup();const row={...s.rows.teacher};const engine=createPaymentEngine({repository:{get:async(role,key)=>{assert.equal(role,'orders');return key===row.orderId?row:null;}},config:s.policy.config,
    getIdentity:async()=>({teacherId:s.state.actor,openId:s.state.actor,appId:s.state.appId}),api:new Proxy({},{get(){throw Error('NO_PAYMENT_CALL');}})});
  assert.equal((await engine.queryOrder({orderId:row.orderId})).orderId,row.orderId);
  s.state.actor='second';await assert.rejects(()=>engine.queryOrder({orderId:row.orderId}),/ORDER_NOT_OWNED/);
});
