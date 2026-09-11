'use strict';
const { check } = require('./protocol');
// Matches existing teacherWordbook's teachers.teacher_id === trusted OPENID model.
// No request fields are used to select the teacher. Student/anonymous callers fail.
function createTeacherIdentity({ wxCloud, db, appId }) {
  return async () => {
    const context = wxCloud.getWXContext();
    check(context.APPID === appId && typeof context.OPENID === 'string' && context.OPENID.length > 0, 'IDENTITY_NOT_VERIFIED');
    const result = await db.collection('teachers').where({ teacher_id: context.OPENID }).limit(2).get();
    check(Array.isArray(result.data) && result.data.length === 1 && result.data[0].teacher_id === context.OPENID, 'TEACHER_IDENTITY_REQUIRED');
    return { teacherId: context.OPENID, openId: context.OPENID, appId };
  };
}
module.exports = { createTeacherIdentity };
