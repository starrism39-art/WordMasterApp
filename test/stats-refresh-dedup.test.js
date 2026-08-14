'use strict';

const assert = require('assert');

function createEventBus() {
  return {
    globalData: {},
    listeners: {},
    on(eventName, handler) {
      if (!this.listeners[eventName]) this.listeners[eventName] = [];
      this.listeners[eventName].push(handler);
    },
    off(eventName, handler) {
      if (!this.listeners[eventName]) return;
      this.listeners[eventName] = this.listeners[eventName]
        .filter((candidate) => candidate !== handler);
    },
    emit(eventName, payload) {
      (this.listeners[eventName] || []).slice().forEach((handler) => handler(payload));
    },
    getLearningRecords() {
      return [];
    }
  };
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createFakeTimers() {
  let nextId = 1;
  const timers = new Map();
  return {
    setTimeout(callback, delay) {
      const id = nextId;
      nextId += 1;
      timers.set(id, { callback, delay: Number(delay) || 0 });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    runAll() {
      while (timers.size > 0) {
        const entries = Array.from(timers.entries())
          .sort((left, right) => left[1].delay - right[1].delay || left[0] - right[0]);
        timers.delete(entries[0][0]);
        entries[0][1].callback();
      }
    },
    reset() {
      timers.clear();
    }
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

const app = createEventBus();
const storage = {};
const studentA = { id: 'student-stats-a', name: 'A' };
const studentB = { id: 'student-stats-b', name: 'B' };
const wordbook = { id: 'stats-book', name: 'Stats Book', words: [] };
let syncImplementation = () => Promise.resolve({ success: true });

global.getApp = () => app;
global.wx = {
  getStorageSync(key) {
    return storage[key];
  },
  setStorageSync(key, value) {
    storage[key] = value;
  },
  removeStorageSync(key) {
    delete storage[key];
  },
  showToast() {}
};

const fakeTimers = createFakeTimers();
const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;
global.setTimeout = fakeTimers.setTimeout;
global.clearTimeout = fakeTimers.clearTimeout;

const migrationPath = require.resolve('../utils/cloud-migration.js');
const loginPath = require.resolve('../utils/login-service.js');
const statsPath = require.resolve('../subpages/stats/stats.js');
const migrationModule = require(migrationPath);
const loginModule = require(loginPath);
const originalSync = migrationModule.syncDataFromCloud;
const originalLogin = loginModule.doSilentLogin;
migrationModule.syncDataFromCloud = (...args) => syncImplementation(...args);
loginModule.doSilentLogin = () => Promise.resolve({ success: true });

let statsDefinition = null;
global.Page = (definition) => {
  statsDefinition = definition;
};
delete require.cache[statsPath];
require(statsPath);
assert.ok(statsDefinition, 'stats page definition must be captured');

function resetScenario() {
  app.listeners = {};
  app.globalData.currentUser = { openid: 'stats-account' };
  app.globalData.currentStudent = studentA;
  app.globalData.currentWordbook = wordbook;
  app.globalData.selectedWordbook = wordbook;
  app.globalData.currentWordbookStudentId = studentA.id;
  storage.openid = 'stats-account';
  storage.currentUser = app.globalData.currentUser;
  storage.currentStudent = studentA;
  storage.selectedStudent = studentA;
  storage.currentWordbook = wordbook;
  storage.selectedWordbook = wordbook;
  storage.currentWordbookStudentId = studentA.id;
  storage.students = [studentA, studentB];
  fakeTimers.reset();
  syncImplementation = () => Promise.resolve({ success: true });
}

function createPage() {
  const counters = {
    loads: 0,
    setData: 0,
    contexts: []
  };
  const page = {
    ...statsDefinition,
    data: {
      ...statsDefinition.data,
      learningStats: { ...statsDefinition.data.learningStats },
      students: []
    }
  };
  page.setData = function setData(patch, callback) {
    counters.setData += 1;
    this.data = { ...this.data, ...patch };
    if (typeof callback === 'function') callback();
  };
  page.loadAndCalculateStats = function loadAndCalculateStatsSpy() {
    counters.loads += 1;
    counters.contexts.push(app.globalData.currentStudent && app.globalData.currentStudent.id);
    this.setData({ loading: false });
  };
  return { page, counters };
}

function createRealStatsPage() {
  const setDataPatches = [];
  const page = {
    ...statsDefinition,
    data: {
      ...statsDefinition.data,
      learningStats: { ...statsDefinition.data.learningStats },
      students: []
    }
  };
  page.setData = function setData(patch, callback) {
    setDataPatches.push(Object.keys(patch));
    this.data = { ...this.data, ...patch };
    if (typeof callback === 'function') callback();
  };
  return { page, setDataPatches };
}

async function mountAndShow() {
  const instance = createPage();
  instance.page.onLoad();
  instance.page.onShow();
  await flushPromises();
  return instance;
}

(async () => {
  try {
    // A. Initial local-only display has one calculation and starts no cloud pull.
    resetScenario();
    delete storage.openid;
    let localOnlySyncCalls = 0;
    syncImplementation = () => {
      localOnlySyncCalls += 1;
      return Promise.resolve({ success: true });
    };
    const localOnly = await mountAndShow();
    assert.strictEqual(localOnlySyncCalls, 0);
    assert.strictEqual(localOnly.counters.loads, 1, 'local-only initial display must calculate once');
    localOnly.page.onUnload();

    // B. Initial onLoad + freshness completion has one local calculation.
    resetScenario();
    const freshness = await mountAndShow();
    assert.strictEqual(freshness.counters.loads, 1, 'initial freshness must reuse onLoad stats');
    assert.strictEqual(freshness.page.data.loading, false);
    freshness.page.onUnload();

    // C. A real full pull emits two events and resolves once: one initial + one final calculation.
    resetScenario();
    const fullPullDeferred = createDeferred();
    syncImplementation = () => fullPullDeferred.promise;
    const fullPull = createPage();
    fullPull.page.onLoad();
    fullPull.page.onShow();
    app.emit('wordMasteryUpdated');
    app.emit('learningRecordAdded');
    fullPullDeferred.resolve({ success: true });
    await flushPromises();
    fakeTimers.runAll();
    assert.strictEqual(fullPull.counters.loads, 2, 'full pull must calculate initial and final state only');
    fullPull.page.onUnload();

    // D. A joined in-flight pull follows the same event-owned final refresh path.
    resetScenario();
    const joinedDeferred = createDeferred();
    let syncCalls = 0;
    let networkStarts = 0;
    networkStarts += 1;
    const existingFlight = joinedDeferred.promise;
    syncImplementation = () => {
      syncCalls += 1;
      return existingFlight;
    };
    const joined = createPage();
    joined.page.onLoad();
    joined.page.onShow();
    app.emit('learningRecordAdded');
    joinedDeferred.resolve({ success: true });
    await flushPromises();
    fakeTimers.runAll();
    assert.strictEqual(syncCalls, 1);
    assert.strictEqual(networkStarts, 1, 'Stats must join the existing flight without another network start');
    assert.strictEqual(joined.counters.loads, 2, 'joined pull must not add a Promise-owned third calculation');
    joined.page.onUnload();

    // E. A later onShow without a pull event still performs one necessary refresh.
    resetScenario();
    const laterShow = await mountAndShow();
    assert.strictEqual(laterShow.counters.loads, 1);
    laterShow.page.onShow();
    await flushPromises();
    assert.strictEqual(laterShow.counters.loads, 2, 'later onShow freshness must refresh exactly once');
    laterShow.page.onUnload();

    // F. Context changes during a pull are owned by the event refresh, never the old Promise callback.
    resetScenario();
    const contextDeferred = createDeferred();
    syncImplementation = () => contextDeferred.promise;
    const contextSwitch = createPage();
    contextSwitch.page.onLoad();
    contextSwitch.page.onShow();
    app.globalData.currentStudent = studentB;
    storage.currentStudent = studentB;
    storage.selectedStudent = studentB;
    app.emit('currentStudentChanged');
    contextDeferred.resolve({ success: true });
    await flushPromises();
    fakeTimers.runAll();
    assert.deepStrictEqual(contextSwitch.counters.contexts, [studentA.id, studentB.id]);
    contextSwitch.page.onUnload();

    // G. A Promise settling after unload cannot calculate or update the old page.
    resetScenario();
    const lateDeferred = createDeferred();
    syncImplementation = () => lateDeferred.promise;
    const late = createPage();
    late.page.onLoad();
    late.page.onShow();
    const setDataBeforeUnload = late.counters.setData;
    late.page.onUnload();
    lateDeferred.resolve({ success: true });
    await flushPromises();
    fakeTimers.runAll();
    assert.strictEqual(late.counters.loads, 1, 'unloaded page must ignore late pull completion');
    assert.strictEqual(late.counters.setData, setDataBeforeUnload, 'unloaded page must not receive late setData');

    // H. An initial failed pull keeps the already-rendered local stats and settles loading.
    resetScenario();
    syncImplementation = () => Promise.reject(new Error('isolated pull failure'));
    const failed = await mountAndShow();
    assert.strictEqual(failed.counters.loads, 1, 'initial pull failure must not duplicate the local calculation');
    assert.strictEqual(failed.page.data.loading, false);
    failed.page.onUnload();

    // I. Mastery + record events from one business change retain the 200ms merge.
    resetScenario();
    const masteryAndRecord = await mountAndShow();
    app.emit('wordMasteryUpdated');
    app.emit('learningRecordAdded');
    fakeTimers.runAll();
    assert.strictEqual(masteryAndRecord.counters.loads, 2, 'mastery + record must debounce to one refresh');
    masteryAndRecord.page.onUnload();

    // J. A real delete event outside the pull cycle still refreshes exactly once.
    resetScenario();
    const eventRefresh = await mountAndShow();
    app.emit('learningRecordDeleted');
    fakeTimers.runAll();
    assert.strictEqual(eventRefresh.counters.loads, 2, 'independent data event must remain live');
    eventRefresh.page.onUnload();

    // K. A current-wordbook change also recalculates the latest context once.
    resetScenario();
    const secondWordbook = { id: 'stats-book-b', name: 'Stats Book B', words: [] };
    const wordbookSwitch = await mountAndShow();
    app.globalData.currentWordbook = secondWordbook;
    app.globalData.selectedWordbook = secondWordbook;
    storage.currentWordbook = secondWordbook;
    storage.selectedWordbook = secondWordbook;
    storage.currentWordbookStudentId = studentA.id;
    app.emit('currentWordbookChanged');
    fakeTimers.runAll();
    assert.strictEqual(wordbookSwitch.counters.loads, 2);
    assert.strictEqual(wordbookSwitch.counters.contexts[1], studentA.id);
    wordbookSwitch.page.onUnload();

    // L. Quantify the production calculation's setData reduction for a full pull.
    resetScenario();
    storage.wordMastery = {};
    storage.learningProgress = {};
    storage.learningRecords = [];
    storage.studentSettings = {};
    const measuredDeferred = createDeferred();
    syncImplementation = () => measuredDeferred.promise;
    const measured = createRealStatsPage();
    measured.page.onLoad();
    measured.page.onShow();
    app.emit('wordMasteryUpdated');
    app.emit('learningRecordAdded');
    measuredDeferred.resolve({ success: true });
    await flushPromises();
    fakeTimers.runAll();
    const measuredCounts = {
      total: measured.setDataPatches.length,
      loading: measured.setDataPatches.filter((keys) => keys.includes('loading')).length,
      context: measured.setDataPatches.filter((keys) => (
        keys.includes('currentStudentName') && !keys.includes('learningStats')
      )).length,
      records: measured.setDataPatches.filter((keys) => keys.includes('studyRecords')).length,
      finalStats: measured.setDataPatches.filter((keys) => keys.includes('learningStats')).length
    };
    assert.deepStrictEqual(measuredCounts, {
      total: 14,
      loading: 5,
      context: 4,
      records: 2,
      finalStats: 2
    });
    measured.page.onUnload();

    console.log('stats-refresh-dedup counts:', JSON.stringify({
      localOnly: localOnly.counters.loads,
      freshnessInitial: freshness.counters.loads,
      fullPull: fullPull.counters.loads,
      joinedPull: joined.counters.loads,
      joinedAdditionalNetworkStarts: networkStarts - 1,
      laterShow: laterShow.counters.loads,
      contextSwitch: contextSwitch.counters.loads,
      unloadedLatePromise: late.counters.loads,
      failedPull: failed.counters.loads,
      masteryAndRecord: masteryAndRecord.counters.loads,
      independentEvent: eventRefresh.counters.loads,
      wordbookSwitch: wordbookSwitch.counters.loads,
      fullPullSetData: measuredCounts
    }));
    console.log('stats-refresh-dedup: PASS');
  } finally {
    migrationModule.syncDataFromCloud = originalSync;
    loginModule.doSilentLogin = originalLogin;
    delete require.cache[statsPath];
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
