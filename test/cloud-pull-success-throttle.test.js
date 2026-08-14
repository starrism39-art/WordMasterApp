'use strict';

const assert = require('assert');

const PAGE_SIZE = 20;
const ACCOUNT_A = 'account-throttle-A';
const ACCOUNT_B = 'account-throttle-B';
const PULL_COLLECTIONS = [
  'students',
  'learning_records',
  'learning_progress',
  'word_mastery',
  'student_statistics',
  'wordbook_statistics'
];
const originalSetTimeout = global.setTimeout;
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = () => {};
console.warn = () => {};
console.error = () => {};

const makeMasteryDocs = (count) => Array.from({ length: count }, (_, index) => ({
  _id: `mastery-${String(index).padStart(5, '0')}`,
  teacher_id: ACCOUNT_A,
  student_id: 'student-throttle',
  wordbook_id: 'book-throttle',
  word_id: `word-${String(index).padStart(5, '0')}`,
  mastered: index % 2 === 0,
  difficult: index % 2 !== 0,
  reviewCount: 0,
  updatedAt: '2026-08-14T00:00:00.000Z'
}));

const createHarness = ({
  masteryCount = 0,
  studentCount = 0,
  retryCollection = '',
  failuresBeforeSuccess = 0,
  retryMessage = 'temporary network error',
  switchAccountOnFirstMasteryPage = false
} = {}) => {
  const storage = {
    openid: ACCOUNT_A,
    currentUser: { id: ACCOUNT_A, username: ACCOUNT_A },
    students: [],
    learningRecords: [],
    learningProgress: {},
    wordMastery: {}
  };
  const app = {
    globalData: {
      cloudReadOnly: true,
      currentUser: storage.currentUser
    },
    ensureUserPermissions: (user) => user,
    emit: () => {}
  };
  const collections = {
    teachers: [{
      _id: 'teacher-A',
      teacher_id: ACCOUNT_A,
      userRole: 'external',
      memberLevel: 'free'
    }],
    students: Array.from({ length: studentCount }, (_, index) => ({
      _id: `student-${index}`,
      id: `student-${index}`,
      student_id: `student-${index}`,
      teacher_id: ACCOUNT_A,
      name: `Student ${index}`
    })),
    learning_records: [],
    learning_progress: [],
    word_mastery: makeMasteryDocs(masteryCount),
    student_statistics: [],
    wordbook_statistics: []
  };
  const delays = [];
  const countOrder = [];
  const pageOffsets = {};
  const pageAttempts = {};
  const storageWrites = [];
  let accountSwitched = false;
  let cloudWriteCount = 0;

  const createQuery = (name, sourceItems) => {
    let items = sourceItems.slice();
    let offset = 0;
    let limit = PAGE_SIZE;
    const query = {
      count: async () => {
        countOrder.push(name);
        return { total: items.length };
      },
      orderBy(field, direction) {
        items = items.slice().sort((left, right) => {
          const leftValue = String(left[field] || '');
          const rightValue = String(right[field] || '');
          return direction === 'desc'
            ? rightValue.localeCompare(leftValue)
            : leftValue.localeCompare(rightValue);
        });
        return query;
      },
      skip(value) {
        offset = value;
        return query;
      },
      limit(value) {
        limit = value;
        return query;
      },
      get: async () => {
        if (PULL_COLLECTIONS.includes(name)) {
          pageOffsets[name] = pageOffsets[name] || [];
          pageOffsets[name].push(offset);
          pageAttempts[name] = (pageAttempts[name] || 0) + 1;

          if (name === retryCollection && pageAttempts[name] <= failuresBeforeSuccess) {
            throw new Error(retryMessage);
          }
        }

        const data = items.slice(offset, offset + limit);
        if (
          name === 'word_mastery' &&
          offset === 0 &&
          switchAccountOnFirstMasteryPage &&
          !accountSwitched
        ) {
          accountSwitched = true;
          storage.openid = ACCOUNT_B;
          storage.currentUser = { id: ACCOUNT_B, username: ACCOUNT_B };
          app.globalData.currentUser = storage.currentUser;
        }
        return { data };
      }
    };
    return query;
  };

  const db = {
    collection(name) {
      const items = collections[name] || [];
      return {
        where(condition) {
          const filtered = items.filter((item) => Object.keys(condition).every(
            (key) => item[key] === condition[key]
          ));
          return createQuery(name, filtered);
        },
        add() {
          cloudWriteCount += 1;
          throw new Error('cloud writes are forbidden in throttle tests');
        },
        doc() {
          return {
            set() {
              cloudWriteCount += 1;
              throw new Error('cloud writes are forbidden in throttle tests');
            },
            update() {
              cloudWriteCount += 1;
              throw new Error('cloud writes are forbidden in throttle tests');
            }
          };
        }
      };
    }
  };

  global.setTimeout = (callback, milliseconds) => {
    delays.push(milliseconds);
    callback();
    return delays.length;
  };
  global.wx = {
    cloud: {
      init: () => {},
      database: () => db
    },
    getDeviceInfo: () => ({ platform: 'devtools' }),
    getLaunchOptionsSync: () => ({ query: {} }),
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => {
      storageWrites.push({ key, accountId: storage.openid });
      storage[key] = value;
    },
    removeStorageSync: (key) => { delete storage[key]; }
  };
  global.getApp = () => app;

  return {
    storage,
    app,
    delays,
    countOrder,
    pageOffsets,
    pageAttempts,
    storageWrites,
    get accountSwitched() { return accountSwitched; },
    get cloudWriteCount() { return cloudWriteCount; }
  };
};

const runPull = async (options) => {
  const harness = createHarness(options);
  const { syncDataFromCloud } = require('../utils/cloud-migration.js');
  const result = await syncDataFromCloud(ACCOUNT_A);
  return { harness, result };
};

const assertSuccessfulPagination = async (documentCount) => {
  const { harness, result } = await runPull({ masteryCount: documentCount });
  assert.strictEqual(result.success, true);
  assert.strictEqual(harness.cloudWriteCount, 0);
  assert.deepStrictEqual(harness.countOrder, PULL_COLLECTIONS);
  assert.deepStrictEqual(
    harness.pageOffsets.word_mastery,
    Array.from({ length: documentCount / PAGE_SIZE }, (_, index) => index * PAGE_SIZE)
  );
  assert.strictEqual(
    Object.keys(harness.storage.wordMastery['student-throttle']['book-throttle']).length,
    documentCount,
    'all paged documents must reach the local in-memory result'
  );

  assert.deepStrictEqual(
    harness.delays,
    [],
    'successful pagination must continue without a fixed inter-page delay'
  );
};

(async () => {
  await assertSuccessfulPagination(100);
  await assertSuccessfulPagination(1000);
  await assertSuccessfulPagination(4000);

  const normalRetry = await runPull({
    studentCount: 1,
    retryCollection: 'students',
    failuresBeforeSuccess: 2,
    retryMessage: 'temporary network error'
  });
  assert.strictEqual(normalRetry.result.success, true);
  assert.strictEqual(normalRetry.harness.pageAttempts.students, 3);
  assert.deepStrictEqual(normalRetry.harness.delays, [1000, 2000]);

  const rateLimitRetry = await runPull({
    studentCount: 1,
    retryCollection: 'students',
    failuresBeforeSuccess: 2,
    retryMessage: '-405015 exceed max client request count'
  });
  assert.strictEqual(rateLimitRetry.result.success, true);
  assert.strictEqual(rateLimitRetry.harness.pageAttempts.students, 3);
  assert.deepStrictEqual(rateLimitRetry.harness.delays, [5000, 10000]);

  const exhaustedRetry = await runPull({
    studentCount: 1,
    retryCollection: 'students',
    failuresBeforeSuccess: Number.POSITIVE_INFINITY,
    retryMessage: 'temporary network error'
  });
  assert.match(exhaustedRetry.result.error, /temporary network error/);
  assert.strictEqual(exhaustedRetry.harness.pageAttempts.students, 3);
  assert.deepStrictEqual(exhaustedRetry.harness.delays, [1000, 2000]);

  const staleAccount = await runPull({
    masteryCount: 100,
    switchAccountOnFirstMasteryPage: true
  });
  assert.strictEqual(staleAccount.harness.accountSwitched, true);
  assert.strictEqual(staleAccount.result.stale, true);
  assert.strictEqual(staleAccount.result.reason, 'account_session_changed');
  assert.strictEqual(staleAccount.harness.pageOffsets.word_mastery.length, 5);
  assert.strictEqual(staleAccount.harness.storage.openid, ACCOUNT_B);
  assert.strictEqual(staleAccount.harness.storage.currentUser.id, ACCOUNT_B);
  assert.strictEqual(
    staleAccount.harness.storageWrites.filter((write) => write.accountId === ACCOUNT_B).length,
    0,
    'a stale account pull may finish reading but must not commit into the new account'
  );
  assert.strictEqual(staleAccount.harness.cloudWriteCount, 0);

  originalLog('cloud-pull-success-throttle: PASS');
})().catch((error) => {
  originalError(error);
  process.exitCode = 1;
}).finally(() => {
  global.setTimeout = originalSetTimeout;
  console.log = originalLog;
  console.warn = originalWarn;
  console.error = originalError;
});
