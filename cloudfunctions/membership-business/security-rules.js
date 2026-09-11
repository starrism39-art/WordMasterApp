'use strict';
// Legacy helper stays retired: old deployment scripts must not silently apply
// the _openid-only CUSTOM rule that broke teacher_id Full Pull queries.
function studentRules() {
 throw Error('STUDENTS_PRIVATE_ACL_MUST_NOT_CHANGE');
}
// User-authorized write guard. No membership status is involved in reading.
// Existing real documents were verified to have teacher_id === _openid before
// enabling this rule; subsequent create/update is server-only and sets both.
function studentWriteGuardRules(){
 return {
  read:"auth.openid != null && (doc.teacher_id == auth.openid || doc._openid == auth.openid || get(`database.students.${doc._id}`)._openid == auth.openid)",
  create:false,
  update:false,
  delete:"auth.openid != null && (doc._openid == auth.openid || get(`database.students.${doc._id}`)._openid == auth.openid)"
 };
}
module.exports={studentRules,studentWriteGuardRules};
