'use strict';

const { ORDER_STATUSES, SCHEMA_VERSION } = require('./constants');
const { instant } = require('./time');
const { id } = require('./model');
const TRANSITIONS = Object.freeze({
  created: ['awaiting_payment', 'paid', 'payment_failed', 'cancelled', 'exception'],
  awaiting_payment: ['paid', 'payment_failed', 'cancelled', 'exception'],
  payment_failed: ['paid', 'exception'], cancelled: ['paid', 'exception'],
  paid: ['grant_pending', 'refund_pending', 'refunded', 'exception'],
  grant_pending: ['granted', 'refund_pending', 'refunded', 'exception'],
  granted: ['refund_pending', 'refunded', 'exception'],
  refund_pending: ['refunded', 'paid', 'grant_pending', 'granted', 'exception'],
  refunded: [], exception: ['paid', 'grant_pending', 'granted', 'refund_pending', 'refunded']
});
function validateOrder(order) {
  ['orderId', 'teacherId', 'productId'].forEach(key => id(order[key], key));
  if (!ORDER_STATUSES.includes(order.status) || !Number.isSafeInteger(order.amount) || order.amount <= 0 || order.currency !== 'CNY') throw new Error('INVALID_ORDER');
  instant(order.createdAt); instant(order.updatedAt);
  if (order.updatedAt < order.createdAt || order.schemaVersion !== SCHEMA_VERSION) throw new Error('INVALID_ORDER');
  return structuredClone(order);
}
// Pure contract, not a notification verifier. Stage3 must supply durable evidence.
function transitionOrder(input, next, evidence) {
  const order = validateOrder(input);
  if (!ORDER_STATUSES.includes(next)) throw new Error('INVALID_ORDER_STATE');
  if (!evidence || evidence.authority !== 'server') throw new Error('SERVER_EVIDENCE_REQUIRED');
  id(evidence.eventId); instant(evidence.at);
  if (evidence.at < order.updatedAt) throw new Error('STALE_EVENT_REQUIRES_RECONCILIATION');
  if (next === order.status) return order;
  if (!TRANSITIONS[order.status].includes(next)) throw new Error('INVALID_ORDER_TRANSITION');
  if (['paid', 'grant_pending', 'granted'].includes(next) && !evidence.paymentVerified) throw new Error('PAYMENT_EVIDENCE_REQUIRED');
  if (next === 'granted' && !evidence.grantId) throw new Error('GRANT_EVIDENCE_REQUIRED');
  if (next === 'refunded' && !evidence.refundVerified) throw new Error('REFUND_EVIDENCE_REQUIRED');
  if (order.status === 'refund_pending' && next !== 'refunded' && next !== 'exception' && !evidence.refundRejected) throw new Error('REFUND_RESOLUTION_REQUIRED');
  return { ...order, status: next, updatedAt: evidence.at, lastEventId: evidence.eventId, grantId: evidence.grantId || order.grantId || null };
}
function paymentEvent(value) {
  ['eventId', 'orderId'].forEach(key => id(value[key]));
  instant(value.receivedAt); instant(value.occurredAt);
  if (!['payment', 'refund', 'query'].includes(value.kind) || !['pending_verification', 'verified', 'rejected', 'processed', 'exception'].includes(value.status) || typeof value.payloadDigest !== 'string' || !/^[a-f0-9]{64}$/.test(value.payloadDigest)) throw new Error('INVALID_PAYMENT_EVENT');
  return { ...value, schemaVersion: SCHEMA_VERSION };
}
module.exports = { TRANSITIONS, validateOrder, transitionOrder, paymentEvent };
