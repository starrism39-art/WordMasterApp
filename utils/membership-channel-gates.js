'use strict';
// Final-D release evidence: Android inherited PASS. Every other device remains
// closed until its own controlled validation and explicit release decision.
function purchaseChannel(wxApi) {
  try {
    const info = typeof wxApi.getDeviceInfo === 'function' ? wxApi.getDeviceInfo() : wxApi.getSystemInfoSync();
    return info && info.platform === 'android' && typeof wxApi.requestVirtualPayment === 'function' ? 'android' : null;
  } catch { return null; }
}
function gateDisplay(model, wxApi) {
  if (purchaseChannel(wxApi)) return model;
  return {...model, showPurchase:false, canPurchase:false, canRenew:false};
}
module.exports = {purchaseChannel, gateDisplay};
