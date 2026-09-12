'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {LocalSdk}=require('../membership-stage3/fixtures');
const {createBusinessRepository}=require('../../cloudfunctions/membership-business/repository');
const {createPersonalTransition}=require('../../cloudfunctions/membership-business/personal-transition');
const {createLegacyEligibility,eligible,readTeachers,KEY}=require('../../cloudfunctions/membership-business/legacy-eligibility');
const AT=1800000000000;
function setup(){
 const db=new LocalSdk(),repository=createBusinessRepository(db,{sleep:async()=>{}}),state={now:AT};
 const rows=()=>[...db.rows].filter(([k])=>k.startsWith('teachers/')).map(([k,v])=>({_id:k.slice(9),...v}));
 const snapshot=createLegacyEligibility({repository,getTeachers:async()=>rows(),clock:()=>state.now});
 const personal=createPersonalTransition({repository,getStudents:async()=>[],clock:()=>state.now,previewKey:'LOCAL_ONLY_PREVIEW_KEY_32_CHARS_MINIMUM'});
 return {db,repository,state,snapshot,personal};
}
test('automatic identity-neutral immutable snapshot starts no timers; subsequent native opens alone start five days',async()=>{
 const s=setup();
 for(const role of ['ordinary','historical','internal','gift'])s.db.rows.set('teachers/'+role,{teacher_id:role,_openid:role,userRole:role});
 s.db.rows.set('teachers/duplicate',{teacher_id:'ordinary'});
 for(const c of ['students','learning_records','word_mastery','learning_progress','student_statistics','review_records','anti_forgetting','sync'])s.db.rows.set(c+'/old',{legacy:[1,2]});
 const before=structuredClone(s.db.rows);
 const [a,b]=await Promise.all([s.snapshot.capture('admin'),s.snapshot.capture('admin')]);assert.deepEqual(a,b);assert.equal(a.count,4);
 assert.equal(s.db.rows.size,before.size+1);
 for(const [k,v] of before)assert.deepEqual(s.db.rows.get(k),v);
 assert.equal(JSON.stringify(s.db.rows.get('membership_migration_evidence/'+KEY)).includes('transitionStartedAt'),false);
 s.db.rows.set('teachers/new',{teacher_id:'new'});s.state.now+=86400000;
 assert.deepEqual(await s.snapshot.capture('admin'),a);
 for(const role of ['ordinary','historical','internal','gift']){
  assert.equal(await eligible(s.repository.base,role),true);
  const kind=role==='internal'?'long-term':role;
  if(role!=='ordinary'){
   const e={verified:true,operator:'admin',reference:'LOCAL_ONLY'};
   s.db.rows.set('membership_migration_evidence/'+role,{teacherId:role,classificationEvidence:e,sources:[{kind,sourceId:'source_'+role,startsAt:s.state.now,duration:{months:12},amount:19900,timePrecision:'exact',evidence:e}]});
  }
  assert.equal((await s.personal.open(role)).transitionStartedAt,s.state.now);
  if(role!=='ordinary'){
   const p=await s.personal.previewOverride(role);
   await s.personal.applyOverride(Object.fromEntries(['teacherId','revision','factsHash','previewAt','token'].map(k=>[k,p[k]])),'admin');
   const row=s.db.rows.get('membership_ledgers/'+role);
   assert.equal(row.initialization.classification,kind);assert.equal(row.grants.length,1);assert.equal(row.transitionStartedAt,s.state.now);
  }
 }
 assert.equal(await eligible(s.repository.base,'new'),false);
 assert.equal((await s.personal.open('new')).transitionStartedAt,null);
 const start=s.state.now;s.state.now+=86400000;
 const anotherDevice=createPersonalTransition({repository:s.repository,getStudents:async()=>[],clock:()=>s.state.now});
 assert.equal((await anotherDevice.open('ordinary')).transitionStartedAt,start);
 for(const [k,v] of before)assert.deepEqual(s.db.rows.get(k),v);
});
test('missing/corrupt snapshot fails closed; changing or conflicting source never seals',async()=>{
 const s=setup();await assert.rejects(s.personal.open('old'),/LEGACY_SNAPSHOT_REQUIRED/);
 let n=0;const capture=createLegacyEligibility({repository:s.repository,getTeachers:async()=>[{teacher_id:'t'+n++}]});
 await assert.rejects(capture.capture('admin'),/SOURCE_CHANGED/);assert.equal(s.db.rows.size,0);
 s.db.rows.set('teachers/bad',{teacher_id:'a',_openid:'b'});
 await assert.rejects(s.snapshot.capture('admin'),/IDENTITY_CONFLICT/);
 s.db.rows.set('membership_migration_evidence/'+KEY,{policy:KEY,state:'sealed',teacherHashes:[],digest:'corrupt'});
 await assert.rejects(s.personal.open('old'),/LEGACY_SNAPSHOT_REQUIRED/);
});
test('failed snapshot commit leaves no partial eligibility and can retry',async()=>{
 const s=setup();s.db.rows.set('teachers/old',{teacher_id:'old'});
 s.db.fail=()=>true;
 await assert.rejects(s.snapshot.capture('admin'),/INJECTED_COMMIT_FAILURE/);
 assert.equal(s.db.rows.has('membership_migration_evidence/'+KEY),false);
 assert.equal((await s.snapshot.capture('admin')).count,1);
});
test('production source adapter paginates all teachers without identity filters',async()=>{
 const rows=Array.from({length:205},(_,i)=>({_id:String(i).padStart(4,'0'),teacher_id:'t'+i}));
 const db={collection(name){
  assert.equal(name,'teachers');
  return {orderBy(key,order){
   assert.equal(key,'_id');assert.equal(order,'asc');
   return {skip(offset){return {limit(n){return {get:async()=>({data:rows.slice(offset,offset+n)})};}};}};
  }};
 }};
 assert.deepEqual(await readTeachers(db),rows);
});
