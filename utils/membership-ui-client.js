'use strict';
const {captureAccountSession,isAccountSessionCurrent} = require('./account-session');
const {isCloudReadOnlyMode} = require('./cloud-mode');
const {createPaymentService} = require('./membership-payment-service');
const business = require('./membership-business-client');
const {purchaseChannel,gateDisplay} = require('./membership-channel-gates');
const ENV = 'cloudbase-4gafzdch60ad597b';
async function call(action, request = {}) {
  const session = captureAccountSession();
  if (!session.accountId) throw Error('LOGIN_REQUIRED');
  const response = await wx.cloud.callFunction({name:'membership_presentation',config:{env:ENV},data:{action,request}});
  if (!isAccountSessionCurrent(session)) throw Error('ACCOUNT_CHANGED');
  if (response?.result?.ok !== true || !response.result.result) throw Error('DISPLAY_UNAVAILABLE');
  return response.result.result;
}
function assertDisplay(value) {
  if (!value || !['free','active','expiring','transition','expired_single','expired_selection','expired_retained','long_term'].includes(value.displayState) ||
      typeof value.canPurchase !== 'boolean' || typeof value.canRenew !== 'boolean' || typeof value.pending !== 'boolean' ||
      typeof value.statusLabel !== 'string' || typeof value.entrySubtitle !== 'string' || !Array.isArray(value.retentionStudents)) throw Error('DISPLAY_UNAVAILABLE');
  return value;
}
async function getDisplay() { return gateDisplay(assertDisplay(await call('getDisplay',{platform:purchaseChannel(wx)||'unsupported'})),wx); }
const locks = new Map();
async function purchase(requestId) {
  if (!purchaseChannel(wx)) throw Error('PURCHASE_CHANNEL_NOT_RELEASED');
  const session = captureAccountSession();
  const revision = () => JSON.stringify(captureAccountSession());
  const key = revision();
  if (locks.has(key)) return locks.get(key);
  const operation = (async () => {
    if (isCloudReadOnlyMode()) throw Error('READ_ONLY');
    const display = await getDisplay();
    if (!isAccountSessionCurrent(session) || display.pending || !(display.canPurchase || display.canRenew || display.canResumePayment)) throw Error('PURCHASE_DISABLED');
    const resumeOrderId=display.canResumePayment ? display.resumeOrderId : '';
    if (display.canResumePayment && (typeof resumeOrderId!=='string'||!resumeOrderId)) throw Error('RESUME_ORDER_REQUIRED');
    if (display.awaitingPayment && !resumeOrderId) throw Error('EXISTING_ORDER_REQUIRED');
    // Reuse the sealed payment orchestration. The adapter deliberately discards
    // its product argument: selection, amount and duration belong to the server.
    const service = createPaymentService({wxApi:wx,sessionRevision:revision,requireInvocationPermission:true,callServer:async(action,request) => {
      // The shared orchestrator receives the already persisted order; no create API
      // is called when resuming. Its parameter endpoint rechecks trusted ownership.
      if (action === 'createOrder') return resumeOrderId ? {orderId:resumeOrderId} : call(action,{requestId:request.requestId,platform:purchaseChannel(wx)||'unsupported'});
      if (action === 'parameters') return call(action,{...request,platform:purchaseChannel(wx)||'unsupported'});
      return call(action,request);
    }});
    return service.purchase({requestId});
  })();
  locks.set(key,operation);
  try { return await operation; } finally {locks.delete(key);}
}
async function retain(studentId,requestId) {
  const session=captureAccountSession();
  if (isCloudReadOnlyMode()) throw Error('READ_ONLY');
  const display = await getDisplay();
  if (!isAccountSessionCurrent(session)) throw Error('ACCOUNT_CHANGED');
  if (!display.retentionAllowed || !display.retentionStudents.some(s=>s.id===studentId)) throw Error('RETENTION_DISABLED');
  return business.call('selectRetainedStudent',{studentId,requestId});
}
module.exports = {call,getDisplay,purchase,retain,requestId:business.requestId,assertDisplay};
