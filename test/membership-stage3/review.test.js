'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { setup, BASE } = require('./fixtures');
const { createPaymentEngine, paymentView } = require('../../cloudfunctions/membership-payment/engine');
const { createClientHandler } = require('../../cloudfunctions/membership-payment/handlers');
const { addDuration } = require('../../cloudfunctions/membership-core/time');
async function review() {
  const s = setup(); const a = await s.create(); await s.engine.reconcile(a.orderId);
  const order = await s.repo.get('orders', a.orderId);
  const proof = { ...order.review.candidate, reference: 'official_record_1', mode: 'short_series_goods', status: 'paid', offerId: order.offerId, quantity: 1 };
  const identity = { operatorId: 'admin_fixture', isAdmin: true };
  const build = () => createPaymentEngine({ repository: s.repo, api: s.api, config: s.config, getIdentity: async () => s.state.actor,
    getAdminIdentity: async () => identity, getReviewEvidence: async ref => ref === proof.reference ? proof : null, clock: () => s.state.clock });
  const engine = build();
  return { ...s, a, proof, identity, build, engine, confirm: () => engine.confirmPaidAndGrant(a.orderId, {}, { reference: proof.reference }, 'Official order manually checked') };
}
test('administrator grants snapshot duration at original payment time, with atomic audit; repeat is idempotent', async () => {
  const s = await review(); s.state.clock += 86400000 * 5;
  const live = await s.repo.get('products', s.item.productId); live.product.enabled = false; s.sdk.seed('products', s.item.productId, live);
  assert.equal((await s.confirm()).userStatus, 'MEMBER_GRANTED'); await s.confirm();
  const row = await s.repo.get('ledgers', 'teacher'); assert.equal(row.grants.length, 1);
  const g = row.grants[0]; assert.equal(g.sourceType, 'payment'); assert.equal(g.startsAt, BASE); assert.equal(g.endsAt, addDuration(BASE, { months: 12 }));
  const audits = [...s.sdk.rows.entries()].filter(([k]) => k.startsWith('membership_admin_audit/')).map(([,v]) => v);
  assert.equal(audits.length, 1); const audit = audits[0];
  assert.equal(audit.before.order.paymentStatus, 'review_required'); assert.equal(audit.after.order.grantStatus, 'granted');
  for (const key of ['operator', 'reason', 'evidenceReference', 'evidenceHash', 'createdAt', 'orderId', 'teacherId', 'amount', 'productId', 'transactionId', 'grantId']) assert.ok(audit[key]);
  assert.equal(g.metadata.adminConfirmation.evidenceReference, audit.evidenceReference);
});
for (const key of ['teacherId', 'orderId', 'amount', 'productId', 'transactionId', 'paidAt', 'appId', 'offerId', 'env', 'channel', 'currency', 'unit', 'quantity', 'mode']) test(`admin rejects incorrect evidence ${key}`, async () => {
  const s = await review(); s.proof[key] = 'wrong'; await assert.rejects(s.confirm(), /REVIEW_EVIDENCE/); assert.equal(await s.repo.get('ledgers', 'teacher'), null);
});
test('nonadmin and forged caller context cannot confirm', async () => {
  const s = await review(); s.identity.isAdmin = false;
  await assert.rejects(s.engine.confirmPaidAndGrant(s.a.orderId, { isAdmin: true }, { reference: s.proof.reference }, 'test'), /ADMIN_REQUIRED/);
  await assert.rejects(createClientHandler(s.engine)({ action: 'confirmPaidAndGrant', request: {} }), /ACTION_NOT_ALLOWED/);
});
test('missing admin adapters fail closed, payload cannot supply evidence fields or duration', async () => {
  const s = await review(); const basic = setup(); await assert.rejects(basic.engine.confirmPaidAndGrant(s.a.orderId, {}, {}, 'test'), /ADMIN_NOT_CONFIGURED/);
  await assert.rejects(s.engine.confirmPaidAndGrant(s.a.orderId, {}, { reference: s.proof.reference, duration: { months: 12 } }, 'test'), /UNEXPECTED_FIELDS/);
  await assert.rejects(s.engine.confirmPaidAndGrant('unknown', {}, { reference: s.proof.reference }, 'test'), /UNKNOWN_ORDER/);
});
for (const status of ['refunded', 'refund_pending', 'cancelled', 'closed', 'payment_failed']) test(`admin cannot grant ${status} order`, async () => {
  const s = await review(); const order = await s.repo.get('orders', s.a.orderId); order.paymentStatus = status; s.sdk.seed('orders', order.orderId, order);
  await assert.rejects(s.confirm(), /ORDER_NOT_REVIEWABLE/); assert.equal(await s.repo.get('ledgers', 'teacher'), null);
});
test('audit commit failure rolls back grant/order/account; process recreation and conflict retries recover once', async () => {
  const s = await review(); s.sdk.fail = rows => [...rows.keys()].some(k => k.startsWith('membership_admin_audit/'));
  await assert.rejects(s.confirm(), /INJECTED_COMMIT_FAILURE/);
  assert.equal(await s.repo.get('ledgers', 'teacher'), null); assert.equal((await s.repo.get('orders', s.a.orderId)).paymentStatus, 'review_required');
  s.sdk.conflicts = 1;
  await s.build().confirmPaidAndGrant(s.a.orderId, {}, { reference: s.proof.reference }, 'Recovered official review');
  assert.equal((await s.repo.get('ledgers', 'teacher')).grants.length, 1);
});
test('concurrent admin confirmations grant and audit once', async () => {
  const s = await review(); await Promise.all([s.confirm(), s.confirm()]); assert.equal((await s.repo.get('ledgers', 'teacher')).grants.length, 1);
  assert.equal([...s.sdk.rows.keys()].filter(k => k.startsWith('membership_admin_audit/')).length, 1);
});
test('late goods notification safely resolves evidence-only review', async () => {
  const s = await review(); await s.engine.authenticatedEvent(await s.event(s.a.orderId)); await s.engine.authenticatedEvent(await s.event(s.a.orderId));
  assert.equal((await s.repo.get('ledgers', 'teacher')).grants.length, 1);
});
test('admin and notification race retain one grant', async () => {
  const s = await review(); const results = await Promise.allSettled([s.confirm(), s.engine.authenticatedEvent(await s.event(s.a.orderId))]);
  assert.ok(results.some(r => r.status === 'fulfilled'));
  await s.engine.authenticatedEvent(await s.event(s.a.orderId)); assert.equal((await s.repo.get('ledgers', 'teacher')).grants.length, 1);
});
test('refund during review suppresses admin and late success', async () => {
  const s = await review(); await s.engine.authenticatedEvent(await s.refundEvent(s.a.orderId)); await assert.rejects(s.confirm(), /ORDER_NOT_REVIEWABLE/);
  await s.engine.authenticatedEvent(await s.event(s.a.orderId)); assert.equal(await s.repo.get('ledgers', 'teacher'), null);
});
test('stable client contract distinguishes processing/cancelled/failed/review without local grant', () => {
  for (const [paymentStatus, expected] of [['awaiting_payment','PAYMENT_PROCESSING'],['paid','PAYMENT_PROCESSING'],['cancelled','PAYMENT_CANCELLED'],['payment_failed','PAYMENT_FAILED']]) assert.equal(paymentView({ paymentStatus }).userStatus, expected);
});
test('reconstructed compensation leaves evidence review untouched', async () => {
  const s = await review(); const calls = s.state.queryCalls; s.state.clock += 86400000; assert.deepEqual(await s.build().compensate(), []); assert.equal(s.state.queryCalls, calls);
});

// No real platform calls; all evidence below is isolated fixture data.
test('admin cannot reclaim a transaction bound to a different order', async () => {
  const s = await review(); const { hash } = require('../../cloudfunctions/membership-payment/crypto');
  const key = hash({ appId: s.proof.appId, env: s.proof.env, transactionId: s.proof.transactionId });
  s.sdk.seed('claims', key, { orderId: 'another_order' });
  await assert.rejects(s.confirm(), /TRANSACTION_ALREADY_BOUND/);
  assert.equal((await s.repo.get('claims', key)).orderId, 'another_order'); assert.equal(await s.repo.get('ledgers', 'teacher'), null);
});
test('two independently reviewed orders of the same teacher both survive concurrent grants', async () => {
  const s = await review(); const b = await s.create('intent_second'); await s.engine.reconcile(b.orderId);
  const orderB = await s.repo.get('orders', b.orderId);
  const proofB = { ...orderB.review.candidate, reference: 'record_second', mode: 'short_series_goods', status: 'paid', offerId: orderB.offerId, quantity: 1 };
  const engineB = createPaymentEngine({ repository: s.repo, api: s.api, config: s.config, getIdentity: async () => s.state.actor,
    getAdminIdentity: async () => s.identity, getReviewEvidence: async () => proofB, clock: () => s.state.clock });
  await Promise.all([s.confirm(), engineB.confirmPaidAndGrant(b.orderId, {}, { reference: proofB.reference }, 'Second official order')]);
  const row = await s.repo.get('ledgers', 'teacher'); assert.equal(row.grants.length, 2);
  const { rebuildAccount } = require('../../cloudfunctions/membership-core/ledger');
  assert.deepEqual(await s.repo.get('accounts', 'teacher'), rebuildAccount('teacher', row.grants, row.access, s.state.clock));
});
