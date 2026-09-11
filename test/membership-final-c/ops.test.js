'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {setup,BASE,encrypt,cryptoConfig}=require('../membership-stage3/fixtures');
const {createOpsRuntime,APP_ID,ENV_ID}=require('../../cloudfunctions/membership-ops/runtime');
const {COLLECTIONS}=require('../../cloudfunctions/membership-ops/repository');
const {hash,hmac}=require('../../cloudfunctions/membership-payment/crypto');
const {canonical}=require('../../cloudfunctions/membership-core/model');
const {addMonths}=require('../../cloudfunctions/membership-core/time');
function fixture(){
  const f=setup({config:{appId:APP_ID},product:{productId:'teacher_member_12m',testOnly:false,price:39900,allowedTestAccounts:[]}});
  f.sdk.seed('products',f.item.productId,{product:f.item,appId:APP_ID,offerId:f.config.offerId,env:0,platformProductId:f.item.productId});
  let actor='admin',nonce=0;
  const config={appId:APP_ID,envId:ENV_ID,administrators:['admin'],internalOperators:['ops_local'],writeTeachers:['teacher','teacher2'],originalId:f.config.originalId,offerId:f.config.offerId,paymentEnv:0};
  const env={MEMBERSHIP_OPS_CONFIG:JSON.stringify(config),MEMBERSHIP_OPS_PREVIEW_KEY:'LOCAL_PREVIEW_ONLY_'.repeat(3),MEMBERSHIP_OPS_INTERNAL_KEY:'LOCAL_INTERNAL_ONLY_'.repeat(3),MEMBERSHIP_OPS_EVIDENCE_KEY:'LOCAL_EVIDENCE_ONLY_'.repeat(3),MEMBERSHIP_NOTIFICATION_TOKEN:cryptoConfig.token,MEMBERSHIP_NOTIFICATION_AES_KEY:cryptoConfig.encodingAESKey};
  const db={collection(name){return {where(filter){return {limit(){return {async get(){return {data:['teacher','teacher2'].includes(filter.teacher_id)?[{teacher_id:filter.teacher_id}]:[]};}};}};}};}};
  const repo={...f.repo,async list(role,filter,offset,limit){return [...f.sdk.rows.entries()].filter(([k,r])=>k.startsWith(COLLECTIONS[role]+'/')&&Object.entries(filter).every(([key,v])=>r[key]===v)).sort(([a],[b])=>a.localeCompare(b)).slice(offset,offset+limit).map(([,r])=>structuredClone(r));}};
  // Add only the two new collection roles to the same transactional fake SDK.
  const {createCloudbaseRepository}=require('../../cloudfunctions/membership-payment/repository');
  Object.assign(repo,createCloudbaseRepository(f.sdk,{collectionNames:COLLECTIONS,sleep:async()=>{}}));
  const runtime=createOpsRuntime({db,wxCloud:{getWXContext:()=>({APPID:APP_ID,OPENID:actor,SOURCE:'wx_client'})},environment:env,repository:repo,api:f.api,clock:()=>f.state.clock});
  const call=(action,request)=>runtime({action,request});
  async function internal(action,request){const body=JSON.stringify({operator:'ops_local',action,request}),timestamp=f.state.clock,n=`local_nonce_000000_${++nonce}`;return runtime({body,timestamp,nonce:n,signature:hmac(env.MEMBERSHIP_OPS_INTERNAL_KEY,canonical({scope:{appId:APP_ID,envId:ENV_ID,function:'membership_ops'},body,timestamp,nonce:n}))});}
  async function apply(r){const p=await call('previewGrant',r);assert.equal(p.state,'ready');return call('applyGrant',{request:r,previewAt:p.previewAt,revision:p.revision,token:p.token});}
  return {...f,repo,call,internal,apply,env,config,runtime,setActor:x=>{actor=x;}};
}
const history=(changes={})=>({kind:'historical',teacherId:'teacher',requestId:'h1',reason:'Synthetic receipt verification',paidAt:BASE,amount:20000,paymentReference:'receipt_001',evidence:'Synthetic original receipt fixture',timePrecision:'exact',...changes});
const gift=(changes={})=>({kind:'gift',teacherId:'teacher',requestId:'g1',reason:'Synthetic support compensation',startsAt:BASE,duration:{months:1},...changes});
test('historical preview/apply persists all projections, same payment with new request is idempotent',async()=>{
  const f=fixture(),r=history();const p=await f.call('previewGrant',r);assert.equal(await f.repo.get('ledgers','teacher'),null);
  const result=await f.call('applyGrant',{request:r,...Object.fromEntries(['previewAt','revision','token'].map(k=>[k,p[k]]))});
  assert.equal(result.account.effectiveExpiresAt,addMonths(BASE,12));
  const duplicate=await f.call('previewGrant',history({requestId:'h2'}));assert.equal(duplicate.state,'applied');
  const row=await f.repo.get('ledgers','teacher');assert.equal(row.grants.length,1);assert.equal(row.access,null);assert.equal(row.initialization,undefined);
  assert.ok(await f.repo.get('grants',result.grantId));assert.equal(row.audits.length,1);assert.ok(await f.repo.get('accounts','teacher'));
});
test('expired history stays expired; missing evidence, unknown identity and overlap enter review',async()=>{
  const f=fixture();await f.apply(history({paidAt:addMonths(BASE,1)-2*366*86400000}));assert.equal((await f.repo.get('accounts','teacher')).status,'expired');
  assert.equal((await f.call('previewGrant',history({requestId:'missing',paymentReference:'other',evidence:''}))).state,'review');
  assert.equal((await f.call('previewGrant',history({requestId:'unknown',teacherId:'unknown'}))).state,'review');
  const g=fixture();await g.apply(gift());assert.equal((await g.call('previewGrant',history())).state,'review');
});
test('same historical payment cannot be applied to another teacher',async()=>{
  const f=fixture();await f.apply(history());assert.equal((await f.call('previewGrant',history({teacherId:'teacher2'}))).state,'review');
});
test('gift and long term preserve independent awards and audit',async()=>{
  const f=fixture();await f.apply(gift());await f.apply({kind:'longTerm',teacherId:'teacher',requestId:'l1',reason:'Synthetic internal person',startsAt:BASE});
  await f.apply(gift({requestId:'g2'}));const row=await f.repo.get('ledgers','teacher');assert.equal(row.account.status,'long_term');assert.equal(row.audits.length,3);assert.equal(row.grants.length,3);
});
test('adjustment requires reason and targets one grant; unrelated grant remains',async()=>{
  const f=fixture(),g=await f.apply(gift());await f.apply(gift({requestId:'g2'}));
  await assert.rejects(f.call('previewGrant',{kind:'adjustment',teacherId:'teacher',requestId:'a1',reason:'',startsAt:BASE,operation:'revoke_remaining',targetGrantId:g.grantId}),/REASON_REQUIRED/);
  await f.apply({kind:'adjustment',teacherId:'teacher',requestId:'a1',reason:'Correct synthetic grant',startsAt:BASE,operation:'revoke_remaining',targetGrantId:g.grantId});
  const row=await f.repo.get('ledgers','teacher');assert.equal(row.account.periods.length,1);assert.equal(row.audits.at(-1).source,'admin_adjustment');assert.ok(row.audits.at(-1).before);
});
test('stale/tampered preview and commit failure cause no partial grant',async()=>{
  const f=fixture(),r=gift(),p=await f.call('previewGrant',r);
  await assert.rejects(f.call('applyGrant',{request:{...r,duration:{months:120}},previewAt:p.previewAt,revision:p.revision,token:p.token}),/PREVIEW_STALE/);
  f.sdk.fail=rows=>[...rows.keys()].some(k=>k.startsWith('membership_grants/'));await assert.rejects(f.call('applyGrant',{request:r,previewAt:p.previewAt,revision:p.revision,token:p.token}),/INJECTED_COMMIT/);assert.equal(await f.repo.get('ledgers','teacher'),null);
});
test('ordinary client cannot call any operations or spoof administrator',async()=>{
  const f=fixture();f.setActor('ordinary');for(const action of ['getTeacher','previewGrant','applyGrant','listAudit','listReview','confirmPaidAndGrant','processRefund','recordEvidence'])await assert.rejects(f.call(action,{teacherId:'teacher'}),/ADMIN_REQUIRED/);
  await assert.rejects(f.runtime({action:'listAudit',request:{},userInfo:{OPENID:'admin'}}),/ADMIN_REQUIRED/);
});
test('payment review never grants, reject/hold is audited and stays pending',async()=>{
  const f=fixture(),o=await f.create();await f.engine.reconcile(o.orderId);assert.equal(await f.repo.get('ledgers','teacher'),null);
  const list=await f.call('listReview',{});assert.equal(list.items.length,1);
  for(const decision of ['reject','hold'])await f.call('reviewDecision',{orderId:o.orderId,requestId:decision,reason:'Synthetic review',decision});
  assert.equal((await f.repo.get('orders',o.orderId)).paymentStatus,'review_required');assert.equal((await f.call('listAudit',{})).items.filter(a=>a.action==='reviewDecision').length,2);
});
async function pending(f){const o=await f.create();await f.engine.reconcile(o.orderId);const row=await f.repo.get('orders',o.orderId);return {o,row,payload:{...row.review.candidate,mode:'short_series_goods',status:'paid',quantity:1,offerId:row.offerId}};}
async function record(f,orderId,payload,kind='official_order',reference='official_1'){if(kind==='official_refund')payload=encrypt(payload,{...cryptoConfig,appId:APP_ID,originalId:f.config.originalId});await f.internal('recordEvidence',{reference,kind,orderId,sourceReference:'Synthetic official export',payload,reason:'Synthetic evidence verification'});return reference;}
test('confirmPaidAndGrant reuses trusted snapshot, fresh paidAt and atomic audit; duplicate safe',async()=>{
  const f=fixture(),{o,payload}=await pending(f);await record(f,o.orderId,payload);
  const r={orderId:o.orderId,requestId:'confirm1',reference:'official_1',reason:'Synthetic confirmed'};
  await f.call('confirmPaidAndGrant',r);await f.call('confirmPaidAndGrant',r);
  const row=await f.repo.get('ledgers','teacher');assert.equal(row.grants.length,1);assert.equal(row.grants[0].startsAt,BASE);assert.equal((await f.call('listAudit',{orderId:o.orderId})).items.length,2);
});
test('wrong amount/product evidence and stale refunded balance reject confirmation',async()=>{
  for(const patch of [{amount:1},{productId:'wrong'}]){const f=fixture(),{o,payload}=await pending(f);await record(f,o.orderId,{...payload,...patch});await assert.rejects(f.call('confirmPaidAndGrant',{orderId:o.orderId,requestId:'c1',reference:'official_1',reason:'Test'}),/MISMATCH/);assert.equal(await f.repo.get('ledgers','teacher'),null);}
  const f=fixture(),{o,payload}=await pending(f);await record(f,o.orderId,payload);f.state.queryChanges.left_fee=0;
  await assert.rejects(f.call('confirmPaidAndGrant',{orderId:o.orderId,requestId:'c1',reference:'official_1',reason:'Test'}),/REFUND_BALANCE_REQUIRES_REVIEW/);
});
test('refund only revokes matching payment, preserves gift/history/other payment/long term; no regrant',async()=>{
  const f=fixture();await f.apply(history({paidAt:BASE-400*86400000}));await f.apply(gift());
  const a=await f.create('a');await f.engine.authenticatedEvent(await f.event(a.orderId));const b=await f.create('b');await f.engine.authenticatedEvent(await f.event(b.orderId));
  await f.apply({kind:'longTerm',teacherId:'teacher',requestId:'l1',startsAt:BASE,reason:'Synthetic'});
  const before=(await f.repo.get('ledgers','teacher')).grants;
  const ev=await f.refundEvent(a.orderId);await record(f,a.orderId,ev,'official_refund','refund1');
  const r={orderId:a.orderId,requestId:'r1',reference:'refund1',reason:'Official synthetic refund'};
  await f.call('processRefund',r);await f.call('processRefund',r);
  const row=await f.repo.get('ledgers','teacher');assert.equal(row.account.status,'long_term');assert.equal(row.grants.length,before.length+1);
  for(const g of before)assert.deepEqual(row.grants.find(x=>x.grantId===g.grantId),g);
  assert.equal(row.grants.find(g=>g.sourceType==='refund_adjustment').targetGrantId,(await f.repo.get('orders',a.orderId)).grantId);
  assert.equal((await f.repo.get('orders',b.orderId)).grantStatus,'granted');assert.ok(row.account.periods.every(p=>p.endsAt>=p.startsAt));
  await assert.rejects(f.call('confirmPaidAndGrant',{...r,requestId:'again'}),/ORDER_NOT_REVIEWABLE/);
  assert.ok((await f.call('listAudit',{orderId:a.orderId})).items.some(a=>a.action==='refund'));
});
test('partial or failed refund preserves all grants and is reviewable',async()=>{
  const f=fixture(),o=await f.create();await f.engine.authenticatedEvent(await f.event(o.orderId));const before=await f.repo.get('ledgers','teacher');
  await record(f,o.orderId,await f.refundEvent(o.orderId,{RefundFee:1}),'official_refund','partial');
  const result=await f.call('processRefund',{orderId:o.orderId,requestId:'r1',reference:'partial',reason:'Needs review'});assert.equal(result.state,'review');assert.deepEqual(await f.repo.get('ledgers','teacher'),before);
});
test('external admin cannot upload evidence; signed operator cannot fake refund kind to grant goods',async()=>{
  const f=fixture(),{o}=await pending(f);await assert.rejects(f.call('recordEvidence',{}),/INTERNAL_EVIDENCE_OPERATOR_REQUIRED/);
  await record(f,o.orderId,await f.event(o.orderId),'official_refund','bad');
  await assert.rejects(f.call('processRefund',{orderId:o.orderId,requestId:'x',reference:'bad',reason:'Synthetic'}),/REFUND_IDENTITY_MISMATCH/);
});
test('teacher query, official query and redacted audit are usable',async()=>{
  const f=fixture();await f.apply(gift());assert.equal((await f.call('getTeacher',{teacherId:'teacher'})).account.status,'active');
  const {o}=await pending(f);assert.equal((await f.call('queryOfficial',{orderId:o.orderId,requestId:'q',reason:'Read official'})).state,'paid');
  const view=await f.call('getOrder',{orderId:o.orderId});assert.equal(view.openId,undefined);assert.equal(view.signData,undefined);assert.equal(view.teacherId,undefined);
});
test('signed internal replay/tampering and unlisted write identity fail closed',async()=>{
  const f=fixture(),{prepare}=require('../../scripts/membership-ops');
  const envelope=prepare({operator:'ops_local',action:'listAudit',request:{}},f.env.MEMBERSHIP_OPS_INTERNAL_KEY,()=>f.state.clock).params;
  await assert.rejects(f.runtime({...envelope,signature:'forged'}),/ADMIN_REQUIRED/);
  await f.runtime(envelope);await assert.rejects(f.runtime(envelope),/INTERNAL_REPLAY_REJECTED/);
  await assert.rejects(f.call('applyGrant',{request:{teacherId:'ordinary'}}),/TEACHER_WRITE_NOT_ENABLED/);
});
test('concurrent identical applies grant once and preserve legacy fields byte-for-byte',async()=>{
  const f=fixture();const legacy={teacherId:'teacher',revision:7,grants:[],access:null,students:[{legacy:true}],studentRefs:{old:'old_document'},initialization:{state:'pending',arbitrary:'kept'},extra:{sync:'unchanged'}};
  f.sdk.seed('ledgers','teacher',legacy);const r=gift(),p=await f.call('previewGrant',r),input={request:r,previewAt:p.previewAt,revision:p.revision,token:p.token};
  const results=await Promise.all([f.call('applyGrant',input),f.call('applyGrant',input)]);assert.equal(results[0].grantId,results[1].grantId);
  const row=await f.repo.get('ledgers','teacher');assert.equal(row.grants.length,1);for(const key of ['students','studentRefs','initialization','extra','access'])assert.deepEqual(row[key],legacy[key]);
});
test('review queue records insufficient historical evidence for later operator lookup',async()=>{
  const f=fixture();await f.call('previewGrant',history({evidence:''}));const list=await f.call('listHistoricalReviews',{});assert.equal(list.items.length,1);assert.equal(list.items[0].request.paymentReference,'receipt_001');
});
test('even signed administrator plain refund assertions are held for review, never revoke',async()=>{
  const f=fixture(),o=await f.create();await f.engine.authenticatedEvent(await f.event(o.orderId));const before=await f.repo.get('ledgers','teacher');
  const r=await f.internal('recordEvidence',{reference:'plain',kind:'official_refund',orderId:o.orderId,sourceReference:'Unverified manual assertion',payload:await f.refundEvent(o.orderId),reason:'Insufficient proof'});
  assert.equal(r.state,'review');assert.equal(await f.repo.get('evidence','plain'),null);assert.deepEqual(await f.repo.get('ledgers','teacher'),before);
});
test('new review path feeds natural Chinese pending display without internal status names',async()=>{
  const f=fixture(),{row}=await pending(f);const {orderModel}=require('../../cloudfunctions/membership-presentation/model');
  const model=orderModel(row,{teacherId:'teacher',grants:[]},{durationText:'12个月'},BASE);assert.equal(model.pending,true);assert.equal(model.statusText,'正在确认');assert.ok(!JSON.stringify(model).includes('PAYMENT_PENDING_REVIEW'));
});
test('failed confirm transaction cannot leave an unaudited payment grant',async()=>{
  const f=fixture(),{o,payload}=await pending(f);await record(f,o.orderId,payload);
  f.sdk.fail=rows=>[...rows.keys()].some(k=>k.startsWith('membership_grants/'));
  await assert.rejects(f.call('confirmPaidAndGrant',{orderId:o.orderId,requestId:'c',reference:'official_1',reason:'Synthetic'}),/INJECTED_COMMIT/);
  assert.equal(await f.repo.get('ledgers','teacher'),null);assert.equal((await f.repo.get('orders',o.orderId)).grantStatus,'none');
});
