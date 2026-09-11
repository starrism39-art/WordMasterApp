'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {LocalSdk}=require('../membership-stage3/fixtures');
const {createBusinessRepository,COLLECTIONS}=require('../../cloudfunctions/membership-business/repository');
const {createInitializationService}=require('../../cloudfunctions/membership-business/initialization');
const {createAccessService}=require('../../cloudfunctions/membership-access/service');
const AT=Date.parse('2026-09-11T10:00:00+08:00'),DAY=86400000;
const evidence={verified:true,reference:'LOCAL_FACT',operator:'admin'};
test('identical legacy aliases bind canonical ID without deletion; conflicting identity goes to review',async()=>{
 const sdk=new LocalSdk(),repo=createBusinessRepository(sdk);
 const doc={teacher_id:'teacher',student_id:'student',name:'Same',grade:'G'};
 sdk.rows.set('students/student',doc);sdk.rows.set('students/copy',{...doc,extra:'preserve'});
 sdk.rows.set('membership_migration_evidence/teacher',{teacherId:'teacher',studentRefs:[{studentId:'student',docId:'student'},{studentId:'student',docId:'copy'}]});
 const facts=await repo.facts('teacher');assert.equal(facts.students.length,1);assert.equal(facts.students[0].aliases[0].docId,'copy');
 assert.equal(sdk.rows.get('students/copy').extra,'preserve');
 sdk.rows.set('students/copy',{...doc,name:'Different'});assert.equal((await repo.facts('teacher')).conflict,true);
});
async function setup({count=0,kind=null,registeredAt=AT-DAY,known=true}={}) {
 const sdk=new LocalSdk(),state={now:AT,risk:'normal'};
 const repo=createBusinessRepository(sdk,{clock:()=>state.now,sleep:async()=>{}});
 const studentRefs=[];
 for(let i=0;i<count;i++){const studentId='old_'+i,docId='doc_'+i;studentRefs.push({studentId,docId});sdk.rows.set('students/'+docId,{student_id:studentId,id:studentId,teacher_id:'teacher',_openid:'teacher',name:'old',grade:'G',joinDate:'2020-01-01'});}
 sdk.rows.set('membership_migration_evidence/teacher',{teacherId:'teacher',registeredAt,registrationEvidence:evidence,
  classificationEvidence:known?evidence:null,studentRefs,sources:kind?[{kind,sourceId:'LOCAL_SOURCE',startsAt:AT-DAY,duration:{months:12},amount:19900,timePrecision:'exact',evidence}]:[]});
 const init=createInitializationService({repository:repo,getFacts:repo.facts,getOperator:async()=>({isAdmin:true,operatorId:'admin'}),previewKey:'LOCAL_PREVIEW_KEY_ONLY_32_BYTES_MINIMUM',clock:()=>state.now});
 const p=await init.preview('teacher');const request=Object.fromEntries(['teacherId','previewAt','factsHash','revision','token'].map(k=>[k,p[k]]));await init.apply(request);
 const service=createAccessService({repository:repo,getIdentity:async()=>({teacherId:'teacher'}),clock:()=>state.now,getProfileRisk:async()=>state.risk});
 return {sdk,repo,state,service,init,request};
}
test('formal initialization persists projections once and never rewrites legacy students',async()=>{
 const s=await setup({count:2,kind:'historical'});await s.init.apply(s.request);
 assert.equal([...s.sdk.rows.keys()].filter(k=>k.startsWith(COLLECTIONS.grants+'/')).length,1);
 assert.equal(s.sdk.rows.get('students/doc_0').joinDate,'2020-01-01');
 assert.equal(s.sdk.rows.get('membership_accounts/teacher').status,'active');
 assert.equal(s.sdk.rows.get('teacher_student_access/teacher').freeSlotConsumed,true);
 assert.equal([...s.sdk.rows.keys()].some(k=>k.startsWith('stage5_')),false);
});
test('unknown persists review account; formal business cannot treat it as free',async()=>{
 const s=await setup({known:false});assert.equal(s.sdk.rows.get('membership_accounts/teacher').status,'review');
 await assert.rejects(s.service.addStudent({requestId:'one',name:'One'}),/MEMBERSHIP_INITIALIZATION_REQUIRED/);
});
test('concurrent free first creates exactly one real student; retry returns same record',async()=>{
 const s=await setup();const request={requestId:'one',name:'One'};
 const results=await Promise.allSettled([s.service.addStudent(request),s.service.addStudent({requestId:'two',name:'Two'})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const first=results.find(r=>r.status==='fulfilled').value;
 assert.equal((await s.service.addStudent(request)).studentId,first.studentId);
 assert.equal([...s.sdk.rows.keys()].filter(k=>k.startsWith('students/')).length,1);
 assert.equal(s.sdk.rows.get('teacher_student_access/teacher').freeSlotConsumed,true);
});
test('existing deletion authority removes student but cannot free slot or enable a replacement',async()=>{
 const s=await setup();const first=await s.service.addStudent({requestId:'one',name:'One'});
 s.sdk.rows.delete('students/'+first.studentId);
 await assert.rejects(s.service.addStudent({requestId:'two',name:'Two'}),/FREE_SLOT_ALREADY_USED/);
 assert.equal(s.sdk.rows.get('teacher_student_access/teacher').retainedStudentId,first.studentId);
 assert.equal((await s.service.authorizeLearning({studentId:first.studentId})).allowed,false);
});
test('active teacher with 31 existing students can create another',async()=>{
 const s=await setup({count:31,kind:'historical'});await s.service.addStudent({requestId:'new',name:'New'});
 assert.equal([...s.sdk.rows.keys()].filter(k=>k.startsWith('students/')).length,32);
});
test('expiry then new valid grant restores old students without recreation',async()=>{
 const s=await setup({count:2,kind:'historical'});s.state.now=AT+400*DAY;
 await s.service.selectRetainedStudent({requestId:'retain',studentId:'old_0'});
 assert.equal((await s.service.authorizeReview({studentId:'old_1'})).allowed,false);
 const admin=createAccessService({repository:s.repo,getIdentity:async()=>({teacherId:'admin'}),clock:()=>s.state.now,administrators:['admin']});
 const entry={sourceType:'gift',sourceId:'LOCAL_RECOVERY',startsAt:s.state.now,duration:{months:1},longTerm:false,metadata:{},reason:'Local recovery test',operation:'grant'};
 const p=await admin.admin.previewGrant({teacherId:'teacher',entry});await admin.admin.applyGrant({teacherId:'teacher',entry,previewToken:p.token,previewAt:p.previewAt});
 assert.equal((await s.service.authorizeReview({studentId:'old_1'})).allowed,true);
 assert.equal(s.sdk.rows.get('students/doc_1').joinDate,'2020-01-01');
});
test('correction changes existing document only; replacement/risk goes to review',async()=>{
 const s=await setup({count:1});const request={requestId:'correct',studentId:'old_0',name:'Corrected',grade:'G',reason:'typo',intent:'correction'};
 await s.service.correctProfile(request);assert.equal(s.sdk.rows.get('students/doc_0').name,'Corrected');
 s.state.risk='uncertain';const result=await s.service.correctProfile({...request,requestId:'replace',name:'Other'});
 assert.equal(result.reviewRequired,true);assert.equal(s.sdk.rows.get('students/doc_0').name,'Corrected');
 await assert.rejects(s.service.correctProfile({...request,studentId:'missing'}),/STUDENT_NOT_OWNED/);
});
test('failure rolls back real student and slot together; learning collections unchanged',async()=>{
 const s=await setup();s.sdk.rows.set('learning_records/old',{content:'must survive'});s.sdk.rows.set('student_statistics/old',{count:7});
 const before=structuredClone(s.sdk.rows);s.sdk.fail=rows=>[...rows.keys()].some(k=>k.startsWith('students/'));
 await assert.rejects(s.service.addStudent({requestId:'one',name:'One'}),/INJECTED_COMMIT_FAILURE/);
 assert.deepEqual(s.sdk.rows,before);
});
