'use strict';

const readLaunchQuery = () => {
  try {
    const options = typeof wx.getLaunchOptionsSync === 'function'
      ? wx.getLaunchOptionsSync()
      : {};
    return options && options.query && typeof options.query === 'object'
      ? options.query
      : {};
  } catch (error) {
    return {};
  }
};

const readPlatform = () => {
  try {
    if (typeof wx.getDeviceInfo === 'function') {
      const device = wx.getDeviceInfo();
      if (device && device.platform) return String(device.platform).toLowerCase();
    }
  } catch (error) {
    // Fall back to the older API for legacy base libraries.
  }

  try {
    if (typeof wx.getSystemInfoSync === 'function') {
      const system = wx.getSystemInfoSync();
      if (system && system.platform) return String(system.platform).toLowerCase();
    }
  } catch (error) {
    // Unknown platforms keep the production default below.
  }

  return '';
};

const resolveCloudReadOnlyMode = () => {
  const query = readLaunchQuery();

  if (String(query.cloudReadOnly || '') === '1') {
    return true;
  }

  // Simulator writes require an explicit opt-in. Real devices keep the
  // existing production behaviour unless cloudReadOnly=1 is supplied.
  if (readPlatform() === 'devtools') {
    return String(query.cloudWriteTest || '') !== '1';
  }

  return false;
};

const isCloudReadOnlyMode = () => {
  try {
    const app = typeof getApp === 'function' ? getApp() : null;
    if (app && app.globalData && typeof app.globalData.cloudReadOnly === 'boolean') {
      return app.globalData.cloudReadOnly;
    }
  } catch (error) {
    // onLaunch and isolated tests may not have an app instance yet.
  }

  return resolveCloudReadOnlyMode();
};

const createCloudReadOnlyResult = (operation) => ({
  ok: true,
  skipped: true,
  reason: 'cloud_read_only',
  operation: operation || ''
});

module.exports = {
  createCloudReadOnlyResult,
  isCloudReadOnlyMode,
  resolveCloudReadOnlyMode
};
