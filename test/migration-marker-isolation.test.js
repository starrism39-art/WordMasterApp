'use strict';

const assert = require('assert');

const accountSessionPath = require.resolve('../utils/account-session.js');
const migrationPath = require.resolve('../utils/cloud-migration.js');
const migrationStatePath = require.resolve('../utils/cloud-migration-state.js');
const loginPath = require.resolve('../utils/login-service.js');
const cloudSyncPath = require.resolve('../utils/cloud-sync.js');
const cloudModePath = require.resolve('../utils/cloud-mode.js');

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

const clearModules = () => {
  [
    accountSessionPath,
    migrationPath,
    migrationStatePath,
    loginPath,
    cloudSyncPath,
    cloudModePath
  ].forEach((file) => { delete require.cache[file]; });
};

const installStorage = (storage, cloud) => {
  global.wx = {
    cloud: cloud || {},
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => { storage[key] = value; },
    removeStorageSync: (key) => { delete storage[key]; },
    showToast: () => {}
  };
  global.getApp = () => ({
    globalData: {},
    emit: () => {},
    ensureUserPermissions: (user) => user
  });
};

const emptyCloudSnapshot = () => ({
  students: [],
  learningRecords: [],
  learningProgress: {},
  wordMastery: {}
});

function loadLoginService({ storage, pull, migrate, retry }) {
  clearModules();
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
      isCloudReadOnlyMode: () => false
    }
  };
  installStorage(storage, {});
  return require(loginPath);
}

function loadRealMigration(storage, counters) {
  clearModules();
  require.cache[cloudSyncPath] = {
    id: cloudSyncPath,
    filename: cloudSyncPath,
    loaded: true,
    exports: {
      syncLearningRecord: () => Promise.resolve({ ok: true }),
      syncLearningProgress: () => Promise.resolve({ ok: true }),
      syncWordMasteryBatch: () => Promise.resolve({ succeeded: 0, failed: 0 })
    }
  };
  require.cache[cloudModePath] = {
    id: cloudModePath,
    filename: cloudModePath,
    loaded: true,
    exports: {
      createCloudReadOnlyResult: (operation) => ({ ok: true, skipped: true, operation }),
      isCloudReadOnlyMode: () => false
    }
  };

  const db = {
    collection(name) {
      if (name === 'teachers') {
        return {
          where: () => ({
            limit: () => ({
              get: () => Promise.resolve({
                data: [{
                  teacher_id: storage.openid,
                  name: '测试教师',
                  userRole: 'external',
                  memberLevel: 'free'
                }]
              })
            })
          })
        };
      }
      if (name === 'students') {
        return {
          doc: () => ({
            set: () => {
              counters.studentWrites += 1;
              return Promise.resolve({ ok: true });
            }
          })
        };
      }
      throw new Error(`unexpected collection: ${name}`);
    }
  };
  installStorage(storage, {
    init: () => {},
    database: () => db
  });
  return require(migrationPath).migrateLocalDataToCloud;
}

async function testAccountScopedHelperIgnoresForeignLegacyMarker() {
  const storage = {
    openid: 'account-B',
    hasMigratedToCloud: true,
    students: [{ id: 'student-B', ownerId: 'account-B' }],
    learningRecords: [],
    learningProgress: {},
    wordMastery: {}
  };
  const counters = { studentWrites: 0 };
  const migrate = loadRealMigration(storage, counters);
  const accountSession = require(accountSessionPath).captureAccountSession('account-B');

  const result = await migrate({
    suppressToast: true,
    accountId: 'account-B',
    accountSession
  });

  assert.strictEqual(result.success, true, 'account-scoped decision must not be overridden by a legacy global marker');
  assert.strictEqual(counters.studentWrites, 1, 'B local data must enter the migration write path');
}

async function testLegacyUnscopedHelperStillHonorsMarker() {
  const storage = {
    openid: 'legacy-account',
    hasMigratedToCloud: true,
    students: [{ id: 'legacy-student' }],
    learningRecords: [],
    learningProgress: {},
    wordMastery: {}
  };
  const counters = { studentWrites: 0 };
  const migrate = loadRealMigration(storage, counters);
  const result = await migrate();

  assert.deepStrictEqual(result, { skipped: true });
  assert.strictEqual(counters.studentWrites, 0, 'legacy unscoped callers must retain old-client compatibility');
}

async function testLegacyMarkerCannotCompleteANewAccount() {
  const storage = {
    openid: 'account-B',
    hasMigratedToCloud: true,
    students: [{ id: 'student-B', ownerId: 'account-B', updatedAt: 200 }]
  };
  const migrations = [];
  const service = loadLoginService({
    storage,
    pull: () => Promise.resolve({ success: true, cloudSnapshot: emptyCloudSnapshot() }),
    migrate: (options) => {
      migrations.push(options.accountId);
      return Promise.resolve({ success: true });
    },
    retry: () => Promise.resolve({ ok: true, pending: 0 })
  });

  const result = await service.doSilentLogin();
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(migrations, ['account-B'], 'an unattributed legacy marker must not make B skip migration');
  assert.strictEqual(storage.cloudMigrationStateByOpenId['account-B'].source, 'legacy_migration');
}

async function testLegacySingleAccountUsesCloudCoverage() {
  const localStudent = {
    id: 'legacy-student',
    ownerId: 'legacy-account',
    updatedAt: 100
  };
  const storage = {
    openid: 'legacy-account',
    hasMigratedToCloud: true,
    students: [localStudent]
  };
  let migrations = 0;
  const service = loadLoginService({
    storage,
    pull: () => Promise.resolve({
      success: true,
      cloudSnapshot: {
        students: [{ ...localStudent }],
        learningRecords: [],
        learningProgress: {},
        wordMastery: {}
      }
    }),
    migrate: () => {
      migrations += 1;
      return Promise.resolve({ success: true });
    },
    retry: () => Promise.resolve({ ok: true, pending: 0 })
  });

  const result = await service.doSilentLogin();
  assert.strictEqual(result.ok, true);
  assert.strictEqual(migrations, 0, 'covered legacy data must not be uploaded again');
  assert.strictEqual(storage.cloudMigrationStateByOpenId['legacy-account'].source, 'cloud_reconciled');
}

async function testAccountSwitchRoundTripAndStaleGeneration() {
  const storage = {
    openid: 'account-B',
    hasMigratedToCloud: true,
    cloudMigrationStateByOpenId: {
      'account-A': { completed: true, source: 'legacy_migration', completedAt: 1 }
    },
    students: [{ id: 'student-B', ownerId: 'account-B', updatedAt: 200 }]
  };
  const migrations = [];
  const service = loadLoginService({
    storage,
    pull: () => Promise.resolve({ success: true, cloudSnapshot: emptyCloudSnapshot() }),
    migrate: (options) => {
      migrations.push(options.accountId);
      return Promise.resolve({ success: true });
    },
    retry: () => Promise.resolve({ ok: true, pending: 0 })
  });

  assert.strictEqual((await service.doSilentLogin()).ok, true);
  assert.deepStrictEqual(migrations, ['account-B']);
  assert.strictEqual(storage.cloudMigrationStateByOpenId['account-B'].completed, true);

  assert.strictEqual((await service.doSilentLogin()).ok, true);
  assert.deepStrictEqual(migrations, ['account-B'], 'completed B must not migrate twice');

  storage.openid = 'account-A';
  storage.students = [{ id: 'student-A', ownerId: 'account-A' }];
  assert.strictEqual((await service.doSilentLogin()).ok, true);
  assert.deepStrictEqual(migrations, ['account-B'], 'switching back to completed A must not migrate again');
  assert.strictEqual(storage.cloudMigrationStateByOpenId['account-A'].completed, true);
  assert.strictEqual(storage.cloudMigrationStateByOpenId['account-B'].completed, true);

  const staleStorage = {
    openid: 'account-stale-A',
    students: [{ id: 'student-stale-A', ownerId: 'account-stale-A' }]
  };
  const migrationGate = deferred();
  let retries = 0;
  const staleService = loadLoginService({
    storage: staleStorage,
    pull: () => Promise.resolve({ success: true, cloudSnapshot: emptyCloudSnapshot() }),
    migrate: () => migrationGate.promise,
    retry: () => {
      retries += 1;
      return Promise.resolve({ ok: true, pending: 0 });
    }
  });
  const staleFlight = staleService.doSilentLogin();
  await Promise.resolve();
  await Promise.resolve();
  staleStorage.openid = 'account-stale-B';
  migrationGate.resolve({ success: true });
  const staleResult = await staleFlight;

  assert.strictEqual(staleResult.ok, false);
  assert.strictEqual(staleResult.stale, true);
  assert.strictEqual(staleStorage.cloudMigrationStateByOpenId, undefined);
  assert.strictEqual(retries, 0, 'stale migration must not enter current-account pending retry');
}

(async () => {
  await testAccountScopedHelperIgnoresForeignLegacyMarker();
  await testLegacyUnscopedHelperStillHonorsMarker();
  await testLegacyMarkerCannotCompleteANewAccount();
  await testLegacySingleAccountUsesCloudCoverage();
  await testAccountSwitchRoundTripAndStaleGeneration();
  console.log('migration-marker-isolation: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
