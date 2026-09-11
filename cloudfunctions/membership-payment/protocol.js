'use strict';
const { hash } = require('./crypto');
const { instant } = require('../membership-core/time');
function check(ok, message) { if (!ok) throw new Error(message); }
function seconds(value) { check(Number.isSafeInteger(value) && value > 0, 'INVALID_PLATFORM_TIME'); return instant(value * 1000); }
function goodsEvidence(order, event) {
  check(event.Event === 'xpay_goods_deliver_notify', 'NOT_GOODS_TRANSACTION');
  check(event.OpenId === order.openId && event.OutTradeNo === order.orderId && event.Env === order.env, 'GOODS_IDENTITY_MISMATCH');
  const g = event.GoodsInfo;
  check(g && g.ProductId === order.platformProductId && g.Quantity === 1 && g.OrigPrice === order.amount && g.ActualPrice === order.amount && g.Attach === order.attach, 'GOODS_MISMATCH');
  return { eventId: hash(event), productId: g.ProductId, openId: event.OpenId, orderId: event.OutTradeNo, env: event.Env, amount: g.ActualPrice, attach: g.Attach,
    paidAt: event.WeChatPayInfo?.PaidTime === undefined ? null : seconds(event.WeChatPayInfo.PaidTime),
    wxpayOrderId: event.WeChatPayInfo?.TransactionId || null };
}
function queryState(order, response) {
  check(response?.errcode === 0 && response.order, 'QUERY_NOT_CONFIRMED');
  const q = response.order;
  check(q.order_id === order.orderId && q.env_type === order.env + 1, 'QUERY_IDENTITY_MISMATCH');
  check(q.order_type === (order.channel === 'apple_iap' ? 7 : 0), 'QUERY_CHANNEL_MISMATCH');
  if ([0, 1].includes(q.status)) return { kind: 'unpaid', query: q };
  if (q.status === 6) return { kind: 'closed', query: q };
  if ([5, 8].includes(q.status)) return { kind: 'refund_review', query: q };
  check([2, 3, 4].includes(q.status), 'QUERY_STATE_REQUIRES_REVIEW');
  return { kind: 'paid', query: q };
}
function queryCashEvidence(order, response, now) {
  const state = queryState(order, response); const q = state.query;
  check(state.kind === 'paid', 'QUERY_NOT_PAID');
  // Official query docs explicitly say coupon_fee is currently absent. Absence is
  // not zero for every field: left_fee is the payment order's remaining amount.
  check(q.order_fee === order.amount && q.paid_fee === order.amount && (q.coupon_fee === undefined || q.coupon_fee === 0), 'QUERY_AMOUNT_MISMATCH');
  check(typeof q.wx_order_id === 'string' && q.wx_order_id.length > 0 && q.wx_order_id.length <= 128, 'TRANSACTION_REQUIRED');
  check(Number.isSafeInteger(q.left_fee) && q.left_fee >= 0, 'REFUND_BALANCE_REQUIRED');
  check(q.left_fee === order.amount, 'REFUND_BALANCE_REQUIRES_REVIEW');
  // refund_fee is defined for refund orders, not proof of a payment's balance.
  // Unexpected nonzero data is held for review rather than silently ignored.
  check(q.refund_fee === undefined || q.refund_fee === 0, 'REFUND_FIELD_REQUIRES_REVIEW');
  const paidAt = seconds(q.paid_time);
  check(paidAt <= now && paidAt >= order.createdAt - 1000, 'PAYMENT_TIME_MISMATCH');
  return { transactionId: q.wx_order_id, wxpayOrderId: q.wxpay_order_id || null, paidAt, amount: order.amount, currency: 'CNY', unit: 'fen', orderId: order.orderId, teacherId: order.teacherId, appId: order.appId, env: order.env, productId: order.platformProductId, channel: order.channel };
}
function queryEvidence(order, response, goods, now) {
  const fact = queryCashEvidence(order, response, now);
  const paidAt = fact.paidAt; const q = response.order;
  // Polling is officially supported. This temporary gate remains because the
  // account/mode binding is NOT yet evidenced (mode is outside signData), not
  // because a query must repeat every goods field. No boolean bypass is exposed.
  check(goods && goods.orderId === order.orderId && goods.openId === order.openId && goods.env === order.env && goods.productId === order.platformProductId && goods.amount === order.amount && goods.attach === order.attach, 'PRODUCT_EVIDENCE_REQUIRED');
  check(goods.paidAt === null || goods.paidAt === paidAt, 'PAYMENT_TIME_MISMATCH');
  check(!goods.wxpayOrderId || goods.wxpayOrderId === q.wxpay_order_id, 'TRANSACTION_MISMATCH');
  return fact;
}
function refundEvidence(order, event, now) {
  check(event.Event === 'xpay_refund_notify' && event.OpenId === order.openId && event.MchOrderId === order.orderId, 'REFUND_IDENTITY_MISMATCH');
  check(typeof event.WxRefundId === 'string' && event.WxRefundId.length > 0 && typeof event.WxOrderId === 'string' && event.WxOrderId.length > 0, 'REFUND_ID_REQUIRED');
  check(event.RetCode === 0, 'REFUND_NOT_FINAL_SUCCESS');
  check(event.RefundFee === order.amount, 'PARTIAL_REFUND_REQUIRES_REVIEW');
  check(!order.fact || order.fact.transactionId === event.WxOrderId, 'TRANSACTION_MISMATCH');
  const refundedAt = seconds(event.RefundSuccTimestamp);
  check(refundedAt <= now && refundedAt >= (order.fact?.paidAt || order.createdAt - 1000), 'REFUND_TIME_MISMATCH');
  return { refundId: event.WxRefundId, transactionId: event.WxOrderId, amount: event.RefundFee, refundedAt };
}
module.exports = { check, seconds, goodsEvidence, queryState, queryCashEvidence, queryEvidence, refundEvidence };
