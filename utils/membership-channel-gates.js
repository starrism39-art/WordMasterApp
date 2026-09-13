'use strict';
// Device capability is only a hint. The server's independent iOS gate must
// authorize this teacher; recognizing iOS never authorizes a purchase.
function purchaseChannel(wxApi) {
  try {
    const info = typeof wxApi.getDeviceInfo === 'function' ? wxApi.getDeviceInfo() : wxApi.getSystemInfoSync();
    return info && ['android','ios'].includes(info.platform) && typeof wxApi.requestVirtualPayment === 'function' ? info.platform : null;
  } catch { return null; }
}
function gateDisplay(model, wxApi) {
  const channel=purchaseChannel(wxApi);
  if (channel==='android'||channel==='ios'&&model.iosPurchaseAllowed===true) return model;
  return {...model, showPurchase:false, canPurchase:false, canRenew:false,canResumePayment:false,resumeOrderId:''};
}
module.exports = {purchaseChannel, gateDisplay};
