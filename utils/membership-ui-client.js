'use strict';
const {captureAccountSession,isAccountSessionCurrent} = require('./account-session');
const {isCloudReadOnlyMode} = require('./cloud-mode');
const {createPaymentService} = require('./membership-payment-service');
const business = require('./membership-business-client');
const {purchaseChannel,gateDisplay} = require('./membership-channel-gates');
const {createIosProbe}=require('./membership-ios-probe');
const ENV = 'cloudbase-4gafzdch60ad597b';
async function call(action, request = {},diagnostic=null) {
  const session = captureAccountSession();
  if (!session.accountId) throw Error('LOGIN_REQUIRED');
  if(action==='parameters')diagnostic?.event('PARAMETERS_BEGIN',{businessOrderId:request.orderId,platform:request.platform});
  let response;
  try{response = await wx.cloud.callFunction({name:'membership_presentation',config:{env:ENV},data:{action,request}});}
  catch(error){diagnostic?.event('API_REJECT',{action,...diagnostic.result(error)});throw error;}
  if(action==='parameters'&&diagnostic){const value=response?.result?.result||{};diagnostic.event('PARAMETERS_END',{ok:response?.result?.ok??null,code:response?.result?.code??null,message:response?.result?.message??null,hasPaymentParameters:!!value.mode&&!!value.signData,payment:diagnostic.payment(value),paymentInvocationAllowed:value.paymentInvocationAllowed??null});}
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
async function purchase(requestId,diagnostic=null) {
  if (!purchaseChannel(wx)) throw Error('PURCHASE_CHANNEL_NOT_RELEASED');
  const session = captureAccountSession();
  const revision = () => JSON.stringify(captureAccountSession());
  const key = revision();
  if (locks.has(key)){diagnostic?.event('PAYMENT_INFLIGHT_REUSED');return locks.get(key);}
  const operation = (async () => {
    if (isCloudReadOnlyMode()) throw Error('READ_ONLY');
    const display = await getDisplay();
    diagnostic?.event('PURCHASE_DISPLAY',{displayState:display.displayState,canPurchase:display.canPurchase,canRenew:display.canRenew,canResumePayment:display.canResumePayment,pending:display.pending,resumeOrderId:display.resumeOrderId});
    if (!isAccountSessionCurrent(session) || display.pending || !(display.canPurchase || display.canRenew || display.canResumePayment)) throw Error('PURCHASE_DISABLED');
    const resumeOrderId=display.canResumePayment ? display.resumeOrderId : '';
    if (display.canResumePayment && (typeof resumeOrderId!=='string'||!resumeOrderId)) throw Error('RESUME_ORDER_REQUIRED');
    if (display.awaitingPayment && !resumeOrderId) throw Error('EXISTING_ORDER_REQUIRED');
    // Reuse the sealed payment orchestration. The adapter deliberately discards
    // its product argument: selection, amount and duration belong to the server.
    const probe=purchaseChannel(wx)==='ios'?createIosProbe(wx,diagnostic):null;
    const service = createPaymentService({wxApi:probe?probe.api:wx,sessionRevision:revision,requireInvocationPermission:true,diagnostic,callServer:async(action,request) => {
      // The shared orchestrator receives the already persisted order; no create API
      // is called when resuming. Its parameter endpoint rechecks trusted ownership.
      if (action === 'createOrder'){diagnostic?.event(resumeOrderId?'BUSINESS_ORDER_REUSED':'BUSINESS_ORDER_CREATE_BEGIN',{businessOrderId:resumeOrderId});return resumeOrderId ? {orderId:resumeOrderId} : call(action,{requestId:request.requestId,platform:purchaseChannel(wx)||'unsupported'});}
      if (action === 'parameters') return call(action,{...request,platform:purchaseChannel(wx)||'unsupported'},diagnostic);
      diagnostic?.event('ORDER_QUERY_BEGIN',{businessOrderId:request.orderId});
      const state=await call(action,request,diagnostic);diagnostic?.event('ORDER_QUERY_END',{paymentStatus:state.paymentStatus,grantStatus:state.grantStatus});return state;
    }});
    const result=await service.purchase({requestId});
    return probe?.result()&&isAccountSessionCurrent(session)?{...result,platformError:probe.result()}:result;
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
