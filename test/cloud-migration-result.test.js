'use strict';

const assert = require('assert');

const migrationPath = require.resolve('../utils/cloud-migration.js');
const cloudSyncPath = require.resolve('../utils/cloud-sync.js');
const cloudModePath = require.resolve('../utils/cloud-mode.js');

const storage = {
  openid: 'openid-test',
  students: [
    { id: 'student456', name: '456' },
    { id: 'student-cloud-01', name: '云端测试01' }
  ],
  learningRecords: [
    { id: 'record-good', studentId: 'student456', wordbookId: 'senior_textbook_real' },
    { id: 'record-fail', studentId: 'student-cloud-01', wordbookId: 'gaokao_reading_words' }
  ],
  learningProgress: {
    student456: { learnedWords: 20 },
    'student-cloud-01': { learnedWords: 10 }
  },
  wordMastery: {
    student456: {
      senior_textbook_real: {
        word_a: { mastered: true },
        word_b: { difficult: true }
      }
    },
    'student-cloud-01': {
      gaokao_reading_words: {
        word_c: { difficult: true }
      }
    }
  }
};

const toasts = [];
let studentWrites = 0;

const createDb = () => ({
  collection: (collectionName) => {
    if (collectionName === 'teachers') {
      return {
        where: () => ({
          limit: () => ({
            get: () => Promise.resolve({
              data: [{
                _id: 'teacher-doc',
                teacher_id: 'openid-test',
                name: '张张张123',
                userRole: 'external',
                memberLevel: 'free'
              }]
            })
          })
        })
      };
    }
    if (collectionName === 'students') {
      return {
        doc: () => ({
          set: () => {
            studentWrites++;
            return Promise.resolve({ ok: true });
          }
        })
      };
    }
    throw new Error(`unexpected collection: ${collectionName}`);
  }
});

global.wx = {
  cloud: {
    init: () => {},
    database: () => createDb()
  },
  getStorageSync: (key) => storage[key],
  setStorageSync: (key, value) => { storage[key] = value; },
  removeStorageSync: (key) => { delete storage[key]; },
  showToast: (options) => { toasts.push(options); }
};
global.getApp = () => ({
  globalData: {},
  ensureUserPermissions: (user) => user
});

const loadMigration = ({ allSuccessful, readOnly = false }) => {
  delete require.cache[migrationPath];
  require.cache[cloudSyncPath] = {
    id: cloudSyncPath,
    filename: cloudSyncPath,
    loaded: true,
    exports: {
      syncLearningRecord: (record) => Promise.resolve(
        allSuccessful || record.id === 'record-good'
          ? { ok: true }
          : { ok: false, error: new Error('record offline') }
      ),
      syncLearningProgress: (studentId) => Promise.resolve(
        allSuccessful || studentId === 'student456'
          ? { ok: true }
          : { ok: false, error: new Error('progress offline') }
      ),
      syncWordMasteryBatch: (studentId, wordbookId, records) => {
        const total = Object.keys(records).length;
        if (allSuccessful || studentId === 'student-cloud-01') {
          return Promise.resolve({ succeeded: total, failed: 0 });
        }
        return Promise.resolve({ succeeded: Math.max(0, total - 1), failed: 1 });
      }
    }
  };
  require.cache[cloudModePath] = {
    id: cloudModePath,
    filename: cloudModePath,
    loaded: true,
    exports: {
      createCloudReadOnlyResult: (operation) => ({
        ok: true,
        skipped: true,
        reason: 'cloud_read_only',
        operation
      }),
      isCloudReadOnlyMode: () => readOnly
    }
  };
  return require(migrationPath).migrateLocalDataToCloud;
};

(async () => {
  const partialMigration = loadMigration({ allSuccessful: false });
  const partialResult = await partialMigration();

  assert.strictEqual(partialResult.success, false);
  assert.strictEqual(partialResult.partial, true);
  assert.strictEqual(partialResult.reason, 'partial_sync_failed');
  assert.strictEqual(storage.hasMigratedToCloud, undefined, 'partial migration must remain retryable');
  assert.deepStrictEqual(partialResult.failures, {
    students: 0,
    learningRecords: 1,
    learningProgress: 1,
    wordMasteryWords: 1
  });
  assert.deepStrictEqual(partialResult.counts, {
    students: 2,
    learningRecords: 1,
    learningProgress: 1,
    wordMastery: 1,
    wordMasteryWords: 2
  });
  assert.strictEqual(toasts[toasts.length - 1].title, '部分数据待同步');

  const successfulMigration = loadMigration({ allSuccessful: true });
  const successResult = await successfulMigration();
  assert.strictEqual(successResult.success, true);
  assert.strictEqual(storage.hasMigratedToCloud, true);
  assert.strictEqual(successResult.failures.learningRecords, 0);
  assert.strictEqual(successResult.failures.learningProgress, 0);
  assert.strictEqual(successResult.failures.wordMasteryWords, 0);
  assert.strictEqual(toasts[toasts.length - 1].title, '数据上云成功');

  const writesBeforeSkip = studentWrites;
  const skippedResult = await successfulMigration();
  assert.deepStrictEqual(skippedResult, { skipped: true });
  assert.strictEqual(studentWrites, writesBeforeSkip, 'completed migration must not repeat writes');

  delete storage.hasMigratedToCloud;
  const writesBeforeReadOnly = studentWrites;
  const readOnlyMigration = loadMigration({ allSuccessful: true, readOnly: true });
  const readOnlyResult = await readOnlyMigration();
  assert.strictEqual(readOnlyResult.reason, 'cloud_read_only');
  assert.strictEqual(storage.hasMigratedToCloud, undefined);
  assert.strictEqual(studentWrites, writesBeforeReadOnly, 'read-only mode must not start migration writes');

  console.log('cloud-migration-result: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
