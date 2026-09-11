'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { paySignature, hmac, decryptNotification } = require('../../cloudfunctions/membership-payment/crypto');
const { createWechatApi } = require('../../cloudfunctions/membership-payment/wechat-api');
const { createCloudbaseRepository } = require('../../cloudfunctions/membership-payment/repository');
const { createTeacherIdentity } = require('../../cloudfunctions/membership-payment/identity');
const { setup, LocalSdk, encrypt, cryptoConfig } = require('./fixtures');
test('official published HMAC vectors (not real credentials)', () => {
  const body = '{"openid": "xxx", "user_ip": "127.0.0.1", "env": 0}';
  assert.equal(paySignature('12345', '/xpay/query_user_balance', body), 'c37809f27c6d7fd1837ad2500a04512b66b34fd793a39a385fade56dca89a4b5');
  assert.equal(hmac('9hAb/NEYUlkaMBEsmFgzig==', body), '089d9e8dc5d308977360c4b79ec600a93d736802802a807d634192328032f6c7');
});
test('official published AES message vector', () => {
  const config = { token: 'AAAAA', encodingAESKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', appId: 'wxba5fad812f8e6fb9', originalId: 'gh_97417a04a28d' };
  const Encrypt = '+qdx1OKCy+5JPCBFWw70tm0fJGb2Jmeia4FCB7kao+/Q5c/ohsOzQHi8khUOb05JCpj0JB4RvQMkUyus8TPxLKJGQqcvZqzDpVzazhZv6JsXUnnR8XGT740XgXZUXQ7vJVnAG+tE8NUd4yFyjPy7GgiaviNrlCTj+l5kdfMuFUPpRSrfMZuMcp3Fn2Pede2IuQrKEYwKSqFIZoNqJ4M8EajAsjLY2km32IIjdf8YL/P50F7mStwntrA2cPDrM1kb6mOcfBgRtWygb3VIYnSeOBrebufAlr7F9mFUPAJGj04=';
  const event = decryptNotification({ body: JSON.stringify({ Encrypt }), query: { timestamp: '1714112445', nonce: '415670741', msg_signature: '046e02f8204d34f8ba5fa3b1db94908f3df2e9b3' } }, config);
  assert.equal(event.debug_str, 'hello world'); assert.equal(event.Event, 'debug_demo');
});
test('illegal signature, changed cipher and wrong decrypted app rejected', () => {
  const request = encrypt({ ToUserName: cryptoConfig.originalId, MsgType: 'event' });
  assert.throws(() => decryptNotification({ ...request, query: { ...request.query, msg_signature: '0'.repeat(40) } }, cryptoConfig), /INVALID_SIGNATURE/);
  assert.throws(() => decryptNotification(request, { ...cryptoConfig, appId: 'wx_other' }), /WRONG_APPLICATION/);
  const encrypted = JSON.parse(request.body); encrypted.Encrypt = `A${encrypted.Encrypt.slice(1)}`;
  assert.throws(() => decryptNotification({ ...request, body: JSON.stringify(encrypted) }, cryptoConfig), /INVALID_SIGNATURE/);
});
test('query API exact body signature and endpoint; delivery has no invented signature', async () => {
  const calls = []; const api = createWechatApi({ getAccessToken: async () => 'LOCAL_TOKEN', getAppKey: async () => 'LOCAL_KEY', getAppSecret: async () => 'LOCAL_SECRET', fetchImpl: async (url, options) => { calls.push({ url: new URL(url), options }); return { ok: true, text: async () => new URL(url).pathname === '/sns/jscode2session' ? '{"openid":"openid","session_key":"LOCAL_SESSION"}' : '{"errcode":0}' }; } });
  const order = { openId: 'openid', env: 0, orderId: 'wm_fixture', teacherId: 'teacher', signData: '{"goodsPrice":100}' };
  await api.query(order); await api.delivered(order);
  assert.equal(calls[0].url.pathname, '/xpay/query_order'); assert.equal(calls[0].options.body, '{"openid":"openid","env":0,"order_id":"wm_fixture"}');
  assert.equal(calls[0].url.searchParams.get('pay_sig'), paySignature('LOCAL_KEY', '/xpay/query_order', calls[0].options.body));
  assert.equal(calls[1].url.pathname, '/xpay/notify_provide_goods'); assert.equal(calls[1].url.searchParams.has('pay_sig'), false);
  const params = await api.parameters(order, { openId: 'openid', teacherId: 'teacher', appId: 'app' }, 'LOCAL_CODE'); assert.equal(params.mode, 'short_series_goods'); assert.equal(params.signature, hmac('LOCAL_SESSION', order.signData));
  assert.equal(calls[2].url.searchParams.get('grant_type'), 'authorization_code'); assert.equal(calls[2].url.searchParams.get('js_code'), 'LOCAL_CODE'); assert.ok(!JSON.stringify(params).includes('LOCAL_SESSION'));
});
test('platform error messages cannot leak access tokens', async () => {
  const api = createWechatApi({ getAccessToken: async () => 'SENSITIVE_FIXTURE', getAppKey: async () => 'KEY', fetchImpl: async () => { throw new Error('SENSITIVE_FIXTURE'); } });
  await assert.rejects(api.query({ openId: 'x', env: 0, orderId: 'order' }), error => error.message === 'PLATFORM_TRANSPORT_FAILED');
});
test('another account login code cannot sign this order', async () => {
  const api = createWechatApi({ getAppSecret: async () => 'LOCAL_SECRET', fetchImpl: async () => ({ ok: true, text: async () => '{"openid":"other","session_key":"LOCAL_SESSION"}' }) });
  await assert.rejects(api.parameters({ openId: 'teacher', teacherId: 'teacher' }, { openId: 'teacher', teacherId: 'teacher', appId: 'app' }, 'LOCAL_CODE'), /SESSION_IDENTITY_MISMATCH/);
});
test('SDK conflict retries bounded and preserves rollback', async () => {
  const sdk = new LocalSdk(); const repo = createCloudbaseRepository(sdk, { sleep: async () => {} }); sdk.conflicts = 2;
  const result = await repo.transaction(async tx => { await tx.put('accounts', 'x', { value: 1 }); return 7; }); assert.equal(result, 7); assert.equal(sdk.starts, 3);
  sdk.conflicts = 99; const before = sdk.starts;
  await assert.rejects(repo.transaction(async tx => tx.put('accounts', 'x', { value: 2 })), { code: 'DATABASE_TRANSACTION_CONFLICT' });
  assert.equal(sdk.starts - before, 4); assert.equal((await repo.get('accounts', 'x')).value, 1);
});
test('ambiguous commit failure not blindly retried', async () => {
  const sdk = new LocalSdk(); const repo = createCloudbaseRepository(sdk); sdk.fail = () => true;
  await assert.rejects(repo.transaction(tx => tx.put('accounts', 'x', { value: 1 })), /INJECTED_COMMIT_FAILURE/); assert.equal(sdk.starts, 1); assert.equal(await repo.get('accounts', 'x'), null);
});
test('transaction operation and document bounds fail atomically', async () => {
  const sdk = new LocalSdk(); const repo = createCloudbaseRepository(sdk);
  await assert.rejects(repo.transaction(async tx => { for (let i = 0; i < 91; i++) await tx.put('accounts', String(i), { value: i }); }), /TRANSACTION_OPERATION_LIMIT/); assert.equal(sdk.rows.size, 0);
  await assert.rejects(repo.transaction(tx => tx.put('accounts', 'x', { large: 'a'.repeat(512001) })), /CAPACITY_REQUIRES_REVIEW/);
});
test('trusted OPENID adapter rejects absent/ambiguous teacher and app mismatch', async () => {
  let rows = [{ teacher_id: 'trusted' }]; const context = { APPID: 'app', OPENID: 'trusted' };
  const identity = createTeacherIdentity({ wxCloud: { getWXContext: () => context }, appId: 'app', db: { collection: name => { assert.equal(name, 'teachers'); return { where: query => { assert.deepEqual(query, { teacher_id: 'trusted' }); return { limit: () => ({ get: async () => ({ data: rows }) }) }; } }; } } });
  assert.equal((await identity()).teacherId, 'trusted'); rows = []; await assert.rejects(identity(), /TEACHER_IDENTITY_REQUIRED/); rows = [{ teacher_id: 'trusted' }, { teacher_id: 'trusted' }]; await assert.rejects(identity(), /TEACHER_IDENTITY_REQUIRED/);
  context.APPID = 'other'; await assert.rejects(identity(), /IDENTITY_NOT_VERIFIED/);
});
test('iOS goods lacking WeChatPayInfo obtains paidAt from verified query', async () => { const s = setup({ product: { channel: 'apple_iap' } }); const a = await s.create(); await s.engine.authenticatedEvent(await s.event(a.orderId)); assert.equal((await s.repo.get('orders', a.orderId)).grantStatus, 'granted'); });
