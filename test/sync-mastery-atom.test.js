'use strict';

const assert = require('assert');
const Module = require('module');

const clone = (value) => JSON.parse(JSON.stringify(value));

const createHarness = (initialCallerOpenid = 'caller-openid') => {
  const documents = new Map();
  const failedWriteIds = new Set();
  let callerOpenid = initialCallerOpenid;
  let transactionCount = 0;

  const collection = {
    doc: (docId) => ({
      get: async () => {
        if (!documents.has(docId)) {
          const error = new Error('document not found');
          error.errCode = -1;
          throw error;
        }
        return { data: clone(documents.get(docId)) };
      },
      set: async ({ data }) => {
        if (failedWriteIds.has(docId)) {
          throw new Error('simulated_write_failure');
        }
        documents.set(docId, clone(data));
        return { errMsg: 'document.set:ok' };
      }
    })
  };
  const database = {
    collection: () => collection,
    runTransaction: async (callback) => {
      transactionCount += 1;
      const result = await callback({
        collection: () => collection
      });
      return {
        result,
        errMsg: 'runTransaction:ok'
      };
    }
  };
  const cloudMock = {
    DYNAMIC_CURRENT_ENV: 'test-env',
    init: () => {},
    database: () => database,
    getWXContext: () => ({ OPENID: callerOpenid })
  };

  const modulePath = require.resolve('../cloudfunctions/syncMasteryAtom/index.js');
  const originalLoad = Module._load;
  delete require.cache[modulePath];
  Module._load = function load(request, parent, isMain) {
    if (request === 'wx-server-sdk') {
      return cloudMock;
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  let syncModule;
  try {
    syncModule = require(modulePath);
  } finally {
    Module._load = originalLoad;
  }

  return {
    documents,
    failedWriteIds,
    main: syncModule.main,
    testApi: syncModule._test,
    getTransactionCount: () => transactionCount,
    setCallerOpenid: (value) => {
      callerOpenid = value;
    }
  };
};

(async () => {
  const harness = createHarness('caller-a');
  const forgedResult = await harness.main({
    openid: 'forged-openid',
    records: [{
      studentId: 'student-a',
      wordbookId: 'book-a',
      wordId: 'word-a',
      reviewCount: 1,
      lastReviewTime: 1000,
      mastered: false,
      difficult: true,
      _openid: 'forged-openid',
      teacher_id: 'forged-openid'
    }]
  });
  assert.strictEqual(forgedResult.success, true);
  const firstDocId = harness.testApi.buildScopedDocId(
    'caller-a',
    'mastery',
    'student-a',
    'book-a',
    'word-a'
  );
  const firstDoc = harness.documents.get(firstDocId);
  assert.strictEqual(firstDoc._openid, 'caller-a');
  assert.strictEqual(firstDoc.teacher_id, 'caller-a');
  assert.strictEqual(firstDoc.student_id, 'student-a');
  assert.strictEqual(firstDoc.wordbook_id, 'book-a');
  assert.strictEqual(firstDoc.word_id, 'word-a');

  const legacyDocId = harness.testApi.buildScopedDocId(
    'caller-a',
    'mastery',
    'student-a',
    'book-a',
    'legacy-word'
  );
  harness.documents.set(legacyDocId, {
    teacher_id: 'caller-a',
    student_id: 'student-a',
    wordbook_id: 'book-a',
    word_id: 'legacy-word',
    reviewCount: 4,
    lastReviewTime: 4000,
    mastered: false,
    difficult: true,
    antiForgettingSeed: true,
    legacyUnknownField: 'keep-me'
  });
  const legacyResult = await harness.main({
    records: [{
      studentId: 'student-a',
      wordbookId: 'book-a',
      wordId: 'legacy-word',
      reviewCount: 5,
      lastReviewTime: 5000,
      mastered: true,
      difficult: false,
      antiForgettingSeed: true
    }]
  });
  assert.strictEqual(legacyResult.success, true);
  assert.strictEqual(legacyResult.results[0].adoptedLegacyOwnership, true);
  const adoptedLegacy = harness.documents.get(legacyDocId);
  assert.strictEqual(adoptedLegacy._openid, 'caller-a');
  assert.strictEqual(adoptedLegacy.legacyUnknownField, 'keep-me');
  assert.strictEqual(adoptedLegacy.reviewCount, 5);
  assert.strictEqual(adoptedLegacy.mastered, true);
  assert.strictEqual(adoptedLegacy.difficult, false);
  assert.strictEqual(
    adoptedLegacy.antiForgettingSeed,
    false,
    'the completed five-round review must not be reactivated'
  );

  const cloudNewerDocId = harness.testApi.buildScopedDocId(
    'caller-a',
    'mastery',
    'student-a',
    'book-a',
    'cloud-newer'
  );
  harness.documents.set(cloudNewerDocId, {
    _openid: 'caller-a',
    teacher_id: 'caller-a',
    student_id: 'student-a',
    wordbook_id: 'book-a',
    word_id: 'cloud-newer',
    reviewCount: 3,
    lastReviewTime: 3000,
    mastered: false,
    difficult: true
  });
  await harness.main({
    records: [{
      studentId: 'student-a',
      wordbookId: 'book-a',
      wordId: 'cloud-newer',
      reviewCount: 1,
      lastReviewTime: 1000,
      mastered: true,
      difficult: false
    }]
  });
  const cloudNewer = harness.documents.get(cloudNewerDocId);
  assert.strictEqual(cloudNewer.reviewCount, 3);
  assert.strictEqual(cloudNewer.mastered, false);
  assert.strictEqual(cloudNewer.difficult, true);

  const localNewerResult = await harness.main({
    records: [{
      studentId: 'student-a',
      wordbookId: 'book-a',
      wordId: 'cloud-newer',
      reviewCount: 4,
      lastReviewTime: 4000,
      mastered: true,
      difficult: false,
      antiForgettingSeed: false
    }]
  });
  assert.strictEqual(localNewerResult.success, true);
  const localNewer = harness.documents.get(cloudNewerDocId);
  assert.strictEqual(localNewer.reviewCount, 4);
  assert.strictEqual(localNewer.mastered, true);
  assert.strictEqual(localNewer.difficult, false);
  assert.strictEqual(localNewer.antiForgettingSeed, false);

  const mismatchDocId = harness.testApi.buildScopedDocId(
    'caller-a',
    'mastery',
    'student-a',
    'book-a',
    'owned-by-other'
  );
  const mismatchBefore = {
    _openid: 'other-openid',
    teacher_id: 'other-openid',
    student_id: 'student-a',
    wordbook_id: 'book-a',
    word_id: 'owned-by-other',
    reviewCount: 2
  };
  harness.documents.set(mismatchDocId, clone(mismatchBefore));
  const mismatchResult = await harness.main({
    records: [{
      studentId: 'student-a',
      wordbookId: 'book-a',
      wordId: 'owned-by-other',
      reviewCount: 3
    }]
  });
  assert.strictEqual(mismatchResult.success, false);
  assert.strictEqual(mismatchResult.results[0].error, 'ownership_mismatch');
  assert.deepStrictEqual(harness.documents.get(mismatchDocId), mismatchBefore);

  const isolationResult = await harness.main({
    records: [{
      studentId: 'student-a',
      wordbookId: 'book-a',
      wordId: 'shared-word',
      reviewCount: 1
    }, {
      studentId: 'student-b',
      wordbookId: 'book-b',
      wordId: 'shared-word',
      reviewCount: 2
    }]
  });
  assert.strictEqual(isolationResult.success, true);
  assert.ok(harness.documents.has(harness.testApi.buildScopedDocId(
    'caller-a',
    'mastery',
    'student-a',
    'book-a',
    'shared-word'
  )));
  assert.ok(harness.documents.has(harness.testApi.buildScopedDocId(
    'caller-a',
    'mastery',
    'student-b',
    'book-b',
    'shared-word'
  )));

  const transactionCountBeforeLargeBatch = harness.getTransactionCount();
  const largeBatchResult = await harness.main({
    records: Array.from(
      { length: harness.testApi.MAX_BATCH_SIZE + 1 },
      (_, index) => ({
        studentId: 'student-a',
        wordbookId: 'book-a',
        wordId: `too-many-${index}`
      })
    )
  });
  assert.strictEqual(largeBatchResult.success, false);
  assert.strictEqual(largeBatchResult.error, 'batch_too_large');
  assert.strictEqual(harness.getTransactionCount(), transactionCountBeforeLargeBatch);

  const failedDocId = harness.testApi.buildScopedDocId(
    'caller-a',
    'mastery',
    'student-a',
    'book-a',
    'write-fails'
  );
  harness.failedWriteIds.add(failedDocId);
  const partialResult = await harness.main({
    records: [{
      studentId: 'student-a',
      wordbookId: 'book-a',
      wordId: 'write-works',
      reviewCount: 1
    }, {
      studentId: 'student-a',
      wordbookId: 'book-a',
      wordId: 'write-fails',
      reviewCount: 1
    }]
  });
  assert.strictEqual(partialResult.success, false);
  assert.strictEqual(partialResult.total, 2);
  assert.strictEqual(partialResult.succeeded, 1);
  assert.strictEqual(partialResult.failed, 1);
  assert.ok(harness.documents.has(harness.testApi.buildScopedDocId(
    'caller-a',
    'mastery',
    'student-a',
    'book-a',
    'write-works'
  )));
  assert.strictEqual(harness.documents.has(failedDocId), false);

  harness.setCallerOpenid('');
  const missingCallerResult = await harness.main({
    records: [{
      studentId: 'student-a',
      wordbookId: 'book-a',
      wordId: 'word-a'
    }]
  });
  assert.strictEqual(missingCallerResult.success, false);
  assert.strictEqual(missingCallerResult.error, 'missing_caller_openid');

  console.log('sync-mastery-atom: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
