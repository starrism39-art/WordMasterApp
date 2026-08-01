'use strict';

const assert = require('assert');

const migrationPath = require.resolve('../utils/data-migration.js');
require.cache[migrationPath] = {
  id: migrationPath,
  filename: migrationPath,
  loaded: true,
  exports: {
    initializeDataVersion: () => ({
      error: true,
      blocked: true,
      message: 'simulated_snapshot_failure'
    })
  }
};

const storage = {};
let modalShown = false;
let app = null;

global.wx = {
  cloud: null,
  getStorageSync: (key) => storage[key],
  setStorageSync: (key, value) => { storage[key] = value; },
  removeStorageSync: (key) => { delete storage[key]; },
  getStorageInfoSync: () => ({ keys: Object.keys(storage) }),
  setInnerAudioOption: () => {},
  showModal: () => { modalShown = true; },
  showToast: () => {},
  reLaunch: () => {}
};
global.App = (config) => { app = config; };
global.getApp = () => app;
global.setTimeout = (fn) => { fn(); return 1; };
global.console = { log() {}, warn() {}, error() {} };

require('../app.js');

let initDataCalls = 0;
app.initData = () => { initDataCalls += 1; };
app.onLaunch();

assert.strictEqual(app.globalData.upgradeProtectionBlocked, true);
assert.strictEqual(app.globalData.cloudReadOnly, true);
assert.strictEqual(app.globalData.upgradeProtectionError, 'simulated_snapshot_failure');
assert.strictEqual(initDataCalls, 0, 'blocked protection must stop startup mutations');
assert.strictEqual(modalShown, true);

process.stdout.write('app-upgrade-protection: PASS\n');
