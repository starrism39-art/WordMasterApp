'use strict';

const assert = require('assert');

const accountSessionPath = require.resolve('../utils/account-session.js');
const loginPath = require.resolve('../utils/login-service.js');
const migrationPath = require.resolve('../utils/cloud-migration.js');
const cloudSyncPath = require.resolve('../utils/cloud-sync.js');
const cloudModePath = require.resolve('../utils/cloud-mode.js');

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

const clearModules = () => {
  [accountSessionPath, loginPath, migrationPath, cloudSyncPath, cloudModePath].forEach((file) => {
    delete require.cache[file];
  });
};

async function testStaleFullPullCommitBarrier() {
  clearModules();
  const storage = {
    openid: 'account-A',
    currentUser: { id: 'account-A' },
    students: [{ id: 'student-A-local', ownerId: 'account-A' }],
    learningRecords: [{ id: 'record-A-local', studentId: 'student-A-local' }],
    learningProgress: { 'student-A-local': { learnedWords: 1 } },
    wordMastery: { 'student-A-local': { bookA: { alpha: { mastered: true } } } },
    currentStudent: { id: 'student-A-local' },
    currentWordbook: { id: 'bookA' }
  };
  const studentCountStarted = deferred();
  const releaseStudentCount = deferred();
  const emitted = [];
  const app = {
    globalData: { cloudReadOnly: true, currentUser: storage.currentUser },
    ensureUserPermissions: (user) => user,
    emit: (name) => emitted.push(name)
  };
  const collections = {
    teachers: [{ teacher_id: 'account-A', userRole: 'external', memberLevel: 'free' }],
    students: [{ teacher_id: 'account-A', student_id: 'student-A-cloud', id: 'student-A-cloud' }],
    learning_records: [{ teacher_id: 'account-A', id: 'record-A-cloud', studentId: 'student-A-cloud' }],
    learning_progress: [],
    word_mastery: [],
    student_statistics: [],
    wordbook_statistics: []
  };
  const createQuery = (name, items) => {
    let offset = 0;
    let limit = items.length;
    const query = {
      count: async () => {
        if (name === 'students') {
          studentCountStarted.resolve();
          await releaseStudentCount.promise;
        }
        return { total: items.length };
      },
      skip(value) { offset = value; return query; },
      limit(value) { limit = value; return query; },
      orderBy() { return query; },
      get: async () => ({ data: items.slice(offset, offset + limit) })
    };
    return query;
  };
  const db = {
    collection(name) {
      return {
        where(condition) {
          const items = (collections[name] || []).filter((item) => Object.keys(condition).every(
            (key) => item[key] === condition[key]
          ));
          return createQuery(name, items);
        }
      };
    }
  };
  global.wx = {
    cloud: {
      init: () => {},
      database: () => db,
      callFunction: async ({ name }) => {
        if (name === 'syncTombstoneAuthority') {
          return { result: { success: true, tombstones: [] } };
        }
        return { result: { success: false } };
      }
    },
    getDeviceInfo: () => ({ platform: 'devtools' }),
    getLaunchOptionsSync: () => ({ query: {} }),
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => { storage[key] = value; },
    removeStorageSync: (key) => { delete storage[key]; }
  };
  global.getApp = () => app;

  const { syncDataFromCloud } = require(migrationPath);
  const pull = syncDataFromCloud('account-A');
  await studentCountStarted.promise;

  storage.openid = 'account-B';
  storage.currentUser = { id: 'account-B' };
  storage.students = [{ id: 'student-B', ownerId: 'account-B' }];
  storage.learningRecords = [{ id: 'record-B', studentId: 'student-B' }];
  storage.learningProgress = { 'student-B': { learnedWords: 2 } };
  storage.wordMastery = { 'student-B': { bookB: { beta: { mastered: true } } } };
  storage.currentStudent = { id: 'student-B' };
  storage.currentWordbook = { id: 'bookB' };
  app.globalData.currentUser = storage.currentUser;
  app.globalData.currentStudent = storage.currentStudent;
  app.globalData.currentWordbook = storage.currentWordbook;
  releaseStudentCount.resolve();

  const result = await pull;
  assert.strictEqual(result.stale, true);
  assert.deepStrictEqual(storage.currentUser, { id: 'account-B' });
  assert.deepStrictEqual(storage.students, [{ id: 'student-B', ownerId: 'account-B' }]);
  assert.deepStrictEqual(storage.learningRecords, [{ id: 'record-B', studentId: 'student-B' }]);
  assert.deepStrictEqual(storage.learningProgress, { 'student-B': { learnedWords: 2 } });
  assert.deepStrictEqual(storage.wordMastery, { 'student-B': { bookB: { beta: { mastered: true } } } });
  assert.strictEqual(storage.currentStudent.id, 'student-B');
  assert.strictEqual(storage.currentWordbook.id, 'bookB');
  assert.deepStrictEqual(emitted, [], 'stale pull must not refresh current-account pages');
}

async function testStaleTeacherReadCannotWriteCurrentUser() {
  clearModules();
  const storage = {
    openid: 'account-A',
    currentUser: { id: 'account-A' },
    students: [], learningRecords: [], learningProgress: {}, wordMastery: {}
  };
  const teacherRead = deferred();
  const app = {
    globalData: { cloudReadOnly: true, currentUser: storage.currentUser },
    ensureUserPermissions: (user) => user,
    emit: () => { throw new Error('stale teacher read must not emit'); }
  };
  const emptyQuery = {
    count: async () => ({ total: 0 }),
    skip() { return emptyQuery; },
    limit() { return emptyQuery; },
    orderBy() { return emptyQuery; },
    get: async () => ({ data: [] })
  };
  const db = {
    collection(name) {
      return {
        where() {
          if (name === 'teachers') {
            return {
              limit() { return this; },
              get: () => teacherRead.promise
            };
          }
          return emptyQuery;
        }
      };
    }
  };
  global.wx = {
    cloud: {
      init: () => {},
      database: () => db,
      callFunction: async ({ name }) => {
        if (name === 'syncTombstoneAuthority') {
          return { result: { success: true, tombstones: [] } };
        }
        return { result: { success: false } };
      }
    },
    getDeviceInfo: () => ({ platform: 'devtools' }),
    getLaunchOptionsSync: () => ({ query: {} }),
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => { storage[key] = value; },
    removeStorageSync: (key) => { delete storage[key]; }
  };
  global.getApp = () => app;
  const { syncDataFromCloud } = require(migrationPath);
  const pull = syncDataFromCloud('account-A');
  storage.openid = 'account-B';
  storage.currentUser = { id: 'account-B' };
  app.globalData.currentUser = storage.currentUser;
  teacherRead.resolve({ data: [{ teacher_id: 'account-A', userRole: 'admin', memberLevel: 'premium' }] });
  const result = await pull;
  assert.strictEqual(result.stale, true);
  assert.deepStrictEqual(storage.currentUser, { id: 'account-B' });
  assert.deepStrictEqual(app.globalData.currentUser, { id: 'account-B' });
}

function loadLoginService({ storage, pull, migrate, retry, events }) {
  clearModules();
  require.cache[migrationPath] = {
    id: migrationPath,
    filename: migrationPath,
    loaded: true,
    exports: { syncDataFromCloud: pull, migrateLocalDataToCloud: migrate }
  };
  require.cache[cloudSyncPath] = {
    id: cloudSyncPath,
    filename: cloudSyncPath,
    loaded: true,
    exports: { retryPendingSyncs: retry }
  };
  require.cache[cloudModePath] = {
    id: cloudModePath,
    filename: cloudModePath,
    loaded: true,
    exports: {
      createCloudReadOnlyResult: (operation) => ({ ok: true, skipped: true, operation }),
      isCloudReadOnlyMode: () => false
    }
  };
  global.wx = {
    cloud: {},
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => { storage[key] = value; },
    removeStorageSync: (key) => { delete storage[key]; }
  };
  global.getApp = () => ({
    globalData: {},
    emit: (name) => events.push(name),
    ensureUserPermissions: (user) => user
  });
  return require(loginPath);
}

async function testAccountScopedLoginFlightAndWorkflow() {
  const storage = { openid: 'account-A' };
  const events = [];
  const pullA = deferred();
  const pullB = deferred();
  const migrations = [];
  const retries = [];
  const service = loadLoginService({
    storage,
    events,
    pull: (openid) => (openid === 'account-A' ? pullA.promise : pullB.promise),
    migrate: (options) => {
      migrations.push(options.accountId);
      return Promise.resolve({ success: true });
    },
    retry: (options) => {
      retries.push(options.accountId);
      return Promise.resolve({ ok: true, pending: 0 });
    }
  });

  const firstA = service.doSilentLogin();
  const secondA = service.doSilentLogin();
  assert.strictEqual(firstA, secondA, 'same account and generation must share one flight');

  storage.openid = 'account-B';
  const firstB = service.doSilentLogin();
  assert.notStrictEqual(firstB, firstA, 'different account must not reuse the old flight');

  pullA.resolve({ success: true });
  const staleAResult = await firstA;
  assert.strictEqual(staleAResult.ok, false);
  assert.strictEqual(staleAResult.error.code, 'account_session_changed');
  assert.deepStrictEqual(migrations, []);
  assert.deepStrictEqual(retries, []);
  assert.deepStrictEqual(events, []);

  const secondB = service.doSilentLogin();
  assert.strictEqual(secondB, firstB, 'old A completion must not clear B flight');
  pullB.resolve({ success: true });
  const resultB = await firstB;
  assert.strictEqual(resultB.ok, true);
  assert.deepStrictEqual(retries, ['account-B']);
  assert.deepStrictEqual(events, ['cloudSyncComplete']);

  const logoutPull = deferred();
  storage.openid = 'account-A';
  const logoutEvents = [];
  const logoutService = loadLoginService({
    storage,
    events: logoutEvents,
    pull: () => logoutPull.promise,
    migrate: () => { throw new Error('migration must not start after logout'); },
    retry: () => { throw new Error('retry must not start after logout'); }
  });
  const logoutFlight = logoutService.doSilentLogin();
  logoutService.invalidateLoginSession();
  delete storage.openid;
  logoutPull.resolve({ success: true });
  const logoutResult = await logoutFlight;
  assert.strictEqual(logoutResult.ok, false);
  assert.strictEqual(logoutResult.error.code, 'account_session_changed');
  assert.deepStrictEqual(logoutEvents, []);
}

async function testLogoutBeforeOpenIdResolution() {
  const storage = {};
  const events = [];
  const openIdResult = deferred();
  clearModules();
  require.cache[migrationPath] = {
    id: migrationPath,
    filename: migrationPath,
    loaded: true,
    exports: {
      syncDataFromCloud: () => { throw new Error('pull must not start'); },
      migrateLocalDataToCloud: () => { throw new Error('migration must not start'); }
    }
  };
  require.cache[cloudSyncPath] = {
    id: cloudSyncPath,
    filename: cloudSyncPath,
    loaded: true,
    exports: { retryPendingSyncs: () => { throw new Error('retry must not start'); } }
  };
  require.cache[cloudModePath] = {
    id: cloudModePath,
    filename: cloudModePath,
    loaded: true,
    exports: {
      createCloudReadOnlyResult: (operation) => ({ ok: true, skipped: true, operation }),
      isCloudReadOnlyMode: () => false
    }
  };
  global.wx = {
    cloud: { callFunction: () => openIdResult.promise },
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => { storage[key] = value; },
    removeStorageSync: (key) => { delete storage[key]; }
  };
  global.getApp = () => ({ globalData: {}, emit: (name) => events.push(name) });
  const service = require(loginPath);
  const flight = service.doSilentLogin();
  service.invalidateLoginSession();
  openIdResult.resolve({ result: { openid: 'account-A' } });
  const result = await flight;
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error.code, 'account_session_changed');
  assert.strictEqual(storage.openid, undefined, 'late identity must not recreate a logged-out session');
  assert.deepStrictEqual(events, []);
}

async function testPendingAccountIsolation() {
  clearModules();
  const storage = {
    openid: 'account-B',
    students: [
      { id: 'student-A', ownerId: 'account-A' },
      { id: 'student-B', ownerId: 'account-B' }
    ],
    learningRecords: [],
    learningProgress: {},
    wordMastery: {},
    pendingLearningRecordSync: {
      '["student-A","book-A","record-A"]': { id: 'record-A', studentId: 'student-A', wordbookId: 'book-A', accountId: 'account-A' },
      '["student-B","book-B","record-B"]': { id: 'record-B', studentId: 'student-B', wordbookId: 'book-B', accountId: 'account-B' },
      '["student-A","book-A","record-A-legacy"]': { id: 'record-A-legacy', studentId: 'student-A', wordbookId: 'book-A' },
      '["student-unknown","book-X","record-unknown"]': { id: 'record-unknown', studentId: 'student-unknown', wordbookId: 'book-X' }
    },
    pendingWordMasterySync: {
      explicitA: { student_id: 'student-A', wordbook_id: 'book-A', word_id: 'alpha', accountId: 'account-A' },
      explicitB: { student_id: 'student-B', wordbook_id: 'book-B', word_id: 'beta', accountId: 'account-B' },
      legacyKnownA: { student_id: 'student-A', wordbook_id: 'book-A', word_id: 'gamma' },
      legacyUnknown: { student_id: 'student-unknown', wordbook_id: 'book-X', word_id: 'delta' }
    },
    pendingLearningProgressSync: {
      explicitA: { studentId: 'student-A', progressData: { learnedWords: 1 }, accountId: 'account-A' },
      explicitB: { studentId: 'student-B', progressData: { learnedWords: 2 }, accountId: 'account-B' },
      legacyKnownA: { studentId: 'student-A', progressData: { learnedWords: 3 } },
      legacyUnknown: { studentId: 'student-unknown', progressData: { learnedWords: 4 } }
    },
    pendingPreviewStateSync: {
      'student-A__book-A': { studentId: 'student-A', wordbookId: 'book-A', previewData: { mastery: {} }, accountId: 'account-A' },
      'student-B__book-B': { studentId: 'student-B', wordbookId: 'book-B', previewData: { mastery: {} }, accountId: 'account-B' },
      'student-A__book-A__account__legacy': { studentId: 'student-A', wordbookId: 'book-A', previewData: { mastery: {} } },
      'student-unknown__book-X': { studentId: 'student-unknown', wordbookId: 'book-X', previewData: { mastery: {} } }
    }
  };
  const attempted = [];
  const db = {
    collection(name) {
      return {
        doc(docId) {
          return {
            get: () => Promise.reject({ errCode: -1 }),
            set: ({ data }) => {
              attempted.push({ name, docId, data });
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
      callFunction: async ({ name }) => {
        if (name === 'syncTombstoneAuthority') {
          return { result: { success: true, tombstones: [] } };
        }
        return { result: { success: false } };
      }
    },
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => { storage[key] = value; },
    removeStorageSync: (key) => { delete storage[key]; }
  };
  global.getApp = () => ({ globalData: { cloudReadOnly: false } });
  const { retryPendingSyncs } = require(cloudSyncPath);

  const bResult = await retryPendingSyncs();
  assert.deepStrictEqual(
    { pending: bResult.pending, retained: bResult.retained },
    { pending: 0, retained: 12 },
    'A and unknown pending must remain without triggering a retry loop for B'
  );
  assert.ok(attempted.length >= 4);
  attempted.forEach((attempt) => {
    assert.ok(attempt.docId.indexOf('account-B__') === 0, 'B retry may only target B scope');
    assert.strictEqual(attempt.data.accountId, undefined, 'local accountId metadata must not enter cloud payload');
  });
  ['pendingLearningRecordSync', 'pendingWordMasterySync', 'pendingLearningProgressSync', 'pendingPreviewStateSync']
    .forEach((key) => {
      const values = Object.values(storage[key] || {});
      assert.strictEqual(values.length, 3);
      assert.ok(values.some((item) => item.accountId === 'account-A'));
      assert.ok(values.some((item) => String(item.studentId || item.student_id) === 'student-A' && !item.accountId));
      assert.ok(values.some((item) => String(item.studentId || item.student_id) === 'student-unknown'));
    });

  attempted.length = 0;
  storage.openid = 'account-A';
  const aResult = await retryPendingSyncs();
  assert.deepStrictEqual(
    { pending: aResult.pending, retained: aResult.retained },
    { pending: 0, retained: 4 },
    'only unknown-owner legacy pending must remain, silently retained'
  );
  attempted.forEach((attempt) => assert.ok(attempt.docId.indexOf('account-A__') === 0));
  ['pendingLearningRecordSync', 'pendingWordMasterySync', 'pendingLearningProgressSync', 'pendingPreviewStateSync']
    .forEach((key) => {
      const values = Object.values(storage[key] || {});
      assert.strictEqual(values.length, 1);
      assert.strictEqual(String(values[0].studentId || values[0].student_id), 'student-unknown');
    });
}

(async () => {
  await testStaleFullPullCommitBarrier();
  await testStaleTeacherReadCannotWriteCurrentUser();
  await testAccountScopedLoginFlightAndWorkflow();
  await testLogoutBeforeOpenIdResolution();
  await testPendingAccountIsolation();
  console.log('account-session-isolation: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
