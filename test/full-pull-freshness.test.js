'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const migrationPath = require.resolve('../utils/cloud-migration.js');
const accountSessionPath = require.resolve('../utils/account-session.js');
const loginPath = require.resolve('../utils/login-service.js');
const cloudSyncPath = require.resolve('../utils/cloud-sync.js');
const cloudModePath = require.resolve('../utils/cloud-mode.js');
const migrationStatePath = require.resolve('../utils/cloud-migration-state.js');
const statsEnginePath = require.resolve('../utils/stats-engine.js');
const learningContextPath = require.resolve('../utils/learning-context.js');
const learningProgressPath = require.resolve('../utils/learning-progress.js');

const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;
const originalDateNow = Date.now;
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

class FakeClock {
  constructor() {
    this.reset();
  }

  reset() {
    this.now = 0;
    this.nextId = 1;
    this.timers = new Map();
  }

  setTimeout(callback, delayMs) {
    const id = this.nextId;
    this.nextId += 1;
    this.timers.set(id, {
      callback,
      dueAt: this.now + Math.max(0, Number(delayMs) || 0)
    });
    return id;
  }

  clearTimeout(id) {
    this.timers.delete(id);
  }

  nextDueAt() {
    let next = null;
    this.timers.forEach((timer) => {
      if (next === null || timer.dueAt < next) next = timer.dueAt;
    });
    return next;
  }

  advanceTo(targetTime) {
    const target = Math.max(this.now, Number(targetTime) || 0);
    while (true) {
      let nextId = null;
      let nextTimer = null;
      this.timers.forEach((timer, id) => {
        if (timer.dueAt <= target && (!nextTimer || timer.dueAt < nextTimer.dueAt)) {
          nextId = id;
          nextTimer = timer;
        }
      });
      if (!nextTimer) break;
      this.now = nextTimer.dueAt;
      this.timers.delete(nextId);
      nextTimer.callback();
    }
    this.now = target;
  }

  advanceBy(milliseconds) {
    this.advanceTo(this.now + milliseconds);
  }
}

const clock = new FakeClock();
global.setTimeout = (callback, delayMs) => clock.setTimeout(callback, delayMs);
global.clearTimeout = (id) => clock.clearTimeout(id);
Date.now = () => clock.now;
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

const flushMicrotasks = async (rounds = 24) => {
  for (let index = 0; index < rounds; index += 1) {
    await Promise.resolve();
  }
};

const settleWithClock = async (promise) => {
  let settled = false;
  let value;
  let error;
  promise.then((result) => {
    settled = true;
    value = result;
  }, (reason) => {
    settled = true;
    error = reason;
  });

  for (let index = 0; index < 24 && !settled; index += 1) {
    await flushMicrotasks();
    if (settled) break;
    const nextDueAt = clock.nextDueAt();
    assert.notStrictEqual(nextDueAt, null, 'promise did not settle and no fake timer can advance it');
    clock.advanceTo(nextDueAt);
  }
  await flushMicrotasks();
  if (error) throw error;
  assert.strictEqual(settled, true, 'promise did not settle within the fake-clock budget');
  return value;
};

const MODULES_TO_CLEAR = [
  migrationPath,
  accountSessionPath,
  loginPath,
  cloudSyncPath,
  cloudModePath,
  migrationStatePath,
  statsEnginePath,
  learningContextPath,
  learningProgressPath
];

const clearModules = () => {
  MODULES_TO_CLEAR.forEach((file) => { delete require.cache[file]; });
};

const resetRuntime = () => {
  clock.reset();
  clearModules();
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
  const events = [];
  const app = {
    globalData: { cloudReadOnly: true, currentUser: storage.currentUser },
    ensureUserPermissions: (user) => user,
    emit: (name) => events.push(name)
  };
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
        add() { throw new Error('cloud write forbidden in freshness test'); },
        doc() {
          return {
            set() { throw new Error('cloud write forbidden in freshness test'); },
            update() { throw new Error('cloud write forbidden in freshness test'); }
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
    events,
    failureLimits,
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

const assertOneEventRound = (events) => {
  assert.strictEqual(events.filter((name) => name === 'wordMasteryUpdated').length, 1);
  assert.strictEqual(events.filter((name) => name === 'learningRecordAdded').length, 1);
};

async function testShortWindowRequestCountsAndContract() {
  resetRuntime();
  const harness = createHarness();
  const syncDataFromCloud = loadPull(harness);
  const networkResult = await syncDataFromCloud(ACCOUNT_A);
  assert.strictEqual(harness.requestCount, REQUESTS_PER_PULL);

  clock.advanceBy(3000);
  const statsResult = await syncDataFromCloud(ACCOUNT_A, { allowFreshness: true });
  assert.strictEqual(harness.requestCount, REQUESTS_PER_PULL, '3-second stats refresh must add zero reads');
  assert.strictEqual(statsResult, networkResult, 'freshness must retain the exact complete result object');
  assert.strictEqual(statsResult.success, true);
  assert.deepStrictEqual(Object.keys(statsResult), ['success', 'counts', 'cloudSnapshot', 'context']);
  assert.strictEqual(statsResult.cloudSnapshot.students.length, 3);
  assert.strictEqual(statsResult.cloudSnapshot.learningRecords.length, 100);

  clock.advanceBy(1000);
  const studentListResult = await syncDataFromCloud(ACCOUNT_A, { allowFreshness: true });
  assert.strictEqual(studentListResult, networkResult);
  assert.strictEqual(harness.requestCount, REQUESTS_PER_PULL, 'stats then student-list must stay at 26 requests');
  assertOneEventRound(harness.events);
}

async function testBoundaryExpiryAndFreshnessReset() {
  resetRuntime();
  const boundaryHarness = createHarness();
  const boundarySync = loadPull(boundaryHarness);
  await boundarySync(ACCOUNT_A);
  clock.advanceBy(5000);
  await boundarySync(ACCOUNT_A, { allowFreshness: true });
  assert.strictEqual(boundaryHarness.requestCount, REQUESTS_PER_PULL * 2, 'exactly 5 seconds must be expired');

  resetRuntime();
  const expiryHarness = createHarness();
  const expirySync = loadPull(expiryHarness);
  await expirySync(ACCOUNT_A);
  clock.advanceBy(6000);
  await expirySync(ACCOUNT_A, { allowFreshness: true });
  assert.strictEqual(expiryHarness.requestCount, REQUESTS_PER_PULL * 2, '6-second refresh must pull again');

  resetRuntime();
  const resetHarness = createHarness();
  const resetSync = loadPull(resetHarness);
  await resetSync(ACCOUNT_A);
  clock.advanceBy(3000);
  await resetSync(ACCOUNT_A);
  assert.strictEqual(resetHarness.requestCount, REQUESTS_PER_PULL * 2, 'default caller must bypass freshness');
  clock.advanceBy(4000);
  await resetSync(ACCOUNT_A, { allowFreshness: true });
  assert.strictEqual(resetHarness.requestCount, REQUESTS_PER_PULL * 2, 'new successful pull must restart the TTL');
}

async function testAccountGenerationLogoutAndRestartIsolation() {
  resetRuntime();
  const accountHarness = createHarness({ includeAccountB: true });
  const accountSync = loadPull(accountHarness);
  await accountSync(ACCOUNT_A);
  clock.advanceBy(2000);
  accountHarness.switchAccount(ACCOUNT_B);
  const accountBResult = await accountSync(ACCOUNT_B, { allowFreshness: true });
  assert.strictEqual(accountBResult.success, true);
  assert.strictEqual(accountHarness.requestCount, REQUESTS_PER_PULL * 2, 'B must not use A freshness');

  resetRuntime();
  const generationHarness = createHarness();
  const generationSync = loadPull(generationHarness);
  await generationSync(ACCOUNT_A);
  require(accountSessionPath).invalidateAccountSession();
  await generationSync(ACCOUNT_A, { allowFreshness: true });
  assert.strictEqual(generationHarness.requestCount, REQUESTS_PER_PULL * 2, 'new generation must not use old freshness');

  resetRuntime();
  const logoutHarness = createHarness();
  const logoutSync = loadPull(logoutHarness);
  const oldResult = await logoutSync(ACCOUNT_A);
  require(accountSessionPath).invalidateAccountSession();
  delete logoutHarness.storage.openid;
  const afterLogout = await logoutSync(ACCOUNT_A, { allowFreshness: true });
  assert.notStrictEqual(afterLogout, oldResult, 'logout must invalidate the old freshness key');
  assert.strictEqual(afterLogout.stale, true);

  resetRuntime();
  const restartHarness = createHarness();
  let restartSync = loadPull(restartHarness);
  await restartSync(ACCOUNT_A);
  restartSync = loadPull(restartHarness);
  await restartSync(ACCOUNT_A, { allowFreshness: true });
  assert.strictEqual(restartHarness.requestCount, REQUESTS_PER_PULL * 2, 'module/App restart must lose memory freshness');
}

async function testFailedStaleAndOptionalResults() {
  resetRuntime();
  const failedHarness = createHarness({ failCounts: { learning_records: 3 } });
  const failedSync = loadPull(failedHarness);
  const failedResult = await settleWithClock(failedSync(ACCOUNT_A));
  assert.match(failedResult.error, /learning_records_unavailable/);
  const startsAfterFailure = failedHarness.studentPullStarts;
  failedHarness.failureLimits.learning_records = 0;
  const retryResult = await failedSync(ACCOUNT_A, { allowFreshness: true });
  assert.strictEqual(retryResult.success, true, 'failed full pull must not establish freshness');
  assert.ok(failedHarness.studentPullStarts > startsAfterFailure);

  resetRuntime();
  const staleHarness = createHarness({ heldStudentPulls: [1] });
  const staleSync = loadPull(staleHarness);
  const staleFlight = staleSync(ACCOUNT_A);
  await staleHarness.waitForStudentStarts(1);
  require(accountSessionPath).invalidateAccountSession();
  staleHarness.releaseStudentPull(1);
  const staleResult = await staleFlight;
  assert.strictEqual(staleResult.stale, true);
  const startsAfterStale = staleHarness.studentPullStarts;
  const currentResult = await staleSync(ACCOUNT_A, { allowFreshness: true });
  assert.strictEqual(currentResult.success, true, 'stale full pull must not establish freshness');
  assert.ok(staleHarness.studentPullStarts > startsAfterStale);

  resetRuntime();
  const optionalHarness = createHarness({ failCounts: { student_statistics: 3 } });
  const optionalSync = loadPull(optionalHarness);
  const optionalResult = await settleWithClock(optionalSync(ACCOUNT_A));
  assert.strictEqual(optionalResult.success, true, 'optional stats failure must retain the existing success semantics');
  const requestsAfterOptional = optionalHarness.requestCount;
  clock.advanceBy(3000);
  const optionalFresh = await optionalSync(ACCOUNT_A, { allowFreshness: true });
  assert.strictEqual(optionalFresh, optionalResult);
  assert.strictEqual(optionalHarness.requestCount, requestsAfterOptional);
}

async function testInflightPrecedesOldFreshness() {
  resetRuntime();
  const harness = createHarness({ heldStudentPulls: [2] });
  const syncDataFromCloud = loadPull(harness);
  const oldFreshResult = await syncDataFromCloud(ACCOUNT_A);
  clock.advanceBy(1000);

  const forcedFlight = syncDataFromCloud(ACCOUNT_A);
  await harness.waitForStudentStarts(2);
  const pageCallerB = syncDataFromCloud(ACCOUNT_A, { allowFreshness: true });
  const pageCallerC = syncDataFromCloud(ACCOUNT_A, { allowFreshness: true });
  assert.strictEqual(pageCallerB, forcedFlight);
  assert.strictEqual(pageCallerC, forcedFlight);
  assert.notStrictEqual(pageCallerB, Promise.resolve(oldFreshResult));
  harness.releaseStudentPull(2);
  const [forcedResult, resultB, resultC] = await Promise.all([forcedFlight, pageCallerB, pageCallerC]);
  assert.strictEqual(resultB, forcedResult);
  assert.strictEqual(resultC, forcedResult);
  assert.strictEqual(harness.requestCount, REQUESTS_PER_PULL * 2);
  assert.strictEqual(harness.events.filter((name) => name === 'wordMasteryUpdated').length, 2);
  assert.strictEqual(harness.events.filter((name) => name === 'learningRecordAdded').length, 2);
}

async function testSilentLoginBypassesPageFreshnessAndMigrationStillRuns() {
  resetRuntime();
  const harness = createHarness();
  const syncDataFromCloud = loadPull(harness);
  await syncDataFromCloud(ACCOUNT_A);
  clock.advanceBy(2000);

  const cloudSync = require(cloudSyncPath);
  cloudSync.retryPendingSyncs = () => Promise.resolve({ ok: true, pending: 0 });
  delete require.cache[loginPath];
  const loginService = require(loginPath);
  const loginResult = await loginService.doSilentLogin();
  assert.strictEqual(loginResult.ok, true);
  assert.strictEqual(harness.requestCount, REQUESTS_PER_PULL * 2, 'doSilentLogin must perform a new real full pull');
  assert.strictEqual(harness.teacherReads, 2);
  assert.strictEqual(
    harness.storage.cloudMigrationStateByOpenId[ACCOUNT_A].source,
    'cloud_reconciled',
    'migration marker must remain account-scoped after the real login pull'
  );
}

function testOnlyImplicitPageCallersOptIn() {
  const statsSource = fs.readFileSync(path.resolve(__dirname, '../subpages/stats/stats.js'), 'utf8');
  const studentListSource = fs.readFileSync(path.resolve(__dirname, '../subpages/student-list/student-list.js'), 'utf8');
  const loginSource = fs.readFileSync(path.resolve(__dirname, '../utils/login-service.js'), 'utf8');
  const learningSource = fs.readFileSync(path.resolve(__dirname, '../pages/learning/learning.js'), 'utf8');
  const reviewSource = fs.readFileSync(path.resolve(__dirname, '../pages/review/review.js'), 'utf8');

  assert.match(statsSource, /syncDataFromCloud\(openid,\s*\{\s*allowFreshness:\s*true\s*\}\)/);
  assert.match(studentListSource, /syncDataFromCloud\(openid,\s*\{\s*allowFreshness:\s*true\s*\}\)/);
  assert.match(loginSource, /syncDataFromCloud\(openid\)/);
  assert.doesNotMatch(loginSource, /syncDataFromCloud\(openid,\s*\{\s*allowFreshness:\s*true/);
  assert.doesNotMatch(learningSource, /syncDataFromCloud/);
  assert.doesNotMatch(reviewSource, /syncDataFromCloud/);
}

(async () => {
  await testShortWindowRequestCountsAndContract();
  await testBoundaryExpiryAndFreshnessReset();
  await testAccountGenerationLogoutAndRestartIsolation();
  await testFailedStaleAndOptionalResults();
  await testInflightPrecedesOldFreshness();
  await testSilentLoginBypassesPageFreshnessAndMigrationStillRuns();
  testOnlyImplicitPageCallersOptIn();
  originalLog('full-pull-freshness: PASS');
})().catch((error) => {
  originalError(error);
  process.exitCode = 1;
}).finally(() => {
  global.setTimeout = originalSetTimeout;
  global.clearTimeout = originalClearTimeout;
  Date.now = originalDateNow;
  console.log = originalLog;
  console.warn = originalWarn;
  console.error = originalError;
});
