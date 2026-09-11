'use strict';
const { addDuration } = require('../../cloudfunctions/membership-core/time');
const { grant } = require('../../cloudfunctions/membership-core/model');
const T = value => Date.parse(value.endsWith('Z') || /[+-]\d\d:\d\d$/.test(value) ? value : `${value}+08:00`);
const BASE = T('2026-09-08T10:00:00');
function award(sourceId, startsAt = BASE, options = {}) {
  const type = options.sourceType || 'payment';
  const longTerm = type === 'internal_long_term';
  const duration = longTerm ? null : options.duration || { months: 12 };
  return grant({ grantId: sourceId, teacherId: 'teacher', sourceId, sourceType: type, startsAt, endsAt: longTerm ? null : addDuration(startsAt, duration), longTerm, duration, status: 'recorded', operation: 'grant', createdAt: BASE, updatedAt: BASE, reason: 'Test evidence', metadata: type === 'payment' || type === 'historical_payment' ? { paidAt: startsAt, amount: 39900, timePrecision: 'exact', evidence: 'receipt' } : {}, ...options });
}
function refund(sourceId, targetGrantId, startsAt, options = {}) {
  return grant({ grantId: sourceId, teacherId: 'teacher', sourceId, sourceType: 'refund_adjustment', startsAt, endsAt: null, duration: null, longTerm: false, status: 'recorded', operation: 'revoke_remaining', targetGrantId, createdAt: startsAt, updatedAt: startsAt, metadata: {}, reason: 'Platform final refund', ...options });
}
function product(options = {}) {
  return { productId: 'test_annual', productType: 'teacher_annual', price: 100, currency: 'CNY', duration: { months: 12 }, channel: 'apple_iap', enabled: true, testOnly: true, allowedTestAccounts: ['teacher'], createdAt: BASE, updatedAt: BASE, autoRenew: false, ...options };
}
const student = studentId => ({ studentId, teacherId: 'teacher', deleted: false, name: studentId, grade: 'G1' });
module.exports = { T, BASE, award, refund, product, student };
