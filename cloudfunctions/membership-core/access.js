'use strict';

const { SCHEMA_VERSION, POLICY_VERSION, REASONS: R } = require('./constants');
const { instant, DAY } = require('./time');
const { id } = require('./model');
const { rebuildAccount, projectLedger } = require('./ledger');

function initializeAccess({ teacherId, existing = null, students, registeredAt, launchAt, now, grants = [], reliablePriorConsumption = false }) {
  id(teacherId); instant(now); instant(launchAt); instant(registeredAt);
  if (typeof reliablePriorConsumption !== 'boolean' || !Array.isArray(students)) throw new Error('INVALID_INITIALIZATION_FACTS');
  if (now < launchAt || registeredAt > now) throw new Error('INITIALIZATION_TIME_INVALID');
  if (existing) {
    if (existing.teacherId !== teacherId || existing.policyVersion !== POLICY_VERSION) throw new Error('ACCESS_MIGRATION_REQUIRED');
    return structuredClone(existing);
  }
  const own = students.filter(student => student.teacherId === teacherId && !student.deleted);
  const studentIds = [...new Set(own.map(student => id(student.studentId)))].sort();
  const memberAtLaunch = projectLedger(teacherId, grants, launchAt);
  const transition = registeredAt < launchAt && studentIds.length > 1 && !['active', 'long_term'].includes(memberAtLaunch.status);
  return {
    teacherId, freeSlotConsumed: reliablePriorConsumption || studentIds.length > 0,
    firstStudentId: studentIds.length === 1 ? studentIds[0] : null,
    retainedStudentId: studentIds.length === 1 ? studentIds[0] : null,
    transitionStartsAt: transition ? launchAt : null,
    transitionEndsAt: transition ? launchAt + 5 * DAY : null,
    transitionStudentIds: transition ? studentIds : [],
    initializedAt: now, updatedAt: now, policyVersion: POLICY_VERSION, schemaVersion: SCHEMA_VERSION
  };
}

// Account caches and client-supplied membership status are deliberately not inputs.
function getMembershipAccess({ teacherId, grants, access, students, studentId = null, now }) {
  if (!access || access.teacherId !== teacherId || access.policyVersion !== POLICY_VERSION) throw new Error('ACCESS_NOT_INITIALIZED');
  const account = rebuildAccount(teacherId, grants, access, now);
  const unlimited = ['active', 'long_term'].includes(account.status);
  const student = students.find(item => item.studentId === studentId && item.teacherId === teacherId);
  const canAddStudent = unlimited || (account.status !== 'grace' && !access.freeSlotConsumed);
  const canUse = !!student && !student.deleted && (unlimited || (account.status === 'grace' ? access.transitionStudentIds.includes(studentId) : studentId === access.retainedStudentId));
  let addReasonCode = unlimited ? (account.longTerm ? R.LONG_TERM_MEMBER : R.MEMBER_ACTIVE) : account.status === 'grace' ? R.TRANSITION_ACTIVE : canAddStudent ? R.FREE_SLOT_AVAILABLE : R.FREE_SLOT_ALREADY_USED;
  let reasonCode = addReasonCode;
  if (studentId) {
    if (!student) reasonCode = R.STUDENT_NOT_OWNED;
    else if (student.deleted) reasonCode = R.STUDENT_DELETED;
    else if (unlimited) reasonCode = addReasonCode;
    else if (account.status === 'grace') reasonCode = canUse ? R.TRANSITION_ACTIVE : R.TRANSITION_STUDENT_LOCKED;
    else if (!access.retainedStudentId) reasonCode = R.RETAINED_STUDENT_REQUIRED;
    else if (account.status === 'expired') reasonCode = canUse ? R.MEMBER_EXPIRED_RETAINED_STUDENT : R.MEMBER_EXPIRED_LOCKED_STUDENT;
    else reasonCode = canUse ? R.FREE_RETAINED_STUDENT : R.FREE_LOCKED_STUDENT;
  }
  return { membershipStatus: account.status, canAddStudent, canStartLearning: canUse, canStartReview: canUse, canViewHistory: !!student && !student.deleted, unlimitedStudents: unlimited, retainedStudentId: access.retainedStudentId, transitionEndsAt: access.transitionEndsAt, expiresAt: account.effectiveExpiresAt, reasonCode, addReasonCode };
}

function retainStudent({ access, students, studentId, now }) {
  id(studentId); instant(now);
  if (!access || access.policyVersion !== POLICY_VERSION) throw new Error('ACCESS_NOT_INITIALIZED');
  if (access.retainedStudentId && access.retainedStudentId !== studentId) throw new Error('RETAINED_STUDENT_LOCKED');
  if (!students.some(item => item.studentId === studentId && item.teacherId === access.teacherId && !item.deleted)) throw new Error('STUDENT_NOT_OWNED');
  return { ...access, retainedStudentId: studentId, freeSlotConsumed: true, updatedAt: now };
}
module.exports = { initializeAccess, getMembershipAccess, retainStudent };
