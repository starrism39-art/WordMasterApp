'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {LocalSdk}=require('../membership-stage3/fixtures');
const {createBusinessRepository}=require('../../cloudfunctions/membership-business/repository');
const {createPersonalTransition}=require('../../cloudfunctions/membership-business/personal-transition');
const {createAccessService}=require('../../cloudfunctions/membership-access/service');
const {readConfig,APP_ID,ENV_ID}=require('../../cloudfunctions/membership-business/runtime');
const AT=Date.parse('2026-09-11T08:00:00Z'),DAY=86400000;
function setup(){
 const db=new LocalSdk(),state={now:AT};
 const repository=createBusinessRepository(db,{clock:()=>state.now,sleep:async()=>{}});
 const getStudents=async owner=>[...db.rows].filter(([key,value])=>key.startsWith('students/')&&value.teacher_id===owner).map(([key,value])=>({...structuredClone(value),_id:key.slice(9)}));
 const personal=createPersonalTransition({repository,getStudents,isLegacy:t=>t!=='new',clock:()=>state.now,previewKey:'LOCAL_ONLY_PREVIEW_KEY_32_CHARS_MINIMUM'});
 function seed(t,id){db.rows.set('students/'+id,{teacher_id:t,student_id:id,name:'Student '+id,grade:'G',untouched:{old:true}});}
 const access=t=>createAccessService({repository,getIdentity:async()=>({teacherId:t}),clock:()=>state.now});
 function proof(kind,source){const e={verified:true,operator:'admin',reference:'LOCAL_ONLY'};db.rows.set('membership_migration_evidence/t',{teacherId:'t',classificationEvidence:e,sources:[{kind,sourceId:source,startsAt:state.now,duration:{months:12},amount:19900,timePrecision:'exact',evidence:e}]});}
 return {db,state,personal,seed,access,proof};
}
test('first native open is atomic and idempotent across concurrent devices; no open consumes no time',async()=>{
 const s=setup();s.seed('t','s1');s.seed('t','s2');s.seed('u','u1');
 assert.equal(s.db.rows.has('membership_ledgers/t'),false);
 const results=await Promise.all([s.personal.open('t'),s.personal.open('t')]);
 assert.equal(results[0].transitionStartedAt,AT);assert.equal(results[1].transitionStartedAt,AT);
 s.state.now+=2*DAY;assert.equal((await s.personal.open('t')).transitionStartedAt,AT);
 assert.equal((await s.personal.open('u')).transitionStartedAt,AT+2*DAY);
 assert.equal([...s.db.rows.values()].filter(x=>x.actionType==='membership_first_new_version_open'&&x.teacherId==='t').length,1);
});
test('personal five-day boundary permits all legacy students then requires fixed selection without deleting data',async()=>{
 const s=setup();s.seed('t','s1');s.seed('t','s2');const original=structuredClone(s.db.rows);
 await s.personal.open('t');s.state.now=AT+5*DAY-1;
 assert.equal((await s.access('t').authorizeLearning({studentId:'s2'})).allowed,true);
 s.state.now++;await s.personal.open('t');
 assert.equal(s.db.rows.get('membership_ledgers/t').initialization.classification,'free');
 assert.equal((await s.access('t').authorizeLearning({studentId:'s2'})).reasonCode,'MEMBER_EXPIRED_NEEDS_RETAINED_STUDENT');
 await s.access('t').selectRetainedStudent({requestId:'retain',studentId:'s1'});
 assert.equal((await s.access('t').authorizeLearning({studentId:'s1'})).allowed,true);
 assert.equal((await s.access('t').authorizeLearning({studentId:'s2'})).allowed,false);
 for(const [key,value] of original)assert.deepEqual(s.db.rows.get(key),value);
});
test('new native teacher has no buffer and first open never resets lifetime slot',async()=>{
 const s=setup();const first=await s.personal.open('new');assert.equal(first.transitionStartedAt,null);assert.equal(first.classification,'free');
 await s.access('new').addStudent({requestId:'first',name:'N'});s.state.now+=10*DAY;await s.personal.open('new');
 assert.equal(s.db.rows.get('teacher_student_access/new').freeSlotConsumed,true);
});

for(const kind of ['historical','long-term','gift'])test(kind+' evidence before first open cannot block personal timer; existing grants also cannot bypass it',async()=>{
 const s=setup();s.seed('t','s1');s.seed('t','s2');s.proof(kind,'preexisting_'+kind);
 assert.equal((await s.personal.open('t')).transitionStartedAt,AT);
 const p=await s.personal.previewOverride('t');
 await s.personal.applyOverride(Object.fromEntries(['teacherId','revision','factsHash','previewAt','token'].map(k=>[k,p[k]])),'admin');
 const row=s.db.rows.get('membership_ledgers/t');
 assert.equal(row.initialization.classification,kind);
 const grants=structuredClone(row.grants);
 // Model an administrative initialization that has never opened the feature.
 row.transitionStartedAt=null;row.access.transitionStartedAt=null;row.access.transitionStartsAt=null;row.access.transitionEndsAt=null;
 s.state.now+=DAY;
 assert.equal((await s.personal.open('t')).transitionStartedAt,AT+DAY);
 assert.deepEqual(s.db.rows.get('membership_ledgers/t').grants,grants);
 s.state.now+=DAY;assert.equal((await s.personal.open('t')).transitionStartedAt,AT+DAY);
 assert.equal((await s.access('t').authorizeLearning({studentId:'s2'})).allowed,true);
});

for(const kind of ['historical','gift','long-term'])test(kind+' overrides candidate through protected preview and an idempotent source grant',async()=>{
 const s=setup();s.seed('t','s1');await s.personal.open('t');s.proof(kind,'source_'+kind);
 const p=await s.personal.previewOverride('t');const {teacherId,revision,factsHash,previewAt,token}=p;
 const request={teacherId,revision,factsHash,previewAt,token};await s.personal.applyOverride(request,'admin');await s.personal.applyOverride(request,'admin');
 const row=s.db.rows.get('membership_ledgers/t');assert.equal(row.initialization.classification,kind);assert.equal(row.grants.length,1);assert.equal(row.transitionStartedAt,AT);
 assert.equal(row.access.freeSlotConsumed,true);s.state.now+=6*DAY;await s.personal.open('t');assert.equal(s.db.rows.get('membership_ledgers/t').initialization.classification,kind);
});
test('later finite gift cannot shorten long-term entitlement',async()=>{
 const s=setup();await s.personal.open('t');s.proof('long-term','forever');let p=await s.personal.previewOverride('t');
 const request=p=>Object.fromEntries(['teacherId','revision','factsHash','previewAt','token'].map(k=>[k,p[k]]));
 await s.personal.applyOverride(request(p),'admin');s.state.now+=DAY;s.proof('gift','gift_later');p=await s.personal.previewOverride('t');await s.personal.applyOverride(request(p),'admin');
 assert.equal(s.db.rows.get('membership_accounts/t').status,'long_term');assert.equal(s.db.rows.get('membership_ledgers/t').grants.length,2);
 assert.equal(s.db.rows.get('membership_ledgers/t').initialization.classification,'long-term');
});
test('explicit review overrides candidate and is not automatically closed as free',async()=>{
 const s=setup();await s.personal.open('t');s.db.rows.set('membership_migration_evidence/t',{teacherId:'t',review:true});
 const p=await s.personal.previewOverride('t');await s.personal.applyOverride(Object.fromEntries(['teacherId','revision','factsHash','previewAt','token'].map(k=>[k,p[k]])),'admin');
 s.state.now+=6*DAY;assert.equal((await s.personal.open('t')).classification,'review');
});
test('old data remains byte-identical; direct profile replacement cannot be used as an authorized student',async()=>{
 const s=setup();s.seed('t','s1');for(const c of ['learning_records','word_mastery','learning_progress','student_statistics'])s.db.rows.set(c+'/old',{owner:'t',legacy:[1,2]});
 const before=structuredClone(s.db.rows);await s.personal.open('t');await s.access('t').authorizeReview({studentId:'s1'});
 for(const [k,v]of before)assert.deepEqual(s.db.rows.get(k),v);
 s.db.rows.get('students/s1').name='Someone else';await assert.rejects(s.access('t').authorizeLearning({studentId:'s1'}),/STUDENT_PROFILE_REVIEW_REQUIRED/);
 assert.equal(s.db.rows.get('membership_ledgers/t').students[0].name,'Student s1');
});
test('configuration no longer requires a global rolloutAt',()=>{
 assert.equal(readConfig({MEMBERSHIP_BUSINESS_CONFIG:JSON.stringify({appId:APP_ID,envId:ENV_ID,enabledTeachers:[],administrators:[],allTeachersEnabled:false})}).allTeachersEnabled,false);
});
test('protected pending source or review prevents automatic free closure',async()=>{
 for(const pending of [{review:true},{sources:[{kind:'historical'}]}]){
  const s=setup();await s.personal.open('t');s.state.now+=6*DAY;
  s.db.rows.set('membership_migration_evidence/t',{teacherId:'t',...pending});
  assert.equal((await s.personal.open('t')).classification,'review');
  assert.equal(s.db.rows.get('membership_ledgers/t').initialization.classification,'legacy_free_candidate');
 }
});
test('a historical deleted student fact consumes the slot on first enrollment',async()=>{
 const s=setup();s.seed('new','deleted');s.db.rows.get('students/deleted').deleted=true;
 await s.personal.open('new');assert.equal(s.db.rows.get('teacher_student_access/new').freeSlotConsumed,true);
});
test('native first-open endpoint rejects client timestamps and teacherId before any writes',async()=>{
 const {createBusinessRuntime}=require('../../cloudfunctions/membership-business/runtime');
 const db=new LocalSdk(),environment={MEMBERSHIP_BUSINESS_CONFIG:JSON.stringify({appId:APP_ID,envId:ENV_ID,enabledTeachers:['native'],administrators:[],allTeachersEnabled:false})};
 const run=createBusinessRuntime({db,environment,wxCloud:{getWXContext:()=>({APPID:APP_ID,OPENID:'native',SOURCE:'wx_client'})},clock:()=>AT});
 for(const request of [{teacherId:'other'},{transitionStartedAt:AT+1},{classification:'legacy_free_candidate'}])
  await assert.rejects(run({action:'openMembership',request}),/UNEXPECTED_FIELDS/);
 assert.equal(db.rows.size,0);
});
