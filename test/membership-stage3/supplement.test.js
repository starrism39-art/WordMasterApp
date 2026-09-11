'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { setup, BASE } = require('./fixtures');
const { credentialProviders, internalHandler, createRuntime } = require('../../cloudfunctions/membership-payment/runtime');
const { hmac, messageSignature } = require('../../cloudfunctions/membership-payment/crypto');
const { createNotificationHandler } = require('../../cloudfunctions/membership-payment/handlers');
test('absent coupon/refund_fee accepted for an authenticated goods payment with full left_fee', async () => {
  const s = setup(); const a = await s.create(); s.state.queryChanges = { coupon_fee: undefined, refund_fee: undefined };
  await s.engine.authenticatedEvent(await s.event(a.orderId)); assert.equal((await s.repo.get('orders', a.orderId)).grantStatus, 'granted');
});
for (const [label, value, expected] of [['absent', undefined, /REFUND_BALANCE_REQUIRED/], ['null', null, /REFUND_BALANCE_REQUIRED/], ['zero', 0, /REFUND_BALANCE_REQUIRES_REVIEW/], ['partial', 50, /REFUND_BALANCE_REQUIRES_REVIEW/]]) test(`left_fee ${label} never silently means unrefunded`, async () => {
  const s = setup(); const a = await s.create(); s.state.queryChanges.left_fee = value;
  await assert.rejects(s.engine.authenticatedEvent(await s.event(a.orderId)), expected); assert.equal(await s.repo.get('ledgers', 'teacher'), null);
});
test('refund order type is never interpreted as payment', async () => {
  const s = setup(); const a = await s.create(); s.state.queryChanges = { order_type: 1, refund_fee: 100, left_fee: 0 };
  await assert.rejects(s.engine.authenticatedEvent(await s.event(a.orderId)), /QUERY_CHANNEL_MISMATCH/);
});
test('long unpaid wait does not exhaust delivery retries; late payment still grants once', async () => {
  const s = setup(); const a = await s.create(); s.state.queryChanges.status = 1;
  for (let i = 0; i < 25; i++) { await s.engine.compensate(); s.state.clock += 7200000; }
  const work = await s.repo.get('work', a.orderId); assert.equal(work.attempts, 0); assert.equal(work.state, 'pending'); assert.equal(work.phase, 'awaiting_payment');
  s.state.queryChanges = { status: 2, paid_time: s.state.clock / 1000 };
  await s.engine.authenticatedEvent(await s.event(a.orderId)); await s.engine.compensate();
  assert.equal((await s.repo.get('ledgers', 'teacher')).grants.length, 1);
});
test('only authoritative closed state ends unpaid polling', async () => {
  const s = setup(); const a = await s.create(); s.state.queryChanges.status = 6; await s.engine.compensate();
  assert.equal((await s.repo.get('orders', a.orderId)).paymentStatus, 'closed'); assert.equal((await s.repo.get('work', a.orderId)).state, 'done');
});
test('paid grant failure refresh detects missing refund notification and prevents old success revival', async () => {
  const s = setup(); const a = await s.create(); s.sdk.fail = rows => [...rows.keys()].some(key => key.startsWith('membership_grants/'));
  await assert.rejects(s.engine.authenticatedEvent(await s.event(a.orderId)));
  s.state.queryChanges.status = 5; await s.engine.compensate();
  assert.equal((await s.repo.get('orders', a.orderId)).reviewRequired, 'PLATFORM_REFUND_REQUIRES_REVIEW');
  s.state.queryChanges.status = 2;
  await assert.rejects(s.engine.authenticatedEvent(await s.event(a.orderId)), /ORDER_REQUIRES_REVIEW/); assert.equal(await s.repo.get('ledgers', 'teacher'), null);
});
test('granted order explicit refund recheck records review without inventing refund timestamp', async () => {
  const s = setup(); const a = await s.create(); await s.engine.authenticatedEvent(await s.event(a.orderId)); s.state.queryChanges.status = 8;
  await assert.rejects(s.engine.reconcile(a.orderId, { refresh: true }), /ORDER_REQUIRES_REVIEW/);
  assert.equal((await s.repo.get('work', a.orderId)).phase, 'review'); assert.equal((await s.repo.get('ledgers', 'teacher')).grants.length, 1);
});
test('transaction conflict becomes a durable exception and preserves original binding', async () => {
  const s = setup(); const a = await s.create('a'); await s.engine.authenticatedEvent(await s.event(a.orderId)); const b = await s.create('b');
  s.state.queryChanges.wx_order_id = `tx_${a.orderId}`;
  await assert.rejects(s.engine.authenticatedEvent(await s.event(b.orderId)), /TRANSACTION_ALREADY_BOUND/);
  assert.equal((await s.repo.get('orders', b.orderId)).reviewRequired, 'TRANSACTION_ALREADY_BOUND'); assert.equal((await s.repo.get('work', b.orderId)).state, 'exception');
  assert.equal((await s.repo.get('ledgers', 'teacher')).grants.length, 1);
});
test('paid delivery retries bounded independently of unpaid polling', async () => {
  const s = setup(); const a = await s.create(); await s.engine.authenticatedEvent(await s.event(a.orderId)); s.state.deliveryError = 'OFFLINE';
  for (let i = 0; i < 12; i++) { await s.engine.compensate(); s.state.clock += 7200000; }
  assert.equal((await s.repo.get('work', a.orderId)).state, 'exception'); assert.equal((await s.repo.get('ledgers', 'teacher')).grants.length, 1);
});
test('missing protected credentials fail before transport', async () => {
  const c = credentialProviders({}); await assert.rejects(c.getAccessToken(), /CREDENTIAL_NOT_CONFIGURED/); await assert.rejects(c.getAppKey(0), /CREDENTIAL_NOT_CONFIGURED/); assert.throws(c.internal, /CREDENTIAL_NOT_CONFIGURED/);
  assert.throws(() => createRuntime({ config: {} }), /RUNTIME_NOT_CONFIGURED/);
});
test('internal compensation rejects unsigned clients, stale requests and replay', async () => {
  const s = setup(); const key = 'LOCAL_ONLY_INTERNAL_FIXTURE_KEY_32_BYTES';
  const handler = internalHandler({ engine: s.engine, repository: s.repo, credentials: credentialProviders({ MEMBERSHIP_INTERNAL_KEY: key }), clock: () => BASE });
  const request = { body: JSON.stringify({ limit: 1 }), timestamp: BASE, nonce: 'local_fixture_nonce_1' };
  request.signature = hmac(key, `${request.timestamp}\n${request.nonce}\n${request.body}`);
  await assert.rejects(handler({ ...request, signature: 'fake' }), /INTERNAL_AUTH_REQUIRED/);
  await assert.rejects(handler({ ...request, timestamp: BASE - 300001 }), /INTERNAL_AUTH_REQUIRED/);
  assert.deepEqual((await handler(request)).compensation, []);
  await assert.rejects(handler(request), /INTERNAL_REPLAY_REJECTED/);
});
test('GET verification challenge never grants and invalid challenge is rejected', async () => {
  const config = { token: 'LOCAL_ONLY' }; const handler = createNotificationHandler({ config, engine: { authenticatedEvent() { throw new Error('UNEXPECTED'); } } });
  const query = { timestamp: '123', nonce: 'n', echostr: 'challenge', signature: messageSignature(config.token, '123', 'n') };
  assert.equal((await handler({ method: 'GET', query })).body, 'challenge'); assert.equal((await handler({ method: 'GET', query: { ...query, signature: 'fake' } })).statusCode, 403);
});
test('No notification: paid cash evidence becomes durable review, never automatic goods grant', async () => {
  const s = setup(); const a = await s.create();
  assert.equal((await s.engine.reconcile(a.orderId)).status, 'review_required');
  const order = await s.repo.get('orders', a.orderId);
  assert.equal(order.review.candidate.paidAt, BASE); assert.equal(order.review.missing, 'PRODUCT_EVIDENCE_REQUIRED');
  assert.equal(await s.repo.get('ledgers', 'teacher'), null);
  const calls = s.state.queryCalls; await s.engine.compensate(); await s.engine.compensate();
  assert.equal(s.state.queryCalls, calls);
});
