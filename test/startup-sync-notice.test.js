'use strict';

const assert = require('assert');

let pageDefinition = null;
const toasts = [];

global.Page = (definition) => {
  pageDefinition = definition;
};
global.wx = {
  showToast: (options) => {
    toasts.push(options);
  }
};

require('../pages/index/index.js');

assert.ok(pageDefinition, 'index page must register itself');
assert.strictEqual(typeof pageDefinition.consumeStartupSyncNotice, 'function');

const pendingApp = {
  globalData: {
    syncFreshPendingCount: 2,
    syncFreshFailed: false,
    syncFreshCompleted: true
  }
};
pageDefinition.consumeStartupSyncNotice(pendingApp);
assert.deepStrictEqual(toasts.map((toast) => toast.title), ['部分数据待同步']);
assert.strictEqual(pendingApp.globalData.syncFreshPendingCount, 0);
assert.strictEqual(pendingApp.globalData.syncFreshCompleted, false);

toasts.length = 0;
pageDefinition.consumeStartupSyncNotice({
  globalData: {
    syncFreshPendingCount: 0,
    syncFreshFailed: true,
    syncFreshCompleted: true
  }
});
assert.deepStrictEqual(toasts.map((toast) => toast.title), ['云端同步失败，已使用本地数据']);

toasts.length = 0;
pageDefinition.consumeStartupSyncNotice({
  globalData: {
    syncFreshPendingCount: 0,
    syncFreshFailed: false,
    syncFreshCompleted: true
  }
});
assert.deepStrictEqual(toasts.map((toast) => toast.title), ['可以开始学习了']);

toasts.length = 0;
pageDefinition.consumeStartupSyncNotice({ globalData: {} });
assert.deepStrictEqual(toasts, [], 'no startup state must not produce a toast');

console.log('startup-sync-notice: PASS');
