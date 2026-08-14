'use strict';

const assert = require('assert');

const migrationPath = require.resolve('../utils/cloud-migration.js');
const accountSessionPath = require.resolve('../utils/account-session.js');
const loginPath = require.resolve('../utils/login-service.js');
const cloudSyncPath = require.resolve('../utils/cloud-sync.js');
const cloudModePath = require.resolve('../utils/cloud-mode.js');

const originalSetTimeout = global.setTimeout;
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

global.setTimeout = (callback) => {
  queueMicrotask(callback);
  return 0;
};
console.log = () => {};
console.warn = () => {};
console.error = () => {};

const SIX_COLLECTIONS = [
  'students',
  'learning_records',
  'learning_progress',
  'word_mastery',
  'student_statistics',
  'wordbook_statistics'
];
const REQUESTS_PER_PULL = 26;
const ACCOUNT_A = 'account-A';
const ACCOUNT_B = 'account-B';
const WORDBOOK_ID = 'book-main';

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

const flushMicrotasks = async (rounds = 16) => {
  for (let index = 0; index < rounds; index += 1) {
    await Promise.resolve();
  }
};

const clearModules = () => {
  [migrationPath, accountSessionPath, loginPath, cloudSyncPath, cloudModePath]
    .forEach((file) => { delete require.cache[file]; });
};

const buildAccountCollections = (accountId) => {
  const studentIds = Array.from({ length: 3 }, (_, index) => `${accountId}-student-${index}`);
  return {
    teachers: [{
      _id: `${accountId}-teacher`,
      teacher_id: accountId,
      name: accountId,
      userRole: 'external',
      memberLevel: 'free'
    }],
    students: studentIds.map((studentId, index) => ({
      _id: studentId,
      id: studentId,
      student_id: studentId,
      teacher_id: accountId,
      name: `${accountId} Student ${index}`,
      updatedAt: 100
    })),
    learning_records: Array.from({ length: 100 }, (_, index) => ({
      _id: `${accountId}-record-${String(index).padStart(3, '0')}`,
      id: `${accountId}-record-${String(index).padStart(3, '0')}`,
      teacher_id: accountId,
      studentId: studentIds[index % studentIds.length],
      wordbookId: WORDBOOK_ID,
      studyDate: `2026-08-${String((index % 20) + 1).padStart(2, '0')}T08:00:00.000Z`,
      updatedAt: 100 + index
    })),
    learning_progress: Array.from({ length: 30 }, (_, index) => ({
      _id: `${accountId}-progress-${String(index).padStart(2, '0')}`,
      teacher_id: accountId,
      student_id: studentIds[index % studentIds.length],
      learnedWords: index + 1,
      totalWords: 200,
      wordbooks: {},
      updatedAt: 100 + index
    })),
    word_mastery: Array.from({ length: 200 }, (_, index) => ({
      _id: `${accountId}-mastery-${String(index).padStart(3, '0')}`,
      teacher_id: accountId,
      student_id: studentIds[index % studentIds.length],
      wordbook_id: WORDBOOK_ID,
      word_id: `word-${String(index).padStart(3, '0')}`,
      mastered: index % 2 === 0,
      difficult: index % 2 !== 0,
      reviewCount: index % 5,
      updatedAt: 100 + index
    })),
    student_statistics: Array.from({ length: 10 }, (_, index) => ({
      _id: `${accountId}-student-stats-${index}`,
      teacher_id: accountId,
      student_id: studentIds[index % studentIds.length],
      updatedAt: 100 + index
    })),
    wordbook_statistics: Array.from({ length: 10 }, (_, index) => ({
      _id: `${accountId}-wordbook-stats-${index}`,
      teacher_id: accountId,
      student_id: studentIds[index % studentIds.length],
      wordbook_id: WORDBOOK_ID,
      updatedAt: 100 + index
    }))
  };
};

const combineCollections = (...sources) => {
  const result = {};
  ['teachers', ...SIX_COLLECTIONS].forEach((name) => {
    result[name] = sources.flatMap((source) => source[name] || []);
  });
  return result;
};

const createHarness = ({
  accountId = ACCOUNT_A,
  includeAccountB = false,
  heldStudentPulls = [],
  failCounts = {},
  initialStorage = {}
} = {}) => {
  const accountACollections = buildAccountCollections(ACCOUNT_A);
  const collections = includeAccountB
    ? combineCollections(accountACollections, buildAccountCollections(ACCOUNT_B))
    : combineCollections(accountACollections);
  const storage = {
    openid: accountId,
    currentUser: { id: accountId },
    students: [],
    learningRecords: [],
    learningProgress: {},
    wordMastery: {},
    ...initialStorage
  };
  const app = {
    globalData: { cloudReadOnly: true, currentUser: storage.currentUser },
    ensureUserPermissions: (user) => user,
    emit: (name) => events.push(name)
  };
  const events = [];
  const requestsByCollection = Object.fromEntries(SIX_COLLECTIONS.map((name) => [name, 0]));
  const attempts = Object.fromEntries(SIX_COLLECTIONS.map((name) => [name, 0]));
  const failureLimits = { ...failCounts };
  const studentGates = new Map(heldStudentPulls.map((ordinal) => [ordinal, deferred()]));
  const studentStartWaiters = [];
  let studentPullStarts = 0;
  let teacherReads = 0;

  const notifyStudentStart = () => {
    studentStartWaiters.slice().forEach((waiter) => {
      if (studentPullStarts >= waiter.target) {
        waiter.resolve();
        studentStartWaiters.splice(studentStartWaiters.indexOf(waiter), 1);
      }
    });
  };

  const createQuery = (collectionName, sourceItems) => {
    let items = sourceItems.slice();
    let offset = 0;
    let limit = items.length;
    const query = {
      count: async () => {
        if (SIX_COLLECTIONS.includes(collectionName)) {
          requestsByCollection[collectionName] += 1;
          attempts[collectionName] += 1;
          if (collectionName === 'students') {
            studentPullStarts += 1;
            notifyStudentStart();
            const gate = studentGates.get(studentPullStarts);
            if (gate) await gate.promise;
          }
          if (attempts[collectionName] <= Number(failureLimits[collectionName] || 0)) {
            throw new Error(`${collectionName}_unavailable`);
          }
        }
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
      skip(value) { offset = value; return query; },
      limit(value) { limit = value; return query; },
      get: async () => {
        if (collectionName === 'teachers') teacherReads += 1;
        if (SIX_COLLECTIONS.includes(collectionName)) {
          requestsByCollection[collectionName] += 1;
        }
        return { data: items.slice(offset, offset + limit) };
      }
    };
    return query;
  };

  const db = {
    collection(name) {
      const source = collections[name] || [];
      return {
        where(condition) {
          const filtered = source.filter((item) => Object.keys(condition).every(
            (key) => item[key] === condition[key]
          ));
          return createQuery(name, filtered);
        },
        add() { throw new Error('cloud write forbidden in full-pull test'); },
        doc() {
          return {
            set() { throw new Error('cloud write forbidden in full-pull test'); },
            update() { throw new Error('cloud write forbidden in full-pull test'); }
          };
        }
      };
    }
  };

  global.wx = {
    cloud: { init: () => {}, database: () => db },
    getDeviceInfo: () => ({ platform: 'devtools' }),
    getLaunchOptionsSync: () => ({ query: {} }),
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => { storage[key] = value; },
    removeStorageSync: (key) => { delete storage[key]; }
  };
  global.getApp = () => app;

  return {
    app,
    attempts,
    collections,
    events,
    failureLimits,
    requestsByCollection,
    storage,
    get requestCount() {
      return Object.values(requestsByCollection).reduce((sum, value) => sum + value, 0);
    },
    get studentPullStarts() { return studentPullStarts; },
    get teacherReads() { return teacherReads; },
    waitForStudentStarts(target) {
      if (studentPullStarts >= target) return Promise.resolve();
      return new Promise((resolve) => studentStartWaiters.push({ target, resolve }));
    },
    releaseStudentPull(ordinal) {
      const gate = studentGates.get(ordinal);
      if (gate) gate.resolve();
    },
    switchAccount(nextAccountId) {
      storage.openid = nextAccountId;
      storage.currentUser = { id: nextAccountId };
      storage.students = [];
      storage.learningRecords = [];
      storage.learningProgress = {};
      storage.wordMastery = {};
      delete storage.currentStudent;
      delete storage.currentWordbook;
      app.globalData.currentUser = storage.currentUser;
      delete app.globalData.currentStudent;
      delete app.globalData.currentWordbook;
    }
  };
};

const loadPull = (harness) => {
  clearModules();
  global.getApp = () => harness.app;
  return require(migrationPath).syncDataFromCloud;
};

const assertSingleEventRound = (events) => {
  assert.strictEqual(events.filter((name) => name === 'wordMasteryUpdated').length, 1);
  assert.strictEqual(events.filter((name) => name === 'learningRecordAdded').length, 1);
};

async function testTwoAndThreeSameSessionCallers() {
  const two = createHarness({ heldStudentPulls: [1] });
  const syncTwo = loadPull(two);
  const first = syncTwo(ACCOUNT_A);
  await two.waitForStudentStarts(1);
  const second = syncTwo(ACCOUNT_A);
  await flushMicrotasks();
  two.releaseStudentPull(1);
  const [firstResult, secondResult] = await Promise.all([first, second]);

  assert.strictEqual(
    two.requestCount,
    REQUESTS_PER_PULL,
    'two concurrent callers must reduce the six-collection request model from 52 to 26'
  );
  assert.strictEqual(two.teacherReads, 1, 'only one real full pull may pass the teacher-read stage');
  assert.strictEqual(first, second, 'same account and generation must share the exact flight promise');
  assert.strictEqual(firstResult, secondResult, 'shared callers must observe the same result object');
  assert.strictEqual(firstResult.success, true);
  assert.strictEqual(firstResult.cloudSnapshot.students.length, 3);
  assert.strictEqual(firstResult.cloudSnapshot.learningRecords.length, 100);
  assert.strictEqual(Object.keys(firstResult.cloudSnapshot.learningProgress).length, 3);
  assert.strictEqual(Object.keys(firstResult.cloudSnapshot.wordMastery).length, 3);
  assertSingleEventRound(two.events);

  const three = createHarness({ heldStudentPulls: [1] });
  const syncThree = loadPull(three);
  const callers = [syncThree(ACCOUNT_A)];
  await three.waitForStudentStarts(1);
  callers.push(syncThree(ACCOUNT_A), syncThree(ACCOUNT_A));
  await flushMicrotasks();
  three.releaseStudentPull(1);
  const results = await Promise.all(callers);
  assert.strictEqual(three.requestCount, REQUESTS_PER_PULL, 'three callers must still start one real pull');
  assert.strictEqual(three.teacherReads, 1);
  assert.ok(callers.every((promise) => promise === callers[0]));
  assert.ok(results.every((result) => result === results[0]));
  assertSingleEventRound(three.events);
}

async function testCompletedPullHasNoFreshnessCache() {
  const harness = createHarness();
  const syncDataFromCloud = loadPull(harness);
  const first = await syncDataFromCloud(ACCOUNT_A);
  const second = await syncDataFromCloud(ACCOUNT_A);
  assert.strictEqual(first.success, true);
  assert.strictEqual(second.success, true);
  assert.notStrictEqual(first, second, 'a completed result must not be retained as a freshness cache');
  assert.strictEqual(harness.teacherReads, 2);
  assert.strictEqual(harness.requestCount, REQUESTS_PER_PULL * 2);
  assert.strictEqual(harness.events.filter((name) => name === 'wordMasteryUpdated').length, 2);
  assert.strictEqual(harness.events.filter((name) => name === 'learningRecordAdded').length, 2);
}

async function testDifferentAccountsDoNotShare() {
  const harness = createHarness({ includeAccountB: true, heldStudentPulls: [1, 2] });
  const syncDataFromCloud = loadPull(harness);
  const accountA = syncDataFromCloud(ACCOUNT_A);
  await harness.waitForStudentStarts(1);
  harness.switchAccount(ACCOUNT_B);
  const accountB = syncDataFromCloud(ACCOUNT_B);
  await harness.waitForStudentStarts(2);
  harness.releaseStudentPull(1);
  harness.releaseStudentPull(2);
  const [resultA, resultB] = await Promise.all([accountA, accountB]);

  assert.notStrictEqual(accountA, accountB);
  assert.strictEqual(harness.teacherReads, 2);
  assert.strictEqual(harness.requestCount, REQUESTS_PER_PULL * 2);
  assert.strictEqual(resultA.stale, true);
  assert.strictEqual(resultB.success, true);
  assert.ok(resultB.cloudSnapshot.students.every((student) => student.ownerId === ACCOUNT_B));
  assertSingleEventRound(harness.events);
}

async function testGenerationAndOldFinallyIsolation() {
  const harness = createHarness({ heldStudentPulls: [1, 2] });
  const syncDataFromCloud = loadPull(harness);
  const oldFlight = syncDataFromCloud(ACCOUNT_A);
  await harness.waitForStudentStarts(1);

  require(accountSessionPath).invalidateAccountSession();
  const newFlight = syncDataFromCloud(ACCOUNT_A);
  await harness.waitForStudentStarts(2);
  assert.notStrictEqual(oldFlight, newFlight, 'a new generation must create a new flight');

  harness.releaseStudentPull(1);
  const oldResult = await oldFlight;
  assert.strictEqual(oldResult.stale, true);

  const joinedAfterOldFinally = syncDataFromCloud(ACCOUNT_A);
  assert.strictEqual(
    joinedAfterOldFinally,
    newFlight,
    'old finally must not clear the still-running new-generation flight'
  );
  harness.releaseStudentPull(2);
  const [newResult, joinedResult] = await Promise.all([newFlight, joinedAfterOldFinally]);
  assert.strictEqual(newResult.success, true);
  assert.strictEqual(joinedResult, newResult);
  assert.strictEqual(harness.teacherReads, 2);
  assert.strictEqual(harness.requestCount, REQUESTS_PER_PULL * 2);
  assertSingleEventRound(harness.events);
}

async function testLogoutMakesOldPullStaleWithoutCancellingReads() {
  const harness = createHarness({ heldStudentPulls: [1] });
  const syncDataFromCloud = loadPull(harness);
  const flight = syncDataFromCloud(ACCOUNT_A);
  await harness.waitForStudentStarts(1);
  require(accountSessionPath).invalidateAccountSession();
  delete harness.storage.openid;
  harness.releaseStudentPull(1);
  const result = await flight;

  assert.strictEqual(result.stale, true);
  assert.strictEqual(harness.requestCount, REQUESTS_PER_PULL, 'logout must not cancel shared cloud reads');
  assert.deepStrictEqual(harness.events, []);
}

async function testSharedCoreFailureAndRetry() {
  const harness = createHarness({ failCounts: { learning_records: 3 } });
  const syncDataFromCloud = loadPull(harness);
  const first = syncDataFromCloud(ACCOUNT_A);
  const second = syncDataFromCloud(ACCOUNT_A);
  const [firstResult, secondResult] = await Promise.all([first, second]);

  assert.strictEqual(first, second);
  assert.strictEqual(firstResult, secondResult);
  assert.match(firstResult.error, /learning_records_unavailable/);
  assert.strictEqual(harness.attempts.learning_records, 3, 'shared failure must run one retry sequence, not two');
  assert.deepStrictEqual(harness.events, []);

  harness.failureLimits.learning_records = 0;
  const retryResult = await syncDataFromCloud(ACCOUNT_A);
  assert.strictEqual(retryResult.success, true, 'a failed flight must be removed so the next caller can retry');
  assert.strictEqual(harness.teacherReads, 2);
  assertSingleEventRound(harness.events);
}

const loadLoginServiceForHarness = (harness, migrationOverride) => {
  const migration = require(migrationPath);
  if (migrationOverride) migration.migrateLocalDataToCloud = migrationOverride;
  const cloudSync = require(cloudSyncPath);
  cloudSync.retryPendingSyncs = () => Promise.resolve({ ok: true, pending: 0 });
  delete require.cache[loginPath];
  return require(loginPath);
};

async function testRealEntryCombinationsAndMigrationCoverage() {
  const combinations = [
    ['Splash + stats', true],
    ['Splash + student-list', true],
    ['stats + student-list', false]
  ];

  for (const [label, includeLogin] of combinations) {
    const harness = createHarness({ heldStudentPulls: [1] });
    const syncDataFromCloud = loadPull(harness);
    const loginService = includeLogin ? loadLoginServiceForHarness(harness) : null;
    const first = includeLogin ? loginService.doSilentLogin() : syncDataFromCloud(ACCOUNT_A);
    await harness.waitForStudentStarts(1);
    const second = syncDataFromCloud(ACCOUNT_A);
    await flushMicrotasks();
    harness.releaseStudentPull(1);
    const [firstResult, secondResult] = await Promise.all([first, second]);
    assert.strictEqual(firstResult.ok === true || firstResult.success === true, true, `${label} first caller failed`);
    assert.strictEqual(secondResult.success, true, `${label} direct caller failed`);
    assert.strictEqual(harness.requestCount, REQUESTS_PER_PULL, `${label} must share one six-collection pull`);
    assertSingleEventRound(harness.events);
  }

  const localStudent = {
    id: `${ACCOUNT_A}-student-0`,
    student_id: `${ACCOUNT_A}-student-0`,
    ownerId: ACCOUNT_A,
    name: `${ACCOUNT_A} Student 0`,
    updatedAt: 100
  };
  const coverage = createHarness({
    heldStudentPulls: [1],
    initialStorage: { students: [localStudent] }
  });
  const syncCoverage = loadPull(coverage);
  let migrationCalls = 0;
  const coverageLogin = loadLoginServiceForHarness(coverage, () => {
    migrationCalls += 1;
    return Promise.resolve({ success: true });
  });
  const loginFlight = coverageLogin.doSilentLogin();
  await coverage.waitForStudentStarts(1);
  const sharedDirect = syncCoverage(ACCOUNT_A);
  coverage.releaseStudentPull(1);
  const [loginResult, directResult] = await Promise.all([loginFlight, sharedDirect]);

  assert.strictEqual(loginResult.ok, true);
  assert.strictEqual(directResult.success, true);
  assert.strictEqual(migrationCalls, 0, 'shared cloudSnapshot coverage must prevent duplicate migration');
  assert.strictEqual(
    coverage.storage.cloudMigrationStateByOpenId[ACCOUNT_A].source,
    'cloud_reconciled'
  );
  assert.strictEqual(coverage.requestCount, REQUESTS_PER_PULL);
}

(async () => {
  await testTwoAndThreeSameSessionCallers();
  await testCompletedPullHasNoFreshnessCache();
  await testDifferentAccountsDoNotShare();
  await testGenerationAndOldFinallyIsolation();
  await testLogoutMakesOldPullStaleWithoutCancellingReads();
  await testSharedCoreFailureAndRetry();
  await testRealEntryCombinationsAndMigrationCoverage();
  originalLog('full-pull-single-flight: PASS');
})().catch((error) => {
  originalError(error);
  process.exitCode = 1;
}).finally(() => {
  global.setTimeout = originalSetTimeout;
  console.log = originalLog;
  console.warn = originalWarn;
  console.error = originalError;
});
