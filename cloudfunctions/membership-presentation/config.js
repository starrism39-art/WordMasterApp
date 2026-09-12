'use strict';
// Public product copy lives on the server. This does not provision a product.
const APP_ID = 'wx930eccb9442dc8f3';
const ENV_ID = 'cloudbase-4gafzdch60ad597b';
const {ANNUAL_PRODUCT} = require('../membership-core/constants');
const FORMAL_PRODUCT = Object.freeze({ productId: 'teacher_member_12m', mode: 'short_series_goods',
  productType: ANNUAL_PRODUCT.productType, price: ANNUAL_PRODUCT.price, currency: ANNUAL_PRODUCT.currency,
  durationMonths: ANNUAL_PRODUCT.duration.months, autoRenew: ANNUAL_PRODUCT.autoRenew });
const DEFAULTS = Object.freeze({ priceText: (ANNUAL_PRODUCT.price / 100) + '元', durationText: ANNUAL_PRODUCT.duration.months + '个月', autoRenewText: '不自动续费',
  expiringDays: 7, purchaseEnabled: false, platformReady: false, productId: '', ordersReady: false, support: null });
function formalProduct(input = FORMAL_PRODUCT) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('INVALID_FORMAL_PRODUCT_CONFIG');
  const keys = Object.keys(input).sort();
  const expected = ['autoRenew','currency','durationMonths','mode','price','productId','productType'].sort();
  if (keys.length !== expected.length || keys.some((key,index) => key !== expected[index])) throw Error('INVALID_FORMAL_PRODUCT_CONFIG');
  if (input.productId !== FORMAL_PRODUCT.productId) throw Error('INVALID_FORMAL_PRODUCT_ID');
  if (input.mode !== 'short_series_goods' || input.productType !== ANNUAL_PRODUCT.productType || input.price !== ANNUAL_PRODUCT.price || input.currency !== ANNUAL_PRODUCT.currency ||
      input.durationMonths !== ANNUAL_PRODUCT.duration.months || input.autoRenew !== ANNUAL_PRODUCT.autoRenew) throw Error('FORMAL_PRODUCT_MISMATCH');
  return { platformReady: true, productId: input.productId };
}
function configuration(environment = {}) {
  const input = environment.MEMBERSHIP_UI_CONFIG ? JSON.parse(environment.MEMBERSHIP_UI_CONFIG) : {};
  // Opening purchases requires a separate rollout approval and payment deployment.
  if (input.purchaseEnabled === true) throw Error('FORMAL_PURCHASE_NOT_RELEASED');
  const support = input.support;
  if (support && !(support.type === 'phone' && /^\+?[0-9 -]{7,20}$/.test(support.value))) throw Error('INVALID_SUPPORT_CONFIG');
  if (input.ordersReady !== undefined && typeof input.ordersReady !== 'boolean') throw Error('INVALID_ORDERS_CONFIG');
  const product = formalProduct(input.formalProduct);
  return { ...DEFAULTS, ...product, ordersReady: input.ordersReady === true, support: support || null };
}
function publicConfig(config) {
  return { priceText: config.priceText, durationText: config.durationText, autoRenewText: config.autoRenewText,
    supportAvailable: !!config.support, support: config.support ? {type: config.support.type, value: config.support.value, label: '拨打客服电话'} : null,
    rules: [
      { title: '价格与有效期', text: config.priceText + ' / ' + config.durationText + '，' + config.autoRenewText + '。' },
      { title: '学生名额', text: '免费老师生命周期累计只能新增1名学生；会员期间学生数量不限。' },
      { title: '续费', text: '有效会员提前续费，从当前到期日顺延12个月。' },
      { title: '缓冲与到期', text: '符合条件的历史老用户，第一次打开会员新版后享受个人5天缓冲。多学生免费用户缓冲结束后需固定1名保留学生。' },
      { title: '数据保障', text: '会员到期不会删除学生及历史学习数据；后续重新开通会员可恢复访问。限制访问不等于删除数据。' }
    ] };
}
module.exports = { APP_ID, ENV_ID, FORMAL_PRODUCT, DEFAULTS, configuration, publicConfig, formalProduct };
