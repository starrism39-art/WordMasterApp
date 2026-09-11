'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { MemoryRepository } = require('../../cloudfunctions/membership-core/repository');
const { createMembershipService } = require('../../cloudfunctions/membership-core/service');
const { projectLedger } = require('../../cloudfunctions/membership-core/ledger');
const { initializeAccess, getMembershipAccess } = require('../../cloudfunctions/membership-core/access');
const { BASE, T, product, award, refund, student } = require('./fixtures');
const { DAY } = require('../../cloudfunctions/membership-core/time');

test('separate service instances sharing repository cannot double-spend a free slot', async () => {
  const repository = new MemoryRepository();
  const admin = createMembershipService({ repository, getIdentity: () => ({ teacherId: 'admin' }), administrators: ['admin'], clock: () => BASE });
  await admin.initialize({ teacherId: 'teacher', requestId: 'init', students: [], registeredAt: BASE, launchAt: BASE, reason: 'Test initialization' });
  const makeClient = () => createMembershipService({ repository, getIdentity: () => ({ teacherId: 'teacher' }), clock: () => BASE });
  const outcomes = await Promise.allSettled([makeClient().addStudent({ requestId: 'win', name: 'A' }), makeClient().addStudent({ requestId: 'ios', name: 'B' })]);
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(repository.read('teacher').students.length, 1);
});
test('transaction body exception cannot leave half-consumed slot or poison subsequent calls', async () => {
  const repository = new MemoryRepository();
  await assert.rejects(repository.transaction('teacher', row => { row.access = { freeSlotConsumed: true }; throw new Error('student_creation_failed'); }), /student_creation_failed/);
  assert.equal(repository.read('teacher').access, null);
  await repository.transaction('teacher', row => { row.students.push(student('a')); });
  assert.equal(repository.read('teacher').students.length, 1);
});
test('read/result mutation cannot modify the committed repository state', async () => {
  const repository = new MemoryRepository();
  const result = await repository.transaction('teacher', row => { row.students.push(student('a')); return row.students; });
  result[0].deleted = true;
  const read = repository.read('teacher'); read.students.length = 0;
  assert.equal(repository.read('teacher').students[0].deleted, false);
});
test('multiple payment arrivals in reverse order reproduce chronological expiry', async () => {
  const run = async refs => {
    const repository = new MemoryRepository();
    const paidAt = { A: BASE, B: T('2027-03-08T10:00:00') };
    const service = createMembershipService({ repository, clock: () => T('2027-04-08T10:00:00'), getIdentity: () => ({ teacherId: 'teacher' }), getVerifiedPayment: async ref => ({ sourceId: ref, teacherId: 'teacher', productId: 'test_annual', productSnapshot: product(), status: 'paid', amount: 100, currency: 'CNY', channel: 'apple_iap', paidAt: paidAt[ref] }) });
    for (const reference of refs) await service.applyVerifiedPayment({ reference });
    return service.rebuild();
  };
  assert.deepEqual(await run(['B', 'A']), await run(['A', 'B']));
  assert.equal((await run(['B', 'A'])).effectiveExpiresAt, T('2028-09-08T10:00:00'));
});
test('multiple refundable sources: repeated adjustments do not resurrect shortened periods', () => {
  const entries = [award('A'), award('B', BASE + 1), award('C', BASE + 2)];
  entries.push(refund('RA', 'A', T('2027-03-08T10:00:00')));
  entries.push(refund('RB', 'B', T('2027-06-08T10:00:00')));
  entries.push(refund('RA_again', 'A', T('2027-07-08T10:00:00')));
  const result = projectLedger('teacher', entries, T('2027-07-08T10:00:00'));
  assert.equal(result.effectiveExpiresAt, T('2028-06-08T10:00:00'));
  assert.equal(result.periods.find(p => p.grantId === 'A').endsAt, T('2027-03-08T10:00:00'));
  assert.equal(result.periods.find(p => p.grantId === 'B').endsAt, T('2027-06-08T10:00:00'));
});
test('future invalid adjustments fail validation immediately, not during a later login', () => {
  assert.throws(() => projectLedger('teacher', [refund('R', 'missing', BASE + DAY, { sourceType: 'admin_adjustment' })], BASE), /TARGET_NOT_AVAILABLE/);
});
test('late first initialization does not grant a fresh five days; new accounts never receive grace', () => {
  for (const registeredAt of [BASE - DAY, BASE]) {
    const access = initializeAccess({ teacherId: 'teacher', students: [student('a'), student('b')], registeredAt, launchAt: BASE, now: BASE + 6 * DAY });
    const result = getMembershipAccess({ teacherId: 'teacher', grants: [], access, students: [student('a'), student('b')], now: BASE + 6 * DAY, studentId: 'a' });
    assert.equal(result.membershipStatus, 'free'); assert.equal(result.canStartLearning, false);
    assert.equal(access.transitionEndsAt, registeredAt < BASE ? BASE + 5 * DAY : null);
  }
});
test('only transition snapshot students are accessible during grace', () => {
  const students = [student('a'), student('b')];
  const access = initializeAccess({ teacherId: 'teacher', students, registeredAt: BASE - DAY, launchAt: BASE, now: BASE });
  const result = getMembershipAccess({ teacherId: 'teacher', grants: [], access, students: [...students, student('later')], studentId: 'later', now: BASE + DAY });
  assert.equal(result.canStartLearning, false); assert.equal(result.reasonCode, 'TRANSITION_STUDENT_LOCKED');
});
test('gift and administrative grants retain independent audit-only metadata', () => {
  const entries = [award('G', BASE, { sourceType: 'gift', metadata: { amount: 1, membershipStatus: 'long_term' } }), award('A', BASE + 1, { sourceType: 'admin_adjustment', duration: { months: 1 } })];
  const result = projectLedger('teacher', entries, BASE + 1);
  assert.equal(result.status, 'active'); assert.equal(result.longTerm, false);
  assert.equal(result.effectiveExpiresAt, T('2027-10-08T10:00:00'));
});
test('source id cannot be reused for another grant type', () => {
  assert.throws(() => projectLedger('teacher', [award('S'), award('S', BASE, { sourceType: 'gift' })], BASE), /IDEMPOTENCY_CONFLICT/);
});

test('fixed-end gift is honored or rejected for review, never silently moved by a paid period', () => {
  const cutoff = T('2026-10-08T10:00:00');
  const gift = award('G', BASE, { sourceType: 'gift', duration: { months: 1 }, metadata: { fixedEndsAt: cutoff } });
  assert.equal(projectLedger('teacher', [gift], BASE).effectiveExpiresAt, cutoff);
  assert.throws(() => projectLedger('teacher', [award('A'), gift], BASE), /GIFT_FIXED_END_CONFLICT/);
});

test('admin preview expires when unchanged ledger has aged past the review window', async () => {
  let now = BASE;
  const repository = new MemoryRepository();
  const service = createMembershipService({ repository, getIdentity: () => ({ teacherId: 'admin' }), administrators: ['admin'], clock: () => now });
  const entry = { sourceId: 'G', sourceType: 'gift', startsAt: BASE, duration: { months: 1 }, longTerm: false, operation: 'grant', metadata: {}, reason: 'Gift approval' };
  const preview = await service.previewAdminGrant({ teacherId: 'teacher', entry });
  now += 301000;
  await assert.rejects(service.applyAdminGrant({ teacherId: 'teacher', entry, previewToken: preview.token, previewAt: preview.previewAt }), /PREVIEW_STALE/);
  assert.equal(repository.read('teacher').grants.length, 0);
});
