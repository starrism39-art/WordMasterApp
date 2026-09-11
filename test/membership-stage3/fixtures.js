'use strict';
// Entirely local synthetic fixtures. Not real users, orders, keys, or platform calls.
const crypto = require('node:crypto');
const { AsyncLocalStorage } = require('node:async_hooks');
const { createCloudbaseRepository, COLLECTIONS } = require('../../cloudfunctions/membership-payment/repository');
const { createPaymentEngine } = require('../../cloudfunctions/membership-payment/engine');
const { messageSignature } = require('../../cloudfunctions/membership-payment/crypto');
const { product, BASE } = require('../membership-stage2/fixtures');
class LocalSdk {
  constructor() { this.rows = new Map(); this.revision = 0; this.conflicts = 0; this.fail = null; this.starts = 0; this.active = 0; this.command = { lte: value => ({ lte: value }) }; }
  collection(name) { return this.scope(this.rows, false).collection(name); }
  scope(rows, transactional) {
    const sdk = this;
    return { collection(name) {
      return { doc(key) {
        const address = `${name}/${key}`;
        return { async get() { return { data: rows.has(address) ? [structuredClone(rows.get(address))] : [] }; }, async set(value) {
          if (!transactional) throw new Error('TEST_REQUIRES_TRANSACTION');
          if (Object.hasOwn(value, 'data')) throw new Error('WRONG_NODE_SDK_SET_SHAPE');
          rows.set(address, structuredClone(value));
        } };
      }, where(filter) { return { orderBy() { return { limit(limit) { return { async get() {
        return { data: [...sdk.rows.entries()].filter(([key, row]) => key.startsWith(`${name}/`) && row.state === filter.state && row.nextAt <= filter.nextAt.lte).map(([, row]) => structuredClone(row)).sort((a, b) => a.nextAt - b.nextAt).slice(0, limit) };
      } }; } }; } }; } };
    } };
  }
  async startTransaction() {
    this.starts++; this.active++;
    const revision = this.revision; const rows = structuredClone(this.rows); const scope = this.scope(rows, true);
    let closed = false;
    const close = () => { if (!closed) { closed = true; this.active--; } };
    return { ...scope, commit: async () => {
      if (this.conflicts > 0 || revision !== this.revision) { this.conflicts = Math.max(0, this.conflicts - 1); throw Object.assign(new Error('CONFLICT'), { code: 'DATABASE_TRANSACTION_CONFLICT' }); }
      if (this.fail && this.fail(rows)) { this.fail = null; throw new Error('INJECTED_COMMIT_FAILURE'); }
      this.rows = rows; this.revision++; close();
    }, rollback: async () => close() };
  }
  seed(name, key, value) { this.rows.set(`${COLLECTIONS[name]}/${key}`, structuredClone(value)); }
}
function setup(options = {}) {
  const sdk = new LocalSdk(); const repo = createCloudbaseRepository(sdk, { sleep: async () => {} });
  const transactionContext = new AsyncLocalStorage(); const transact = repo.transaction;
  repo.transaction = operation => transact(tx => transactionContext.run(true, () => operation(tx)));
  const config = { appId: 'wx_local_fixture', originalId: 'gh_local_fixture', offerId: '123', env: 0, purchaseEnabled: true, enabledChannels: ['wechat', 'apple_iap'], ...options.config };
  const state = { clock: BASE, actor: { teacherId: 'teacher', openId: 'teacher', appId: config.appId }, queryCalls: 0, deliveryCalls: 0, queryError: null, deliveryError: null, queryChanges: {} };
  const item = product({ channel: 'wechat', ...options.product });
  sdk.seed('products', item.productId, { product: item, appId: config.appId, offerId: config.offerId, env: config.env, platformProductId: 'annual_fixture' });
  const api = {
    parameters: async order => ({ mode: 'short_series_goods', signData: order.signData, paySig: 'LOCAL_ONLY', signature: 'LOCAL_ONLY' }),
    async query(order) {
      if (transactionContext.getStore()) throw new Error('EXTERNAL_CALL_INSIDE_TRANSACTION');
      state.queryCalls++;
      if (state.queryError) throw new Error(state.queryError);
      return { errcode: 0, order: { order_id: order.orderId, env_type: order.env + 1, order_fee: order.amount, paid_fee: order.amount, left_fee: order.amount, coupon_fee: 0, refund_fee: 0, order_type: order.channel === 'apple_iap' ? 7 : 0, status: 2, wx_order_id: `tx_${order.orderId}`, wxpay_order_id: `wxpay_${order.orderId}`, paid_time: BASE / 1000, ...state.queryChanges } };
    },
    async delivered() { if (transactionContext.getStore()) throw new Error('EXTERNAL_CALL_INSIDE_TRANSACTION'); state.deliveryCalls++; if (state.deliveryError) throw new Error(state.deliveryError); }
  };
  const engine = createPaymentEngine({ repository: repo, api, config, getIdentity: async () => state.actor, clock: () => state.clock });
  async function create(requestId = 'intent1') { return engine.createOrder({ productId: item.productId, requestId }); }
  async function event(orderId, changes = {}) {
    const order = await repo.get('orders', orderId);
    return { ToUserName: config.originalId, FromUserName: 'fixed_official_sender', MsgType: 'event', Event: 'xpay_goods_deliver_notify', CreateTime: BASE / 1000, OpenId: order.openId, OutTradeNo: orderId, Env: order.env,
      GoodsInfo: { ProductId: order.platformProductId, Quantity: 1, OrigPrice: order.amount, ActualPrice: order.amount, Attach: order.attach }, ...changes };
  }
  async function refundEvent(orderId, changes = {}) {
    const order = await repo.get('orders', orderId);
    return { ToUserName: config.originalId, MsgType: 'event', Event: 'xpay_refund_notify', OpenId: order.openId, MchOrderId: orderId, WxOrderId: `tx_${orderId}`, WxRefundId: `refund_${orderId}`, RetCode: 0, RefundFee: order.amount, RefundSuccTimestamp: state.clock / 1000, ...changes };
  }
  return { sdk, repo, engine, config, state, item, api, create, event, refundEvent };
}
const cryptoConfig = { appId: 'wx_local_fixture', originalId: 'gh_local_fixture', token: 'LOCAL_FIXTURE_ONLY', encodingAESKey: Buffer.alloc(32, 4).toString('base64').slice(0, 43) };
function encrypt(event, config = cryptoConfig) {
  const text = Buffer.from(JSON.stringify(event)); const size = Buffer.alloc(4); size.writeUInt32BE(text.length);
  const content = Buffer.concat([Buffer.alloc(16, 7), size, text, Buffer.from(config.appId)]);
  const padding = 32 - content.length % 32; const key = Buffer.from(`${config.encodingAESKey}=`, 'base64');
  const coder = crypto.createCipheriv('aes-256-cbc', key, key.subarray(0, 16)); coder.setAutoPadding(false);
  const Encrypt = Buffer.concat([coder.update(Buffer.concat([content, Buffer.alloc(padding, padding)])), coder.final()]).toString('base64');
  const query = { timestamp: String(BASE / 1000), nonce: 'local_nonce', msg_signature: messageSignature(config.token, String(BASE / 1000), 'local_nonce', Encrypt) };
  return { method: 'POST', body: JSON.stringify({ Encrypt }), query };
}
module.exports = { setup, LocalSdk, BASE, cryptoConfig, encrypt };
