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
    removeStorageSync: (key) => { delete storage[key]; },
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
  assert.strictEqual(
    storage.cloudMigrationStateByOpenId['openid-test'].source,
    'legacy_migration',
    'successful legacy migration must be recorded for the current account'
  );

  const freshEvents = [];
  const freshStorage = { openid: 'openid-fresh' };
  const freshService = loadLoginService({
    storage: freshStorage,
    pull: () => {
      freshEvents.push('pull');
      // Simulate a real fresh-client pull populating local storage.
      freshStorage.students = [{ id: 'student-cloud', ownerId: 'openid-fresh' }];
      freshStorage.learningRecords = [{
        id: 'cloud-record-1',
        studentId: 'student-cloud'
      }];
      return Promise.resolve({ success: true });
    },
    migrate: () => {
      freshEvents.push('migrate');
      return Promise.resolve({ success: true });
    },
    retry: () => {
      freshEvents.push('retry');
      return Promise.resolve({ ok: true });
    }
  });
  const freshResult = await freshService.doSilentLogin();
  assert.strictEqual(freshResult.ok, true);
  assert.deepStrictEqual(
    freshEvents,
    ['pull', 'retry'],
    'data downloaded by a fresh client must never be bulk-migrated back to cloud'
  );
  assert.strictEqual(
    freshStorage.cloudMigrationStateByOpenId['openid-fresh'].source,
    'cloud_bootstrap',
    'fresh cloud bootstrap must be remembered across launches'
  );

  freshEvents.length = 0;
  const secondFreshResult = await freshService.doSilentLogin();
  assert.strictEqual(secondFreshResult.ok, true);
  assert.deepStrictEqual(
    freshEvents,
    ['pull', 'retry'],
    'a second launch must not misclassify previously pulled cloud data as legacy data'
  );
  assert.strictEqual(
    freshStorage.cloudMigrationStateByOpenId['openid-fresh'].source,
    'cloud_bootstrap',
    'repeated launches must preserve the original migration state'
  );

  const mirroredEvents = [];
  const mirroredStorage = {
    openid: 'openid-mirrored',
    students: [{ id: 'student-mirrored', ownerId: 'openid-mirrored', updatedAt: 100 }],
    learningRecords: [{
      id: 'record-mirrored',
      studentId: 'student-mirrored',
      wordbookId: 'senior_textbook_real',
      updatedAt: 100
    }],
    learningProgress: {
      'student-mirrored': { learnedWords: 20, updatedAt: 100 }
    },
    wordMastery: {
      'student-mirrored': {
        senior_textbook_real: {
          word_mirrored: { mastered: true, updatedAt: 100 }
        }
      }
    }
  };
  const mirroredCloudSnapshot = {
    students: [{ id: 'student-mirrored', ownerId: 'openid-mirrored', updatedAt: 100 }],
    learningRecords: [{
      id: 'record-mirrored',
      studentId: 'student-mirrored',
      wordbookId: 'senior_textbook_real',
      updatedAt: 100
    }],
    learningProgress: {
      'student-mirrored': { learnedWords: 20, updatedAt: 100 }
    },
    wordMastery: {
      'student-mirrored': {
        senior_textbook_real: {
          word_mirrored: { mastered: true, updatedAt: 100 }
        }
      }
    }
  };
  const mirroredService = loadLoginService({
    storage: mirroredStorage,
    pull: () => {
      mirroredEvents.push('pull');
      return Promise.resolve({ success: true, cloudSnapshot: mirroredCloudSnapshot });
    },
    migrate: () => {
      mirroredEvents.push('migrate');
      return Promise.resolve({ success: true });
    },
    retry: () => {
      mirroredEvents.push('retry');
      return Promise.resolve({ ok: true, pending: 0 });
    }
  });
  const mirroredResult = await mirroredService.doSilentLogin();
  assert.strictEqual(mirroredResult.ok, true);
  assert.strictEqual(mirroredResult.pending, 0);
  assert.deepStrictEqual(
    mirroredEvents,
    ['pull', 'retry'],
    'an existing client whose local cache is already covered by cloud must not bulk-write it again'
  );
  assert.strictEqual(
    mirroredStorage.cloudMigrationStateByOpenId['openid-mirrored'].source,
    'cloud_reconciled'
  );

  const newerEvents = [];
  const newerStorage = {
    openid: 'openid-newer',
    students: [{ id: 'student-newer', ownerId: 'openid-newer', updatedAt: 200 }]
  };
  const newerService = loadLoginService({
    storage: newerStorage,
    pull: () => {
      newerEvents.push('pull');
      return Promise.resolve({
        success: true,
        cloudSnapshot: {
          students: [{ id: 'student-newer', ownerId: 'openid-newer', updatedAt: 100 }],
          learningRecords: [],
          learningProgress: {},
          wordMastery: {}
        }
      });
    },
    migrate: (options) => {
      newerEvents.push(options && options.suppressToast === true ? 'migrate-silent' : 'migrate-visible');
      return Promise.resolve({ success: true });
    },
    retry: () => {
      newerEvents.push('retry');
      return Promise.resolve({ ok: true, pending: 0 });
    }
  });
  const newerResult = await newerService.doSilentLogin();
  assert.strictEqual(newerResult.ok, true);
  assert.deepStrictEqual(
    newerEvents,
    ['pull', 'migrate-silent', 'retry'],
    'a genuinely newer local entry must remain eligible for legacy migration'
  );

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
  const partialStorage = { openid: 'openid-test', students: [{ id: 'student456' }] };
  const partialService = loadLoginService({
    storage: partialStorage,
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
  assert.strictEqual(partialResult.pending, 1, 'unresolved retry queue must be reported to the UI');
  assert.deepStrictEqual(partialEvents, ['pull', 'migrate', 'retry']);
  assert.strictEqual(
    partialStorage.cloudMigrationStateByOpenId,
    undefined,
    'partial migration must remain retryable'
  );

  const recoveredEvents = [];
  const recoveredStorage = { openid: 'openid-recovered', students: [{ id: 'student456' }] };
  const recoveredService = loadLoginService({
    storage: recoveredStorage,
    pull: () => {
      recoveredEvents.push('pull');
      return Promise.resolve({ success: true });
    },
    migrate: (options) => {
      recoveredEvents.push(options && options.suppressToast === true ? 'migrate-silent' : 'migrate-visible');
      return Promise.resolve({
        success: false,
        partial: true,
        reason: 'partial_sync_failed',
        failures: {
          students: 0,
          learningRecords: 1,
          learningProgress: 0,
          wordMasteryWords: 0
        }
      });
    },
    retry: () => {
      recoveredEvents.push('retry');
      return Promise.resolve({ ok: true, pending: 0 });
    }
  });
  const recoveredResult = await recoveredService.doSilentLogin();
  assert.strictEqual(recoveredResult.ok, true);
  assert.strictEqual(recoveredResult.pending, 0);
  assert.deepStrictEqual(recoveredEvents, ['pull', 'migrate-silent', 'retry']);
  assert.strictEqual(
    recoveredStorage.cloudMigrationStateByOpenId['openid-recovered'].source,
    'legacy_migration_recovered',
    'a queue-backed partial migration that fully recovers must not repeat on every launch'
  );

  console.log('login-sync-order: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
