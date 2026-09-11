'use strict';
const { paySignature, hmac } = require('./crypto');
const { check } = require('./protocol');
// Inject protected server credential providers. Errors deliberately omit URLs/body/keys.
function createWechatApi({ getAccessToken, getAppKey, getAppSecret, fetchImpl = globalThis.fetch }) {
  async function session(identity, code) {
    check(typeof code === 'string' && code.length > 0 && code.length <= 256 && typeof getAppSecret === 'function', 'LOGIN_CODE_REQUIRED');
    const secret = await getAppSecret(); check(typeof secret === 'string' && secret.length > 0, 'APP_SECRET_REQUIRED');
    const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
    for (const [key, value] of Object.entries({ appid: identity.appId, secret, js_code: code, grant_type: 'authorization_code' })) url.searchParams.set(key, value);
    let result;
    try {
      const response = await fetchImpl(url.toString(), { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error();
      result = JSON.parse(await response.text());
    } catch { throw new Error('SESSION_EXCHANGE_FAILED'); }
    check((result.errcode === undefined || result.errcode === 0) && result.openid === identity.openId && typeof result.session_key === 'string' && result.session_key.length > 0, 'SESSION_IDENTITY_MISMATCH');
    return result.session_key;
  }
  async function post(path, value, env, signed) {
    const body = JSON.stringify(value);
    const token = await getAccessToken();
    check(typeof token === 'string' && token.length > 0, 'ACCESS_TOKEN_REQUIRED');
    const url = new URL(`https://api.weixin.qq.com${path}`);
    url.searchParams.set('access_token', token);
    if (signed) url.searchParams.set('pay_sig', paySignature(await getAppKey(env), path, body));
    let result;
    try {
      const response = await fetchImpl(url.toString(), { method: 'POST', headers: { 'content-type': 'application/json' }, body, redirect: 'error', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error();
      const text = await response.text();
      result = text ? JSON.parse(text) : null;
    } catch { throw new Error('PLATFORM_TRANSPORT_FAILED'); }
    return result;
  }
  return {
    async parameters(order, identity, loginCode) {
      check(identity.openId === order.openId && identity.teacherId === order.teacherId, 'SESSION_IDENTITY_MISMATCH');
      const sessionKey = await session(identity, loginCode);
      check(typeof sessionKey === 'string' && sessionKey.length > 0, 'SESSION_KEY_REQUIRED');
      return { mode: 'short_series_goods', signData: order.signData, paySig: paySignature(await getAppKey(order.env), 'requestVirtualPayment', order.signData), signature: hmac(sessionKey, order.signData) };
    },
    query(order) { return post('/xpay/query_order', { openid: order.openId, env: order.env, order_id: order.orderId }, order.env, true); },
    async delivered(order) {
      const result = await post('/xpay/notify_provide_goods', { order_id: order.orderId, env: order.env }, order.env, false);
      check(result === null || result.errcode === 0, 'DELIVERY_NOT_CONFIRMED');
    }
  };
}
module.exports = { createWechatApi };
