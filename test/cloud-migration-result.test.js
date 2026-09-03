'use strict';

const assert = require('assert');

const migrationPath = require.resolve('../utils/cloud-migration.js');
const cloudSyncPath = require.resolve('../utils/cloud-sync.js');
const cloudModePath = require.resolve('../utils/cloud-mode.js');

const storage = {
  openid: 'openid-test',
  students: [
    { id: 'student456', name: '456' },
    { id: 'student-cloud-01', name: '云端测试01', teacher_id: 'openid-test' },
    { id: 'student-foreign', name: '其他老师学生', teacher_id: 'openid-other' }
  ],
  learningRecords: [
    { id: 'record-good', studentId: 'student456', wordbookId: 'senior_textbook_real' },
    { id: 'record-fail', studentId: 'student-cloud-01', wordbookId: 'gaokao_reading_words' },
    { id: 'record-foreign', studentId: 'student-foreign', wordbookId: 'senior_textbook_real' }
  ],
  learningProgress: {
    student456: { learnedWords: 20 },
    'student-cloud-01': { learnedWords: 10 },
    'student-foreign': { learnedWords: 99 }
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
    },
    'student-foreign': {
      senior_textbook_real: {
        foreign_word: { mastered: true }
      }
    }
  }
};

const toasts = [];
let studentWrites = 0;
const studentWriteIds = [];
const recordSyncIds = [];
const progressSyncIds = [];
const masterySyncIds = [];

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
        doc: (docId) => ({
          set: () => {
            studentWrites++;
            studentWriteIds.push(docId);
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
    database: () => createDb(),
    callFunction: async ({ name, data }) => {
      assert.strictEqual(name, 'syncTombstoneAuthority');
      assert.strictEqual(data.action, 'list');
      return { result: { success: true, tombstones: [] } };
    }
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
      syncLearningRecord: (record) => {
        recordSyncIds.push(record.id);
        return Promise.resolve(allSuccessful || record.id === 'record-good'
          ? { ok: true }
          : { ok: false, error: new Error('record offline') }
        );
      },
      syncLearningProgress: (studentId) => {
        progressSyncIds.push(studentId);
        return Promise.resolve(allSuccessful || studentId === 'student456'
          ? { ok: true }
          : { ok: false, error: new Error('progress offline') }
        );
      },
      syncWordMasteryBatch: (studentId, wordbookId, records) => {
        masterySyncIds.push(studentId);
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
  assert.ok(!studentWriteIds.includes('student-foreign'));
  assert.ok(!recordSyncIds.includes('record-foreign'));
  assert.ok(!progressSyncIds.includes('student-foreign'));
  assert.ok(!masterySyncIds.includes('student-foreign'));

  const toastCountBeforeSilentRetry = toasts.length;
  const silentPartialResult = await partialMigration({ suppressToast: true });
  assert.strictEqual(silentPartialResult.partial, true);
  assert.strictEqual(
    toasts.length,
    toastCountBeforeSilentRetry,
    'silent startup migration must defer user messaging until retry outcome is known'
  );

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
