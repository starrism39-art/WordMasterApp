'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {previewBatch,applyApprovedBatch}=require('../../cloudfunctions/membership-business/migration');
const {studentRules}=require('../../cloudfunctions/membership-business/security-rules');
test('batch deduplicates teacher identity and requires an unchanged reviewed manifest',async()=>{
 const calls=[];const service={preview:async teacherId=>({teacherId,classification:'free',previewAt:1,token:'signed',revision:0,factsHash:'facts'}),apply:async r=>{calls.push(r.teacherId);return {alreadyApplied:false};}};
 const p=await previewBatch(service,['b','a','a']);assert.equal(p.uniqueTeachers,2);assert.equal(p.duplicates,1);
 await assert.rejects(applyApprovedBatch(service,p,'wrong'),/APPROVED_PREVIEW_REQUIRED/);
 assert.equal((await applyApprovedBatch(service,p,p.digest)).complete,true);assert.deepEqual(calls,['a','b']);
});
test('unresolved preview blocks batch writes instead of quietly converting review',async()=>{
 const service={preview:async teacherId=>({teacherId,classification:'review'}),apply:async()=>assert.fail('must not write')};
 const p=await previewBatch(service,['a']);await assert.rejects(applyApprovedBatch(service,p,p.digest),/UNRESOLVED_REVIEW/);
});
test('retired ACL generator refuses controlled and full rollout changes',()=>{
 for(const allTeachersEnabled of [false,true])
  assert.throws(()=>studentRules({enabledTeachers:['controlled'],allTeachersEnabled}),/STUDENTS_PRIVATE_ACL_MUST_NOT_CHANGE/);
});
