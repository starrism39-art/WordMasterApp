'use strict';
// Template only. No credentials, enabled purchases, or actual account claims.
module.exports = Object.freeze({ appId: '', originalId: '', offerId: '', cloudEnvId: '', env: 0,
  purchaseEnabled: false, enabledChannels: [],
  // Supply token/encodingAESKey only via a protected cloud configuration provider.
  notificationFormat: 'JSON', notificationEncryption: 'AES'
});
