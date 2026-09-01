'use strict';

const assert = require('assert');
const {
  mergeLearningProgress,
  mergeLearningProgressMap
} = require('../utils/learning-progress.js');

const clone = (value) => JSON.parse(JSON.stringify(value));
const STUDENT_ID = 'student-progress-stage1b';
const ACCOUNT_A = 'openid-progress-stage1b-a';
const ACCOUNT_B = 'openid-progress-stage1b-b';

const storage = {};
let cloudDocument = null;
let cloudWritable = true;
let afterSuccessfulSet = null;
let writeCount = 0;

const progressDocument = {
  get() {
    if (!cloudDocument) {
      return Promise.reject({ errCode: -1, errMsg: 'document not found' });
    }
    return Promise.resolve({ data: clone(cloudDocument) });
  },
  set({ data }) {
    if (!cloudWritable) return Promise.reject(new Error('offline'));
    cloudDocument = clone(data);
    writeCount += 1;
    if (afterSuccessfulSet) afterSuccessfulSet(cloudDocument);
    return Promise.resolve({ ok: true });
  }
};

global.wx = {
  cloud: {
    database: () => ({
      collection: (name) => {
        assert.strictEqual(name, 'learning_progress');
        return { doc: () => progressDocument };
      }
    })
  },
  getStorageSync: (key) => storage[key],
  setStorageSync: (key, value) => { storage[key] = value; },
  removeStorageSync: (key) => { delete storage[key]; }
};
global.getApp = () => ({ globalData: { cloudReadOnly: false } });

const {
  retryPendingSyncs,
  syncLearningProgress
} = require('../utils/cloud-sync.js');

const resetHarness = (accountId = ACCOUNT_A) => {
  Object.keys(storage).forEach((key) => { delete storage[key]; });
  storage.openid = accountId;
  storage.students = [{
    id: STUDENT_ID,
    name: 'Progress Student',
    ownerId: accountId
  }];
  storage.wordMastery = {};
  storage.learningRecords = [];
  storage.learningProgress = {};
  cloudDocument = null;
  cloudWritable = true;
  afterSuccessfulSet = null;
  writeCount = 0;
};

const buildBook = (completedCount, totalCount, studyTime, extra = {}) => ({
  ...extra,
  completedCount,
  learnedWords: completedCount,
  totalCount,
  lastStudyTime: studyTime,
  lastStudied: studyTime,
  updatedAt: Date.parse(studyTime)
});

const buildProgress = ({ aCount, bCount, aTime, bTime, updatedAt }) => ({
  learnedWords: aCount + bCount,
  totalWords: 300,
  updatedAt,
  wordbooks: {
    'book-a': buildBook(aCount, 100, aTime),
    'book-b': buildBook(bCount, 200, bTime)
  }
});

const assertCounts = (progress, aCount, bCount) => {
  assert.strictEqual(progress.wordbooks['book-a'].completedCount, aCount);
  assert.strictEqual(progress.wordbooks['book-a'].learnedWords, aCount);
  assert.strictEqual(progress.wordbooks['book-b'].completedCount, bCount);
  assert.strictEqual(progress.wordbooks['book-b'].learnedWords, bCount);
  assert.strictEqual(progress.learnedWords, aCount + bCount);
};

(async () => {
  // 1-4. Two devices update different books from the same stale snapshot.
  resetHarness();
  cloudDocument = buildProgress({
    aCount: 10,
    bCount: 20,
    aTime: '2026-09-01T08:00:00.000Z',
    bTime: '2026-09-01T08:00:00.000Z',
    updatedAt: Date.parse('2026-09-01T08:00:00.000Z')
  });
  const deviceOne = buildProgress({
    aCount: 11,
    bCount: 20,
    aTime: '2026-09-01T09:00:00.000Z',
    bTime: '2026-09-01T08:00:00.000Z',
    updatedAt: Date.parse('2026-09-01T09:00:00.000Z')
  });
  const deviceTwo = buildProgress({
    aCount: 10,
    bCount: 21,
    aTime: '2026-09-01T08:00:00.000Z',
    bTime: '2026-09-01T10:00:00.000Z',
    updatedAt: Date.parse('2026-09-01T10:00:00.000Z')
  });
  await syncLearningProgress(STUDENT_ID, deviceOne);
  await syncLearningProgress(STUDENT_ID, deviceTwo);
  assertCounts(cloudDocument, 11, 21);
  assert.deepStrictEqual(Object.keys(cloudDocument.wordbooks).sort(), ['book-a', 'book-b']);

  // 5. Recent activity and per-book updatedAt are selected independently.
  const activityMerged = mergeLearningProgress(deviceOne, deviceTwo, {
    useKnownWordbookTotals: false
  });
  assert.strictEqual(activityMerged.wordbooks['book-a'].lastStudyTime, '2026-09-01T09:00:00.000Z');
  assert.strictEqual(activityMerged.wordbooks['book-b'].lastStudyTime, '2026-09-01T10:00:00.000Z');
  assert.strictEqual(
    activityMerged.wordbooks['book-b'].updatedAt,
    Date.parse('2026-09-01T10:00:00.000Z')
  );

  // Other existing metadata is preserved and nested daily stats are combined.
  const metadataMerged = mergeLearningProgress({
    wordbooks: {
      'book-a': buildBook(1, 10, '2026-09-01T08:00:00.000Z', {
        legacyOnly: 'keep',
        dailyStats: { '2026-09-01': { newWords: 1 } }
      })
    }
  }, {
    wordbooks: {
      'book-a': buildBook(2, 10, '2026-09-02T08:00:00.000Z', {
        currentOnly: 'keep',
        dailyStats: { '2026-09-02': { newWords: 1 } }
      })
    }
  }, { useKnownWordbookTotals: false });
  assert.strictEqual(metadataMerged.wordbooks['book-a'].legacyOnly, 'keep');
  assert.strictEqual(metadataMerged.wordbooks['book-a'].currentOnly, 'keep');
  assert.deepStrictEqual(Object.keys(metadataMerged.wordbooks['book-a'].dailyStats).sort(), [
    '2026-09-01',
    '2026-09-02'
  ]);

  // 6-8. Current catalog metadata can grow or shrink; historical totals are fallback only.
  const total25 = { wordbooks: { catalog: buildBook(5, 25, '2026-09-01T08:00:00.000Z') } };
  const total100 = mergeLearningProgress(total25, total25, {
    bookTotals: { catalog: 100 },
    useKnownWordbookTotals: false
  });
  assert.strictEqual(total100.wordbooks.catalog.totalCount, 100);
  const total80 = mergeLearningProgress(total100, total100, {
    bookTotals: { catalog: 80 },
    useKnownWordbookTotals: false
  });
  assert.strictEqual(total80.wordbooks.catalog.totalCount, 80);
  const historicalFallback = mergeLearningProgress(total100, {
    wordbooks: { catalog: { completedCount: 5, learnedWords: 5 } }
  }, { useKnownWordbookTotals: false });
  assert.strictEqual(historicalFallback.wordbooks.catalog.totalCount, 100);

  // Exact stale pending example: cloud A=30/B=40, pending A=20/B=40.
  resetHarness();
  cloudDocument = buildProgress({
    aCount: 30,
    bCount: 40,
    aTime: '2026-09-01T12:00:00.000Z',
    bTime: '2026-09-01T12:00:00.000Z',
    updatedAt: Date.parse('2026-09-01T12:00:00.000Z')
  });
  storage.pendingLearningProgressSync = {
    [STUDENT_ID]: {
      studentId: STUDENT_ID,
      accountId: ACCOUNT_A,
      failedAt: 1,
      pendingVersion: 1,
      progressData: buildProgress({
        aCount: 20,
        bCount: 40,
        aTime: '2026-09-01T10:00:00.000Z',
        bTime: '2026-09-01T10:00:00.000Z',
        updatedAt: Date.parse('2026-09-01T10:00:00.000Z')
      })
    }
  };
  const exactStaleRetry = await retryPendingSyncs();
  assert.deepStrictEqual(exactStaleRetry, { ok: true, pending: 0 });
  assertCounts(cloudDocument, 30, 40);

  // 9-10. Failed retries coalesce by wordbook, stay idempotent, and cannot regress on retry.
  resetHarness();
  cloudDocument = buildProgress({
    aCount: 10,
    bCount: 20,
    aTime: '2026-09-01T08:00:00.000Z',
    bTime: '2026-09-01T08:00:00.000Z',
    updatedAt: Date.parse('2026-09-01T08:00:00.000Z')
  });
  cloudWritable = false;
  const failedOne = await syncLearningProgress(STUDENT_ID, deviceOne);
  const failedTwo = await syncLearningProgress(STUDENT_ID, deviceTwo);
  assert.strictEqual(failedOne.ok, false);
  assert.strictEqual(failedTwo.ok, false);
  assert.strictEqual(Object.keys(storage.pendingLearningProgressSync).length, 1);
  assertCounts(storage.pendingLearningProgressSync[STUDENT_ID].progressData, 11, 21);
  cloudWritable = true;
  const convergedRetry = await retryPendingSyncs();
  assert.deepStrictEqual(convergedRetry, { ok: true, pending: 0 });
  assertCounts(cloudDocument, 11, 21);
  const writesAfterConvergence = writeCount;
  const emptyRetry = await retryPendingSyncs();
  assert.deepStrictEqual(emptyRetry, { ok: true, pending: 0 });
  assert.strictEqual(writeCount, writesAfterConvergence);

  // A newer pending replacement created while an older retry is in flight must survive cleanup.
  resetHarness();
  cloudWritable = false;
  await syncLearningProgress(STUDENT_ID, deviceOne);
  const oldPending = clone(storage.pendingLearningProgressSync[STUDENT_ID]);
  cloudWritable = true;
  afterSuccessfulSet = () => {
    storage.pendingLearningProgressSync[STUDENT_ID] = {
      studentId: STUDENT_ID,
      accountId: ACCOUNT_A,
      failedAt: oldPending.failedAt + 1,
      pendingVersion: oldPending.pendingVersion + 1,
      progressData: deviceTwo
    };
  };
  const retryWithReplacement = await retryPendingSyncs();
  assert.deepStrictEqual(retryWithReplacement, { ok: true, pending: 1 });
  assert.strictEqual(
    storage.pendingLearningProgressSync[STUDENT_ID].pendingVersion,
    oldPending.pendingVersion + 1
  );
  afterSuccessfulSet = null;
  const replacementRetry = await retryPendingSyncs();
  assert.deepStrictEqual(replacementRetry, { ok: true, pending: 0 });

  // 11. Account A and B pending payloads remain isolated and are removed independently.
  resetHarness(ACCOUNT_A);
  const accountBKey = `${STUDENT_ID}__account__${ACCOUNT_B}`;
  storage.pendingLearningProgressSync = {
    [STUDENT_ID]: {
      studentId: STUDENT_ID,
      accountId: ACCOUNT_A,
      failedAt: 1,
      pendingVersion: 1,
      progressData: deviceOne
    },
    [accountBKey]: {
      studentId: STUDENT_ID,
      accountId: ACCOUNT_B,
      failedAt: 1,
      pendingVersion: 1,
      progressData: deviceTwo
    }
  };
  const accountARetry = await retryPendingSyncs();
  assert.deepStrictEqual(accountARetry, { ok: true, pending: 0, retained: 1 });
  assert.ok(storage.pendingLearningProgressSync[accountBKey]);
  assert.strictEqual(storage.pendingLearningProgressSync[STUDENT_ID], undefined);
  storage.openid = ACCOUNT_B;
  const accountBRetry = await retryPendingSyncs();
  assert.deepStrictEqual(accountBRetry, { ok: true, pending: 0 });
  assert.strictEqual(cloudDocument.teacher_id, ACCOUNT_B);

  // 12. The same map helper used by Full Pull retains every student's wordbook keys.
  const fullPullMerged = mergeLearningProgressMap({
    [STUDENT_ID]: {
      wordbooks: {
        'book-a': buildBook(11, 100, '2026-09-01T09:00:00.000Z')
      }
    }
  }, {
    [STUDENT_ID]: {
      wordbooks: {
        'book-b': buildBook(21, 200, '2026-09-01T10:00:00.000Z')
      }
    }
  }, { useKnownWordbookTotals: false });
  assertCounts(fullPullMerged[STUDENT_ID], 11, 21);

  // A versioned incoming total can decrease when its per-book timestamp is newer.
  const newerReducedTotal = mergeLearningProgress({
    wordbooks: { catalog: buildBook(5, 100, '2026-09-01T08:00:00.000Z') }
  }, {
    wordbooks: { catalog: buildBook(5, 80, '2026-09-02T08:00:00.000Z') }
  }, { useKnownWordbookTotals: false });
  assert.strictEqual(newerReducedTotal.wordbooks.catalog.totalCount, 80);

  console.log('learning-progress-sync-merge: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
