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
let rejectSystemFieldWrites = true;
const attemptedDocIds = [];
const setAttempts = [];
const cloudDocuments = new Map();

const clone = (value) => JSON.parse(JSON.stringify(value));

const db = {
  collection: (collectionName) => {
    assert.strictEqual(collectionName, 'learning_records');
    return {
      doc: (docId) => {
        attemptedDocIds.push(docId);
        return {
          get: () => cloudDocuments.has(docId)
            ? Promise.resolve({ data: clone(cloudDocuments.get(docId)) })
            : Promise.reject({ errCode: -1, errMsg: 'document not found' }),
          set: ({ data }) => {
            const payload = clone(data);
            setAttempts.push({ docId, data: payload });
            if (!cloudWritable) {
              return Promise.reject(new Error('offline'));
            }
            if (
              rejectSystemFieldWrites &&
              (Object.prototype.hasOwnProperty.call(payload, '_id') ||
                Object.prototype.hasOwnProperty.call(payload, '_openid'))
            ) {
              return Promise.reject(new Error('system fields are read-only'));
            }
            cloudDocuments.set(docId, {
              _id: docId,
              _openid: storage.openid,
              ...payload
            });
            return Promise.resolve({ ok: true });
          }
        };
      }
    };
  }
};

global.wx = {
  cloud: {
    database: () => db,
    callFunction: async ({ name, data }) => {
      assert.strictEqual(name, 'syncTombstoneAuthority');
      assert.strictEqual(data.action, 'list');
      return { result: { success: true, tombstones: [] } };
    }
  },
  getStorageSync: (key) => storage[key],
  setStorageSync: (key, value) => { storage[key] = value; },
  removeStorageSync: (key) => { delete storage[key]; }
};
global.getApp = () => ({
  globalData: { cloudReadOnly }
});

const {
  buildScopedDocId,
  syncLearningRecord,
  retryPendingSyncs,
  getSyncStatus
} = require('../utils/cloud-sync.js');
const { mergeById } = require('../utils/sync-merge.js');

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

  const forcedOwnerRecord = {
    ...record,
    id: 'record-first-write-forced-owner',
    teacher_id: 'forged-account',
    _id: 'forged-system-id',
    _openid: 'forged-system-openid'
  };
  await syncLearningRecord(forcedOwnerRecord);
  const forcedOwnerDocId = buildScopedDocId(storage.openid, 'record', forcedOwnerRecord.id);
  const forcedOwnerCloud = cloudDocuments.get(forcedOwnerDocId);
  assert.strictEqual(forcedOwnerCloud.teacher_id, storage.openid, 'first write must bind teacher_id to current account');
  assert.strictEqual(forcedOwnerCloud.id, forcedOwnerRecord.id);
  assert.strictEqual(forcedOwnerCloud._openid, storage.openid, 'server-owned _openid must not come from payload');

  const stage1AFailures = [];

  // 场景 A：已存在的云文档会带回 _id/_openid；系统字段不得进入后续 set payload。
  const systemFieldRecord = {
    ...record,
    id: 'record-existing-system-fields',
    updatedAt: 2000,
    recordSchemaVersion: 1,
    completedAt: '2026-08-30T12:00:00.000Z',
    wordsSnapshot: [{ wordId: 'word-system', word: 'system', meaning: '系统', masteryStatus: 'mastered' }]
  };
  const systemFieldDocId = buildScopedDocId(storage.openid, 'record', systemFieldRecord.id);
  cloudDocuments.set(systemFieldDocId, {
    _id: systemFieldDocId,
    _openid: storage.openid,
    _createTime: 1000,
    _updateTime: 2000,
    teacher_id: storage.openid,
    ...clone(systemFieldRecord)
  });
  setAttempts.length = 0;
  rejectSystemFieldWrites = true;
  cloudWritable = true;
  const systemFieldResult = await syncLearningRecord(systemFieldRecord);
  const systemFieldSet = setAttempts[setAttempts.length - 1];
  if (!systemFieldResult || systemFieldResult.ok !== true) {
    stage1AFailures.push('A: existing record retransmit failed after cloud get returned system fields');
  }
  if (
    !systemFieldSet ||
    Object.prototype.hasOwnProperty.call(systemFieldSet.data, '_id') ||
    Object.prototype.hasOwnProperty.call(systemFieldSet.data, '_openid') ||
    Object.prototype.hasOwnProperty.call(systemFieldSet.data, '_createTime') ||
    Object.prototype.hasOwnProperty.call(systemFieldSet.data, '_updateTime')
  ) {
    stage1AFailures.push('A: a CloudBase system field leaked into learning_records set payload');
  }

  // 丢弃场景 A 在旧实现失败后产生的测试 pending，避免污染场景 B。
  delete storage.pendingLearningRecordSync;
  delete storage.pendingSyncProgress;

  // 场景 B：旧 pending 迟到重试，不得回退云端更完整、更新的历史快照。
  const staleRecord = {
    ...record,
    id: 'record-stale-pending',
    updatedAt: 1000,
    recordSchemaVersion: 1,
    completedAt: '',
    studentSnapshot: { id: 'student456', name: '' },
    wordbookSnapshot: { id: 'senior_textbook_real', title: '', sourceType: 'official', version: null },
    wordsSnapshot: [{
      wordId: 'word-stale',
      word: 'stale',
      meaning: '',
      masteryStatus: 'notMastered'
    }],
    retainedCloudField: ''
  };
  const staleDocId = buildScopedDocId(storage.openid, 'record', staleRecord.id);
  const newerCloudRecord = {
    _id: staleDocId,
    _openid: storage.openid,
    teacher_id: storage.openid,
    ...record,
    id: staleRecord.id,
    updatedAt: 3000,
    recordSchemaVersion: 2,
    completedAt: '2026-08-30T13:00:00.000Z',
    studentSnapshot: { id: 'student456', name: '历史学生' },
    wordbookSnapshot: {
      id: 'senior_textbook_real',
      title: '历史词书',
      sourceType: 'official',
      version: null
    },
    wordsSnapshot: [{
      wordId: 'word-stale',
      word: 'stale',
      meaning: '云端新释义',
      masteryStatus: 'mastered'
    }],
    retainedCloudField: 'keep-me'
  };
  cloudDocuments.set(staleDocId, clone(newerCloudRecord));
  rejectSystemFieldWrites = false;
  cloudWritable = false;
  await syncLearningRecord(staleRecord);
  assert.strictEqual(Object.keys(storage.pendingLearningRecordSync || {}).length, 1, 'stale payload must enter the real pending path');

  setAttempts.length = 0;
  cloudWritable = true;
  await retryPendingSyncs();
  const afterStaleRetry = cloudDocuments.get(staleDocId) || {};
  if (afterStaleRetry.recordSchemaVersion !== 2) {
    stage1AFailures.push('B: stale pending lowered recordSchemaVersion');
  }
  if (afterStaleRetry.completedAt !== newerCloudRecord.completedAt) {
    stage1AFailures.push('B: stale pending erased/replaced completedAt');
  }
  if (JSON.stringify(afterStaleRetry.studentSnapshot) !== JSON.stringify(newerCloudRecord.studentSnapshot)) {
    stage1AFailures.push('B: stale pending regressed studentSnapshot');
  }
  if (JSON.stringify(afterStaleRetry.wordbookSnapshot) !== JSON.stringify(newerCloudRecord.wordbookSnapshot)) {
    stage1AFailures.push('B: stale pending regressed wordbookSnapshot');
  }
  if (JSON.stringify(afterStaleRetry.wordsSnapshot) !== JSON.stringify(newerCloudRecord.wordsSnapshot)) {
    stage1AFailures.push('B: stale pending regressed wordsSnapshot/masteryStatus');
  }
  if (afterStaleRetry.retainedCloudField !== 'keep-me') {
    stage1AFailures.push('B: stale empty field erased a non-empty cloud field');
  }

  const fullPullMerged = mergeById([staleRecord], [afterStaleRetry], 'id');
  assert.strictEqual(fullPullMerged.length, 1, 'full pull merge must keep one logical record per recordId');
  assert.strictEqual(
    Array.from(cloudDocuments.values()).filter((item) => item.id === staleRecord.id).length,
    1,
    'pending retry must keep one cloud document for the same recordId'
  );

  // 可靠 newer payload：同 schema 且 updatedAt 明确更新时，仅版本化历史字段可用非空值更新；
  // 旧云端额外单词与普通非空字段仍必须保留。
  const newerId = 'record-proven-newer';
  const newerDocId = buildScopedDocId(storage.openid, 'record', newerId);
  cloudDocuments.set(newerDocId, {
    _id: newerDocId,
    _openid: storage.openid,
    teacher_id: storage.openid,
    id: newerId,
    studentId: 'student456',
    wordbookId: 'senior_textbook_real',
    updatedAt: 1000,
    recordSchemaVersion: 1,
    completedAt: '2026-08-30T10:00:00.000Z',
    studentSnapshot: { id: 'student456', name: '旧学生名' },
    wordbookSnapshot: { id: 'senior_textbook_real', title: '旧词书名', sourceType: 'official', version: null },
    wordsSnapshot: [
      { wordId: 'word-update', word: 'update', meaning: '旧释义', masteryStatus: 'notMastered' },
      { wordId: 'word-cloud-only', word: 'cloud', meaning: '只在云端', masteryStatus: 'mastered' }
    ],
    immutableHistoricalNote: 'keep-cloud'
  });
  const provenNewerPayload = {
    id: newerId,
    studentId: 'student456',
    wordbookId: 'senior_textbook_real',
    updatedAt: 5000,
    recordSchemaVersion: 1,
    completedAt: '2026-08-30T10:01:00.000Z',
    studentSnapshot: { id: 'student456', name: '新学生名' },
    wordbookSnapshot: { id: 'senior_textbook_real', title: '新词书名', sourceType: 'official', version: null },
    wordsSnapshot: [
      { wordId: 'word-update', word: 'update', meaning: '新释义', masteryStatus: 'mastered' },
      { wordId: 'word-incoming-only', word: 'incoming', meaning: '新补充', masteryStatus: 'notMastered' }
    ],
    immutableHistoricalNote: 'must-not-overwrite',
    safeSupplement: 'added'
  };
  rejectSystemFieldWrites = true;
  const provenNewerResult = await syncLearningRecord(provenNewerPayload);
  assert.strictEqual(provenNewerResult.ok, true);
  const afterProvenNewer = cloudDocuments.get(newerDocId);
  assert.strictEqual(afterProvenNewer.completedAt, provenNewerPayload.completedAt);
  assert.strictEqual(afterProvenNewer.studentSnapshot.name, '新学生名');
  assert.strictEqual(afterProvenNewer.wordbookSnapshot.title, '新词书名');
  assert.strictEqual(afterProvenNewer.updatedAt, 5000);
  assert.strictEqual(afterProvenNewer.immutableHistoricalNote, 'keep-cloud', 'ordinary non-empty cloud fields stay immutable');
  assert.strictEqual(afterProvenNewer.safeSupplement, 'added', 'new payload may safely supplement a missing field');
  assert.deepStrictEqual(
    afterProvenNewer.wordsSnapshot.map((word) => word.wordId),
    ['word-update', 'word-cloud-only', 'word-incoming-only'],
    'newer snapshot update must preserve cloud-only words and append new words without duplicates'
  );
  assert.strictEqual(afterProvenNewer.wordsSnapshot[0].meaning, '新释义');
  assert.strictEqual(afterProvenNewer.wordsSnapshot[0].masteryStatus, 'mastered');

  // schemaVersion 只描述格式，不是事件修订序号：它应单调提升并补缺，但不能单独覆盖云端非空值。
  const schemaUpgradePayload = {
    ...provenNewerPayload,
    updatedAt: 4000,
    recordSchemaVersion: 2,
    completedAt: '',
    studentSnapshot: { id: 'student456', name: '' },
    wordbookSnapshot: { id: 'senior_textbook_real', title: '', sourceType: 'official', version: null },
    wordsSnapshot: [{
      wordId: 'word-update',
      word: 'update',
      meaning: 'schema-v2',
      phonetic: '/v2/',
      masteryStatus: 'mastered'
    }]
  };
  await syncLearningRecord(schemaUpgradePayload);
  const afterSchemaUpgrade = cloudDocuments.get(newerDocId);
  assert.strictEqual(afterSchemaUpgrade.recordSchemaVersion, 2);
  assert.strictEqual(afterSchemaUpgrade.updatedAt, 5000, 'schema upgrade must not lower updatedAt');
  assert.strictEqual(afterSchemaUpgrade.completedAt, provenNewerPayload.completedAt, 'empty newer field must not erase completedAt');
  assert.strictEqual(afterSchemaUpgrade.studentSnapshot.name, '新学生名', 'empty nested field must not erase snapshot data');
  assert.strictEqual(afterSchemaUpgrade.wordsSnapshot[0].meaning, '新释义', 'schema version alone must not overwrite non-empty history');
  assert.strictEqual(afterSchemaUpgrade.wordsSnapshot[0].phonetic, '/v2/', 'higher schema may safely supplement a missing field');
  assert.strictEqual(afterSchemaUpgrade.wordsSnapshot.length, 3, 'schema upgrade must not drop cloud-only words');

  // 同账号两个 pending：成功同步其中一个时，只移除对应项；另一个继续保留。
  const pendingOne = { ...record, id: 'record-remove-only-one', updatedAt: 6000 };
  const pendingTwo = { ...record, id: 'record-must-remain', updatedAt: 6001 };
  cloudWritable = false;
  await syncLearningRecord(pendingOne);
  await syncLearningRecord(pendingTwo);
  assert.strictEqual(Object.keys(storage.pendingLearningRecordSync || {}).length, 2);
  cloudWritable = true;
  await syncLearningRecord(pendingOne);
  let remainingPending = Object.values(storage.pendingLearningRecordSync || {});
  assert.deepStrictEqual(remainingPending.map((item) => item.id), [pendingTwo.id]);
  await retryPendingSyncs();
  assert.strictEqual(storage.pendingLearningRecordSync, undefined);

  const attemptsBeforeIdempotentRetry = setAttempts.length;
  await retryPendingSyncs();
  assert.strictEqual(setAttempts.length, attemptsBeforeIdempotentRetry, 'retry after convergence must be a no-op');

  // 账号 A 的 pending 在账号 B 下不可执行；切回 A 后才允许收敛。
  storage.openid = 'openid-account-A';
  const accountARecord = { ...record, id: 'record-account-a-only', updatedAt: 7000 };
  cloudWritable = false;
  await syncLearningRecord(accountARecord);
  assert.strictEqual(Object.values(storage.pendingLearningRecordSync || {})[0].accountId, 'openid-account-A');
  storage.openid = 'openid-account-B';
  cloudWritable = true;
  const attemptsBeforeAccountB = setAttempts.length;
  const accountBRetry = await retryPendingSyncs();
  assert.deepStrictEqual(accountBRetry, { ok: true, pending: 0, retained: 1 });
  assert.strictEqual(setAttempts.length, attemptsBeforeAccountB, 'account B must not attempt account A pending');
  assert.strictEqual(Object.keys(storage.pendingLearningRecordSync || {}).length, 1);
  storage.openid = 'openid-account-A';
  const accountARetry = await retryPendingSyncs();
  assert.deepStrictEqual(accountARetry, { ok: true, pending: 0 });
  assert.strictEqual(storage.pendingLearningRecordSync, undefined);
  storage.openid = 'openid-test';

  assert.deepStrictEqual(stage1AFailures, [], stage1AFailures.join('\n'));

  console.log('cloud-learning-record-retry: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
