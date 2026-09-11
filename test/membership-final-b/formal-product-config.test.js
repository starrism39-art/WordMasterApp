'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { configuration, publicConfig } = require('../../cloudfunctions/membership-presentation/config');

const validProduct = Object.freeze({
  productId: 'teacher_member_12m',
  mode: 'short_series_goods',
  productType: 'teacher_annual',
  price: 39900,
  currency: 'CNY',
  durationMonths: 12,
  autoRenew: false
});
const env = value => ({ MEMBERSHIP_UI_CONFIG: JSON.stringify(value) });

test('formal product mapping is fixed, isolated from TEST, and remains purchase-closed', () => {
  const defaults = configuration();
  assert.equal(defaults.platformReady, true);
  assert.equal(defaults.productId, validProduct.productId);
  assert.equal(defaults.purchaseEnabled, false);

  const configured = configuration(env({ formalProduct: validProduct }));
  assert.equal(configured.platformReady, true);
  assert.equal(configured.productId, validProduct.productId);
  assert.equal(configured.purchaseEnabled, false);
  assert.deepEqual(publicConfig(configured), {
    priceText: '399元', durationText: '12个月', autoRenewText: '不自动续费',
    supportAvailable: false, support: null,
    rules: publicConfig(configured).rules
  });
  assert.equal('productId' in publicConfig(configured), false);

  for (const formalProduct of [
    { ...validProduct, productId: 'TEST_teacher_12m_a' },
    { ...validProduct, price: 1 },
    { ...validProduct, durationMonths: 1 },
    { ...validProduct, autoRenew: true }
  ]) assert.throws(() => configuration(env({ formalProduct })));

  assert.throws(() => configuration(env({ formalProduct: validProduct, purchaseEnabled: true })), /FORMAL_PURCHASE_NOT_RELEASED/);
});
