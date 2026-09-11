'use strict';

const { SCHEMA_VERSION, SOURCE_TYPES, ANNUAL_PRODUCT } = require('./constants');
const { instant, validateDuration, addDuration } = require('./time');
function id(value, field = 'id') {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new Error(`INVALID_${field}`);
  return value;
}
function reason(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 1000) throw new Error('REASON_REQUIRED');
  return value;
}
function strictKeys(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new Error('UNEXPECTED_FIELDS');
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function product(value) {
  strictKeys(value, ['productId', 'productType', 'price', 'currency', 'duration', 'channel', 'enabled', 'testOnly', 'allowedTestAccounts', 'createdAt', 'updatedAt', 'autoRenew', 'schemaVersion']);
  id(value.productId, 'PRODUCT_ID');
  if (value.productType !== ANNUAL_PRODUCT.productType || value.currency !== 'CNY' || value.autoRenew !== false) throw new Error('INVALID_PRODUCT');
  if (!Number.isSafeInteger(value.price) || value.price <= 0 || value.duration?.months !== 12 || Object.keys(value.duration).length !== 1) throw new Error('INVALID_PRODUCT');
  if (!['wechat', 'apple_iap'].includes(value.channel) || typeof value.enabled !== 'boolean' || typeof value.testOnly !== 'boolean') throw new Error('INVALID_PRODUCT');
  if (!Array.isArray(value.allowedTestAccounts)) throw new Error('INVALID_TEST_ACCOUNTS');
  value.allowedTestAccounts.forEach(account => id(account, 'TEACHER_ID'));
  if ((!value.testOnly && (value.price !== 39900 || value.allowedTestAccounts.length)) || (value.testOnly && !value.allowedTestAccounts.length)) throw new Error('INVALID_PRODUCT_POLICY');
  instant(value.createdAt); instant(value.updatedAt);
  if (value.updatedAt < value.createdAt || (value.schemaVersion !== undefined && value.schemaVersion !== SCHEMA_VERSION)) throw new Error('INVALID_VERSION_OR_TIME');
  return structuredClone({ ...value, schemaVersion: SCHEMA_VERSION });
}
function resolveProduct(value, teacherId) {
  const result = product(value);
  id(teacherId, 'TEACHER_ID');
  if (!result.enabled || (result.testOnly && !result.allowedTestAccounts.includes(teacherId))) throw new Error('PRODUCT_NOT_AVAILABLE');
  return result;
}
function grant(value) {
  strictKeys(value, ['grantId', 'teacherId', 'sourceType', 'sourceId', 'startsAt', 'endsAt', 'longTerm', 'duration', 'status', 'createdAt', 'updatedAt', 'metadata', 'reason', 'schemaVersion', 'targetGrantId', 'operation']);
  ['grantId', 'teacherId', 'sourceId'].forEach(key => id(value[key], key));
  if (!SOURCE_TYPES.includes(value.sourceType) || value.status !== 'recorded' || typeof value.longTerm !== 'boolean') throw new Error('INVALID_GRANT');
  instant(value.startsAt); instant(value.createdAt); instant(value.updatedAt);
  if (value.updatedAt < value.createdAt || (value.schemaVersion !== undefined && value.schemaVersion !== SCHEMA_VERSION)) throw new Error('INVALID_VERSION_OR_TIME');
  if (!value.metadata || typeof value.metadata !== 'object' || Array.isArray(value.metadata)) throw new Error('INVALID_METADATA');
  // Metadata is audit-only. Unknown/cyclic/non-JSON values cannot enter a stored ledger.
  if (canonical(JSON.parse(JSON.stringify(value.metadata))) !== canonical(value.metadata)) throw new Error('INVALID_METADATA');
  const revoke = value.operation === 'revoke_remaining';
  if (revoke) {
    if (!['refund_adjustment', 'admin_adjustment'].includes(value.sourceType)) throw new Error('INVALID_ADJUSTMENT');
    id(value.targetGrantId, 'TARGET'); reason(value.reason);
    if (value.duration !== null || value.endsAt !== null || value.longTerm) throw new Error('INVALID_ADJUSTMENT');
  } else {
    if (value.operation !== 'grant' || value.targetGrantId || value.sourceType === 'refund_adjustment') throw new Error('INVALID_OPERATION');
    if (value.longTerm) {
      if (value.sourceType !== 'internal_long_term' || value.endsAt !== null || value.duration !== null) throw new Error('INVALID_LONG_TERM');
    } else {
      if (value.sourceType === 'internal_long_term') throw new Error('INVALID_LONG_TERM');
      validateDuration(value.duration);
      if (value.endsAt !== addDuration(value.startsAt, value.duration)) throw new Error('INVALID_ENDS_AT');
      if (value.metadata.fixedEndsAt !== undefined && (value.sourceType !== 'gift' || instant(value.metadata.fixedEndsAt) !== value.endsAt)) throw new Error('INVALID_GIFT_CUTOFF');
    }
    if (['payment', 'historical_payment'].includes(value.sourceType)) {
      if (value.duration?.months !== 12 || value.metadata.paidAt !== value.startsAt || !Number.isSafeInteger(value.metadata.amount) || value.metadata.amount <= 0) throw new Error('INVALID_PAYMENT_GRANT');
      if (value.sourceType === 'historical_payment' && (!['exact', 'date_only'].includes(value.metadata.timePrecision) || !value.metadata.evidence)) throw new Error('HISTORY_EVIDENCE_REQUIRED');
    }
    if (value.sourceType !== 'payment') reason(value.reason);
  }
  return structuredClone({ ...value, schemaVersion: SCHEMA_VERSION });
}
module.exports = { id, reason, strictKeys, canonical, product, resolveProduct, grant };
