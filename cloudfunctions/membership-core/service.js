'use strict';

const crypto = require('node:crypto');
const { SCHEMA_VERSION } = require('./constants');
const { instant, addDuration } = require('./time');
const { id, reason, strictKeys, canonical, grant, resolveProduct } = require('./model');
const { normalizeLedger, rebuildAccount } = require('./ledger');
const { initializeAccess, getMembershipAccess, retainStudent } = require('./access');
const digest = value => crypto.createHash('sha256').update(canonical(value)).digest('hex');

// All dependencies are trusted server adapters, never request-supplied context.
// No cloud SDK, HTTP handler, exported main(), order creation or network calls here.
function createMembershipService({ repository, getIdentity, clock, administrators = [], getVerifiedPayment = null }) {
  const admins = new Set(administrators);
  async function identity() { const actor = await getIdentity(); id(actor?.teacherId, 'IDENTITY'); return actor.teacherId; }
  async function admin() { const operator = await identity(); if (!admins.has(operator)) throw new Error('ADMIN_REQUIRED'); return operator; }
  const timestamp = () => instant(clock());
  function audit(row, operator, actionType, source, before, after, why, at) {
    row.audits.push({ auditId: digest({ teacherId: row.teacherId, actionType, source }), operator, teacherId: row.teacherId, actionType, source, before: structuredClone(before), after: structuredClone(after), reason: reason(why), createdAt: at, schemaVersion: SCHEMA_VERSION });
  }
  function refresh(row, at) { row.account = rebuildAccount(row.teacherId, row.grants, row.access, at); return row.account; }
  function once(row, key, request, operation) {
    const hash = digest(request);
    const previous = row.operations[key];
    if (previous) {
      if (previous.hash !== hash) throw new Error('IDEMPOTENCY_CONFLICT');
      return structuredClone(previous.result);
    }
    const result = operation();
    row.operations[key] = { hash, result: structuredClone(result) };
    return result;
  }
  function append(row, entry) {
    row.grants = normalizeLedger(row.teacherId, [...row.grants, entry]);
  }
  function adminEntry(request, teacherId, at) {
    strictKeys(request, ['sourceId', 'sourceType', 'startsAt', 'duration', 'longTerm', 'metadata', 'reason', 'targetGrantId', 'operation']);
    if (request.sourceType === 'payment') throw new Error('VERIFIED_PAYMENT_REQUIRED');
    if (['historical_payment', 'refund_adjustment'].includes(request.sourceType) && request.startsAt > at) throw new Error('FUTURE_PAYMENT_OR_REFUND');
    if (request.sourceType === 'historical_payment' && request.metadata?.timePrecision === 'date_only' && !request.metadata?.timeBasis) throw new Error('EXPLICIT_DATE_BASIS_REQUIRED');
    const entry = { ...request, teacherId, grantId: `grant_${digest({ teacherId, sourceId: request.sourceId })}`, createdAt: at, updatedAt: at, status: 'recorded', schemaVersion: SCHEMA_VERSION, endsAt: request.operation === 'revoke_remaining' || request.longTerm ? null : addDuration(request.startsAt, request.duration) };
    return grant(entry);
  }
  return {
    async access(request = {}) {
      strictKeys(request, ['studentId']);
      const teacherId = await identity(); const row = await repository.read(teacherId);
      return getMembershipAccess({ teacherId, grants: row.grants, access: row.access, students: row.students, studentId: request.studentId, now: timestamp() });
    },
    async rebuild() {
      const teacherId = await identity();
      return repository.transaction(teacherId, row => refresh(row, timestamp()));
    },
    // Later initialization adapter must read the existing student/registration facts
    // server-side. This admin-only import is local Stage2; never accept a client list.
    async initialize(request) {
      const operator = await admin();
      strictKeys(request, ['teacherId', 'requestId', 'students', 'registeredAt', 'launchAt', 'reliablePriorConsumption', 'reason']);
      const teacherId = id(request.teacherId); id(request.requestId); reason(request.reason);
      return repository.transaction(teacherId, row => once(row, `initialize_${request.requestId}`, request, () => {
        if (row.access) return row.access;
        if (!Array.isArray(request.students) || request.students.some(s => s.teacherId !== teacherId || typeof s.deleted !== 'boolean')) throw new Error('INVALID_STUDENT_IMPORT');
        request.students.forEach(s => id(s.studentId));
        if (new Set(request.students.map(s => s.studentId)).size !== request.students.length) throw new Error('DUPLICATE_STUDENT');
        const at = timestamp();
        row.access = initializeAccess({ ...request, grants: row.grants, now: at });
        row.students = structuredClone(request.students);
        audit(row, operator, 'initialize', request.requestId, null, row.access, request.reason, at);
        refresh(row, at); return row.access;
      }));
    },
    async previewAdminGrant({ teacherId, entry }) {
      await admin(); id(teacherId);
      const row = await repository.read(teacherId); const at = timestamp();
      const candidate = adminEntry(entry, teacherId, at);
      if (row.grants.some(g => g.sourceId === entry.sourceId)) throw new Error('SOURCE_ALREADY_RECORDED');
      const before = rebuildAccount(teacherId, row.grants, row.access, at);
      const after = rebuildAccount(teacherId, [...row.grants, candidate], row.access, at);
      return { revision: row.revision, previewAt: at, token: digest({ teacherId, entry, revision: row.revision, previewAt: at }), before, after };
    },
    async applyAdminGrant(request) {
      const operator = await admin();
      strictKeys(request, ['teacherId', 'entry', 'previewToken', 'previewAt']); id(request.teacherId);
      return repository.transaction(request.teacherId, row => once(row, `grant_${id(request.entry.sourceId)}`, request.entry, () => {
        instant(request.previewAt);
        if (request.previewAt > timestamp() || timestamp() - request.previewAt > 5 * 60 * 1000 || request.previewToken !== digest({ teacherId: request.teacherId, entry: request.entry, revision: row.revision, previewAt: request.previewAt })) throw new Error('PREVIEW_STALE_OR_MISSING');
        const at = timestamp(); const entry = adminEntry(request.entry, request.teacherId, at);
        const before = rebuildAccount(row.teacherId, row.grants, row.access, at);
        append(row, entry); const after = refresh(row, at);
        audit(row, operator, entry.sourceType, entry.sourceId, before, after, entry.reason, at);
        return { grantId: entry.grantId, account: after };
      }));
    },
    // Internal Stage3 seam. The adapter must return a platform-verified persisted
    // receipt. Accepts only a reference; no amount, teacherId or status from caller.
    async applyVerifiedPayment(request) {
      strictKeys(request, ['reference']); id(request.reference);
      if (!getVerifiedPayment) throw new Error('PAYMENT_ADAPTER_NOT_CONFIGURED');
      const receipt = await getVerifiedPayment(request.reference);
      if (!receipt || receipt.sourceId !== request.reference || receipt.status !== 'paid') throw new Error('VERIFIED_PAYMENT_REQUIRED');
      const teacherId = id(receipt.teacherId); const at = timestamp();
      // Immutable server product snapshot from the original purchase authorization.
      // Disabling a product later must not prevent compensation for a paid receipt.
      const item = resolveProduct(receipt.productSnapshot, teacherId);
      if (item.productId !== receipt.productId) throw new Error('PAYMENT_MISMATCH');
      if (receipt.amount !== item.price || receipt.currency !== item.currency || receipt.channel !== item.channel || receipt.paidAt > at) throw new Error('PAYMENT_MISMATCH');
      return repository.transaction(teacherId, row => once(row, `grant_${receipt.sourceId}`, receipt, () => {
        const entry = grant({ grantId: `grant_${digest({ teacherId, sourceId: receipt.sourceId })}`, teacherId, sourceType: 'payment', sourceId: receipt.sourceId, startsAt: receipt.paidAt, endsAt: addDuration(receipt.paidAt, item.duration), duration: item.duration, longTerm: false, status: 'recorded', operation: 'grant', createdAt: at, updatedAt: at, metadata: { paidAt: receipt.paidAt, amount: receipt.amount, productId: item.productId }, reason: 'Verified payment receipt' });
        append(row, entry); return { grantId: entry.grantId, account: refresh(row, at) };
      }));
    },
    async addStudent(request) {
      strictKeys(request, ['requestId', 'name', 'grade']); id(request.requestId);
      if (typeof request.name !== 'string' || !request.name.trim() || request.name.length > 80 || (request.grade !== undefined && (typeof request.grade !== 'string' || request.grade.length > 80))) throw new Error('INVALID_PROFILE');
      const teacherId = await identity();
      return repository.transaction(teacherId, row => once(row, `add_${request.requestId}`, request, () => {
        const at = timestamp();
        const access = getMembershipAccess({ ...row, access: row.access, now: at });
        if (!access.canAddStudent) throw new Error(access.addReasonCode);
        const studentId = `student_${digest({ teacherId, requestId: request.requestId })}`;
        const student = { studentId, teacherId, name: request.name.trim(), grade: request.grade || '', deleted: false };
        row.students.push(student);
        row.access = { ...row.access, freeSlotConsumed: true, firstStudentId: row.access.firstStudentId || studentId, retainedStudentId: access.unlimitedStudents ? row.access.retainedStudentId : studentId, updatedAt: at };
        audit(row, teacherId, 'student_created', request.requestId, null, student, 'Student created with atomic slot consumption', at);
        refresh(row, at); return student;
      }));
    },
    async retain(request) {
      strictKeys(request, ['requestId', 'studentId']); id(request.requestId);
      const teacherId = await identity();
      return repository.transaction(teacherId, row => once(row, `retain_${request.requestId}`, request, () => {
        const at = timestamp(); const account = rebuildAccount(teacherId, row.grants, row.access, at);
        if (['active', 'long_term', 'grace'].includes(account.status)) throw new Error('RETAIN_ONLY_WHEN_RESTRICTED');
        const before = row.access; row.access = retainStudent({ access: row.access, students: row.students, studentId: request.studentId, now: at });
        audit(row, teacherId, 'retain_student', request.requestId, before, row.access, 'Teacher selected fixed student', at);
        return row.access;
      }));
    },
    async correctProfile(request) {
      strictKeys(request, ['requestId', 'studentId', 'name', 'grade', 'reason', 'intent']);
      id(request.requestId); id(request.studentId); reason(request.reason);
      if (request.intent !== 'correction') throw new Error('PROFILE_REPLACEMENT_REQUIRES_ADMIN');
      if (typeof request.name !== 'string' || !request.name.trim() || request.name.length > 80 || typeof request.grade !== 'string' || request.grade.length > 80) throw new Error('INVALID_PROFILE');
      const teacherId = await identity();
      return repository.transaction(teacherId, row => once(row, `profile_${request.requestId}`, request, () => {
        const student = row.students.find(s => s.studentId === request.studentId && s.teacherId === teacherId && !s.deleted);
        if (!student) throw new Error('STUDENT_NOT_OWNED');
        const before = structuredClone(student);
        student.name = request.name.trim(); student.grade = request.grade;
        audit(row, teacherId, 'profile_correction', request.requestId, before, student, request.reason, timestamp());
        return student;
      }));
    },
    async correctFreeSlot(request) {
      const operator = await admin();
      strictKeys(request, ['teacherId', 'requestId', 'consumed', 'reason', 'evidence', 'expectedRevision']);
      id(request.teacherId); id(request.requestId); reason(request.reason); reason(request.evidence);
      if (typeof request.consumed !== 'boolean') throw new Error('INVALID_SLOT_CORRECTION');
      return repository.transaction(request.teacherId, row => once(row, `admin_slot_${request.requestId}`, request, () => {
        if (!row.access || row.revision !== request.expectedRevision) throw new Error('PREVIEW_STALE_OR_MISSING');
        if (!request.consumed && row.students.some(s => !s.deleted)) throw new Error('ACTIVE_STUDENT_PREVENTS_SLOT_RESET');
        const at = timestamp(); const before = row.access;
        row.access = { ...row.access, freeSlotConsumed: request.consumed, updatedAt: at };
        audit(row, operator, 'free_slot_correction', request.requestId, before, row.access, `${request.reason}: ${request.evidence}`, at);
        return row.access;
      }));
    },
    async correctRetainedStudent(request) {
      const operator = await admin();
      strictKeys(request, ['teacherId', 'requestId', 'studentId', 'reason']); id(request.teacherId); id(request.requestId); reason(request.reason);
      return repository.transaction(request.teacherId, row => once(row, `admin_retain_${request.requestId}`, request, () => {
        const at = timestamp(); const before = row.access;
        row.access = retainStudent({ access: { ...row.access, retainedStudentId: null }, students: row.students, studentId: request.studentId, now: at });
        audit(row, operator, 'retained_student_correction', request.requestId, before, row.access, request.reason, at);
        return row.access;
      }));
    }
  };
}
module.exports = { createMembershipService };
