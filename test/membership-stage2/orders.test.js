'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { transitionOrder: next, paymentEvent } = require('../../cloudfunctions/membership-core/orders');
const { BASE } = require('./fixtures');
const order = (status = 'created') => ({ orderId: 'fixture_order', teacherId: 'teacher', productId: 'test_annual', amount: 100, currency: 'CNY', status, createdAt: BASE, updatedAt: BASE, schemaVersion: 1 });
const proof = (extra = {}) => ({ authority: 'server', eventId: 'event1', at: BASE, ...extra });
test('paid is distinct from granted and supports compensation via grant_pending', () => {
  let value = next(order(), 'awaiting_payment', proof());
  value = next(value, 'paid', proof({ paymentVerified: true }));
  assert.equal(value.grantId, null);
  value = next(value, 'grant_pending', proof({ paymentVerified: true }));
  value = next(value, 'exception', proof());
  value = next(value, 'grant_pending', proof({ paymentVerified: true }));
  value = next(value, 'granted', proof({ paymentVerified: true, grantId: 'G' }));
  assert.equal(value.grantId, 'G');
});
test('frontend success cannot grant, cancelled client result can later reconcile platform paid', () => {
  assert.throws(() => next(order(), 'paid', proof({ authority: 'client', paymentVerified: true })), /SERVER/);
  assert.throws(() => next(order('paid'), 'granted', proof({ paymentVerified: true, grantId: 'G' })), /TRANSITION/);
  assert.equal(next(order('cancelled'), 'paid', proof({ paymentVerified: true })).status, 'paid');
});
test('refund request alone cannot remove grants; final refund is terminal', () => {
  const pending = next(order('granted'), 'refund_pending', proof());
  assert.throws(() => next(pending, 'refunded', proof()), /REFUND_EVIDENCE/);
  const refunded = next(pending, 'refunded', proof({ refundVerified: true }));
  assert.deepEqual(next(refunded, 'refunded', proof()), refunded);
  assert.throws(() => next(refunded, 'paid', proof({ paymentVerified: true })), /TRANSITION/);
});
test('stale messages require reconciliation and payment/refund evidence is mandatory', () => {
  assert.throws(() => next(order(), 'paid', proof()), /PAYMENT_EVIDENCE/);
  assert.throws(() => next(order(), 'paid', proof({ at: BASE - 1, paymentVerified: true })), /STALE_EVENT/);
  assert.throws(() => next(order('refund_pending'), 'granted', proof({ paymentVerified: true, grantId: 'G' })), /REFUND_RESOLUTION/);
});
test('event contract tracks received/occurred times, digest and verification stage', () => {
  const event = paymentEvent({ eventId: 'E', orderId: 'O', receivedAt: BASE, occurredAt: BASE - 100, kind: 'payment', status: 'pending_verification', payloadDigest: 'a'.repeat(64) });
  assert.equal(event.schemaVersion, 1);
  assert.throws(() => paymentEvent({ ...event, payloadDigest: 'secret raw payload' }), /INVALID/);
});
