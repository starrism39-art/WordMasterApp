'use strict';

const assert = require('assert');

const ACCOUNT_A = 'account-concurrency-A';
const ACCOUNT_B = 'account-concurrency-B';
const STUDENT_ID = 'student-concurrency';
const WORDBOOK_ID = 'book-concurrency';
const LOCAL_WORDBOOK_ID = 'book-local-before-full-pull';
const COLLECTIONS = [
  'students',
  'learning_records',
  'learning_progress',
  'word_mastery',
  'student_statistics',
  'wordbook_statistics'
];
const CORE_STORAGE_KEYS = new Set([
  'students',
  'learningRecords',
  'learningProgress',
  'wordMastery'
]);
const originalSetTimeout = global.setTimeout;
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = () => {};
console.warn = () => {};
console.error = () => {};

class VirtualClock {
  constructor() {
    this.now = 0;
    this.nextId = 1;
    this.timers = [];
    this.backoffDelays = [];
  }

  schedule(callback, milliseconds, kind) {
    const id = this.nextId++;
    const delay = Number(milliseconds) || 0;
    this.timers.push({ id, due: this.now + delay, callback, kind });
    if (kind === 'backoff') this.backoffDelays.push(delay);
    return id;
  }

  waitForRead(collectionName, milliseconds) {
    return new Promise((resolve) => {
      this.schedule(resolve, milliseconds, `read:${collectionName}`);
    });
  }

  async flushMicrotasks(rounds = 40) {
    for (let index = 0; index < rounds; index += 1) {
      await Promise.resolve();
    }
  }

  async run(promise) {
    let state = 'pending';
    let value;
    let failure;
    promise.then(
      (result) => { state = 'fulfilled'; value = result; },
      (error) => { state = 'rejected'; failure = error; }
    );

    while (state === 'pending') {
      await this.flushMicrotasks();
      if (state !== 'pending') break;
      if (this.timers.length === 0) {
        await this.flushMicrotasks(120);
        if (state === 'pending' && this.timers.length === 0) {
          throw new Error('virtual clock deadlock: promise pending without timers');
        }
        continue;
      }

      const nextDue = Math.min(...this.timers.map((timer) => timer.due));
      this.now = nextDue;
      const ready = this.timers
        .filter((timer) => timer.due === nextDue)
        .sort((left, right) => left.id - right.id);
      this.timers = this.timers.filter((timer) => timer.due !== nextDue);
      ready.forEach((timer) => timer.callback());
    }

    await this.flushMicrotasks();
    if (state === 'rejected') throw failure;
    return value;
  }
}

const makeCollections = (masteryCount = 1) => ({
  teachers: [{
    _id: 'teacher-A',
    teacher_id: ACCOUNT_A,
    userRole: 'external',
    memberLevel: 'free'
  }],
  students: [{
    _id: STUDENT_ID,
    id: STUDENT_ID,
    student_id: STUDENT_ID,
    teacher_id: ACCOUNT_A,
    name: 'Concurrency Student'
  }],
  learning_records: [{
    _id: 'record-concurrency',
    id: 'record-concurrency',
    teacher_id: ACCOUNT_A,
    studentId: STUDENT_ID,
    wordbookId: WORDBOOK_ID,
    studyDate: '2026-08-14T00:00:00.000Z',
    updatedAt: '2026-08-14T00:00:00.000Z'
  }],
  learning_progress: [{
    _id: STUDENT_ID,
    teacher_id: ACCOUNT_A,
    student_id: STUDENT_ID,
    learnedWords: 1,
    totalWords: masteryCount,
    wordbooks: {
      [WORDBOOK_ID]: { learnedWords: 1, totalWords: masteryCount }
    }
  }],
  word_mastery: Array.from({ length: masteryCount }, (_, index) => ({
    _id: `mastery-${String(index).padStart(3, '0')}`,
    teacher_id: ACCOUNT_A,
    student_id: STUDENT_ID,
    wordbook_id: WORDBOOK_ID,
    word_id: `word-${String(index).padStart(3, '0')}`,
    mastered: index === 0,
    difficult: index !== 0,
    reviewCount: index,
    updatedAt: '2026-08-14T00:00:00.000Z'
  })),
  student_statistics: [{
    _id: STUDENT_ID,
    teacher_id: ACCOUNT_A,
    student_id: STUDENT_ID,
    isManualOverride: true,
    manualMasteredCount: 7,
    manualNotMasteredCount: 3,
    manualCheckinDays: 2,
    updatedAt: '2026-08-14T00:00:00.000Z'
  }],
  wordbook_statistics: [{
    _id: `${STUDENT_ID}_${WORDBOOK_ID}`,
    teacher_id: ACCOUNT_A,
    student_id: STUDENT_ID,
    wordbook_id: WORDBOOK_ID,
    isManualOverride: true,
    manualMasteredCount: 6,
    manualNotMasteredCount: 4,
    manualCheckinDays: 3,
    updatedAt: '2026-08-14T00:00:00.000Z'
  }]
});

const createHarness = ({
  durations,
  failures = {},
  masteryCount = 1,
  switchWhenActive = 0
}) => {
  const clock = new VirtualClock();
  const storage = {
    openid: ACCOUNT_A,
    currentUser: { id: ACCOUNT_A, username: ACCOUNT_A },
    students: [],
    learningRecords: [],
    learningProgress: {
      [STUDENT_ID]: {
        learnedWords: 2,
        totalWords: 50,
        wordbooks: {
          [LOCAL_WORDBOOK_ID]: {
            completedCount: 2,
            learnedWords: 2,
            totalCount: 50,
            lastStudyTime: '2026-08-13T00:00:00.000Z'
          }
        }
      }
    },
    wordMastery: {}
  };
  const emitted = [];
  const storageWrites = [];
  const collections = makeCollections(masteryCount);
  const attempts = {};
  const starts = {};
  const completions = {};
  const startOrder = [];
  const completionOrder = [];
  const activeCollections = new Set();
  const pageOffsets = {};
  const pageActive = {};
  const maxPageActive = {};
  let maxActive = 0;
  let switched = false;
  let cloudWriteCount = 0;

  const app = {
    globalData: {
      cloudReadOnly: true,
      currentUser: storage.currentUser
    },
    ensureUserPermissions: (user) => user,
    emit: (name) => emitted.push(name)
  };

  const switchAccount = () => {
    if (switched) return;
    switched = true;
    storage.openid = ACCOUNT_B;
    storage.currentUser = { id: ACCOUNT_B, username: ACCOUNT_B };
    storage.students = [{ id: 'student-B', student_id: 'student-B' }];
    storage.learningRecords = [{ id: 'record-B' }];
    storage.learningProgress = { 'student-B': { learnedWords: 9 } };
    storage.wordMastery = { 'student-B': { 'book-B': { 'word-B': { mastered: true } } } };
    app.globalData.currentUser = storage.currentUser;
  };

  const startCollection = (name) => {
    if (activeCollections.has(name)) return;
    activeCollections.add(name);
    starts[name] = (starts[name] || 0) + 1;
    startOrder.push(name);
    maxActive = Math.max(maxActive, activeCollections.size);
    if (switchWhenActive && activeCollections.size >= switchWhenActive) {
      switchAccount();
    }
  };

  const finishCollection = (name) => {
    if (!activeCollections.delete(name)) return;
    completions[name] = (completions[name] || 0) + 1;
    completionOrder.push(name);
  };

  const createQuery = (name, sourceItems) => {
    let items = sourceItems.slice();
    let offset = 0;
    let limit = 20;
    const query = {
      count: async () => {
        if (!COLLECTIONS.includes(name)) return { total: items.length };
        startCollection(name);
        attempts[name] = (attempts[name] || 0) + 1;
        await clock.waitForRead(name, durations[name] || 0);
        const plan = failures[name];
        if (plan && attempts[name] <= plan.times) {
          if (attempts[name] >= 3) finishCollection(name);
          throw new Error(plan.message);
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
      skip(value) {
        offset = value;
        return query;
      },
      limit(value) {
        limit = value;
        return query;
      },
      get: async () => {
        if (COLLECTIONS.includes(name)) {
          pageOffsets[name] = pageOffsets[name] || [];
          pageOffsets[name].push(offset);
          pageActive[name] = (pageActive[name] || 0) + 1;
          maxPageActive[name] = Math.max(maxPageActive[name] || 0, pageActive[name]);
        }
        const data = items.slice(offset, offset + limit);
        if (COLLECTIONS.includes(name)) {
          pageActive[name] -= 1;
          if (offset + limit >= items.length) finishCollection(name);
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
          throw new Error('cloud writes are forbidden in bounded concurrency tests');
        },
        doc() {
          return {
            set() {
              cloudWriteCount += 1;
              throw new Error('cloud writes are forbidden in bounded concurrency tests');
            },
            update() {
              cloudWriteCount += 1;
              throw new Error('cloud writes are forbidden in bounded concurrency tests');
            }
          };
        }
      };
    }
  };

  global.setTimeout = (callback, milliseconds) => (
    clock.schedule(callback, milliseconds, 'backoff')
  );
  global.wx = {
    cloud: {
      init: () => {},
      database: () => db,
      callFunction: async () => ({ result: { success: true, tombstones: [] } })
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
    app,
    attempts,
    clock,
    completionOrder,
    completions,
    emitted,
    maxPageActive,
    pageOffsets,
    startOrder,
    starts,
    storage,
    storageWrites,
    get cloudWriteCount() { return cloudWriteCount; },
    get maxActive() { return maxActive; },
    get switched() { return switched; }
  };
};

const runPull = async (options) => {
  const harness = createHarness(options);
  const { syncDataFromCloud } = require('../utils/cloud-migration.js');
  const result = await harness.clock.run(syncDataFromCloud(ACCOUNT_A));
  return { harness, result };
};

const assertSuccessfulMapping = (harness, result, masteryCount = 1) => {
  assert.strictEqual(result.success, true);
  assert.strictEqual(harness.cloudWriteCount, 0);
  assert.ok(harness.storage.students.some((student) => student.student_id === STUDENT_ID));
  assert.ok(harness.storage.learningRecords.some((record) => record.id === 'record-concurrency'));
  assert.ok(harness.storage.learningProgress[STUDENT_ID]);
  assert.strictEqual(
    harness.storage.learningProgress[STUDENT_ID].wordbooks[LOCAL_WORDBOOK_ID].completedCount,
    2,
    'Full Pull must retain a local wordbook that is absent from the cloud snapshot'
  );
  assert.strictEqual(
    harness.storage.learningProgress[STUDENT_ID].wordbooks[WORDBOOK_ID].completedCount,
    masteryCount,
    'Full Pull must add the cloud wordbook without replacing the local wordbook map'
  );
  assert.strictEqual(
    Object.keys(harness.storage.wordMastery[STUDENT_ID][WORDBOOK_ID]).length,
    masteryCount
  );
  assert.strictEqual(harness.storage[`stats_${STUDENT_ID}`].manualMasteredCount, 7);
  assert.strictEqual(
    harness.storage[`wordbook_stats_${STUDENT_ID}_${WORDBOOK_ID}`].manualMasteredCount,
    6
  );
};

const assertTimingScenario = async ({ durations, failures, serialElapsed, boundedElapsed }) => {
  const run = await runPull({ durations, failures });
  assertSuccessfulMapping(run.harness, run.result);
  assert.deepStrictEqual(run.harness.startOrder, COLLECTIONS);
  COLLECTIONS.forEach((name) => {
    assert.strictEqual(run.harness.starts[name], 1, `${name} must start exactly once`);
    assert.strictEqual(run.harness.completions[name], 1, `${name} must complete exactly once`);
  });

  assert.ok(run.harness.maxActive <= 2);
  assert.strictEqual(run.harness.maxActive, 2);
  assert.strictEqual(run.harness.clock.now, boundedElapsed);
  assert.ok(boundedElapsed < serialElapsed);
  return run;
};

(async () => {
  const equalDurations = Object.fromEntries(COLLECTIONS.map((name) => [name, 100]));
  await assertTimingScenario({
    durations: equalDurations,
    serialElapsed: 600,
    boundedElapsed: 300
  });

  const masteryHeavy = {
    students: 100,
    learning_records: 300,
    learning_progress: 250,
    word_mastery: 1000,
    student_statistics: 100,
    wordbook_statistics: 100
  };
  await assertTimingScenario({
    durations: masteryHeavy,
    serialElapsed: 1850,
    boundedElapsed: 1300
  });

  const retryTiming = await assertTimingScenario({
    durations: masteryHeavy,
    failures: {
      learning_records: { times: 1, message: 'temporary network error' }
    },
    serialElapsed: 3150,
    boundedElapsed: 1600
  });
  assert.strictEqual(retryTiming.harness.attempts.learning_records, 2);
  assert.deepStrictEqual(retryTiming.harness.clock.backoffDelays, [1000, 5000]);

  const rateLimitRetry = await runPull({
    durations: Object.fromEntries(COLLECTIONS.map((name) => [name, 0])),
    failures: {
      word_mastery: { times: 2, message: '-405015 exceed max client request count' }
    }
  });
  assertSuccessfulMapping(rateLimitRetry.harness, rateLimitRetry.result);
  assert.strictEqual(rateLimitRetry.harness.attempts.word_mastery, 3);
  assert.deepStrictEqual(rateLimitRetry.harness.clock.backoffDelays, [5000, 10000, 5000]);
  assert.ok(rateLimitRetry.harness.maxActive <= 2);

  const coreFailure = await runPull({
    durations: {
      ...Object.fromEntries(COLLECTIONS.map((name) => [name, 0])),
      students: 5000
    },
    failures: {
      learning_records: { times: 3, message: 'core records unavailable' }
    }
  });
  assert.match(coreFailure.result.error, /core records unavailable/);
  assert.strictEqual(coreFailure.harness.attempts.learning_records, 3);
  assert.deepStrictEqual(coreFailure.harness.clock.backoffDelays, [1000, 2000]);
  assert.deepStrictEqual(
    coreFailure.harness.startOrder,
    ['students', 'learning_records'],
    'a core failure must stop workers from claiming not-yet-started collection reads'
  );
  assert.strictEqual(
    coreFailure.harness.storageWrites.filter((write) => CORE_STORAGE_KEYS.has(write.key)).length,
    0,
    'core collection failure must prevent all core local commits'
  );
  assert.strictEqual(
    coreFailure.harness.storageWrites.filter((write) => (
      write.key.startsWith('stats_') || write.key.startsWith('wordbook_stats_')
    )).length,
    0,
    'core collection failure must prevent derived stats commits'
  );
  assert.deepStrictEqual(coreFailure.harness.emitted, []);

  const statsFailure = await runPull({
    durations: Object.fromEntries(COLLECTIONS.map((name) => [name, 0])),
    failures: {
      student_statistics: { times: 3, message: 'student stats unavailable' },
      wordbook_statistics: { times: 3, message: 'wordbook stats unavailable' }
    }
  });
  assert.strictEqual(statsFailure.result.success, true);
  assert.strictEqual(statsFailure.harness.attempts.student_statistics, 3);
  assert.strictEqual(statsFailure.harness.attempts.wordbook_statistics, 3);
  assert.ok(statsFailure.harness.storage.students.some(
    (student) => student.student_id === STUDENT_ID
  ));

  const pagination = await runPull({
    durations: Object.fromEntries(COLLECTIONS.map((name) => [name, 0])),
    masteryCount: 41
  });
  assertSuccessfulMapping(pagination.harness, pagination.result, 41);
  assert.deepStrictEqual(pagination.harness.pageOffsets.word_mastery, [0, 20, 40]);
  assert.strictEqual(pagination.harness.maxPageActive.word_mastery, 1);
  assert.deepStrictEqual(pagination.harness.clock.backoffDelays, [5000]);

  const staleAccount = await runPull({
    durations: equalDurations,
    switchWhenActive: 2
  });
  assert.strictEqual(staleAccount.harness.switched, true);
  assert.strictEqual(staleAccount.harness.maxActive, 2);
  COLLECTIONS.forEach((name) => {
    assert.strictEqual(staleAccount.harness.starts[name], 1);
    assert.strictEqual(staleAccount.harness.completions[name], 1);
  });
  assert.strictEqual(staleAccount.result.stale, true);
  assert.strictEqual(staleAccount.result.reason, 'account_session_changed');
  assert.strictEqual(staleAccount.harness.storage.currentUser.id, ACCOUNT_B);
  assert.deepStrictEqual(staleAccount.harness.storage.students, [
    { id: 'student-B', student_id: 'student-B' }
  ]);
  assert.deepStrictEqual(staleAccount.harness.storage.learningRecords, [{ id: 'record-B' }]);
  assert.deepStrictEqual(staleAccount.harness.storage.learningProgress, {
    'student-B': { learnedWords: 9 }
  });
  assert.ok(staleAccount.harness.storage.wordMastery['student-B']);
  assert.strictEqual(
    staleAccount.harness.storageWrites.filter((write) => write.accountId === ACCOUNT_B).length,
    0,
    'stale account reads may finish but must not write into account B'
  );
  assert.deepStrictEqual(staleAccount.harness.emitted, []);

  originalLog('cloud-pull-bounded-concurrency: PASS');
})().catch((error) => {
  originalError(error);
  process.exitCode = 1;
}).finally(() => {
  global.setTimeout = originalSetTimeout;
  console.log = originalLog;
  console.warn = originalWarn;
  console.error = originalError;
});
