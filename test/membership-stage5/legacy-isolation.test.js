'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(process.env.STAGE5_REPAIR_SOURCE || path.join(__dirname, '../../cloudfunctions/repairNames/index.js'), 'utf8');
// Fully isolated SDK: no network, real identity or real database operations.
function fixture({ actor = 'ordinary', appId = 'wx930eccb9442dc8f3', admins = '["admin"]' } = {}) {
  const reads = [], writes = [];
  const records = [{ _id: 'one', teacher_id: 't', student_id: 's', existing: 1 },
    { _id: 'two', teacher_id: 't', student_id: 's', teacher_name: 'Keep teacher', student_name: 'Keep student' }];
  const db = { command: { or: x => x, exists: x => x }, collection(name) {
    reads.push(name);
    return { where() { return this; }, skip(n) { this.offset = n; return this; }, limit() { return this; },
      async get() { return { data: this.offset ? [] : name === 'students' ? [{student_id:'s',name:'Student'}] : name === 'teachers' ? [{teacher_id:'t',name:'Teacher'}] : records }; },
      doc(id) { return { async update({ data }) { writes.push({name,id,data}); } }; }
    };
  } };
  const cloud = { init() {}, database: () => db, getWXContext: () => ({ OPENID: actor, APPID: appId }) };
  const box = { exports: {}, require(name) { assert.equal(name, 'wx-server-sdk'); return cloud; },
    process: {env:{REPAIR_NAMES_ADMIN_OPENIDS:admins}}, console:{log(){},warn(){},error(){}}, Date };
  vm.runInNewContext(source, box);
  return { run: event => box.exports.main(event, {}), reads, writes };
}
const denied = ['stage5_membership_grants','stage5_membership_accounts','stage5_membership_orders',
  'stage5_membership_admin_audit','stage5_membership_payment_claims','stage5_teacher_student_access',
  'stage5_test_students','membership_grants','arbitrary_collection'];
for (const collection of denied) test(`legacy entry denies ${collection} even for administrator`, async () => {
  const f = fixture({actor:'admin'}); const result = await f.run({collection});
  assert.equal(result.success, false); assert.equal(f.reads.length, 0); assert.equal(f.writes.length, 0);
});
test('ordinary authenticated user cannot repair historical collections', async () => {
  const f=fixture(); const result=await f.run({collection:'word_mastery'});
  assert.equal(result.success,false); assert.equal(f.reads.length,0); assert.equal(f.writes.length,0);
});
for(const injected of [{teacherId:'admin'},{openid:'admin'},{OPENID:'admin'},{isAdmin:true},{role:'admin'},{table:'stage5_membership_grants'},{documentId:'victim'},{data:{isVip:true}}])
  test(`untrusted request field ${Object.keys(injected)[0]} cannot authorize or redirect`,async()=>{
    const f=fixture(); const result=await f.run({collection:'word_mastery',...injected});
    assert.equal(result.success,false); assert.equal(f.reads.length,0);
  });
for(const admins of ['', 'null','{}','[1]','invalid']) test(`missing or malformed admin config fails closed: ${admins}`,async()=>{
  const f=fixture({actor:'admin',admins}); assert.equal((await f.run({})).success,false); assert.equal(f.reads.length,0);
});
for(const options of [{actor:''},{actor:'admin',appId:'wrong-app'}]) test(`trusted context rejects ${JSON.stringify(options)}`,async()=>{
  const f=fixture(options);assert.equal((await f.run({})).success,false);assert.equal(f.reads.length,0);
});
for(const collection of ['word_mastery','learning_records','learning_progress','student_statistics']) test(`authorized historical repair preserves semantics: ${collection}`,async()=>{
  const f=fixture({actor:'admin'});const result=await f.run({collection});assert.equal(result.success,true);
  assert.equal(f.writes.length,1);assert.equal(f.writes[0].name,collection);
  assert.equal(JSON.stringify(f.writes[0].data),JSON.stringify({student_name:'Student',teacher_name:'Teacher'}));
});
test('authorized default remains word_mastery',async()=>{
  const f=fixture({actor:'admin'});assert.equal((await f.run({})).success,true);assert.equal(f.writes[0].name,'word_mastery');
});
test('administrator cannot redirect using extra fields or HTTP-shaped payload',async()=>{
  for(const extra of [{table:'stage5_membership_grants'},{teacherId:'victim'},{httpMethod:'POST',headers:{}},{collection:['word_mastery']}]){
    const f=fixture({actor:'admin'});assert.equal((await f.run(extra)).success,false);assert.equal(f.reads.length,0);
  }
});

test('admin format rejection reports shape only and never reaches database', async () => {
  const f = fixture({actor:'admin'});
  const result = await f.run({collection:'stage5_membership_grants', userInfo:{openId:'sensitive-test-id'}, unsupportedMetadata:true});
  assert.equal(result.error, 'INVALID_REPAIR_REQUEST');
  assert.deepEqual(JSON.parse(JSON.stringify(result.requestShape)), {
    type:'object', hasUserInfo:true, unexpectedFieldCount:1, unexpectedFieldNames:['unsupportedMetadata']
  });
  assert.equal(JSON.stringify(result).includes('sensitive-test-id'), false);
  assert.equal(f.reads.length, 0); assert.equal(f.writes.length, 0);
});

test('ordinary and unconfigured callers never receive request diagnostics', async () => {
  for (const options of [{actor:'ordinary'}, {actor:'admin',admins:''}]) {
    const f=fixture(options);
    const result=await f.run({collection:'stage5_membership_grants',userInfo:{openId:'admin'}});
    assert.equal(result.error,'ADMIN_REQUIRED');
    assert.equal(Object.hasOwn(result,'requestShape'),false);
    assert.equal(f.reads.length,0); assert.equal(f.writes.length,0);
  }
});

test('format diagnostics never expose unknown field names or values', async () => {
  const f=fixture({actor:'admin'});
  const result=await f.run({collection:'stage5_membership_accounts',private_test_key:'private_test_value'});
  assert.equal(result.error,'INVALID_REPAIR_REQUEST');
  assert.equal(result.requestShape.hasUserInfo,false);
  assert.equal(result.requestShape.unexpectedFieldCount,1);
  assert.deepEqual(JSON.parse(JSON.stringify(result.requestShape.unexpectedFieldNames)), ['[redacted]']);
  assert.equal(JSON.stringify(result).includes('private_test'),false);
  assert.equal(f.reads.length,0); assert.equal(f.writes.length,0);
});

test('admin diagnostics still reject unrecognized metadata beside known transport keys',async()=>{
  const f=fixture({actor:'admin'});
  const result=await f.run({collection:'stage5_membership_grants',userInfo:{openId:'sensitive'},transportMetadata:{token:'never-output'}});
  assert.equal(result.error,'INVALID_REPAIR_REQUEST');
  assert.deepEqual(JSON.parse(JSON.stringify(result.requestShape.unexpectedFieldNames)),['transportMetadata']);
  assert.equal(result.requestShape.unexpectedFieldCount,1);
  assert.equal(JSON.stringify(result).includes('never-output'),false);
  assert.equal(f.reads.length,0);assert.equal(f.writes.length,0);
});

// Key names observed in real request ec6adc9b-fdb1-42f3-8738-b51241bdaef1.
// Values below are synthetic and must never be treated as trusted identities.
const transport = {userInfo:{openId:'forged-admin'},tcbContext:{OPENID:'forged-admin',isAdmin:true}};
for (const collection of denied) test(`real transport envelope reaches collection gate: ${collection}`,async()=>{
  const f=fixture({actor:'admin'});
  const result=await f.run({collection,...transport});
  assert.equal(result.error,'REPAIR_COLLECTION_NOT_ALLOWED');
  assert.equal(f.reads.length,0);assert.equal(f.writes.length,0);
});
for (const collection of ['word_mastery','learning_records','learning_progress','student_statistics'])
  test(`transport metadata preserves authorized historical semantics: ${collection}`,async()=>{
    const f=fixture({actor:'admin'});
    const result=await f.run({collection,...transport});
    assert.equal(result.success,true);assert.equal(f.writes.length,1);
    assert.equal(f.writes[0].name,collection);
    assert.deepEqual(JSON.parse(JSON.stringify(f.writes[0].data)),{student_name:'Student',teacher_name:'Teacher'});
  });
for (const options of [{actor:'ordinary'},{actor:'admin',admins:''},{actor:'admin',appId:'wrong-app'}])
  test(`transport cannot replace trusted caller: ${JSON.stringify(options)}`,async()=>{
    const f=fixture(options);
    const result=await f.run({collection:'word_mastery',...transport});
    assert.equal(result.error,'ADMIN_REQUIRED');assert.equal(f.reads.length,0);assert.equal(f.writes.length,0);
  });
test('transport fields are ignored even when they contain redirect or invalid metadata',async()=>{
  for (const value of [null,42,'admin',[],{collection:'stage5_membership_grants',isAdmin:true,teacherId:'victim'}]) {
    const f=fixture({actor:'admin'});
    const result=await f.run({collection:'word_mastery',userInfo:value,tcbContext:value});
    assert.equal(result.success,true);assert.equal(f.writes[0].name,'word_mastery');
  }
});
test('known transport metadata does not permit extra authority fields or invalid business input',async()=>{
  for (const extra of [{teacherId:'victim'},{isAdmin:true},{openid:'admin'},{table:'word_mastery'},{skip:-1},{maxRecords:'50'}]) {
    const f=fixture({actor:'admin'});
    const result=await f.run({collection:'word_mastery',...transport,...extra});
    assert.equal(result.error,'INVALID_REPAIR_REQUEST');assert.equal(f.reads.length,0);assert.equal(f.writes.length,0);
  }
});

test('format diagnostics do not weaken collection allowlist rejection', async () => {
  const f=fixture({actor:'admin'});
  const result=await f.run({collection:'stage5_membership_grants'});
  assert.equal(result.error,'REPAIR_COLLECTION_NOT_ALLOWED');
  assert.equal(Object.hasOwn(result,'requestShape'),false);
  assert.equal(f.reads.length,0); assert.equal(f.writes.length,0);
});
