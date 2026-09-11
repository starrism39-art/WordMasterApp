'use strict';
const { strictKeys } = require('../membership-core/model');
const { check } = require('./protocol');
const { hash, hmac, equal } = require('./crypto');
const { createCloudbaseRepository } = require('./repository');
const { createTeacherIdentity } = require('./identity');
const { createWechatApi } = require('./wechat-api');
const { createPaymentEngine } = require('./engine');
const { createClientHandler, createNotificationHandler } = require('./handlers');

// Protected environment injection; never read secrets from request/product documents.
// Stage5 supplies tokenOptions for app-scoped stable_token normal-mode rotation.
// The legacy factory retains its explicit injected-token contract.
function credentialProviders(environment, tokenOptions) {
  const secret = name => {
    const value = environment[name];
    check(typeof value === 'string' && value.trim().length > 0, 'CREDENTIAL_NOT_CONFIGURED');
    return value;
  };
  const managedToken = tokenOptions && require('./stable-token').createStableTokenProvider({
    ...tokenOptions, getAppSecret: async () => secret('MEMBERSHIP_APP_SECRET')
  });
  return {
    getAppSecret: async () => secret('MEMBERSHIP_APP_SECRET'),
    getAccessToken: managedToken || (async () => secret('MEMBERSHIP_ACCESS_TOKEN')),
    getAppKey: async env => { check([0, 1].includes(env), 'INVALID_PAYMENT_ENV'); return secret(env === 0 ? 'MEMBERSHIP_LIVE_APP_KEY' : 'MEMBERSHIP_SANDBOX_APP_KEY'); },
    notification: () => ({ token: secret('MEMBERSHIP_NOTIFICATION_TOKEN'), encodingAESKey: secret('MEMBERSHIP_NOTIFICATION_AES_KEY') }),
    internal: () => { const value = secret('MEMBERSHIP_INTERNAL_KEY'); check(Buffer.byteLength(value) >= 32, 'INTERNAL_KEY_TOO_SHORT'); return value; }
  };
}
function internalHandler({ engine, repository, credentials, clock = Date.now }) {
  return async request => {
    strictKeys(request, ['body', 'timestamp', 'nonce', 'signature']);
    check(typeof request.body === 'string' && Buffer.byteLength(request.body) <= 4096 && Number.isSafeInteger(request.timestamp) && Math.abs(clock() - request.timestamp) <= 300000 && /^[A-Za-z0-9_-]{16,128}$/.test(request.nonce || ''), 'INTERNAL_AUTH_REQUIRED');
    const message = `${request.timestamp}\n${request.nonce}\n${request.body}`;
    check(equal(hmac(credentials.internal(), message), request.signature), 'INTERNAL_AUTH_REQUIRED');
    const body = JSON.parse(request.body); strictKeys(body, ['limit', 'reviewOrderIds']);
    check(body.limit === undefined || Number.isInteger(body.limit) && body.limit > 0 && body.limit <= 50, 'INVALID_BATCH');
    check(body.reviewOrderIds === undefined || Array.isArray(body.reviewOrderIds) && body.reviewOrderIds.length <= 20 && body.reviewOrderIds.every(id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id)), 'INVALID_REVIEW_BATCH');
    const key = `internal_${hash({ timestamp: request.timestamp, nonce: request.nonce })}`;
    await repository.transaction(async tx => {
      check(!await tx.get('events', key), 'INTERNAL_REPLAY_REJECTED');
      await tx.put('events', key, { kind: 'internal_invocation', recordedAt: clock(), requestHash: hash(body) });
    });
    const reviews = [];
    for (const orderId of body.reviewOrderIds || []) {
      try { reviews.push(await engine.reconcile(orderId, { refresh: true })); }
      catch { reviews.push({ orderId, status: 'review_required' }); }
    }
    return { reviews, compensation: await engine.compensate({ limit: body.limit || 20 }) };
  };
}
function createRuntime({ db, wxCloud, config, environment = process.env, fetchImpl, clock = Date.now }) {
  check(config?.appId && config.originalId && config.offerId && config.cloudEnvId && [0, 1].includes(config.env), 'RUNTIME_NOT_CONFIGURED');
  const repository = createCloudbaseRepository(db);
  const credentials = credentialProviders(environment);
  const api = createWechatApi({ ...credentials, fetchImpl });
  const engine = createPaymentEngine({ repository, api, config, clock, getIdentity: createTeacherIdentity({ wxCloud, db, appId: config.appId }) });
  return {
    orders: createClientHandler(engine),
    async notification(request) {
      // Gateway adapter passes the original string body/query; no simulated-event action.
      try { return await createNotificationHandler({ engine, config: { ...config, ...credentials.notification() } })(request); }
      catch { return { statusCode: 503, body: 'configuration unavailable' }; }
    },
    compensate: internalHandler({ engine, repository, credentials, clock })
  };
}
// Call only in a future authorized deployment bootstrap. Nothing initializes at import.
function createSdkRuntime({ cloudbase, wxCloud, config, ...options }) {
  check(config?.cloudEnvId, 'RUNTIME_NOT_CONFIGURED');
  wxCloud.init({ env: config.cloudEnvId });
  const app = cloudbase.init({ env: config.cloudEnvId });
  return createRuntime({ ...options, config, wxCloud, db: app.database() });
}
module.exports = { credentialProviders, internalHandler, createRuntime, createSdkRuntime };
