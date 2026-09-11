'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { MemoryRepository } = require('../../cloudfunctions/membership-core/repository');
const { createMembershipService } = require('../../cloudfunctions/membership-core/service');
const { initializeAccess, getMembershipAccess } = require('../../cloudfunctions/membership-core/access');
const { DAY } = require('../../cloudfunctions/membership-core/time');
const { T, BASE, award, product, student } = require('./fixtures');

async function setup(students = [], options = {}) {
  const repository = new MemoryRepository();
  let actor = 'admin'; let now = options.now || BASE;
  const receipts = new Map();
  const service = createMembershipService({ repository, getIdentity: () => ({ teacherId: actor }), clock: () => now, administrators: ['admin'], getVerifiedPayment: async ref => receipts.get(ref) });
  await service.initialize({ teacherId: 'teacher', requestId: 'init', students, registeredAt: options.registeredAt || BASE, launchAt: BASE, reason: 'Audited test initialization' });
  actor = 'teacher';
  return { repository, service, receipts, actor: value => { actor = value; }, time: value => { now = value; } };
}
function entry(type = 'gift', overrides = {}) {
  return { sourceId: 'gift1', sourceType: type, startsAt: BASE, duration: type === 'internal_long_term' ? null : { months: 12 }, longTerm: type === 'internal_long_term', metadata: {}, reason: 'Approved test grant', operation: 'grant', ...overrides };
}
async function adminGrant(ctx, input) {
  ctx.actor('admin');
  const preview = await ctx.service.previewAdminGrant({ teacherId: 'teacher', entry: input });
  const result = await ctx.service.applyAdminGrant({ teacherId: 'teacher', entry: input, previewToken: preview.token, previewAt: preview.previewAt });
  ctx.actor('teacher'); return result;
}
function receipt(reference = 'pay1', overrides = {}) {
  return { sourceId: reference, teacherId: 'teacher', productId: 'test_annual', productSnapshot: product(), status: 'paid', amount: 100, currency: 'CNY', channel: 'apple_iap', paidAt: BASE, ...overrides };
}
test('free first student consumes slot; deletion and new service instance cannot restore it', async () => {
  const ctx = await setup();
  assert.equal((await ctx.service.access()).reasonCode, 'FREE_SLOT_AVAILABLE');
  const added = await ctx.service.addStudent({ requestId: 'one', name: 'A' });
  assert.equal((await ctx.service.access({ studentId: added.studentId })).canStartLearning, true);
  // Simulate existing deletion authority's outcome; no deletion API is implemented.
  await ctx.repository.transaction('teacher', row => { row.students[0].deleted = true; });
  await assert.rejects(ctx.service.addStudent({ requestId: 'two', name: 'B' }), /FREE_SLOT_ALREADY_USED/);
  assert.equal((await ctx.service.access({ studentId: added.studentId })).canStartReview, false);
  const device2 = createMembershipService({ repository: ctx.repository, getIdentity: () => ({ teacherId: 'teacher' }), clock: () => BASE });
  assert.equal((await device2.access()).canAddStudent, false);
  assert.equal(ctx.repository.read('teacher').access.firstStudentId, added.studentId);
});
test('two different simultaneous free additions: exactly one succeeds', async () => {
  const ctx = await setup();
  const calls = await Promise.allSettled([ctx.service.addStudent({ requestId: 'one', name: 'A' }), ctx.service.addStudent({ requestId: 'two', name: 'B' })]);
  assert.equal(calls.filter(c => c.status === 'fulfilled').length, 1);
  assert.equal(ctx.repository.read('teacher').students.length, 1);
  assert.equal(ctx.repository.read('teacher').access.freeSlotConsumed, true);
});
test('same request concurrently retried creates exactly one student', async () => {
  const ctx = await setup(); const request = { requestId: 'one', name: 'A' };
  const [a, b] = await Promise.all([ctx.service.addStudent(request), ctx.service.addStudent(request)]);
  assert.deepEqual(a, b); assert.equal(ctx.repository.read('teacher').students.length, 1);
  await assert.rejects(ctx.service.addStudent({ ...request, name: 'B' }), /IDEMPOTENCY_CONFLICT/);
});
test('failed commit rolls back student, slot, summary, audit and idempotency marker', async () => {
  const ctx = await setup(); const before = ctx.repository.read('teacher');
  ctx.repository.failNextCommit = true;
  await assert.rejects(ctx.service.addStudent({ requestId: 'one', name: 'A' }), /COMMIT_FAILURE/);
  assert.deepEqual(ctx.repository.read('teacher'), before);
  await ctx.service.addStudent({ requestId: 'one', name: 'A' });
  assert.equal(ctx.repository.read('teacher').students.length, 1);
});
test('active member adds beyond old limit, but cannot access another teachers student', async () => {
  const ctx = await setup(); await adminGrant(ctx, entry());
  for (let i = 0; i < 32; i++) await ctx.service.addStudent({ requestId: `add${i}`, name: `S${i}` });
  assert.equal(ctx.repository.read('teacher').students.length, 32);
  assert.equal((await ctx.service.access()).unlimitedStudents, true);
  assert.equal((await ctx.service.access({ studentId: 'foreign' })).reasonCode, 'STUDENT_NOT_OWNED');
});
test('expiry requires selection; fixed student cannot rotate; renewal restores all', async () => {
  const ctx = await setup(); await adminGrant(ctx, entry());
  const a = await ctx.service.addStudent({ requestId: 'a', name: 'A' });
  const b = await ctx.service.addStudent({ requestId: 'b', name: 'B' });
  ctx.time(T('2027-09-08T10:00:00'));
  assert.equal((await ctx.service.access({ studentId: a.studentId })).reasonCode, 'RETAINED_STUDENT_REQUIRED');
  await ctx.service.retain({ requestId: 'select', studentId: b.studentId });
  assert.equal((await ctx.service.access({ studentId: b.studentId })).reasonCode, 'MEMBER_EXPIRED_RETAINED_STUDENT');
  const locked = await ctx.service.access({ studentId: a.studentId });
  assert.equal(locked.canStartLearning, false); assert.equal(locked.canStartReview, false); assert.equal(locked.canViewHistory, true);
  await assert.rejects(ctx.service.retain({ requestId: 'rotate', studentId: a.studentId }), /RETAINED_STUDENT_LOCKED/);
  await adminGrant(ctx, entry('gift', { sourceId: 'renew', startsAt: T('2027-09-08T10:00:00') }));
  assert.equal((await ctx.service.access({ studentId: a.studentId })).canStartReview, true);
  assert.equal(ctx.repository.read('teacher').students.length, 2);
});
test('deleting retained student does not allow reselection or new free student', async () => {
  const ctx = await setup([student('a'), student('b')]);
  await ctx.service.retain({ requestId: 'select', studentId: 'a' });
  await ctx.repository.transaction('teacher', row => { row.students[0].deleted = true; });
  await assert.rejects(ctx.service.retain({ requestId: 'rotate', studentId: 'b' }), /RETAINED_STUDENT_LOCKED/);
  assert.equal((await ctx.service.access()).canAddStudent, false);
});
test('free corrections allowed and audited; explicit replacement denied', async () => {
  const ctx = await setup([student('a')]);
  await ctx.service.correctProfile({ requestId: 'fix', studentId: 'a', name: 'Correct name', grade: 'G2', reason: 'Typing correction', intent: 'correction' });
  assert.equal(ctx.repository.read('teacher').access.firstStudentId, 'a');
  assert.equal(ctx.repository.read('teacher').audits.at(-1).actionType, 'profile_correction');
  await assert.rejects(ctx.service.correctProfile({ requestId: 'replace', studentId: 'a', name: 'B', grade: 'G2', reason: 'Different student', intent: 'replacement' }), /REQUIRES_ADMIN/);
});
test('only administrator can correct retained student, operation leaves before/after', async () => {
  const ctx = await setup([student('a'), student('b')]);
  await ctx.service.retain({ requestId: 'retain', studentId: 'a' });
  const request = { teacherId: 'teacher', requestId: 'correct', studentId: 'b', reason: 'Verified mistaken selection' };
  await assert.rejects(ctx.service.correctRetainedStudent(request), /ADMIN_REQUIRED/);
  ctx.actor('admin'); await ctx.service.correctRetainedStudent(request);
  const log = ctx.repository.read('teacher').audits.at(-1);
  assert.equal(log.before.retainedStudentId, 'a'); assert.equal(log.after.retainedStudentId, 'b');
  const count = ctx.repository.read('teacher').audits.length;
  await ctx.service.correctRetainedStudent(request); assert.equal(ctx.repository.read('teacher').audits.length, count);
});
test('free slot administrative correction requires evidence and current revision', async () => {
  const ctx = await setup(); ctx.actor('admin');
  const request = { teacherId: 'teacher', requestId: 'fixslot', consumed: true, reason: 'Recovered prior usage', evidence: 'Legacy receipt', expectedRevision: ctx.repository.read('teacher').revision };
  await ctx.service.correctFreeSlot(request);
  assert.equal(ctx.repository.read('teacher').access.freeSlotConsumed, true);
  assert.equal(ctx.repository.read('teacher').audits.at(-1).actionType, 'free_slot_correction');
  await assert.rejects(ctx.service.correctFreeSlot({ ...request, requestId: 'stale' }), /STALE/);
});
test('five-day grace is from common launch, not login; only existing students allowed', async () => {
  const ctx = await setup([student('a'), student('b')], { registeredAt: BASE - DAY, now: BASE + 2 * DAY });
  assert.equal((await ctx.service.access({ studentId: 'a' })).membershipStatus, 'grace');
  assert.equal((await ctx.service.access()).canAddStudent, false);
  assert.equal(ctx.repository.read('teacher').access.transitionEndsAt, BASE + 5 * DAY);
  ctx.actor('admin');
  await ctx.service.initialize({ teacherId: 'teacher', requestId: 'device2', students: [], registeredAt: BASE, launchAt: BASE + DAY, reason: 'Reentry' });
  assert.equal(ctx.repository.read('teacher').access.transitionEndsAt, BASE + 5 * DAY);
  ctx.actor('teacher'); ctx.time(BASE + 5 * DAY);
  assert.equal((await ctx.service.access({ studentId: 'a' })).canStartLearning, false);
  assert.equal((await ctx.service.access()).membershipStatus, 'free');
});
test('transition day2 purchase starts at actual paid time, not transition end', async () => {
  const ctx = await setup([student('a'), student('b')], { registeredAt: BASE - DAY, now: BASE + DAY });
  ctx.receipts.set('pay1', receipt('pay1', { paidAt: BASE + DAY }));
  const result = await ctx.service.applyVerifiedPayment({ reference: 'pay1' });
  assert.equal(result.account.effectiveStartsAt, BASE + DAY);
  assert.equal(result.account.effectiveExpiresAt, T('2027-09-09T10:00:00'));
});
test('no students and no reliable history: one free slot; paid/long-term old users get no grace', () => {
  const args = { teacherId: 'teacher', students: [], registeredAt: BASE - DAY, launchAt: BASE, now: BASE };
  assert.equal(initializeAccess(args).freeSlotConsumed, false);
  assert.equal(initializeAccess({ ...args, reliablePriorConsumption: true }).freeSlotConsumed, true);
  for (const g of [award('P'), award('L', BASE, { sourceType: 'internal_long_term' })]) {
    assert.equal(initializeAccess({ ...args, students: [student('a'), student('b')], grants: [g] }).transitionEndsAt, null);
  }
});
test('long term grants preserve unrestricted access after ordinary year expires', async () => {
  const ctx = await setup([student('a')]); await adminGrant(ctx, entry('internal_long_term'));
  ctx.time(T('2035-01-01T10:00:00'));
  assert.equal((await ctx.service.access({ studentId: 'a' })).reasonCode, 'LONG_TERM_MEMBER');
});
test('admin grant preview stale detection, retry and full audit', async () => {
  const ctx = await setup(); ctx.actor('admin'); const input = entry();
  const preview = await ctx.service.previewAdminGrant({ teacherId: 'teacher', entry: input });
  ctx.actor('teacher'); await ctx.service.addStudent({ requestId: 'a', name: 'A' }); ctx.actor('admin');
  await assert.rejects(ctx.service.applyAdminGrant({ teacherId: 'teacher', entry: input, previewToken: preview.token, previewAt: preview.previewAt }), /PREVIEW_STALE/);
  const current = await ctx.service.previewAdminGrant({ teacherId: 'teacher', entry: input });
  const request = { teacherId: 'teacher', entry: input, previewToken: current.token, previewAt: current.previewAt };
  const first = await ctx.service.applyAdminGrant(request); ctx.time(BASE + 5000);
  assert.deepEqual(await ctx.service.applyAdminGrant(request), first);
  assert.equal(ctx.repository.read('teacher').grants.length, 1);
  assert.equal(ctx.repository.read('teacher').audits.at(-1).operator, 'admin');
});
test('historical import uses actual old date and amount and requires explicit date precision', async () => {
  const ctx = await setup();
  const startsAt = T('2020-01-01T00:00:00');
  const input = entry('historical_payment', { sourceId: 'history', startsAt, metadata: { paidAt: startsAt, amount: 19900, evidence: 'Historic receipt', timePrecision: 'date_only', timeBasis: 'Recorded business date at CST midnight; exact clock time unknown' } });
  const result = await adminGrant(ctx, input);
  assert.equal(result.account.status, 'expired');
  assert.equal(ctx.repository.read('teacher').grants[0].metadata.amount, 19900);
  ctx.actor('admin');
  await assert.rejects(ctx.service.previewAdminGrant({ teacherId: 'teacher', entry: { ...input, sourceId: 'bad', metadata: { ...input.metadata, timeBasis: undefined } } }), /DATE_BASIS/);
});
test('payment grant retries after failed atomic commit and repeated receipt delivery', async () => {
  const ctx = await setup(); ctx.receipts.set('pay1', receipt());
  ctx.repository.failNextCommit = true;
  await assert.rejects(ctx.service.applyVerifiedPayment({ reference: 'pay1' }), /COMMIT_FAILURE/);
  assert.equal(ctx.repository.read('teacher').grants.length, 0);
  const results = await Promise.all([ctx.service.applyVerifiedPayment({ reference: 'pay1' }), ctx.service.applyVerifiedPayment({ reference: 'pay1' })]);
  assert.deepEqual(results[0], results[1]); assert.equal(ctx.repository.read('teacher').grants.length, 1);
});
test('payment belongs to verified teacher regardless of current caller account', async () => {
  const ctx = await setup(); ctx.receipts.set('pay1', receipt()); ctx.actor('other');
  await ctx.service.applyVerifiedPayment({ reference: 'pay1' });
  assert.equal(ctx.repository.read('teacher').grants.length, 1); assert.equal(ctx.repository.read('other').grants.length, 0);
});
test('payment uses original authorized product snapshot after product disabled', async () => {
  const ctx = await setup(); const currentProduct = product();
  ctx.receipts.set('pay1', receipt('pay1', { productSnapshot: structuredClone(currentProduct) }));
  currentProduct.enabled = false;
  await ctx.service.applyVerifiedPayment({ reference: 'pay1' });
  assert.equal(ctx.repository.read('teacher').account.status, 'active');
});
test('client overrides rejected; trusted receipt amount/channel/teacher/product checked', async () => {
  const ctx = await setup();
  for (const extra of [{ teacherId: 'other' }, { amount: 1 }, { membershipStatus: 'long_term' }, { duration: { months: 120 } }]) {
    await assert.rejects(ctx.service.applyVerifiedPayment({ reference: 'pay1', ...extra }), /UNEXPECTED_FIELDS/);
    await assert.rejects(ctx.service.addStudent({ requestId: 'one', name: 'A', ...extra }), /UNEXPECTED_FIELDS/);
  }
  for (const change of [{ amount: 1 }, { channel: 'wechat' }, { teacherId: 'other' }, { status: 'cancelled' }, { paidAt: BASE + 1 }, { productId: 'wrong' }]) {
    ctx.receipts.set('pay1', receipt('pay1', change));
    await assert.rejects(ctx.service.applyVerifiedPayment({ reference: 'pay1' }));
  }
  ctx.actor('other'); await assert.rejects(ctx.service.previewAdminGrant({ teacherId: 'teacher', entry: entry() }), /ADMIN_REQUIRED/);
});
test('summary is rebuildable after stale/corrupt cache; no client state trusted', async () => {
  const ctx = await setup([student('a')]); await adminGrant(ctx, entry());
  await ctx.repository.transaction('teacher', row => { row.account = { status: 'free' }; });
  assert.equal((await ctx.service.access({ studentId: 'a' })).membershipStatus, 'active');
  const result = await ctx.service.rebuild(); assert.equal(result.status, 'active');
  ctx.time(T('2027-09-08T10:00:00')); assert.equal((await ctx.service.rebuild()).status, 'expired');
});
test('refund preserves retained choice through buy-refund cycle and records adjustment audit', async () => {
  const ctx = await setup([student('a'), student('b')]);
  await ctx.service.retain({ requestId: 'retain', studentId: 'a' });
  ctx.receipts.set('pay1', receipt()); const paid = await ctx.service.applyVerifiedPayment({ reference: 'pay1' });
  ctx.time(BASE + DAY);
  await adminGrant(ctx, entry('refund_adjustment', { sourceId: 'refund1', startsAt: BASE + DAY, targetGrantId: paid.grantId, duration: null, operation: 'revoke_remaining' }));
  assert.equal((await ctx.service.access({ studentId: 'a' })).canStartLearning, true);
  assert.equal((await ctx.service.access({ studentId: 'b' })).canStartLearning, false);
  assert.equal(ctx.repository.read('teacher').audits.at(-1).actionType, 'refund_adjustment');
});
test('pure permission contract denies use before selecting owned existing student', () => {
  const access = initializeAccess({ teacherId: 'teacher', students: [], registeredAt: BASE, launchAt: BASE, now: BASE });
  const result = getMembershipAccess({ teacherId: 'teacher', grants: [], access, students: [], now: BASE });
  assert.equal(result.canAddStudent, true); assert.equal(result.canStartLearning, false);
});
