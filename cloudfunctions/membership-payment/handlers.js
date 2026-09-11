'use strict';
const { decryptNotification, messageSignature, equal } = require('./crypto');
// Factories only: no deployed main, timer, platform order creation, or configuration writes.
function createNotificationHandler({ engine, config }) {
  return async function notification(request) {
    try {
      if (request.method === 'GET') {
        const q = request.query || {};
        if (!config.token || !/^\d{1,12}$/.test(q.timestamp || '') || typeof q.nonce !== 'string' || q.nonce.length > 128 || typeof q.echostr !== 'string' || q.echostr.length > 4096 || !equal(messageSignature(config.token, q.timestamp, q.nonce), q.signature)) return { statusCode: 403, body: 'invalid challenge' };
        return { statusCode: 200, headers: { 'content-type': 'text/plain' }, body: q.echostr };
      }
      if (request.method !== 'POST') return { statusCode: 405, body: 'method not allowed' };
      const event = decryptNotification(request, config);
      const result = await engine.authenticatedEvent(event);
      // Plain success is expressly allowed for encrypted message replies. For goods,
      // it acknowledges delivery only after atomic grant (or terminal refunded tombstone).
      if (!result.refundResultRecorded && !['granted', 'revoked', 'suppressed'].includes(result.grantStatus)) throw new Error('NOT_DELIVERED');
      return { statusCode: 200, headers: { 'content-type': 'text/plain' }, body: 'success' };
    } catch { return { statusCode: 503, body: 'retry' }; }
  };
}
function createClientHandler(engine) {
  const actions = { createOrder: request => engine.createOrder(request), parameters: request => engine.parameters(request), queryOrder: request => engine.queryOrder(request) };
  return async ({ action, request }) => {
    if (!Object.hasOwn(actions, action)) throw new Error('ACTION_NOT_ALLOWED');
    return actions[action](request);
  };
}
module.exports = { createNotificationHandler, createClientHandler };
