'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { addMonths, instant } = require('../../cloudfunctions/membership-core/time');
const { grant, product: validateProduct, resolveProduct } = require('../../cloudfunctions/membership-core/model');
const { projectLedger: project, rebuildAccount } = require('../../cloudfunctions/membership-core/ledger');
const { T, BASE, award, refund, product } = require('./fixtures');

for (const [from, months, to] of [
  ['2026-09-08T10:00:00', 12, '2027-09-08T10:00:00'],
  ['2026-01-31T23:59:59.123', 1, '2026-02-28T23:59:59.123'],
  ['2024-01-31T10:00:00', 1, '2024-02-29T10:00:00'],
  ['2024-02-29T10:00:00', 12, '2025-02-28T10:00:00'],
  ['2023-02-28T10:00:00', 12, '2024-02-28T10:00:00'],
  ['2026-12-31T00:00:00', 12, '2027-12-31T00:00:00'],
  ['2026-04-30T10:00:00', 1, '2026-05-30T10:00:00'],
  ['2023-03-01T00:00:00', 12, '2024-03-01T00:00:00']
]) test(`CST calendar ${from} + ${months} months`, () => assert.equal(addMonths(T(from), months), T(to)));

test('timezone explicit: UTC instant crosses CST calendar day', () => {
  assert.equal(addMonths(T('2024-02-28T16:30:00Z'), 12), T('2025-02-27T16:30:00Z'));
  assert.throws(() => instant('2026-09-08'), /INVALID/);
  assert.throws(() => addMonths(BASE, 0), /INVALID/);
});
test('first purchase begins at actual payment despite late recording', () => {
  const result = project('teacher', [award('A')], BASE + 86400000);
  assert.equal(result.effectiveStartsAt, BASE);
  assert.equal(result.effectiveExpiresAt, T('2027-09-08T10:00:00'));
});
for (const [delta, status] of [[-1000, 'active'], [0, 'expired'], [1000, 'expired']]) {
  test(`expiry half-open boundary ${delta}`, () => assert.equal(project('teacher', [award('A')], T('2027-09-08T10:00:00') + delta).status, status));
}
test('renewal extends original expiry, preserves continuous start', () => {
  const result = project('teacher', [award('A'), award('B', T('2027-01-01T10:00:00'))], T('2027-01-01T10:00:00'));
  assert.equal(result.effectiveStartsAt, BASE);
  assert.equal(result.effectiveExpiresAt, T('2028-09-08T10:00:00'));
});
test('repurchase after expiry starts at new payment; exactly expiry is contiguous', () => {
  const at = T('2027-10-08T10:00:00');
  assert.equal(project('teacher', [award('A'), award('B', at)], at).effectiveExpiresAt, T('2028-10-08T10:00:00'));
  assert.equal(project('teacher', [award('A'), award('B', at)], at).effectiveStartsAt, at);
  const edge = T('2027-09-08T10:00:00');
  assert.equal(project('teacher', [award('A'), award('B', edge)], edge).effectiveExpiresAt, T('2028-09-08T10:00:00'));
});
test('gift then purchase preserves gift plus full paid year', () => {
  const gifts = award('G', BASE, { sourceType: 'gift', duration: { months: 1 } });
  const result = project('teacher', [gifts, award('P', BASE + 86400000)], BASE + 86400000);
  assert.equal(result.effectiveExpiresAt, T('2027-10-08T10:00:00'));
});
test('gift after purchase cannot overwrite or shorten payment', () => {
  const result = project('teacher', [award('P'), award('G', BASE + 1, { sourceType: 'gift', duration: { months: 1 } })], BASE + 2);
  assert.equal(result.effectiveExpiresAt, T('2027-10-08T10:00:00'));
});
test('expired historical payment never becomes a fresh year at import time', () => {
  assert.equal(project('teacher', [award('H', T('2020-03-01T10:00:00'), { sourceType: 'historical_payment' })], BASE).status, 'expired');
});
test('long term survives ordinary paid grants and their refunds', () => {
  const result = project('teacher', [award('L', BASE, { sourceType: 'internal_long_term' }), award('A'), refund('R', 'A', BASE + 1)], BASE + 2);
  assert.equal(result.status, 'long_term'); assert.equal(result.effectiveExpiresAt, null);
});
test('positive admin adjustment and explicit long-term correction are traceable', () => {
  const entries = [award('L', BASE, { sourceType: 'internal_long_term' }), award('G', BASE, { sourceType: 'admin_adjustment', duration: { months: 1 } }), refund('R', 'L', BASE + 1, { sourceType: 'admin_adjustment' })];
  assert.equal(project('teacher', entries, BASE + 2).status, 'active');
  assert.equal(entries.length, 3);
});
test('source id duplicates are idempotent and conflicting reuse rejected', () => {
  const a = award('A');
  assert.equal(project('teacher', [a, a], BASE).periods.length, 1);
  assert.throws(() => project('teacher', [a, { ...a, reason: 'changed' }], BASE), /IDEMPOTENCY_CONFLICT/);
  assert.throws(() => project('other', [a], BASE), /TEACHER_MISMATCH/);
});
test('ledger source permutations yield identical rebuild, including refund before target in input', () => {
  const entries = [award('A'), award('B', BASE + 100), award('G', BASE + 200, { sourceType: 'gift', duration: { months: 1 } }), refund('R', 'A', T('2027-03-08T10:00:00'))];
  const expected = project('teacher', entries, T('2027-03-08T10:00:00'));
  for (let i = 0; i < entries.length; i++) {
    const order = [...entries.slice(i), ...entries.slice(0, i)].reverse();
    assert.deepEqual(project('teacher', order, T('2027-03-08T10:00:00')), expected);
  }
});
test('A refunded halfway: B starts immediately and retains twelve calendar months', () => {
  const at = T('2027-03-08T10:00:00');
  const entries = [award('A'), award('B', BASE + 1), refund('R', 'A', at)];
  const result = project('teacher', entries, at);
  assert.equal(result.periods[0].endsAt, at);
  assert.equal(result.periods[1].startsAt, at);
  assert.equal(result.effectiveExpiresAt, T('2028-03-08T10:00:00'));
  assert.deepEqual(project('teacher', [...entries, entries[2]], at), result);
});
test('only B refunded: A remains until original expiry', () => {
  assert.equal(project('teacher', [award('A'), award('B', BASE + 1), refund('R', 'B', T('2027-03-08T10:00:00'))], T('2027-03-08T10:00:00')).effectiveExpiresAt, T('2027-09-08T10:00:00'));
});
test('expired A refund does not debit B; all remaining refunds yield expired not negative', () => {
  const at = T('2027-10-08T10:00:00');
  const entries = [award('A'), award('B', BASE + 1), refund('R', 'A', at)];
  assert.equal(project('teacher', entries, at).effectiveExpiresAt, T('2028-09-08T10:00:00'));
  const result = project('teacher', [...entries, refund('RB', 'B', at)], at);
  assert.equal(result.status, 'expired');
  assert.ok(result.periods.every(p => p.endsAt >= p.startsAt));
});
test('distinct duplicate refund outcomes cannot debit remaining gift', () => {
  const at = BASE + 86400000;
  const entries = [award('A'), award('G', BASE + 1, { sourceType: 'gift', duration: { months: 1 } }), refund('R1', 'A', at), refund('R2', 'A', at + 1)];
  assert.equal(project('teacher', entries, at + 2).effectiveExpiresAt, T('2026-10-09T10:00:00'));
});
test('future refunds do not alter a historical as-of projection', () => {
  assert.equal(project('teacher', [award('A'), refund('R', 'A', BASE + 1000)], BASE).effectiveExpiresAt, T('2027-09-08T10:00:00'));
});
test('future gift gap does not falsely extend currently effective expiry', () => {
  const result = project('teacher', [award('A'), award('G', T('2030-01-01T10:00:00'), { sourceType: 'gift' })], BASE);
  assert.equal(result.effectiveExpiresAt, T('2027-09-08T10:00:00'));
});
test('refund invalid target, foreign target or gift target rejected', () => {
  assert.throws(() => project('teacher', [refund('R', 'missing', BASE)], BASE), /TARGET/);
  assert.throws(() => project('teacher', [award('G', BASE, { sourceType: 'gift' }), refund('R', 'G', BASE + 1)], BASE + 1), /REFUND_REQUIRES_PAYMENT/);
});
test('raw ledger is never mutated and rebuild ignores stale account caches', () => {
  const entries = [award('A')]; const copy = structuredClone(entries);
  const result = rebuildAccount('teacher', entries, null, BASE);
  assert.deepEqual(entries, copy); assert.equal(result.schemaVersion, 1);
  assert.equal(result.status, 'active');
});
test('product contract: cents, controlled annual duration, per-account test restriction', () => {
  assert.equal(validateProduct(product()).price, 100);
  assert.equal(validateProduct(product({ testOnly: false, allowedTestAccounts: [], price: 39900 })).price, 39900);
  for (const override of [{ price: 1.5 }, { price: -1 }, { duration: { months: 11 } }, { autoRenew: true }, { allowedTestAccounts: [] }, { testOnly: false, price: 100 }]) assert.throws(() => validateProduct(product(override)));
  assert.throws(() => resolveProduct(product(), 'other'), /PRODUCT_NOT_AVAILABLE/);
  assert.throws(() => resolveProduct(product({ enabled: false }), 'teacher'), /PRODUCT_NOT_AVAILABLE/);
});
test('grant rejects arbitrary amount/duration top-level and inconsistent dates', () => {
  assert.throws(() => grant({ ...award('A'), price: 1 }), /UNEXPECTED_FIELDS/);
  assert.throws(() => grant({ ...award('A'), endsAt: BASE }), /INVALID_ENDS_AT/);
  assert.throws(() => grant({ ...award('A'), duration: { months: 1 }, endsAt: addMonths(BASE, 1) }), /PAYMENT_GRANT/);
});
