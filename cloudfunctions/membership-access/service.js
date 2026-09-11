'use strict';
const { createMembershipService } = require('../membership-core/service');
const { id, strictKeys, reason } = require('../membership-core/model');
const { instant } = require('../membership-core/time');
const { hash } = require('../membership-payment/crypto');
const { evaluateAccess, ACTIONS } = require('./policy');

// readSnapshot must return a coherent trusted grants/access/students snapshot.
// Neither cached account flags nor payment statuses are accepted as grant authority.
function createMembershipAuthorizer({ readSnapshot, getIdentity, clock = Date.now }) {
  async function getMembershipAccess(request) {
    strictKeys(request, ['action', 'studentId', 'intent']);
    const identity = await getIdentity(); const teacherId = id(identity?.teacherId, 'IDENTITY');
    if (request.studentId !== undefined) id(request.studentId, 'STUDENT_ID');
    // now is sampled in the repository's read boundary by a production adapter.
    return readSnapshot(teacherId, row => evaluateAccess({ teacherId, grants: row.grants, access: row.access, students: row.students, ...request, now: instant(clock()) }));
  }
  return { getMembershipAccess,
    authorizeLearning(request) { strictKeys(request, ['studentId']); return getMembershipAccess({ ...request, action: ACTIONS.START_LEARNING }); },
    authorizeReview(request) { strictKeys(request, ['studentId']); return getMembershipAccess({ ...request, action: ACTIONS.START_REVIEW }); }
  };
}
function createAccessService({ repository, getIdentity, clock = Date.now, administrators = [], getProfileRisk = async () => 'normal' }) {
  // Reuse Stage2 operations and audits. Add an explicit reference alias without
  // changing any Stage2 source or sourceId/idempotency semantics.
  const repo = {
    read: teacherId => repository.read(teacherId),
    transaction: (teacherId, operation) => repository.transaction(teacherId, async row => {
      const beforeAccess = structuredClone(row.access); const oldKeys = new Set(Object.keys(row.operations));
      const result = await operation(row);
      const retainedOperation = Object.keys(row.operations).find(key => !oldKeys.has(key) && key.startsWith('retain_'));
      if (retainedOperation) audit(row, 'retained_student_selected', retainedOperation.slice(7), beforeAccess, row.access, 'Teacher selected fixed student');
      for (const audit of row.audits) if (!audit.reference) audit.reference = audit.source;
      return result;
    })
  };
  const core = createMembershipService({ repository: repo, getIdentity, clock, administrators });
  const authorizer = createMembershipAuthorizer({ getIdentity, clock, readSnapshot: (teacherId, evaluate) => repository.transaction(teacherId, evaluate) });
  function once(row, key, request, operation) {
    const digest = hash(request); const existing = row.operations[key];
    if (existing) { if (existing.hash !== digest) throw new Error('IDEMPOTENCY_CONFLICT'); return existing.result; }
    const result = operation(); row.operations[key] = { hash: digest, result }; return result;
  }
  function audit(row, actionType, source, before, after, why) {
    row.audits.push({ auditId: hash({ teacherId: row.teacherId, actionType, source }), teacherId: row.teacherId, operator: row.teacherId,
      actionType, source, reference: source, before: structuredClone(before), after: structuredClone(after), reason: reason(why), createdAt: instant(clock()), schemaVersion: 1 });
  }
  async function teacher() { return id((await getIdentity())?.teacherId, 'IDENTITY'); }
  return { ...authorizer,
    // Stage2 student creation + permanent slot consumption + audit + idempotency
    // share one transaction. Post-commit response failure retries the same requestId.
    addStudent: request => core.addStudent(request),
    selectRetainedStudent: request => core.retain(request),
    async correctProfile(request) {
      strictKeys(request, ['requestId', 'studentId', 'name', 'grade', 'reason', 'intent']);
      id(request.requestId); id(request.studentId); reason(request.reason);
      const teacherId = await teacher();
      // Risk adapter is server-controlled. A client's assertion is not identity proof.
      const risk = await getProfileRisk(teacherId, request.studentId, request);
      if (request.intent === 'correction' && risk === 'normal') return core.correctProfile(request);
      return repo.transaction(teacherId, row => once(row, `profile_review_${request.requestId}`, request, () => {
        const decision = evaluateAccess({ ...row, teacherId, studentId: request.studentId, action: ACTIONS.EDIT_STUDENT, intent: request.intent === 'replacement' ? 'replacement' : 'uncertain', now: instant(clock()) });
        if (['STUDENT_NOT_OWNED', 'STUDENT_DELETED'].includes(decision.reasonCode)) throw new Error(decision.reasonCode);
        const result = { ...decision, reviewRequired: decision.reasonCode === 'PROFILE_REVIEW_REQUIRED' };
        audit(row, 'profile_review', request.requestId, row.students.find(s => s.studentId === request.studentId), result, request.reason);
        return result;
      }));
    },
    async deleteStudent(request) {
      strictKeys(request, ['requestId', 'studentId', 'reason']); id(request.requestId); id(request.studentId); reason(request.reason);
      const teacherId = await teacher();
      return repo.transaction(teacherId, row => once(row, `delete_${request.requestId}`, request, () => {
        const permission = evaluateAccess({ ...row, teacherId, studentId: request.studentId, action: ACTIONS.DELETE_STUDENT, now: instant(clock()) });
        if (!permission.allowed) throw new Error(permission.reasonCode);
        const student = row.students.find(s => s.studentId === request.studentId); const before = structuredClone(student);
        // Isolated model only. Stage7 must coordinate actual deletion/tombstones.
        // Never releases slot or retained choice and never touches learning records.
        student.deleted = true; audit(row, 'student_deleted', request.requestId, before, student, request.reason);
        return { studentId: student.studentId, deleted: true };
      }));
    },
    admin: Object.freeze({
      initialize: request => core.initialize(request),
      previewGrant: request => core.previewAdminGrant(request),
      applyGrant: request => core.applyAdminGrant(request),
      correctRetainedStudent: request => core.correctRetainedStudent(request),
      correctFreeSlot: request => core.correctFreeSlot(request)
    })
  };
}
module.exports = { createMembershipAuthorizer, createAccessService };
