'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {studentWriteGuardRules,studentRules}=require('../../cloudfunctions/membership-business/security-rules');

// Configuration regression only. Runtime enforcement is evidenced by the
// frozen native CloudBase checks in WRITE-GUARD-20260911.md.
test('write guard uses boolean denials and preserves scoped query and document ownership checks',()=>{
 const rules=studentWriteGuardRules();
 assert.deepEqual(Object.keys(rules).sort(),['create','delete','read','update']);
 assert.equal(rules.create,false);assert.equal(rules.update,false);
 assert.equal(rules.read,'auth.openid != null && (doc.teacher_id == auth.openid || doc._openid == auth.openid || get(`database.students.${doc._id}`)._openid == auth.openid)');
 assert.equal(rules.delete,'auth.openid != null && (doc._openid == auth.openid || get(`database.students.${doc._id}`)._openid == auth.openid)');
 assert.throws(()=>studentRules(),/STUDENTS_PRIVATE_ACL_MUST_NOT_CHANGE/);
});
