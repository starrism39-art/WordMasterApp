'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { createPaymentService } = require('../../utils/membership-payment-service');
function fixture(options = {}) {
  const state = { revision: 0, calls: [], launches: 0 };
  const service = createPaymentService({ sessionRevision: () => state.revision,
    wxApi: { login(params) { params.success({ code: 'LOCAL_CODE' }); }, requestVirtualPayment(params) { state.launches++; options.onLaunch?.(state); if (options.cancel) params.fail({ errMsg: 'requestVirtualPayment:fail cancel' }); else if (options.fail) params.fail({ errMsg: 'requestVirtualPayment:fail' }); else params.success({}); } },
    async callServer(action, request) {
      state.calls.push(action); options.onServer?.(state, action);
      if (action === 'createOrder') return { orderId: 'order' };
      if (action === 'parameters') return { mode: 'short_series_goods' };
      if (options.offline) throw new Error('OFFLINE');
      return { orderId: request.orderId, paymentStatus: options.paid ? 'paid' : 'awaiting_payment', grantStatus: options.paid ? 'granted' : 'none' };
    } });
  return { state, purchase: () => service.purchase({ productId: 'p', requestId: 'new_intent' }) };
}
test('client success merely processing until server grants', async () => { const s = fixture(); assert.equal((await s.purchase()).status, 'processing'); assert.deepEqual(s.state.calls, ['createOrder', 'parameters', 'queryOrder']); });
test('server paid+granted required', async () => assert.equal((await fixture({ paid: true }).purchase()).status, 'granted'));
test('cancel stays cancelled without client grant', async () => assert.equal((await fixture({ cancel: true }).purchase()).status, 'cancelled'));
test('failure distinct from cancellation', async () => assert.equal((await fixture({ fail: true }).purchase()).status, 'failed'));
test('offline after UI is unknown, not paid', async () => assert.equal((await fixture({ offline: true }).purchase()).status, 'unknown'));
test('late verified payment overrides client cancellation', async () => assert.equal((await fixture({ cancel: true, paid: true }).purchase()).status, 'granted'));
test('account change before UI prevents launching', async () => { const s = fixture({ onServer(state, action) { if (action === 'parameters') state.revision++; } }); assert.equal((await s.purchase()).status, 'account_changed'); assert.equal(s.state.launches, 0); });
test('account change during UI ignores old completion', async () => { const s = fixture({ paid: true, onLaunch(state) { state.revision++; } }); assert.equal((await s.purchase()).status, 'account_changed'); assert.equal(s.state.calls.includes('queryOrder'), false); });
test('account change during query ignores returned entitlement', async () => { const s = fixture({ paid: true, onServer(state, action) { if (action === 'queryOrder') state.revision += 2; } }); assert.equal((await s.purchase()).status, 'account_changed'); });
