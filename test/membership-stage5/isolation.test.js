'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {setup,config,COLLECTIONS,BASE,hash,hmac}=require('./isolation-fixtures');
const {createPolicy,fromEnvironment}=require('../../cloudfunctions/membership-stage5/policy');
const {createStage5Repository}=require('../../cloudfunctions/membership-stage5/repository');
const {createStage5Runtime,makeMain,reviewEvidenceProvider,httpRequest}=require('../../cloudfunctions/membership-stage5/runtime');
const {entry}=require('../membership-stage4/fixtures');

test('Stage5 client access contract requires explicit business action',async()=>{
  const s=await setup();
  await assert.rejects(()=>s.runtime.access({action:'getMembershipAccess',request:{}}),/INVALID_ACTION/);
  const result=await s.runtime.access({action:'getMembershipAccess',request:{action:'ADD_STUDENT'}});
  assert.equal(result.allowed,true);assert.equal(result.freeSlotConsumed,false);
});

test('synthetic cloud access needs no invented payment identity but cannot become real payment',()=>{
  const input=config({source:'synthetic',offerId:null,originalId:null,purchaseEnabled:false,purchaseTeachers:[]});
  const p=createPolicy(input);assert.throws(()=>p.real(),/REAL_PAYMENT_ONLY/);
  assert.throws(()=>createPolicy({...input,source:'real_payment'}),/PAYMENT_IDENTITY_REQUIRED/);
  assert.throws(()=>createPolicy({...input,purchaseEnabled:true}),/PAYMENT_IDENTITY_REQUIRED/);
});

async function reviewed() {
  const s=await setup();const order=await s.create();await s.runtime.compensate(s.internal());
  const stored=await s.repository.get('orders',order.orderId);
  assert.equal(stored.paymentStatus,'review_required');
  const reference='official_fixture_reference';
  const evidence={...stored.review.candidate,reference,mode:'short_series_goods',status:'paid',offerId:stored.offerId,quantity:1};
  const record={kind:'official_order_evidence',reference,reviewerId:'admin',sourceReference:'ISOLATED_FIXTURE_ONLY',evidence};
  record.signature=hmac(s.environment.STAGE5_EVIDENCE_KEY,JSON.stringify({scopeId:s.policy.scopeId,reference,reviewerId:record.reviewerId,sourceReference:record.sourceReference,evidence}));
  await s.repository.transaction(tx=>tx.put('audits',`evidence_${hash(reference)}`,record));
  s.state.actor='admin';
  return {...s,order,confirm:()=>s.runtime.admin({action:'confirmPaidAndGrant',request:{orderId:order.orderId,evidence:{reference},reason:'Isolated official evidence fixture'}})};
}
test('signed evidence review grants once using original payment time and atomic audit',async()=>{
  const s=await reviewed();s.state.now+=86400000*5;
  s.db.fail=()=>true;await assert.rejects(s.confirm,/COMMIT_FAILURE/);
  assert.equal(await s.repository.get('ledgers','teacher'),null);
  await Promise.all([s.confirm(),s.confirm()]);
  const row=await s.repository.get('ledgers','teacher');assert.equal(row.grants.length,1);
  assert.equal(row.grants[0].startsAt,BASE);
  assert.equal(row.grants[0].endsAt,require('../../cloudfunctions/membership-core/time').addDuration(BASE,{months:12}));
  const audits=[...s.db.rows].filter(([key,value])=>key.startsWith(COLLECTIONS.audits+'/')&&value.before?.order);
  assert.equal(audits.length,1);assert.equal(audits[0][1].after.order.grantStatus,'granted');
  assert.ok(audits[0][1].evidenceHash);assert.ok(audits[0][1].operator);
});
test('valid signed goods notification cannot escape original batch',async()=>{
  const a=await setup();const order=await a.create();const event=await a.notification(order.orderId);
  const b=await setup({batchId:'batch_two'},a.db);
  assert.notEqual((await b.runtime.payment_notify(event)).statusCode,200);
  assert.equal(await b.repository.get('ledgers','teacher'),null);
  assert.equal(await a.repository.get('ledgers','teacher'),null);
});
test('mid-write failure rolls back free slot, projections and audit',async()=>{
  const s=await setup();const before=JSON.stringify([...s.db.rows]);s.db.calls=0;s.db.failAt=2;
  await assert.rejects(()=>s.runtime.access({action:'addStudent',request:{requestId:'mid',name:'Test'}}),/WRITE_FAILURE/);
  assert.equal(JSON.stringify([...s.db.rows]),before);
});
test('refunded review cannot be restored by admin or late signed success',async()=>{
  const s=await reviewed();
  const {encrypt,cryptoConfig}=require('../membership-stage3/fixtures');
  const event={ToUserName:s.policy.config.originalId,MsgType:'event',Event:'xpay_refund_notify',OpenId:'teacher',MchOrderId:s.order.orderId,WxOrderId:'tx_'+s.order.orderId,WxRefundId:'refund_fixture',RetCode:0,RefundFee:s.order.amount,RefundSuccTimestamp:BASE/1000};
  const response=await s.runtime.payment_notify(encrypt(event,{...cryptoConfig,appId:s.policy.config.appId,originalId:s.policy.config.originalId}));
  assert.equal(response.statusCode,200);
  await assert.rejects(s.confirm,/ORDER_NOT_REVIEWABLE/);
  await s.runtime.payment_notify(await s.notification(s.order.orderId));
  assert.equal(await s.repository.get('ledgers','teacher'),null);
});
test('Stage5 uses fixed test collections including transaction writes',async()=>{
  const s=await setup();const order=await s.create();
  assert.equal((await s.runtime.payment_notify(await s.notification(order.orderId))).statusCode,200);
  const row=await s.repository.get('ledgers','teacher');assert.equal(row.grants.length,1);
  assert.ok(s.db.targets.every(name=>Object.values(COLLECTIONS).includes(name)));
});

for(const field of ['cloudEnvId','appId','offerId','batchId','processingTeachers','source']) test(`missing protected ${field} fails closed`,()=>{
  const c=config();delete c[field];assert.throws(()=>createPolicy(c));
});
test('unknown map/environment and empty SDK reject without fallback',()=>{
  assert.throws(()=>createPolicy(config({cloudEnvId:'other'})),/WRONG_ENVIRONMENT/);
  assert.throws(()=>createPolicy({...config(),collectionPrefix:'membership_'}));
  assert.throws(()=>fromEnvironment({}),/NOT_CONFIGURED/);
  assert.throws(()=>createStage5Repository(null,createPolicy(config())),/DATABASE_REQUIRED/);
});
for(const name of ['orders','payment_notify','compensate','access','admin']) test(`exported ${name} bootstrap rejects missing config before loading SDK`,async()=>{
  const old=process.env.STAGE5_CONFIG_JSON;delete process.env.STAGE5_CONFIG_JSON;let loaded=false;
  try {await assert.rejects(()=>makeMain(name,()=>{loaded=true;throw Error('must not load');})({}),/NOT_CONFIGURED/);assert.equal(loaded,false);}
  finally {if(old===undefined)delete process.env.STAGE5_CONFIG_JSON;else process.env.STAGE5_CONFIG_JSON=old;}
});
for(const field of ['collection','env','teacherId','openid','batchId','isAdmin']) test(`client cannot select ${field}`,async()=>{
  const s=await setup();const before=s.db.rows.size;
  await assert.rejects(()=>s.runtime.orders({action:'createOrder',request:{productId:s.record.product.productId,requestId:'one',[field]:'forged'}}));
  assert.equal(s.db.rows.size,before);
});
test('forged transport identity never authenticates an outsider',async()=>{
  const s=await setup();s.state.actor='outside';
  for(const method of ['orders','access','admin']) await assert.rejects(()=>s.runtime[method]({action:'queryOrder',request:{orderId:'guess'},userInfo:{openId:'admin'},tcbContext:{OPENID:'admin'}}),/DENIED|ADMIN_REQUIRED/);
});
test('non-TEST product cannot be stored, purchased, or signed',async()=>{
  const s=await setup();const invalid={...s.record,product:{...s.record.product,testOnly:false,price:39900,allowedTestAccounts:[]}};
  await assert.rejects(()=>s.repository.transaction(tx=>tx.put('products','formal',invalid)),/TEST_PRODUCT_REQUIRED/);
  const address=[...s.db.rows.keys()][0];s.db.rows.get(address).product=invalid.product;
  await assert.rejects(()=>s.create(),/TEST_PRODUCT_REQUIRED/);
});
test('product account and channel constraints still apply',async()=>{
  const s=await setup({enabledChannels:[]});await assert.rejects(()=>s.create(),/CHANNEL_NOT_VERIFIED/);
  const t=await setup();await t.repository.transaction(tx=>tx.put('products',t.record.product.productId,{...t.record,product:{...t.record.product,allowedTestAccounts:['second']}}));
  await assert.rejects(()=>t.create(),/PRODUCT_NOT_AVAILABLE/);
});
test('order queries and parameters require owner and test account',async()=>{
  const s=await setup();const order=await s.create();s.state.actor='second';
  for(const action of ['queryOrder','parameters']) await assert.rejects(()=>s.runtime.orders({action,request:{orderId:order.orderId,...(action==='parameters'?{loginCode:'fixture'}:{})}}),/ORDER_NOT_OWNED/);
  s.state.actor='outside';await assert.rejects(()=>s.runtime.orders({action:'parameters',request:{orderId:order.orderId,loginCode:'fixture'}}),/ACCOUNT_DENIED/);
});
test('student ownership cannot be changed by known identifiers',async()=>{
  const s=await setup();const student=await s.runtime.access({action:'addStudent',request:{requestId:'one',name:'One'}});s.state.actor='second';
  const response=await s.runtime.access({action:'authorizeLearning',request:{studentId:student.studentId}});assert.equal(response.allowed,false);
  await assert.rejects(()=>s.runtime.access({action:'deleteStudent',request:{requestId:'delete',studentId:student.studentId,reason:'Test'}}),/STUDENT_NOT_OWNED/);
});
test('all fixed roles enforce unknown collection and corrupt scope rejection',async()=>{
  const s=await setup();await assert.rejects(()=>s.repository.get('arbitrary','one'),/INVALID_COLLECTION/);
  await assert.rejects(()=>s.repository.transaction(tx=>tx.put('membership_accounts','one',{})),/INVALID_COLLECTION/);
  const row=[...s.db.rows.values()][0];row._stage5.batchId='other';
  await assert.rejects(()=>s.repository.get('products',s.record.product.productId),/SCOPE_MISMATCH/);
});
test('two batches do not share orders, slots, students, or accounts',async()=>{
  const a=await setup();const b=await setup({batchId:'batch_two'},a.db);
  const x=await a.create('same');const y=await b.create('same');assert.notEqual(x.orderId,y.orderId);
  assert.equal(await b.repository.get('orders',x.orderId),null);
  await a.runtime.access({action:'addStudent',request:{requestId:'same',name:'One'}});
  assert.equal(await b.repository.get('ledgers','teacher'),null);
  await b.runtime.access({action:'addStudent',request:{requestId:'same',name:'Other'}});
  assert.equal((await a.repository.get('ledgers','teacher')).students[0].name,'One');
  assert.equal((await b.repository.get('ledgers','teacher')).students[0].name,'Other');
});
test('same real platform transaction cannot be claimed in another batch',async()=>{
  const a=await setup();const b=await setup({batchId:'batch_two'},a.db);
  for(const s of [a,b])s.p.state.queryChanges={wx_order_id:'same_real_transaction',wxpay_order_id:'same_cash_transaction'};
  const one=await a.create();const two=await b.create();
  assert.equal((await a.runtime.payment_notify(await a.notification(one.orderId))).statusCode,200);
  assert.equal((await b.runtime.payment_notify(await b.notification(two.orderId))).statusCode,503);
  assert.equal(await b.repository.get('ledgers','teacher'),null);
  assert.equal((await a.repository.get('ledgers','teacher')).grants.length,1);
});
test('synthetic source cannot create, notify, compensate, or hold payment grants',async()=>{
  const s=await setup({source:'synthetic'});await assert.rejects(()=>s.create(),/REAL_PAYMENT_ONLY/);
  assert.equal((await s.runtime.payment_notify({method:'POST',body:'{}',query:{}})).statusCode,503);
  await assert.rejects(()=>s.runtime.compensate(s.internal()),/REAL_PAYMENT_ONLY/);
  await assert.rejects(()=>s.repository.transaction(tx=>tx.put('grants','fake',{teacherId:'teacher',sourceType:'payment'})),/REAL_PAYMENT_ONLY/);
  assert.equal(await s.repository.get('ledgers','teacher'),null);
});
test('invalid and unknown notifications write only bounded redacted security records',async()=>{
  const s=await setup();for(let i=0;i<20;i++)assert.equal((await s.runtime.payment_notify({method:'POST',body:JSON.stringify({secret:'private-'+i}),query:{}})).statusCode,503);
  const rows=[...s.db.rows.entries()].filter(([k])=>k.startsWith(COLLECTIONS.events+'/'));
  assert.equal(rows.length,1);assert.equal(JSON.stringify(rows).includes('private-'),false);
  assert.ok(rows.every(([,v])=>v._stage5.scopeId===s.policy.scopeId));
});
test('notification and compensation competition grant once',async()=>{
  const s=await setup();const order=await s.create();const event=await s.notification(order.orderId);
  await Promise.all([s.runtime.payment_notify(event),s.runtime.payment_notify(event),s.runtime.compensate(s.internal())]);
  assert.equal((await s.repository.get('ledgers','teacher')).grants.length,1);
});
test('internal HMAC, replay, scope and scanning parameters are enforced',async()=>{
  const a=await setup();const b=await setup({batchId:'batch_two'},a.db);const request=a.internal();
  await assert.rejects(()=>b.runtime.compensate(request),/INTERNAL_AUTH_REQUIRED/);
  await a.runtime.compensate(request);await assert.rejects(()=>a.runtime.compensate(request),/REPLAY_REJECTED/);
  await assert.rejects(()=>a.runtime.compensate(a.internal({limit:20,teacherId:'other'},'OTHER_LOCAL_NONCE_123456')),/UNEXPECTED_FIELD/);
});
test('closing purchase and batch, including delisted product, preserves paid order processing',async()=>{
  const s=await setup();const order=await s.create();const event=await s.notification(order.orderId);
  const closed=await setup({purchaseEnabled:false,batchClosed:true,purchaseTeachers:[],enabledChannels:[]},s.db);
  await closed.repository.transaction(tx=>tx.put('products',s.record.product.productId,{...s.record,product:{...s.record.product,enabled:false}}));
  await assert.rejects(()=>closed.create('new'),/PURCHASE_DISABLED/);
  await assert.rejects(()=>closed.runtime.orders({action:'parameters',request:{orderId:order.orderId,loginCode:'fixture'}}),/PURCHASE_DISABLED/);
  assert.equal((await closed.runtime.payment_notify(event)).statusCode,200);
  await closed.runtime.compensate(closed.internal());
  assert.equal((await closed.runtime.orders({action:'queryOrder',request:{orderId:order.orderId}})).status,'granted');
});
test('free slot and audit rollback together on transaction commit failure',async()=>{
  const s=await setup();const before=JSON.stringify([...s.db.rows]);s.db.fail=()=>true;
  await assert.rejects(()=>s.runtime.access({action:'addStudent',request:{requestId:'one',name:'One'}}),/COMMIT_FAILURE/);
  assert.equal(JSON.stringify([...s.db.rows]),before);
  await s.runtime.access({action:'addStudent',request:{requestId:'one',name:'One'}});
  const reopened=await setup({},s.db);
  await assert.rejects(()=>reopened.runtime.access({action:'addStudent',request:{requestId:'two',name:'Two'}}),/FREE_SLOT/);
});
test('concurrent free-slot requests keep one student and one audit',async()=>{
  const s=await setup();const results=await Promise.allSettled(['one','two'].map(requestId=>s.runtime.access({action:'addStudent',request:{requestId,name:requestId}})));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const row=await s.repository.get('ledgers','teacher');assert.equal(row.students.length,1);assert.equal(row.audits.length,1);
});
test('two orders for one teacher concurrently preserve both grants',async()=>{
  const s=await setup();const one=await s.create('one');const two=await s.create('two');
  await Promise.all([one,two].map(async order=>s.runtime.payment_notify(await s.notification(order.orderId))));
  const row=await s.repository.get('ledgers','teacher');assert.equal(row.grants.length,2);
});
test('paid fact survives failed grant and recovers after process reconstruction and purchase close',async()=>{
  const s=await setup();const order=await s.create();s.db.fail=rows=>[...rows.keys()].some(k=>k.startsWith(COLLECTIONS.grants+'/'));
  assert.equal((await s.runtime.payment_notify(await s.notification(order.orderId))).statusCode,503);
  assert.equal((await s.repository.get('orders',order.orderId)).paymentStatus,'paid');
  assert.equal(await s.repository.get('ledgers','teacher'),null);
  const reopened=await setup({purchaseEnabled:false},s.db);await reopened.runtime.compensate(reopened.internal());
  assert.equal((await reopened.repository.get('ledgers','teacher')).grants.length,1);
});
test('ordinary teacher and administrator targeting non-test teacher cannot grant',async()=>{
  const s=await setup();await assert.rejects(()=>s.runtime.admin({action:'previewGrant',request:{teacherId:'teacher',entry:entry()}}),/ADMIN_REQUIRED/);
  s.state.actor='admin';await assert.rejects(()=>s.runtime.admin({action:'previewGrant',request:{teacherId:'outside',entry:entry()}}),/ACCOUNT_DENIED/);
});
test('synthetic admin gift and audit share ledger and transaction',async()=>{
  const s=await setup({source:'synthetic'});s.state.actor='admin';const input=entry();
  const preview=await s.runtime.admin({action:'previewGrant',request:{teacherId:'teacher',entry:input}});
  s.db.fail=()=>true;await assert.rejects(()=>s.runtime.admin({action:'applyGrant',request:{teacherId:'teacher',entry:input,previewToken:preview.token,previewAt:preview.previewAt}}),/COMMIT_FAILURE/);
  assert.equal(await s.repository.get('ledgers','teacher'),null);
  await s.runtime.admin({action:'applyGrant',request:{teacherId:'teacher',entry:input,previewToken:preview.token,previewAt:preview.previewAt}});
  const row=await s.repository.get('ledgers','teacher');assert.equal(row.grants.length,1);assert.equal(row.audits.length,1);
  const real=await setup({},s.db);assert.equal(await real.repository.get('ledgers','teacher'),null);
});
test('evidence reader rejects unsigned/manual verification and wrong signing key',async()=>{
  const s=await setup();const read=reviewEvidenceProvider(s.repository,s.policy,s.environment);
  await assert.rejects(()=>read('unknown','admin'),/EVIDENCE_REQUIRED/);
  await s.repository.transaction(tx=>tx.put('audits',`evidence_${hash('ref')}`,{kind:'official_order_evidence',reference:'ref',reviewerId:'admin',sourceReference:'official-record',evidence:{teacherId:'teacher',reference:'ref'},signature:'forged'}));
  await assert.rejects(()=>read('ref','admin'),/SIGNATURE_INVALID/);
  await assert.rejects(()=>reviewEvidenceProvider(s.repository,s.policy,{})('ref','admin'),/SECRET_NOT_CONFIGURED/);
});
test('missing payment credentials cannot return fake parameters or successful notification',async()=>{
  const s=await setup();const order=await s.create();const runtime=createStage5Runtime({db:s.db,wxCloud:s.wxCloud,policy:s.policy,environment:{}});
  await assert.rejects(()=>runtime.orders({action:'parameters',request:{orderId:order.orderId,loginCode:'fixture'}}),/CREDENTIAL_NOT_CONFIGURED/);
  assert.equal((await runtime.payment_notify({method:'POST',body:'{}',query:{}})).statusCode,503);
});
test('HTTP adapter preserves exact original body and has no simulated event action',()=>{
  const body=' {"Encrypt":"test"} ';assert.equal(httpRequest({httpMethod:'POST',body,queryStringParameters:{}}).body,body);
  assert.equal(httpRequest({httpMethod:'POST',body:Buffer.from(body).toString('base64'),isBase64Encoded:true}).body,body);
  assert.throws(()=>httpRequest({action:'simulatePaid'}),/INVALID_HTTP/);
});
test('access shares payment ledger and persists free slot in test namespace',async()=>{
  const s=await setup();const call=request=>s.runtime.access({action:'addStudent',request});
  await call({requestId:'first',name:'First'});
  await assert.rejects(()=>call({requestId:'second',name:'Second'}),/FREE_SLOT/);
  const order=await s.create();assert.equal((await s.runtime.payment_notify(await s.notification(order.orderId))).statusCode,200);
  await call({requestId:'second',name:'Second'});
  assert.equal((await s.repository.get('ledgers','teacher')).students.length,2);
});
