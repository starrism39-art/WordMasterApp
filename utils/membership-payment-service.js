'use strict';
// Deliberately not imported by app/pages. Session revision must change on EVERY
// login/logout, including A -> B -> A. Never cache an isVip flag here.
function createPaymentService({ wxApi, callServer, sessionRevision, requireInvocationPermission = false,diagnostic=null }) {
  return {
    async purchase({ productId, requestId }) {
      const revision = sessionRevision();
      const current = () => sessionRevision() === revision;
      let order;
      try {
        order = await callServer('createOrder', { productId, requestId });
        diagnostic?.event('BUSINESS_ORDER_READY',{businessOrderId:order.orderId});
        if (!current()) return { status: 'account_changed' };
        const loginCode = await new Promise((resolve, reject) => wxApi.login({ success: result => result.code ? resolve(result.code) : reject(new Error('LOGIN_FAILED')), fail: reject }));
        if (!current()) return { status: 'account_changed' };
        const parameters = await callServer('parameters', { orderId: order.orderId, loginCode });
        if (!current()) return { status: 'account_changed' };
        if (requireInvocationPermission && parameters.paymentInvocationAllowed !== true){diagnostic?.event('NATIVE_PAYMENT_SKIPPED',{reason:'INVOCATION_NOT_ALLOWED'});return {status:'prepared',orderId:order.orderId};}
        const {paymentInvocationAllowed,...paymentParameters}=parameters;
        if (typeof wxApi.requestVirtualPayment !== 'function'){diagnostic?.event('NATIVE_PAYMENT_SKIPPED',{reason:'API_UNAVAILABLE'});return { status: 'unsupported', orderId: order.orderId };}
        let result;
        try{result = await new Promise(resolve => wxApi.requestVirtualPayment({ ...paymentParameters, success: () => resolve('returned'), fail: error => resolve(/cancel/i.test(error.errMsg || '') ? 'cancelled' : 'failed') }));}
        catch(error){diagnostic?.event('NATIVE_PAYMENT_REJECT',{source:'payment-orchestrator-promise',...diagnostic.result(error)});throw error;}
        if (!current()) return { status: 'account_changed' };
        try {
          const state = await callServer('queryOrder', { orderId: order.orderId });
          if (!current()) return { status: 'account_changed' };
          if (state.paymentStatus === 'paid' && state.grantStatus === 'granted') return { status: 'granted', order: state };
          if (state.paymentStatus === 'refunded') return { status: 'refunded', order: state };
          return { status: result === 'returned' ? 'processing' : result, order: state };
        } catch { return current() ? { status: 'unknown', orderId: order.orderId, clientResult: result } : { status: 'account_changed' }; }
      } catch (error) {
        diagnostic?.event('PAYMENT_SERVICE_CATCH',{businessOrderId:order?.orderId,...diagnostic.result(error)});
        // Only expose known pre-order refusals. Never turn a timeout into a retry.
        const refusal = !order && String(error?.errMsg || error?.message || '').match(/\b(STAGE5_PURCHASE_DISABLED|STAGE5_ACCOUNT_DENIED|IDENTITY_NOT_VERIFIED|STAGE5_PRODUCT_ACCOUNTS_DENIED)\b/);
        return current() ? { status: 'unknown', orderId: order?.orderId, ...(refusal ? { refusal: refusal[1] } : {}) } : { status: 'account_changed' };
      }
    }
  };
}
module.exports = { createPaymentService };
