'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {LocalSdk}=require('../membership-stage3/fixtures');
const {createBusinessRuntime,readConfig,APP_ID,ENV_ID}=require('../../cloudfunctions/membership-business/runtime');
const AT=Date.parse('2026-09-11T00:00:00Z');
function setup() {
 const db=new LocalSdk(),who={APPID:APP_ID,OPENID:'teacher',SOURCE:'wx_client'};
 const environment={MEMBERSHIP_BUSINESS_CONFIG:JSON.stringify({appId:APP_ID,envId:ENV_ID,
  enabledTeachers:['teacher'],administrators:['admin'],allTeachersEnabled:false}),MEMBERSHIP_PREVIEW_KEY:'local_key_for_tests_32_bytes_minimum'};
 const run=createBusinessRuntime({db,wxCloud:{getWXContext:()=>who},environment,clock:()=>AT});
 return {db,who,environment,run};
}
test('runtime rejects body identity, HTTP envelopes, forged APPID, absent native identity',async()=>{
 const s=setup();
 await assert.rejects(s.run({action:'status',teacherId:'other'}),/UNEXPECTED_FIELDS/);
 await assert.rejects(s.run({action:'status',headers:{}}),/UNEXPECTED_FIELDS/);
 s.who.APPID='other';await assert.rejects(s.run({action:'status'}),/IDENTITY_NOT_VERIFIED/);
 s.who.APPID=APP_ID;s.who.SOURCE='wx_http';await assert.rejects(s.run({action:'status'}),/IDENTITY_NOT_VERIFIED/);
 s.who.SOURCE='wx_devtools';assert.equal((await s.run({action:'status'})).enabled,true);
 s.who.APPID=APP_ID;delete s.who.OPENID;await assert.rejects(s.run({action:'status',userInfo:{openId:'teacher'}}),/IDENTITY_NOT_VERIFIED/);
});
test('unenrolled teacher cannot access business or admin',async()=>{
 const s=setup();
 s.who.OPENID='other';assert.equal((await s.run({action:'status'})).enabled,false);
 await assert.rejects(s.run({action:'authorizeLearning',request:{studentId:'s'}}),/BUSINESS_NOT_ENABLED/);
 await assert.rejects(s.run({action:'previewInitialization',request:{teacherId:'teacher'}}),/ADMIN_REQUIRED/);
});
test('runtime admin preview/apply uses protected evidence and no client classification',async()=>{
 const s=setup();s.who.OPENID='admin';
 const e={verified:true,operator:'admin',reference:'LOCAL_ONLY'};
 s.db.rows.set('membership_migration_evidence/teacher',{teacherId:'teacher',registeredAt:AT,registrationEvidence:e,classificationEvidence:e,sources:[],studentRefs:[]});
 const p=await s.run({action:'previewInitialization',request:{teacherId:'teacher'}});
 await s.run({action:'applyInitialization',request:Object.fromEntries(['teacherId','previewAt','factsHash','revision','token'].map(k=>[k,p[k]]))});
 s.who.OPENID='teacher';
 const added=await s.run({action:'addStudent',request:{requestId:'one',name:'Alice',grade:'G',joinDate:'2026-09-01'}});
 assert.equal(s.db.rows.get('students/'+added.studentId).joinDate,'2026-09-01');
 await assert.rejects(s.run({action:'addStudent',request:{requestId:'one',name:'Alice',grade:'G',joinDate:'2026-09-02'}}),/IDEMPOTENCY_CONFLICT/);
 const r=await s.run({action:'correctProfile',request:{requestId:'replace',studentId:added.studentId,name:'Bob',grade:'G',reason:'typo',intent:'correction'}});
 assert.equal(r.reviewRequired,true);
 assert.equal(s.db.rows.get('students/'+added.studentId).name,'Alice');
 const corrected=await s.run({action:'correctProfile',request:{requestId:'spacing',studentId:added.studentId,name:' Alice ',grade:'G',reason:'spacing',intent:'correction'}});
 assert.equal(corrected.name,'Alice');
 await assert.rejects(s.run({action:'syncExistingStudent',request:{studentId:'old',name:'Import'}}),/UNEXPECTED_FIELDS/);
 await assert.rejects(s.run({action:'syncExistingStudent',request:{studentId:'old'}}),/IMPORT_REQUIRES_REVIEW/);
});
test('configuration rejects a different environment or missing configuration',()=>{
 assert.throws(()=>readConfig({}),/BUSINESS_NOT_CONFIGURED/);
 const s=setup(),c=JSON.parse(s.environment.MEMBERSHIP_BUSINESS_CONFIG);c.envId='different';
 assert.throws(()=>readConfig({MEMBERSHIP_BUSINESS_CONFIG:JSON.stringify(c)}),/BUSINESS_CONFIG_INVALID/);
});
test('disabled uninitialized owner can verify existing backup student without rewriting data',async()=>{
 const s=setup();s.who.OPENID='legacy';
 const original={teacher_id:'legacy',student_id:'old',name:'Original',grade:'G',custom:{keep:1}};
 s.db.rows.set('students/old',original);const before=structuredClone(s.db.rows);
 assert.equal((await s.run({action:'syncExistingStudent',request:{studentId:'old'}})).name,'Original');
 assert.deepEqual(s.db.rows,before);
 await assert.rejects(s.run({action:'syncExistingStudent',request:{studentId:'missing'}}),/IMPORT_REQUIRES_REVIEW/);
 s.who.OPENID='other';await assert.rejects(s.run({action:'syncExistingStudent',request:{studentId:'old'}}),/STUDENT_NOT_OWNED/);
});
test('teacher display maintenance preserves alias identity and does not require a membership ledger',async()=>{
 const s=setup();s.who.OPENID='legacy';
 s.db.rows.set('students/alias',{teacher_id:'legacy',student_id:'old',name:'Student',grade:'G',custom:7});
 await s.run({action:'updateStudentDisplay',request:{studentId:'old',documentId:'alias',teacherName:'Teacher'}});
 const row=s.db.rows.get('students/alias');assert.equal(row.name,'Student');assert.equal(row.custom,7);assert.equal(row.teacher_name,'Teacher');
 assert.equal(s.db.rows.has('membership_ledgers/legacy'),false);
 s.who.OPENID='other';await assert.rejects(s.run({action:'updateStudentDisplay',request:{studentId:'old',documentId:'alias',teacherName:'Wrong'}}),/STUDENT_NOT_OWNED/);
});
