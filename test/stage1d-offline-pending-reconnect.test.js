'use strict';

const assert = require('assert');
const fs = require('fs');

const ACCOUNT = 'openid-stage1d-a';
const STUDENT = 'student-stage1d-a';
const BOOK = 'book-stage1d-a';
const WORD = 'word-stage1d-a';

const clone = (value) => JSON.parse(JSON.stringify(value));

function createHarness(initiallyOnline) {
  const storage = {
    openid: ACCOUNT,
    students: [{ id: STUDENT, ownerId: ACCOUNT, name: 'Stage1D Student' }],
    learningRecords: [],
    learningProgress: {},
    wordMastery: {}
  };
  const cloudRecords = new Map();
  const cloudProgress = new Map();
  const cloudPreview = new Map();
  const cloudMastery = new Map();
  const tombstoneRecordIds = new Set();
  const networkHandlers = [];
  let online = initiallyOnline;
  let afterMasteryWrite = null;
  let afterPreviewWrite = null;
  let writeFailuresRemaining = 0;

  const notFound = () => {
    const error = new Error('document not found');
    error.errCode = -1;
    return error;
  };

  global.wx = {
    cloud: {
      database: () => ({
        collection: (collectionName) => ({
          doc: (docId) => ({
            get: async () => {
              if (!online) throw new Error('offline');
              const target = collectionName === 'learning_records'
                ? cloudRecords
                : (collectionName === 'learning_progress' ? cloudProgress : cloudPreview);
              if (!target.has(docId)) throw notFound();
              return { data: clone(target.get(docId)) };
            },
            set: async ({ data }) => {
              if (!online) throw new Error('offline');
              if (writeFailuresRemaining > 0) {
                writeFailuresRemaining -= 1;
                throw new Error('transient_write_failure');
              }
              const target = collectionName === 'learning_records'
                ? cloudRecords
                : (collectionName === 'learning_progress' ? cloudProgress : cloudPreview);
              target.set(docId, clone(data));
              if (collectionName === 'preview_state' && afterPreviewWrite) afterPreviewWrite();
              return { ok: true };
            }
          })
        })
      }),
      callFunction: async (request) => {
        if (!online) throw new Error('offline');
        if (request.name === 'syncTombstoneAuthority') {
          const descriptors = Array.isArray(request.data.entities) ? request.data.entities : [];
          const tombstones = descriptors.filter((descriptor) => (
            descriptor.entityType === 'learning_record' && tombstoneRecordIds.has(descriptor.entityId)
          )).map((descriptor) => ({
            ...descriptor,
            deletedAt: 300,
            schemaVersion: 1
          }));
          return { result: { success: true, tombstones } };
        }
        assert.strictEqual(request.name, 'syncMasteryAtom');
        if (request.data.action === 'capabilities') {
          return {
            result: {
              success: true,
              protocolVersion: 2,
              maxBatchSize: 20,
              features: {
                transactionalMasteryMerge: true,
                legacyOwnershipAdoption: true
              }
            }
          };
        }
        const results = request.data.records.map((record) => {
          const key = [record.studentId, record.wordbookId, record.wordId].join('|');
          cloudMastery.set(key, clone(record));
          return { wordId: record.wordId, ok: true };
        });
        if (afterMasteryWrite) afterMasteryWrite();
        return { result: { success: true, protocolVersion: 2, results } };
      }
    },
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => { storage[key] = value; },
    removeStorageSync: (key) => { delete storage[key]; },
    onNetworkStatusChange: (handler) => { networkHandlers.push(handler); }
  };
  global.getApp = () => ({ globalData: { cloudReadOnly: false }, emit: () => {} });

  const cloudSyncPath = require.resolve('../utils/cloud-sync.js');
  const accountSessionPath = require.resolve('../utils/account-session.js');
  delete require.cache[cloudSyncPath];
  delete require.cache[accountSessionPath];
  const cloudSync = require(cloudSyncPath);

  return {
    cloudProgress,
    cloudRecords,
    cloudPreview,
    cloudMastery,
    cloudSync,
    emitNetwork(status) {
      networkHandlers.forEach((handler) => handler(status));
    },
    getNetworkHandlerCount: () => networkHandlers.length,
    markRecordTombstoned: (recordId) => { tombstoneRecordIds.add(recordId); },
    setAfterMasteryWrite: (handler) => { afterMasteryWrite = handler; },
    setAfterPreviewWrite: (handler) => { afterPreviewWrite = handler; },
    setOnline: (value) => { online = value; },
    setWriteFailures: (count) => { writeFailuresRemaining = count; },
    storage
  };
}

const checks = [];
const check = async (name, run) => {
  try {
    await run();
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    checks.push({ name, error });
    process.stderr.write(`FAIL ${name}: ${error.stack || error}\n`);
  }
};

const makeRecord = (id, studentId = STUDENT, wordbookId = BOOK, updatedAt = 100) => ({
  id,
  studentId,
  wordbookId,
  updatedAt,
  recordSchemaVersion: 2,
  learnedWordIds: [`${id}-word`],
  wordsSnapshot: [{ wordId: `${id}-word`, word: id, masteryStatus: 'notMastered' }]
});

const makeBookProgress = (wordbookId, completedCount, updatedAt) => ({
  learnedWords: completedCount,
  totalWords: 100,
  updatedAt,
  wordbooks: {
    [wordbookId]: {
      completedCount,
      learnedWords: completedCount,
      totalCount: 100,
      lastStudyTime: new Date(updatedAt).toISOString(),
      updatedAt
    }
  }
});

(async () => {
  await check('single and multi-record offline learning converges once', async () => {
    const harness = createHarness(false);
    const records = ['offline-x', 'offline-y', 'offline-z'].map((id, index) => (
      makeRecord(id, STUDENT, BOOK, 100 + index)
    ));
    harness.storage.learningRecords = clone(records);
    for (const record of records) {
      const result = await harness.cloudSync.syncLearningRecord(record);
      assert.strictEqual(result.ok, false);
    }
    const masteryPayload = {};
    records.forEach((record, index) => {
      masteryPayload[record.learnedWordIds[0]] = {
        mastered: index === 0,
        difficult: index !== 0,
        updatedAt: record.updatedAt
      };
    });
    const masteryResult = await harness.cloudSync.syncWordMasteryBatch(STUDENT, BOOK, masteryPayload);
    assert.strictEqual(masteryResult.failed, 3);
    const progressResult = await harness.cloudSync.syncLearningProgress(
      STUDENT,
      makeBookProgress(BOOK, 3, 103)
    );
    assert.strictEqual(progressResult.ok, false);
    assert.strictEqual(Object.keys(harness.storage.pendingLearningRecordSync || {}).length, 3);
    assert.strictEqual(Object.keys(harness.storage.pendingWordMasterySync || {}).length, 3);
    assert.strictEqual(Object.keys(harness.storage.pendingLearningProgressSync || {}).length, 1);

    harness.setOnline(true);
    const retry = await harness.cloudSync.retryPendingSyncs({ accountId: ACCOUNT });
    assert.deepStrictEqual(retry, { ok: true, pending: 0 });
    assert.strictEqual(harness.cloudRecords.size, 3);
    assert.strictEqual(harness.cloudMastery.size, 3);
    assert.strictEqual(harness.cloudProgress.size, 1);
    const progress = Array.from(harness.cloudProgress.values())[0];
    assert.strictEqual(progress.wordbooks[BOOK].completedCount, 3);
    assert.strictEqual(harness.storage.pendingLearningRecordSync, undefined);
    assert.strictEqual(harness.storage.pendingWordMasterySync, undefined);
    assert.strictEqual(harness.storage.pendingLearningProgressSync, undefined);

    const sizes = [harness.cloudRecords.size, harness.cloudMastery.size, harness.cloudProgress.size];
    assert.deepStrictEqual(
      await harness.cloudSync.retryPendingSyncs({ accountId: ACCOUNT }),
      { ok: true, pending: 0 }
    );
    assert.deepStrictEqual(
      [harness.cloudRecords.size, harness.cloudMastery.size, harness.cloudProgress.size],
      sizes,
      'repeated online recovery must be idempotent'
    );
  });

  await check('failed retry is retained and later succeeds once', async () => {
    const harness = createHarness(false);
    const record = makeRecord('retry-after-flap');
    harness.storage.learningRecords = [clone(record)];
    await harness.cloudSync.syncLearningRecord(record);
    harness.setOnline(true);
    harness.setWriteFailures(1);
    const firstRetry = await harness.cloudSync.retryPendingSyncs({ accountId: ACCOUNT });
    assert.strictEqual(firstRetry.pending, 1);
    assert.strictEqual(Object.keys(harness.storage.pendingLearningRecordSync || {}).length, 1);
    const secondRetry = await harness.cloudSync.retryPendingSyncs({ accountId: ACCOUNT });
    assert.deepStrictEqual(secondRetry, { ok: true, pending: 0 });
    assert.strictEqual(harness.cloudRecords.size, 1);
    assert.strictEqual(harness.storage.pendingLearningRecordSync, undefined);
  });

  await check('account, student, and wordbook ownership stay isolated', async () => {
    const harness = createHarness(false);
    const accountARecord = makeRecord('account-a-only');
    harness.storage.learningRecords = [clone(accountARecord)];
    await harness.cloudSync.syncLearningRecord(accountARecord);
    harness.storage.openid = 'openid-stage1d-b';
    harness.setOnline(true);
    const accountBRetry = await harness.cloudSync.retryPendingSyncs({
      accountId: 'openid-stage1d-b'
    });
    assert.deepStrictEqual(accountBRetry, { ok: true, pending: 0, retained: 1 });
    assert.strictEqual(harness.cloudRecords.size, 0);
    harness.storage.openid = ACCOUNT;
    assert.deepStrictEqual(
      await harness.cloudSync.retryPendingSyncs({ accountId: ACCOUNT }),
      { ok: true, pending: 0 }
    );
    assert.strictEqual(Array.from(harness.cloudRecords.values())[0].teacher_id, ACCOUNT);

    const studentOne = 'student-stage1d-one';
    const studentTwo = 'student-stage1d-two';
    harness.storage.students.push(
      { id: studentOne, ownerId: ACCOUNT },
      { id: studentTwo, ownerId: ACCOUNT }
    );
    harness.setOnline(false);
    const studentOneRecord = makeRecord('student-one-record', studentOne, 'book-a', 201);
    harness.storage.learningRecords.push(clone(studentOneRecord));
    await harness.cloudSync.syncLearningRecord(studentOneRecord);
    harness.storage.currentStudent = { id: studentTwo, ownerId: ACCOUNT };
    await harness.cloudSync.syncWordMasteryBatch(studentOne, 'book-a', {
      'word-a': { mastered: true, updatedAt: 201 }
    });
    await harness.cloudSync.syncWordMasteryBatch(studentOne, 'book-b', {
      'word-b': { mastered: false, difficult: true, updatedAt: 202 }
    });
    await harness.cloudSync.syncLearningProgress(
      studentOne,
      makeBookProgress('book-a', 1, 201)
    );
    await harness.cloudSync.syncLearningProgress(
      studentOne,
      makeBookProgress('book-b', 1, 202)
    );
    harness.setOnline(true);
    assert.deepStrictEqual(
      await harness.cloudSync.retryPendingSyncs({ accountId: ACCOUNT }),
      { ok: true, pending: 0 }
    );
    const uploadedStudentRecord = Array.from(harness.cloudRecords.values())
      .find((record) => record.id === studentOneRecord.id);
    assert.strictEqual(uploadedStudentRecord.studentId, studentOne);
    assert.ok(harness.cloudMastery.has(`${studentOne}|book-a|word-a`));
    assert.ok(harness.cloudMastery.has(`${studentOne}|book-b|word-b`));
    const studentProgress = Array.from(harness.cloudProgress.values())
      .find((progress) => progress.student_id === studentOne);
    assert.deepStrictEqual(Object.keys(studentProgress.wordbooks).sort(), ['book-a', 'book-b']);
  });

  await check('tombstone wins over an offline record pending retry', async () => {
    const harness = createHarness(false);
    const record = makeRecord('tombstoned-offline-record');
    harness.storage.learningRecords = [clone(record)];
    await harness.cloudSync.syncLearningRecord(record);
    assert.strictEqual(Object.keys(harness.storage.pendingLearningRecordSync || {}).length, 1);
    harness.markRecordTombstoned(record.id);
    harness.setOnline(true);
    const retry = await harness.cloudSync.retryPendingSyncs({ accountId: ACCOUNT });
    assert.deepStrictEqual(retry, { ok: true, pending: 0, tombstonedDiscarded: 1 });
    assert.strictEqual(harness.cloudRecords.size, 0);
    assert.deepStrictEqual(harness.storage.learningRecords, []);
    assert.strictEqual(harness.storage.pendingLearningRecordSync, undefined);
  });

  await check('offline mastery retries immediately after connectivity returns', async () => {
    const harness = createHarness(false);
    const first = await harness.cloudSync.syncWordMasteryBatch(STUDENT, BOOK, {
      [WORD]: { mastered: false, difficult: true, updatedAt: 100 }
    });
    assert.strictEqual(first.failed, 1);
    assert.strictEqual(Object.keys(harness.storage.pendingWordMasterySync || {}).length, 1);

    harness.setOnline(true);
    const retry = await harness.cloudSync.retryPendingSyncs({ accountId: ACCOUNT });
    assert.deepStrictEqual(retry, { ok: true, pending: 0 });
    assert.strictEqual(harness.storage.pendingWordMasterySync, undefined);
    assert.strictEqual(harness.cloudMastery.size, 1);
  });

  await check('old mastery completion cannot clear a newer same-key pending payload', async () => {
    const harness = createHarness(true);
    const pendingKey = `${STUDENT}__${BOOK}__${WORD}`;
    const oldPending = {
      accountId: ACCOUNT,
      student_id: STUDENT,
      wordbook_id: BOOK,
      word_id: WORD,
      mastered: false,
      difficult: true,
      updatedAt: 100
    };
    const newPending = { ...oldPending, mastered: true, difficult: false, updatedAt: 200 };
    harness.storage.pendingWordMasterySync = { [pendingKey]: oldPending };
    harness.setAfterMasteryWrite(() => {
      harness.storage.pendingWordMasterySync = { [pendingKey]: newPending };
      harness.setAfterMasteryWrite(null);
    });

    const firstRetry = await harness.cloudSync.retryPendingSyncs({ accountId: ACCOUNT });
    assert.strictEqual(firstRetry.pending, 1);
    assert.strictEqual(harness.storage.pendingWordMasterySync[pendingKey].updatedAt, 200);

    const secondRetry = await harness.cloudSync.retryPendingSyncs({ accountId: ACCOUNT });
    assert.deepStrictEqual(secondRetry, { ok: true, pending: 0 });
    assert.strictEqual(harness.storage.pendingWordMasterySync, undefined);
    assert.strictEqual(harness.cloudMastery.get(`${STUDENT}|${BOOK}|${WORD}`).updatedAt, 200);
  });

  await check('old preview completion cannot clear a newer same-key pending payload', async () => {
    const harness = createHarness(true);
    const pendingKey = `${STUDENT}__${BOOK}`;
    const oldPending = {
      accountId: ACCOUNT,
      studentId: STUDENT,
      wordbookId: BOOK,
      failedAt: 100,
      previewData: { mastery: { [WORD]: false }, order: [WORD], excluded: [] }
    };
    const newPending = {
      ...oldPending,
      failedAt: 200,
      previewData: { mastery: { [WORD]: true }, order: [WORD], excluded: [WORD] }
    };
    harness.storage.pendingPreviewStateSync = { [pendingKey]: oldPending };
    harness.setAfterPreviewWrite(() => {
      harness.storage.pendingPreviewStateSync = { [pendingKey]: newPending };
      harness.setAfterPreviewWrite(null);
    });
    const firstRetry = await harness.cloudSync.retryPendingSyncs({ accountId: ACCOUNT });
    assert.strictEqual(firstRetry.pending, 1);
    assert.strictEqual(harness.storage.pendingPreviewStateSync[pendingKey].failedAt, 200);
    const secondRetry = await harness.cloudSync.retryPendingSyncs({ accountId: ACCOUNT });
    assert.deepStrictEqual(secondRetry, { ok: true, pending: 0 });
    assert.strictEqual(harness.storage.pendingPreviewStateSync, undefined);
  });

  await check('Full Pull then pending retry retains cloud and offline-local records', async () => {
    const harness = createHarness(false);
    const pendingRecord = makeRecord('local-offline-record', STUDENT, BOOK, 400);
    const cloudRecord = makeRecord('remote-during-offline', STUDENT, BOOK, 350);
    harness.storage.learningRecords = [clone(pendingRecord)];
    await harness.cloudSync.syncLearningRecord(pendingRecord);
    harness.setOnline(true);
    harness.cloudRecords.set(
      harness.cloudSync.buildScopedDocId(ACCOUNT, 'record', cloudRecord.id),
      { ...clone(cloudRecord), teacher_id: ACCOUNT }
    );
    harness.storage.cloudMigrationStateByOpenId = {
      [ACCOUNT]: { completed: true, source: 'prior-session', completedAt: 1 }
    };

    const events = [];
    const migrationPath = require.resolve('../utils/cloud-migration.js');
    const cloudSyncPath = require.resolve('../utils/cloud-sync.js');
    const loginPath = require.resolve('../utils/login-service.js');
    require.cache[migrationPath] = {
      id: migrationPath,
      filename: migrationPath,
      loaded: true,
      exports: {
        syncDataFromCloud: async () => {
          events.push('pull');
          const byId = new Map(harness.storage.learningRecords.map((record) => [record.id, record]));
          byId.set(cloudRecord.id, clone(cloudRecord));
          harness.storage.learningRecords = Array.from(byId.values());
          return {
            success: true,
            cloudSnapshot: {
              students: clone(harness.storage.students),
              learningRecords: [clone(cloudRecord)],
              learningProgress: {},
              wordMastery: {}
            }
          };
        },
        migrateLocalDataToCloud: async () => {
          throw new Error('completed migration must not rerun');
        }
      }
    };
    const originalCloudSync = require.cache[cloudSyncPath].exports;
    require.cache[cloudSyncPath].exports = {
      ...originalCloudSync,
      retryPendingSyncs: async (options) => {
        events.push('retry');
        return originalCloudSync.retryPendingSyncs(options);
      }
    };
    delete require.cache[loginPath];
    const loginService = require(loginPath);
    const result = await loginService.doSilentLogin();
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.pending, 0);
    assert.deepStrictEqual(events, ['pull', 'retry']);
    assert.deepStrictEqual(
      harness.storage.learningRecords.map((record) => record.id).sort(),
      [cloudRecord.id, pendingRecord.id].sort()
    );
    assert.strictEqual(harness.cloudRecords.size, 2);
  });

  await check('online transition registers once and starts one reconnect sync flight', async () => {
    const harness = createHarness(false);
    assert.strictEqual(typeof harness.cloudSync.registerNetworkReconnectSync, 'function');
    let runs = 0;
    let finishFirst;
    const firstFlight = new Promise((resolve) => { finishFirst = resolve; });
    const syncNow = () => {
      runs += 1;
      return runs === 1 ? firstFlight : Promise.resolve({ ok: true });
    };

    assert.strictEqual(harness.cloudSync.registerNetworkReconnectSync({ syncNow }), true);
    assert.strictEqual(harness.cloudSync.registerNetworkReconnectSync({ syncNow }), true);
    assert.strictEqual(harness.getNetworkHandlerCount(), 1);
    harness.emitNetwork({ isConnected: false });
    harness.emitNetwork({ isConnected: true });
    harness.emitNetwork({ isConnected: true });
    await new Promise((resolve) => setImmediate(resolve));
    assert.strictEqual(runs, 1);
    finishFirst({ ok: true });
    await new Promise((resolve) => setImmediate(resolve));
    harness.emitNetwork({ isConnected: false });
    harness.emitNetwork({ isConnected: true });
    await new Promise((resolve) => setImmediate(resolve));
    assert.strictEqual(runs, 2);
    const appSource = fs.readFileSync(require.resolve('../app.js'), 'utf8');
    assert.ok(
      /registerNetworkReconnectSync\(\)/.test(appSource),
      'App launch must register the reconnect listener'
    );
  });

  if (checks.length > 0) {
    throw new Error(`${checks.length} Stage1D risk checks failed`);
  }
  process.stdout.write('stage1d-offline-pending-reconnect: PASS\n');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
