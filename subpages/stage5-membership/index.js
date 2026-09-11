'use strict';
const { captureAccountSession, isAccountSessionCurrent } = require('../../utils/account-session');
// This local receipt is a duplicate-click guard, never an entitlement or authorization.
const keyFor = account => 'stage5_first_ui_' + account;
const REQUEST_ID = 'stage5_first_real_20260910_01';
function statusText(order) {
  if (order.paymentStatus === 'paid' && order.grantStatus === 'granted') return '服务端已确认付款并发放会员。';
  if (order.paymentStatus === 'refunded') return '服务端确认已退款。';
  return '订单正在核验，请刷新状态，不要重复付款。';
}
Page({
  data: { accountLabel: '未登录', loggedIn: false, busy: false, locked: false, restoring: false, membershipStatus: '', expiresAt: null, expiresText: '', orderId: '', message: '购买是否开放由服务端决定；仅在本次验收确认后购买。' },
  onShow() {
    const session = captureAccountSession();
    this.session = session;
    const account = session.accountId;
    const receipt = account ? wx.getStorageSync(keyFor(account)) : null;
    this.setData({ loggedIn: !!account, accountLabel: account ? account.slice(0, 3) + '***' + account.slice(-4) : '未登录',
      locked: !!receipt, orderId: receipt?.orderId || '', busy: !!this.inFlight, membershipStatus: '', expiresAt: null, expiresText: '',
      message: receipt ? '已有购买尝试，禁止重复付款；请刷新订单或等待核验。' : '购买是否开放由服务端决定；仅在本次验收确认后购买。' });
    this.restorePromise = account ? this.restoreMembership() : Promise.resolve();
  },
  async restoreMembership() {
    const session = this.session;
    const request = {};
    this.restoreRequest = request;
    this.setData({restoring: true, locked: true, message: '正在从服务端恢复会员状态…'});
    try {
      const value = await getApp().getStage5MembershipPaymentClient().getMembershipAccess();
      if (this.restoreRequest !== request || !isAccountSessionCurrent(session)) return;
      const active = ['active','long_term'].includes(value.membershipStatus);
      const date = value.expiresAt ? new Date(value.expiresAt + 8 * 3600000).toISOString().slice(0,19).replace('T',' ') : '';
      this.setData({membershipStatus: value.membershipStatus, expiresAt: value.expiresAt, expiresText: date,
        locked: active || !!wx.getStorageSync(keyFor(session.accountId)),
        message: active ? '会员已生效（服务端确认）' : '服务端已恢复当前会员状态；购买是否开放由服务端决定。'});
    } catch {
      if (this.restoreRequest === request && isAccountSessionCurrent(session)) this.setData({locked: true, message: '会员状态暂未确认，请刷新；不要重复购买。'});
    } finally {
      if (this.restoreRequest === request && isAccountSessionCurrent(session)) this.setData({restoring: false});
    }
  },
  async buy() {
    if (this.inFlight || this.data.restoring || this.data.locked || !this.session?.accountId || !isAccountSessionCurrent(this.session)) return;
    const session = this.session;
    const key = keyFor(session.accountId);
    if (wx.getStorageSync(key)) { this.setData({ locked: true }); return; }
    this.inFlight = true;
    this.setData({ busy: true, locked: true, message: '正在请求服务端验证…' });
    try {
      wx.setStorageSync(key, { requestId: REQUEST_ID });
      const result = await getApp().getStage5MembershipPaymentClient().purchase({ requestId: REQUEST_ID });
      const orderId = result.orderId || result.order?.orderId || '';
      if (result.refusal) wx.removeStorageSync(key);
      else wx.setStorageSync(key, { requestId: REQUEST_ID, orderId });
      if (!isAccountSessionCurrent(session)) return;
      this.setData({ locked: !result.refusal, orderId, message: result.refusal === 'STAGE5_PURCHASE_DISABLED' ? '购买当前关闭，未创建订单、未拉起支付。' :
        result.refusal ? '服务端拒绝本账号购买，未拉起支付。' : result.order ? statusText(result.order) : '购买结果待核验，已锁定重复购买，请勿再次付款。' });
      console.info('[Stage5 TEST UI]', { status: result.status, refusal: result.refusal || null, hasOrder: !!orderId });
    } catch {
      if (isAccountSessionCurrent(session)) this.setData({ message: '请求未完成，保留购买锁，等待核验；请勿重复付款。' });
    } finally {
      this.inFlight = false;
      if (isAccountSessionCurrent(session)) this.setData({ busy: false });
    }
  },
  async refreshOrder() {
    const session = this.session;
    if (this.inFlight || !this.data.orderId || !isAccountSessionCurrent(session)) return;
    this.inFlight = true;
    this.setData({ busy: true });
    try {
      const order = await getApp().getStage5MembershipPaymentClient().queryOrder({ orderId: this.data.orderId });
      if (isAccountSessionCurrent(session)) this.setData({ message: statusText(order) });
    } catch {
      if (isAccountSessionCurrent(session)) this.setData({ message: '暂未取得可信订单状态；请稍后刷新，不要重复付款。' });
    } finally {
      this.inFlight = false;
      if (isAccountSessionCurrent(session)) this.setData({ busy: false });
    }
  }
});
