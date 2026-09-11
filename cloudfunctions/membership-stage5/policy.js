'use strict';
const { strictKeys, id } = require('../membership-core/model');
const { hash } = require('../membership-payment/crypto');
const { check } = require('../membership-payment/protocol');
const APP_ID = 'wx930eccb9442dc8f3';
const ENV_ID = 'cloudbase-4gafzdch60ad597b';
const COLLECTIONS = Object.freeze({ products:'stage5_membership_products', orders:'stage5_membership_orders',
  intents:'stage5_membership_payment_intents', claims:'stage5_membership_payment_claims', events:'stage5_membership_payment_events',
  work:'stage5_membership_payment_work', ledgers:'stage5_membership_ledgers', grants:'stage5_membership_grants',
  accounts:'stage5_membership_accounts', audits:'stage5_membership_admin_audit', access:'stage5_teacher_student_access', students:'stage5_test_students' });
function createPolicy(input) {
  check(input && typeof input === 'object', 'STAGE5_NOT_CONFIGURED');
  strictKeys(input, ['appId','cloudEnvId','offerId','originalId','env','batchId','source','processingTeachers','purchaseTeachers','administrators','enabledChannels','purchaseEnabled','batchClosed','launchAt']);
  const c = structuredClone(input);
  check(c.appId === APP_ID && c.cloudEnvId === ENV_ID, 'STAGE5_WRONG_ENVIRONMENT');
  const paymentIdentity = typeof c.offerId === 'string' && /^\d+$/.test(c.offerId) && typeof c.originalId === 'string' && /^gh_[a-zA-Z0-9]+$/.test(c.originalId);
  // Non-payment cloud permission tests do not invent an OfferID. Such a domain
  // cannot buy, receive payment notifications or hold payment claims/grants.
  const noPaymentIdentity = c.source === 'synthetic' && c.offerId === null && c.originalId === null && c.purchaseEnabled === false && Array.isArray(c.purchaseTeachers) && c.purchaseTeachers.length === 0;
  check(paymentIdentity || noPaymentIdentity, 'STAGE5_PAYMENT_IDENTITY_REQUIRED');
  check([0,1].includes(c.env) && ['synthetic','real_payment'].includes(c.source), 'STAGE5_INVALID_SOURCE');
  id(c.batchId); check(Number.isSafeInteger(c.launchAt) && c.launchAt > 0, 'STAGE5_LAUNCH_REQUIRED');
  for (const key of ['processingTeachers','purchaseTeachers','administrators','enabledChannels']) {
    check(Array.isArray(c[key]) && c[key].length <= 32 && new Set(c[key]).size === c[key].length, 'STAGE5_INVALID_LIST');
    c[key].forEach(value => id(value)); Object.freeze(c[key]);
  }
  check(c.processingTeachers.length > 0 && c.purchaseTeachers.every(t => c.processingTeachers.includes(t)), 'STAGE5_TEST_ACCOUNTS_REQUIRED');
  check(c.enabledChannels.every(x => ['wechat','apple_iap'].includes(x)) && typeof c.purchaseEnabled === 'boolean' && typeof c.batchClosed === 'boolean', 'STAGE5_INVALID_SWITCH');
  const scopeId = hash({appId:c.appId,cloudEnvId:c.cloudEnvId,offerId:c.offerId,env:c.env,batchId:c.batchId,source:c.source});
  Object.freeze(c);
  function teacher(value) { id(value); check(c.processingTeachers.includes(value), 'STAGE5_ACCOUNT_DENIED'); return value; }
  function real() { check(c.source === 'real_payment', 'STAGE5_REAL_PAYMENT_ONLY'); }
  function buyer(value) { real(); teacher(value); check(c.purchaseEnabled && !c.batchClosed && c.purchaseTeachers.includes(value), 'STAGE5_PURCHASE_DISABLED'); }
  function product(record, who = null) {
    check(record?.product?.testOnly === true && record.appId === c.appId && record.offerId === c.offerId && record.env === c.env, 'STAGE5_TEST_PRODUCT_REQUIRED');
    check(Array.isArray(record.product.allowedTestAccounts) && record.product.allowedTestAccounts.length > 0 && record.product.allowedTestAccounts.every(t => c.processingTeachers.includes(t)), 'STAGE5_PRODUCT_ACCOUNTS_DENIED');
    if (who) check(record.product.allowedTestAccounts.includes(teacher(who)), 'STAGE5_PRODUCT_ACCOUNTS_DENIED');
  }
  // Persisted order identity is independent of permission to execute payments.
  // Used by the normal read-only order query in both configured data domains.
  function orderRecord(row) {
    teacher(row.teacherId);
    check(row.openId === row.teacherId, 'STAGE5_ORDER_OWNER_MISMATCH');
    product({product:row.productSnapshot,appId:row.appId,offerId:row.offerId,env:row.env}, row.teacherId);
  }
  function order(row) { real(); orderRecord(row); }
  return Object.freeze({ config:c, scopeId, collections:COLLECTIONS, teacher, buyer, product, order, orderRecord, real,
    administrator(value) { id(value); check(c.administrators.includes(value),'STAGE5_ADMIN_REQUIRED'); return value; },
    stamp:Object.freeze({scopeId,appId:c.appId,cloudEnvId:c.cloudEnvId,offerId:c.offerId,paymentEnv:c.env,batchId:c.batchId,source:c.source,testOnly:true}) });
}
function fromEnvironment(environment) {
  let input; try { input=JSON.parse(environment.STAGE5_CONFIG_JSON); } catch { throw new Error('STAGE5_NOT_CONFIGURED'); }
  return createPolicy(input);
}
module.exports = { APP_ID, ENV_ID, COLLECTIONS, createPolicy, fromEnvironment };
