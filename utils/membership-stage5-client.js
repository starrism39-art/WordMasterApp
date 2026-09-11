'use strict';
const { createPaymentService } = require('./membership-payment-service');
const { captureAccountSession } = require('./account-session');
const ENV = 'cloudbase-4gafzdch60ad597b';
const PRODUCT = 'TEST_teacher_12m_a';

function input(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !fields.includes(key)) ||
      fields.some(key => typeof value[key] !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value[key]))) {
    throw new Error('INVALID_REQUEST');
  }
}
// This adapter has no automatic side effects. The caller must explicitly invoke
// purchase after authorization. All authorization remains in stage5_orders.
function createStage5PaymentClient(wxApi = wx) {
  if (!wxApi.cloud || typeof wxApi.cloud.callFunction !== 'function') throw new Error('CLOUD_NOT_AVAILABLE');
  function revision() {
    const s = captureAccountSession();
    return JSON.stringify([s.accountId, s.generation]);
  }
  async function callServer(action, request) {
    const result = await wxApi.cloud.callFunction({name: 'stage5_orders', config: {env: ENV}, data: {action, request}});
    const value = result && result.result;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_SERVER_RESPONSE');
    return value;
  }
  const service = createPaymentService({wxApi, callServer, sessionRevision: revision});
  return Object.freeze({
    async getMembershipAccess(request = {}) {
      input(request, []);
      if (!captureAccountSession().accountId) throw new Error('LOGIN_REQUIRED');
      const before = revision();
      const response = await wxApi.cloud.callFunction({name: 'stage5_access', config: {env: ENV},
        data: {action: 'getMembershipAccess', request: {action: 'ADD_STUDENT'}}});
      if (revision() !== before) throw new Error('ACCOUNT_CHANGED');
      const value = response?.result;
      if (!value || !['active','long_term','expired','free','transition'].includes(value.membershipStatus) ||
          (value.membershipStatus === 'active' && !Number.isSafeInteger(value.expiresAt))) throw new Error('INVALID_SERVER_RESPONSE');
      return {membershipStatus: value.membershipStatus, expiresAt: value.expiresAt, longTerm: value.longTerm === true};
    },
    async purchase(request) {
      input(request, ['requestId']);
      if (!captureAccountSession().accountId) throw new Error('LOGIN_REQUIRED');
      return service.purchase({productId: PRODUCT, requestId: request.requestId});
    },
    async queryOrder(request) {
      input(request, ['orderId']);
      if (!captureAccountSession().accountId) throw new Error('LOGIN_REQUIRED');
      const before = revision();
      const value = await callServer('queryOrder', {orderId: request.orderId});
      if (revision() !== before) throw new Error('ACCOUNT_CHANGED');
      return value;
    }
  });
}
module.exports = { createStage5PaymentClient };
