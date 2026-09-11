'use strict';
const { captureAccountSession, isAccountSessionCurrent } = require('./account-session');
const { isCloudReadOnlyMode } = require('./cloud-mode');
const ENV = 'cloudbase-4gafzdch60ad597b';
const MESSAGES = {
  MEMBERSHIP_INITIALIZATION_REQUIRED: '会员资料待核实，请联系管理员',
  BUSINESS_NOT_ENABLED: '会员业务尚未启用',
  FREE_SLOT_ALREADY_USED: '免费学生名额已使用，删除不会恢复名额',
  PROFILE_REVIEW_REQUIRED: '资料变更已提交审核，原学生信息保留',
  STUDENT_PROFILE_REVIEW_REQUIRED: '学生资料存在差异，请联系管理员核实，历史数据已保留',
  MEMBERSHIP_REVIEW_REQUIRED: '会员身份正在核实，历史数据已保留',
  RETAINED_STUDENT_REQUIRED: '请先选择一名固定保留学生',
  MEMBER_EXPIRED_NEEDS_RETAINED_STUDENT: '请先选择一名固定保留学生',
  TRANSITION_EXPIRED: '过渡期已结束，请使用固定保留学生',
  RETAINED_STUDENT_LOCKED: '保留学生已固定，不能自行更换',
  ACCOUNT_SESSION_CHANGED: '账号已切换，请重试',
  LOGIN_REQUIRED: '请先登录',
  CLOUD_READ_ONLY: '当前为只读模式',
  STUDENT_NOT_OWNED: '学生资料尚未核实',
  STUDENT_DELETED: '该学生已删除'
};
function requestId() { return 'business_' + Date.now() + '_' + Math.random().toString(36).slice(2); }
function message(error) { return MESSAGES[error && (error.code || error.message)] || '当前权限无法完成此操作，请核实会员状态后重试'; }
async function call(action, request) {
  const session = captureAccountSession();
  if (!session.accountId) throw new Error('LOGIN_REQUIRED');
  if (!wx.cloud) throw new Error('CLOUD_UNAVAILABLE');
  if (isCloudReadOnlyMode() && ['openMembership', 'addStudent', 'correctProfile', 'selectRetainedStudent', 'updateStudentDisplay'].includes(action)) throw new Error('CLOUD_READ_ONLY');
  const response = await wx.cloud.callFunction({ name: 'membership_business', config: { env: ENV }, data: { action, request: request || {} } });
  if (!isAccountSessionCurrent(session)) throw new Error('ACCOUNT_SESSION_CHANGED');
  const envelope = response && response.result;
  if (!envelope || envelope.ok !== true) throw new Error(envelope && envelope.code || 'BUSINESS_UNAVAILABLE');
  return envelope.result;
}
async function openVersion() {
  if (isCloudReadOnlyMode()) return {skipped:true};
  try { return await call('openMembership', {}); }
  catch(error) { if(error.message==='BUSINESS_NOT_ENABLED')return {enabled:false};return {pending:true}; }
}
function studentId(page) {
  const student = page.data.currentStudent || {};
  return String(student.studentId || student.student_id || student.id || page.data.studentId || '');
}
// Called only when starting a new session/batch. Save handlers deliberately do
// not call this gate: work already produced must still reach the existing sync.
async function authorizePage(page, kind) {
  const target = studentId(page);
  const session = captureAccountSession();
  const wordbook = String((page.data.currentWordbook || {}).id || '');
  const current = () => isAccountSessionCurrent(session) && studentId(page) === target &&
    String((page.data.currentWordbook || {}).id || '') === wordbook;
  try {
    const action = kind === 'review' ? 'authorizeReview' : 'authorizeLearning';
    let decision = await call(action, { studentId: target });
    if (!current()) return false;
    if (decision && !decision.allowed && decision.reasonCode === 'MEMBER_EXPIRED_NEEDS_RETAINED_STUDENT') {
      const selected = await new Promise(resolve => wx.showModal({ title: '选择固定保留学生',
        content: '将“' + (page.data.currentStudent.name || '当前学生') + '”选为继续学习、复习的学生？选定后不能自行更换。其他学生和历史记录仍会保留。',
        confirmText: '固定此学生', success: result => resolve(result.confirm), fail: () => resolve(false) }));
      if (!selected || !current()) return false;
      await call('selectRetainedStudent', { studentId: target, requestId: requestId() });
      if (!current()) return false;
      decision = await call(action, { studentId: target });
    }
    if (!current()) return false;
    if (!decision || !decision.allowed) throw new Error(decision && decision.reasonCode || 'ACCESS_DENIED');
    return true;
  } catch (error) {
    if (!current()) return false;
    const text = message(error);
    const hasWork = ['currentBatchWords', 'testWords', 'currentGroupWords'].some(key => Array.isArray(page.data[key]) && page.data[key].length);
    // A denied next batch must leave the current batch and its save controls on
    // screen. Initial entry can show a blocking error because no work exists yet.
    page.setData({ loading: false, showLoadingModal: false, ...(hasWork ? {} : { hasError: true, errorMessage: text }) });
    wx.hideLoading(); wx.showToast({ title: text, icon: 'none', duration: 2500 });
    return false;
  }
}
module.exports = { call, requestId, message, authorizePage, openVersion };
