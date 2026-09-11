'use strict';
const { REASONS: CORE, POLICY_VERSION } = require('../membership-core/constants');
const { getMembershipAccess: coreAccess } = require('../membership-core/access');
const ACTIONS = Object.freeze(Object.fromEntries(['ADD_STUDENT', 'EDIT_STUDENT', 'DELETE_STUDENT', 'START_LEARNING', 'START_REVIEW', 'VIEW_HISTORY', 'SELECT_RETAINED_STUDENT'].map(k => [k, k])));
const REASONS = Object.freeze({ ...CORE, ...Object.fromEntries(['MEMBER_EXPIRED_NEEDS_RETAINED_STUDENT', 'TRANSITION_EXPIRED', 'ACCESS_DENIED', 'PROFILE_CORRECTION_ALLOWED', 'PROFILE_REVIEW_REQUIRED', 'HISTORY_AVAILABLE', 'DELETE_ALLOWED', 'RETAINED_STUDENT_LOCKED', 'RETAINED_SELECTION_ALLOWED'].map(k => [k, k])) });
// Pure server policy. Input facts must come from the trusted repository, never pages.
// Entitlement dates/stacking/free-slot semantics are exclusively owned by Stage2.
function evaluateAccess({ teacherId, grants, access, students, studentId = null, action, now, intent = 'correction' }) {
  if (!Object.hasOwn(ACTIONS, action)) throw new Error('INVALID_ACTION');
  const core = coreAccess({ teacherId, grants, access, students, studentId, now });
  const transitionExpired = access.transitionEndsAt !== null && access.transitionEndsAt <= now && !core.unlimitedStudents;
  let allowed = false; let reasonCode = core.reasonCode;
  if (action === ACTIONS.ADD_STUDENT) { allowed = core.canAddStudent; reasonCode = core.addReasonCode; }
  else if (!studentId) reasonCode = REASONS.ACCESS_DENIED;
  else if ([CORE.STUDENT_NOT_OWNED, CORE.STUDENT_DELETED].includes(core.reasonCode)) { /* deny every action on a foreign/deleted student */ }
  else if ([ACTIONS.START_LEARNING, ACTIONS.START_REVIEW].includes(action)) {
    allowed = action === ACTIONS.START_LEARNING ? core.canStartLearning : core.canStartReview;
    if (reasonCode === CORE.RETAINED_STUDENT_REQUIRED) reasonCode = REASONS.MEMBER_EXPIRED_NEEDS_RETAINED_STUDENT;
    else if (!allowed && transitionExpired && core.membershipStatus === 'free') reasonCode = REASONS.TRANSITION_EXPIRED;
  } else if (action === ACTIONS.VIEW_HISTORY) { allowed = core.canViewHistory; reasonCode = REASONS.HISTORY_AVAILABLE; }
  else if (action === ACTIONS.DELETE_STUDENT) { allowed = true; reasonCode = REASONS.DELETE_ALLOWED; }
  else if (action === ACTIONS.EDIT_STUDENT) {
    allowed = intent === 'correction';
    reasonCode = allowed ? REASONS.PROFILE_CORRECTION_ALLOWED : intent === 'replacement' && !core.unlimitedStudents ? CORE.PROFILE_REPLACEMENT_REQUIRES_ADMIN : REASONS.PROFILE_REVIEW_REQUIRED;
  } else if (action === ACTIONS.SELECT_RETAINED_STUDENT) {
    allowed = !core.unlimitedStudents && core.membershipStatus !== 'grace' && (!access.retainedStudentId || access.retainedStudentId === studentId);
    reasonCode = allowed ? REASONS.RETAINED_SELECTION_ALLOWED : access.retainedStudentId && access.retainedStudentId !== studentId ? REASONS.RETAINED_STUDENT_LOCKED : REASONS.ACCESS_DENIED;
  }
  return { membershipStatus: core.membershipStatus === 'grace' ? 'transition' : core.membershipStatus, allowed, reasonCode,
    unlimitedStudents: core.unlimitedStudents, freeSlotConsumed: access.freeSlotConsumed, retainedStudentId: core.retainedStudentId,
    transitionEndsAt: core.transitionEndsAt, expiresAt: core.expiresAt, longTerm: core.membershipStatus === 'long_term', policyVersion: POLICY_VERSION };
}
module.exports = { ACTIONS, REASONS, evaluateAccess };
