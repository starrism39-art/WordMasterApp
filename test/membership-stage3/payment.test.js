'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { setup, BASE, encrypt, cryptoConfig } = require('./fixtures');
const { createNotificationHandler, createClientHandler } = require('../../cloudfunctions/membership-payment/handlers');
const { addDuration } = require('../../cloudfunctions/membership-core/time');
const { award } = require('../membership-stage2/fixtures');
async function paid(s, requestId) { const order = await s.create(requestId); await s.engine.authenticatedEvent(await s.event(order.orderId)); return order; }
for (const [key, value] of Object.entries({ amount: 1, duration: { months: 999 }, teacherId: 'victim', openId: 'victim', channel: 'apple_iap' })) {
  test(`reject client ${key}`, async () => { const s = setup(); await assert.rejects(s.engine.createOrder({ productId: s.item.productId, requestId: 'x', [key]: value }), /UNEXPECTED_FIELDS/); });
}
test('test product whitelist checked on server', async () => { const s = setup(); s.state.actor.teacherId = 'outsider'; await assert.rejects(s.create(), /PRODUCT_NOT_AVAILABLE/); });
test('disabled purchase configuration', async () => { const s = setup({ config: { purchaseEnabled: false } }); await assert.rejects(s.create(), /PURCHASE_DISABLED/); });
test('long-term membership cannot create another purchase', async () => { const s = setup(); s.sdk.seed('ledgers', 'teacher', { teacherId: 'teacher', revision: 1, access: null, grants: [award('internal', BASE, { sourceType: 'internal_long_term' })] }); await assert.rejects(s.create(), /LONG_TERM_PURCHASE_DISABLED/); });
test('unverified channel cannot purchase', async () => { const s = setup({ config: { enabledChannels: [] } }); await assert.rejects(s.create(), /CHANNEL_NOT_VERIFIED/); });
test('iOS sandbox rejected', async () => { const s = setup({ config: { env: 1 }, product: { channel: 'apple_iap' } }); await assert.rejects(s.create(), /IOS_SANDBOX_UNSUPPORTED/); });
test('same request concurrent retry returns same order; new intent different', async () => {
  const s = setup(); const [a, b] = await Promise.all([s.create(), s.create()]); assert.equal(a.orderId, b.orderId); assert.notEqual((await s.create('intent2')).orderId, a.orderId);
});
test('order owns immutable product snapshot and exact signed payload', async () => {
  const s = setup(); const a = await s.create(); const o = await s.repo.get('orders', a.orderId);
  assert.equal(o.amount, 100); assert.equal(o.unit, 'fen'); assert.equal(JSON.parse(o.signData).goodsPrice, 100); assert.equal(o.orderId.length, 32);
  const record = await s.repo.get('products', s.item.productId); record.product.enabled = false; s.sdk.seed('products', s.item.productId, record);
  await assert.rejects(s.engine.parameters({ orderId: a.orderId }), /PRODUCT_NOT_AVAILABLE/);
  await s.engine.authenticatedEvent(await s.event(a.orderId)); assert.equal((await s.repo.get('orders', a.orderId)).grantStatus, 'granted');
});
test('ownership checks query and signing', async () => {
  const s = setup(); const a = await s.create(); s.state.actor.teacherId = 'other'; s.state.actor.openId = 'other';
  await assert.rejects(s.engine.queryOrder({ orderId: a.orderId }), /ORDER_NOT_OWNED/); await assert.rejects(s.engine.parameters({ orderId: a.orderId }), /ORDER_NOT_OWNED/);
});
for (const [label, changes, code] of [
  ['wrong application', { ToUserName: 'gh_other' }, /WRONG_APPLICATION/],
  ['wrong buyer', { OpenId: 'other' }, /GOODS_IDENTITY_MISMATCH/],
  ['wrong environment', { Env: 1 }, /GOODS_IDENTITY_MISMATCH/],
  ['unknown order', { OutTradeNo: 'unknown' }, /UNKNOWN_ORDER/],
  ['coin recharge', { Event: 'xpay_coin_pay_notify' }, /UNSUPPORTED_EVENT/]
]) test(label, async () => { const s = setup(); const a = await s.create(); await assert.rejects(s.engine.authenticatedEvent(await s.event(a.orderId, changes)), code); assert.equal(await s.repo.get('ledgers', 'teacher'), null); });
for (const key of ['ActualPrice', 'OrigPrice', 'Quantity', 'ProductId', 'Attach']) test(`reject goods ${key} tampering`, async () => {
  const s = setup(); const a = await s.create(); const e = await s.event(a.orderId); e.GoodsInfo[key] = 'wrong'; await assert.rejects(s.engine.authenticatedEvent(e), /GOODS_MISMATCH/);
});
for (const [key, value] of Object.entries({ status: 9, order_fee: 1, paid_fee: 1, coupon_fee: 1, env_type: 0, order_type: 7, wx_order_id: '', paid_time: BASE / 1000 + 1, refund_fee: 100 })) test(`query rejects ${key}`, async () => {
  const s = setup(); const a = await s.create(); s.state.queryChanges[key] = value;
  await assert.rejects(s.engine.authenticatedEvent(await s.event(a.orderId))); assert.equal(await s.repo.get('ledgers', 'teacher'), null);
});
test('query-only with unspecified biz_meta stays pending, never guesses goods', async () => {
  const s = setup(); const a = await s.create(); assert.equal((await s.engine.reconcile(a.orderId)).userStatus, 'PAYMENT_PENDING_REVIEW');
  assert.equal((await s.repo.get('work', a.orderId)).state, 'review_required'); assert.equal(await s.repo.get('ledgers', 'teacher'), null);
});
test('notification and query race grants exactly once', async () => {
  const s = setup(); const a = await s.create(); s.state.queryError = 'OFFLINE'; await assert.rejects(s.engine.authenticatedEvent(await s.event(a.orderId)));
  s.state.queryError = null;
  await Promise.all([s.engine.authenticatedEvent(await s.event(a.orderId)), s.engine.reconcile(a.orderId)]);
  assert.equal((await s.repo.get('ledgers', 'teacher')).grants.length, 1);
});
test('same platform transaction cannot bind two orders', async () => {
  const s = setup(); const a = await paid(s, 'a'); const b = await s.create('b'); s.state.queryChanges.wx_order_id = `tx_${a.orderId}`;
  await assert.rejects(s.engine.authenticatedEvent(await s.event(b.orderId)), /TRANSACTION_ALREADY_BOUND/); assert.equal((await s.repo.get('ledgers', 'teacher')).grants.length, 1);
});
test('same teacher two concurrent payments both preserved and 24 months', async () => {
  const s = setup(); const a = await s.create('a'); const b = await s.create('b');
  await Promise.all([s.engine.authenticatedEvent(await s.event(a.orderId)), s.engine.authenticatedEvent(await s.event(b.orderId))]);
  assert.equal((await s.repo.get('ledgers', 'teacher')).grants.length, 2);
  assert.equal((await s.repo.get('accounts', 'teacher')).effectiveExpiresAt, addDuration(addDuration(BASE, { months: 12 }), { months: 12 }));
});
test('duplicate notification timestamp changes do not regrant', async () => { const s = setup(); const a = await paid(s); await s.engine.authenticatedEvent(await s.event(a.orderId, { CreateTime: BASE / 1000 + 9 })); assert.equal((await s.repo.get('ledgers', 'teacher')).grants.length, 1); });
test('grant commit failure retains paid fact and durable work; compensation uses real paidAt', async () => {
  const s = setup(); const a = await s.create(); s.sdk.fail = rows => [...rows.keys()].some(key => key.startsWith('membership_grants/'));
  await assert.rejects(s.engine.authenticatedEvent(await s.event(a.orderId)), /INJECTED_COMMIT_FAILURE/);
  const order = await s.repo.get('orders', a.orderId); assert.equal(order.paymentStatus, 'paid'); assert.equal(order.grantStatus, 'pending'); assert.equal(await s.repo.get('ledgers', 'teacher'), null);
  s.state.clock += 86400000; await s.engine.compensate(); await s.engine.compensate();
  const ledger = await s.repo.get('ledgers', 'teacher'); assert.equal(ledger.grants.length, 1); assert.equal(ledger.grants[0].startsAt, BASE);
});
test('payment fact commit failure rolls back transaction claim; retry recovers', async () => {
  const s = setup(); const a = await s.create(); s.sdk.fail = rows => [...rows.keys()].some(key => key.startsWith('membership_payment_claims/'));
  await assert.rejects(s.engine.authenticatedEvent(await s.event(a.orderId))); assert.equal((await s.repo.get('orders', a.orderId)).fact, undefined);
  assert.equal([...s.sdk.rows.keys()].some(key => key.startsWith('membership_payment_claims/')), false);
  await s.engine.compensate(); assert.equal((await s.repo.get('orders', a.orderId)).grantStatus, 'granted');
});
test('delivery acknowledgement retry never repeats grant', async () => {
  const s = setup(); const a = await paid(s); s.state.deliveryError = 'OFFLINE'; await s.engine.compensate();
  assert.equal((await s.repo.get('work', a.orderId)).state, 'pending'); s.state.deliveryError = null; s.state.clock += 3600000; await s.engine.compensate();
  assert.equal((await s.repo.get('ledgers', 'teacher')).grants.length, 1); assert.equal((await s.repo.get('work', a.orderId)).state, 'done');
});
test('unconfirmed payments do not exhaust paid-delivery retry budget', async () => {
  const s = setup(); const a = await s.create(); s.state.queryError = 'OFFLINE'; for (let i = 0; i < 12; i++) { await s.engine.compensate(); s.state.clock += 7200000; }
  const work = await s.repo.get('work', a.orderId); assert.equal(work.state, 'pending'); assert.equal(work.attempts, 0); assert.equal(work.phase, 'payment_confirmation'); assert.equal(work.needsReview, true);
});
test('refund before grant suppresses late payment forever', async () => {
  const s = setup(); const a = await s.create(); await s.engine.authenticatedEvent(await s.refundEvent(a.orderId));
  await s.engine.authenticatedEvent(await s.event(a.orderId)); assert.equal((await s.repo.get('orders', a.orderId)).paymentStatus, 'refunded'); assert.equal(await s.repo.get('ledgers', 'teacher'), null);
});
test('refund removes only matching remainder and protects second order', async () => {
  const s = setup(); const a = await paid(s, 'a'); await paid(s, 'b'); s.state.clock += 86400000;
  await s.engine.authenticatedEvent(await s.refundEvent(a.orderId)); await s.engine.authenticatedEvent(await s.refundEvent(a.orderId)); await s.engine.authenticatedEvent(await s.event(a.orderId));
  const row = await s.repo.get('ledgers', 'teacher'); assert.equal(row.grants.length, 3); assert.equal((await s.repo.get('accounts', 'teacher')).status, 'active');
});
test('partial refund requires review rather than revoking full annual grant', async () => { const s = setup(); const a = await paid(s); await assert.rejects(s.engine.authenticatedEvent(await s.refundEvent(a.orderId, { RefundFee: 1 })), /PARTIAL_REFUND/); assert.equal((await s.repo.get('ledgers', 'teacher')).grants.length, 1); });
test('refund failure is durably handled and does not revoke', async () => { const s = setup(); const a = await paid(s); const result = await s.engine.authenticatedEvent(await s.refundEvent(a.orderId, { RetCode: 1 })); assert.equal(result.refundResultRecorded, true); assert.equal((await s.repo.get('orders', a.orderId)).grantStatus, 'granted'); });
test('callback does not ACK uncommitted grant; signed retry ACKs', async () => {
  const s = setup(); const a = await s.create(); const handler = createNotificationHandler({ engine: s.engine, config: cryptoConfig }); const req = encrypt(await s.event(a.orderId));
  s.sdk.fail = rows => [...rows.keys()].some(key => key.startsWith('membership_grants/'));
  assert.equal((await handler(req)).statusCode, 503); assert.equal((await handler(req)).body, 'success');
});
test('unsigned input never reaches engine; internal methods not client exposed', async () => {
  let calls = 0; const handler = createNotificationHandler({ engine: { authenticatedEvent() { calls++; } }, config: cryptoConfig });
  assert.equal((await handler({ method: 'POST', body: '{}', query: {} })).statusCode, 503); assert.equal(calls, 0);
  await assert.rejects(createClientHandler(setup().engine)({ action: 'authenticatedEvent', request: {} }), /ACTION_NOT_ALLOWED/);
});
test('reverse arrival replays Stage2 chronological allocation', async () => {
  const s = setup(); const a = await s.create('older'); const b = await s.create('newer'); s.state.clock += 1000;
  s.state.queryChanges.paid_time = s.state.clock / 1000; await s.engine.authenticatedEvent(await s.event(b.orderId));
  s.state.queryChanges.paid_time = BASE / 1000; await s.engine.authenticatedEvent(await s.event(a.orderId));
  const account = await s.repo.get('accounts', 'teacher'); assert.equal(account.periods.length, 2); assert.equal(account.effectiveStartsAt, BASE); assert.equal(account.effectiveExpiresAt, addDuration(addDuration(BASE, { months: 12 }), { months: 12 }));
});
test('refund and payment concurrently leave no revived membership', async () => {
  const s = setup(); const a = await s.create(); await Promise.all([s.engine.authenticatedEvent(await s.event(a.orderId)), s.engine.authenticatedEvent(await s.refundEvent(a.orderId))]);
  const order = await s.repo.get('orders', a.orderId); assert.equal(order.paymentStatus, 'refunded');
  const account = await s.repo.get('accounts', 'teacher'); assert.ok(!account || account.status !== 'active');
});
test('authenticated partial refund produces a durable review exception', async () => {
  const s = setup(); const a = await paid(s); await assert.rejects(s.engine.authenticatedEvent(await s.refundEvent(a.orderId, { RefundFee: 1 })));
  assert.ok([...s.sdk.rows.values()].some(row => row.kind === 'processing_exception' && row.code === 'PARTIAL_REFUND_REQUIRES_REVIEW'));
});
test('process replacement after failed grant recovers using persisted facts only', async () => {
  const s = setup(); const a = await s.create(); s.sdk.fail = rows => [...rows.keys()].some(key => key.startsWith('membership_grants/'));
  await assert.rejects(s.engine.authenticatedEvent(await s.event(a.orderId)));
  const { createPaymentEngine } = require('../../cloudfunctions/membership-payment/engine');
  const replacement = createPaymentEngine({ repository: s.repo, api: s.api, config: s.config, getIdentity: async () => { throw new Error('NO_CLIENT'); }, clock: () => s.state.clock + 1000 });
  await replacement.compensate(); assert.equal((await s.repo.get('ledgers', 'teacher')).grants.length, 1);
});
