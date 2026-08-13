'use strict';

const assert = require('assert');

const storage = {
  openid: 'openid-test',
  students: [
    { id: 'student456', name: '456' },
    { id: 'student-cloud-01', name: '云端测试01' }
  ]
};

let cloudWritable = false;
let cloudReadOnly = false;
const attemptedDocIds = [];

const db = {
  collection: (collectionName) => {
    assert.strictEqual(collectionName, 'learning_records');
    return {
      doc: (docId) => {
        attemptedDocIds.push(docId);
        return {
          get: () => Promise.reject({ errCode: -1, errMsg: 'document not found' }),
          set: () => cloudWritable
            ? Promise.resolve({ ok: true })
            : Promise.reject(new Error('offline'))
        };
      }
    };
  }
};

global.wx = {
  cloud: {
    database: () => db
  },
  getStorageSync: (key) => storage[key],
  setStorageSync: (key, value) => { storage[key] = value; },
  removeStorageSync: (key) => { delete storage[key]; }
};
global.getApp = () => ({
  globalData: { cloudReadOnly }
});

const {
  syncLearningRecord,
  retryPendingSyncs,
  getSyncStatus
} = require('../utils/cloud-sync.js');

const record = {
  id: 'record-student456-book-a-001',
  studentId: 'student456',
  wordbookId: 'senior_textbook_real',
  timestamp: 1785236000000,
  totalWords: 20,
  masteredWords: 10
};

(async () => {
  const firstResult = await syncLearningRecord(record);
  assert.strictEqual(firstResult.ok, false);

  let pendingRecords = storage.pendingLearningRecordSync || {};
  assert.strictEqual(Object.keys(pendingRecords).length, 1, 'failed record must be persisted once');
  const queuedRecord = pendingRecords[Object.keys(pendingRecords)[0]];
  assert.strictEqual(queuedRecord.id, record.id);
  assert.strictEqual(queuedRecord.studentId, 'student456');
  assert.strictEqual(queuedRecord.wordbookId, 'senior_textbook_real');
  assert.strictEqual(queuedRecord.accountId, 'openid-test');
  assert.strictEqual(getSyncStatus().pending, 1);

  await syncLearningRecord(record);
  pendingRecords = storage.pendingLearningRecordSync || {};
  assert.strictEqual(Object.keys(pendingRecords).length, 1, 'same failure must not duplicate the queue');
  assert.strictEqual(getSyncStatus().pending, 1, 'same failure must not inflate pending count');

  const failedRetryResult = await retryPendingSyncs();
  assert.deepStrictEqual(failedRetryResult, { ok: true, pending: 1 });
  assert.strictEqual(Object.keys(storage.pendingLearningRecordSync || {}).length, 1);
  assert.strictEqual(storage.pendingSyncProgress, true, 'failed retry must keep the generic pending flag');

  cloudWritable = true;
  const retryResult = await retryPendingSyncs();
  assert.deepStrictEqual(retryResult, { ok: true, pending: 0 });
  assert.strictEqual(storage.pendingLearningRecordSync, undefined, 'successful retry must clear only its queue entry');
  assert.strictEqual(storage.pendingSyncProgress, undefined, 'generic pending flag clears only after all queues are empty');
  assert.strictEqual(getSyncStatus().pending, 0);
  assert.ok(getSyncStatus().lastOk > 0);

  const uniqueDocIds = Array.from(new Set(attemptedDocIds));
  assert.strictEqual(uniqueDocIds.length, 1, 'all retries must target the same scoped document ID');

  cloudReadOnly = true;
  const attemptsBeforeReadOnly = attemptedDocIds.length;
  const readOnlyResult = await syncLearningRecord({
    ...record,
    id: 'record-read-only-must-not-queue'
  });
  assert.strictEqual(readOnlyResult.reason, 'cloud_read_only');
  assert.strictEqual(attemptedDocIds.length, attemptsBeforeReadOnly, 'read-only mode must not attempt a cloud write');
  assert.strictEqual(storage.pendingLearningRecordSync, undefined, 'read-only mode must not create a pending write');

  cloudReadOnly = false;
  cloudWritable = false;
  await syncLearningRecord({
    ...record,
    id: 'record-student456-isolation',
    studentId: 'student456',
    wordbookId: 'senior_textbook_real'
  });
  await syncLearningRecord({
    ...record,
    id: 'record-cloud01-isolation',
    studentId: 'student-cloud-01',
    wordbookId: 'gaokao_reading_words'
  });
  pendingRecords = storage.pendingLearningRecordSync || {};
  assert.strictEqual(Object.keys(pendingRecords).length, 2, 'different students must keep separate pending records');
  assert.deepStrictEqual(
    Object.values(pendingRecords).map((item) => item.studentId).sort(),
    ['student-cloud-01', 'student456']
  );

  cloudWritable = true;
  const isolationRetryResult = await retryPendingSyncs();
  assert.deepStrictEqual(isolationRetryResult, { ok: true, pending: 0 });
  assert.strictEqual(storage.pendingLearningRecordSync, undefined);

  console.log('cloud-learning-record-retry: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
