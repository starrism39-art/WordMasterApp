'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { evaluateAccess, ACTIONS, REASONS } = require('../../cloudfunctions/membership-access/policy');
const { setup, BASE, award, student } = require('./fixtures');
const { DAY, addDuration } = require('../../cloudfunctions/membership-core/time');
// Executable matrix: add, student A learning, student B learning. Review must match.
const MATRIX = [
  { name: 'free unused', options: {}, allowed: [true, false, false] },
  { name: 'free used', options: { students: [student('a')] }, allowed: [false, true, false] },
  { name: 'active', options: { students: [student('a'), student('b')], grants: [award('annual')] }, allowed: [true, true, true] },
  { name: 'expired unselected', options: { students: [student('a'), student('b')], grants: [award('annual')], now: addDuration(BASE, { months: 12 }) }, allowed: [false, false, false] },
  { name: 'expired selected', options: { students: [student('a'), student('b')], grants: [award('annual')], now: addDuration(BASE, { months: 12 }) }, selected: true, allowed: [false, true, false] },
  { name: 'transition', options: { students: [student('a'), student('b')], registeredAt: BASE - DAY }, allowed: [false, true, true] },
  { name: 'long term', options: { students: [student('a'), student('b')], grants: [award('long', BASE, { sourceType: 'internal_long_term' })] }, allowed: [true, true, true] }
];
for (const c of MATRIX) for (const [i, action, studentId] of [[0,'ADD_STUDENT',undefined],[1,'START_LEARNING','a'],[2,'START_LEARNING','b'],[1,'START_REVIEW','a'],[2,'START_REVIEW','b']]) test(`${c.name}: ${action} ${studentId || ''}`, async () => {
  const s = await setup(c.options); if (c.selected) await s.service.selectRetainedStudent({ requestId: 'select', studentId: 'a' });
  const result = await s.service.getMembershipAccess({ action, ...(studentId ? { studentId } : {}) }); assert.equal(result.allowed, c.allowed[i]);
  assert.ok(Object.hasOwn(REASONS, result.reasonCode));
  for (const key of ['membershipStatus','allowed','reasonCode','unlimitedStudents','freeSlotConsumed','retainedStudentId','transitionEndsAt','expiresAt','longTerm','policyVersion']) assert.ok(Object.hasOwn(result,key));
});
test('expired reason codes, locked history and editing/deletion permissions', async () => {
  const s = await setup({ students: [student('a'),student('b')], grants:[award('annual')], now:addDuration(BASE,{months:12}) });
  assert.equal((await s.service.authorizeLearning({studentId:'a'})).reasonCode,'MEMBER_EXPIRED_NEEDS_RETAINED_STUDENT');
  await s.service.selectRetainedStudent({requestId:'r',studentId:'a'});
  assert.equal((await s.service.authorizeLearning({studentId:'a'})).reasonCode,'MEMBER_EXPIRED_RETAINED_STUDENT');
  assert.equal((await s.service.authorizeReview({studentId:'b'})).reasonCode,'MEMBER_EXPIRED_LOCKED_STUDENT');
  for (const action of ['VIEW_HISTORY','EDIT_STUDENT','DELETE_STUDENT']) assert.equal((await s.service.getMembershipAccess({action,studentId:'b'})).allowed,true);
});
for (const action of Object.values(ACTIONS)) test(`ownership enforced: ${action}`, async () => {
  const s=await setup({students:[student('a'),{...student('foreign'),teacherId:'other'}],grants:[award('annual')]});
  if(action==='ADD_STUDENT') return assert.equal((await s.service.getMembershipAccess({action})).allowed,true);
  assert.equal((await s.service.getMembershipAccess({action,studentId:'foreign'})).allowed,false);
});
test('unknown action fails closed', async()=>{const s=await setup(); await assert.rejects(s.service.getMembershipAccess({action:'MAKE_VIP'}),/INVALID_ACTION/);});
module.exports = { MATRIX };
