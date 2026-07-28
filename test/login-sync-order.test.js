'use strict';

const assert = require('assert');
const path = require('path');

const loginPath = require.resolve('../utils/login-service.js');
const migrationPath = require.resolve('../utils/cloud-migration.js');
const cloudSyncPath = require.resolve('../utils/cloud-sync.js');
const cloudModePath = require.resolve('../utils/cloud-mode.js');

const loadLoginService = ({ storage, pull, migrate, retry }) => {
  delete require.cache[loginPath];
  require.cache[migrationPath] = {
    id: migrationPath,
    filename: migrationPath,
    loaded: true,
    exports: {
      syncDataFromCloud: pull,
      migrateLocalDataToCloud: migrate
    }
  };
  require.cache[cloudSyncPath] = {
    id: cloudSyncPath,
    filename: cloudSyncPath,
    loaded: true,
    exports: { retryPendingSyncs: retry }
  };
  require.cache[cloudModePath] = {
    id: cloudModePath,
    filename: cloudModePath,
    loaded: true,
    exports: {
      createCloudReadOnlyResult: (operation) => ({ ok: true, skipped: true, operation }),
      isCloudReadOnlyMode: () => true
    }
  };

  global.wx = {
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => { storage[key] = value; },
    cloud: {}
  };
  global.getApp = () => ({
    globalData: {},
    emit: () => {},
    ensureUserPermissions: (user) => user
  });
  return require(loginPath);
};

(async () => {
  const events = [];
  let resolvePull;
  const pullPromise = new Promise((resolve) => { resolvePull = resolve; });
  const storage = {
    openid: 'openid-test',
    students: [{ id: 'student456' }]
  };
  const service = loadLoginService({
    storage,
    pull: () => {
      events.push('pull');
      return pullPromise;
    },
    migrate: () => {
      events.push('migrate');
      return Promise.resolve({ success: true });
    },
    retry: () => {
      events.push('retry');
      return Promise.resolve({ ok: true });
    }
  });

  const first = service.doSilentLogin();
  const concurrent = service.doSilentLogin();
  assert.strictEqual(first, concurrent, 'concurrent callers must await the same sync');
  assert.deepStrictEqual(events, ['pull'], 'no cloud write may start before pull completes');
  resolvePull({ success: true });
  const result = await first;
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(events, ['pull', 'migrate', 'retry']);

  const failedEvents = [];
  const failedService = loadLoginService({
    storage: { openid: 'openid-test', students: [{ id: 'student456' }] },
    pull: () => {
      failedEvents.push('pull');
      return Promise.resolve({ error: 'offline' });
    },
    migrate: () => {
      failedEvents.push('migrate');
      return Promise.resolve({ success: true });
    },
    retry: () => {
      failedEvents.push('retry');
      return Promise.resolve({ ok: true });
    }
  });
  const failedResult = await failedService.doSilentLogin();
  assert.strictEqual(failedResult.ok, false);
  assert.deepStrictEqual(failedEvents, ['pull'], 'failed pull must block every write path');

  const partialEvents = [];
  const partialService = loadLoginService({
    storage: { openid: 'openid-test', students: [{ id: 'student456' }] },
    pull: () => {
      partialEvents.push('pull');
      return Promise.resolve({ success: true });
    },
    migrate: () => {
      partialEvents.push('migrate');
      return Promise.resolve({
        success: false,
        partial: true,
        reason: 'partial_sync_failed'
      });
    },
    retry: () => {
      partialEvents.push('retry');
      return Promise.resolve({ ok: true, pending: 1 });
    }
  });
  const partialResult = await partialService.doSilentLogin();
  assert.strictEqual(partialResult.ok, true, 'partial migration must not block normal login');
  assert.deepStrictEqual(partialEvents, ['pull', 'migrate', 'retry']);

  console.log('login-sync-order: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
