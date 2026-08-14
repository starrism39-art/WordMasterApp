'use strict';

const assert = require('assert');

const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;
let nextTimerId = 1;
const timers = new Map();

global.setTimeout = (handler, delay = 0) => {
  const id = nextTimerId;
  nextTimerId += 1;
  timers.set(id, { handler, delay: Number(delay) || 0 });
  return id;
};
global.clearTimeout = (id) => {
  timers.delete(id);
};

function runZeroDelayTimers() {
  while (true) {
    const next = Array.from(timers.entries()).find(([, timer]) => timer.delay === 0);
    if (!next) return;
    const [id, timer] = next;
    timers.delete(id);
    timer.handler();
  }
}

function zeroDelayTimerCount() {
  return Array.from(timers.values()).filter((timer) => timer.delay === 0).length;
}

function createEventBus() {
  return {
    globalData: {},
    eventListeners: {},
    on(eventName, handler) {
      if (!this.eventListeners[eventName]) this.eventListeners[eventName] = [];
      this.eventListeners[eventName].push(handler);
    },
    off(eventName, handler) {
      if (!this.eventListeners[eventName]) return;
      this.eventListeners[eventName] = handler
        ? this.eventListeners[eventName].filter((candidate) => candidate !== handler)
        : [];
    },
    emit(eventName, payload) {
      (this.eventListeners[eventName] || []).slice().forEach((handler) => handler(payload));
    },
    listenerCount(eventName) {
      return (this.eventListeners[eventName] || []).length;
    }
  };
}

const student = {
  id: 'student-5e',
  name: 'Student 5E',
  ownerId: 'account-5e',
  ownerUsername: 'account-5e'
};
const wordbook = {
  id: 'book-5e',
  title: 'Book 5E',
  totalWords: 20
};
const currentUser = { id: 'account-5e', username: 'account-5e' };
const storage = {
  currentUser,
  currentStudent: student,
  selectedStudent: student,
  students: [student],
  currentWordbook: wordbook,
  selectedWordbook: wordbook,
  [`currentWordbook_${student.id}`]: wordbook
};

const app = createEventBus();
app.globalData.currentUser = currentUser;
app.globalData.currentStudent = student;
app.globalData.currentWordbook = wordbook;
app.globalData.selectedWordbook = wordbook;
global.getApp = () => app;

let activeCounters = null;
global.wx = {
  getStorageSync(key) {
    return storage[key];
  },
  setStorageSync(key, value) {
    storage[key] = value;
  },
  showToast() {
    if (activeCounters) activeCounters.toast += 1;
  }
};

let indexDefinition = null;
global.Page = (definition) => {
  indexDefinition = definition;
};
require('../pages/index/index.js');
assert.ok(indexDefinition, 'index page must register itself');

function emptyCounters() {
  return {
    loadLearningStats: 0,
    updateRealTimeStats: 0,
    loadRecentRecords: 0,
    calculateAntiForgotTime: 0,
    loadRecommendedWordbooks: 0,
    setData: 0,
    learningRecordScans: 0,
    recentRecordFilters: 0,
    getWordbookStats: 0,
    antiForgotScans: 0,
    toast: 0
  };
}

function resetCounters(counters) {
  Object.assign(counters, emptyCounters());
}

function pickRefreshCounts(counters) {
  return {
    loadLearningStats: counters.loadLearningStats,
    updateRealTimeStats: counters.updateRealTimeStats,
    loadRecentRecords: counters.loadRecentRecords,
    calculateAntiForgotTime: counters.calculateAntiForgotTime,
    loadRecommendedWordbooks: counters.loadRecommendedWordbooks
  };
}

function mount(label) {
  const counters = emptyCounters();
  activeCounters = counters;
  const page = {
    ...indexDefinition,
    data: {
      ...indexDefinition.data,
      currentStudent: student,
      currentWordbook: wordbook,
      learningWordbooks: wordbook.title
    }
  };

  page.setData = function setData(patch, callback) {
    counters.setData += 1;
    this.data = { ...this.data, ...patch };
    if (typeof callback === 'function') callback();
  };
  page.resolveCurrentStudentWithFallback = () => student;
  page.loadLearningStats = function loadLearningStats() {
    counters.loadLearningStats += 1;
    this.setData({ learningStats: { totalWords: 20, learnedWords: 4, dailyLearning: 2, weekStreak: 1 } });
    return this.updateRealTimeStats(student.id) !== false;
  };
  page.updateRealTimeStats = function updateRealTimeStats() {
    counters.updateRealTimeStats += 1;
    counters.learningRecordScans += 1;
    counters.getWordbookStats += 1;
    this.setData({ totalUnmasteredWords: 3 });
    return true;
  };
  page.loadRecentRecords = function loadRecentRecords() {
    counters.loadRecentRecords += 1;
    counters.recentRecordFilters += 1;
    this.setData({ recentRecords: [] });
  };
  page.loadRecommendedWordbooks = function loadRecommendedWordbooks() {
    counters.loadRecommendedWordbooks += 1;
    this.setData({ recommendedWordbooks: [] });
  };
  page.calculateAntiForgotTime = function calculateAntiForgotTime() {
    counters.calculateAntiForgotTime += 1;
    counters.antiForgotScans += 1;
    this.setData({ antiForgotTime: '没有' });
  };

  page.onLoad({});
  // Ignore the unrelated existing onLoad 100 ms page-data timer in this focused test.
  timers.clear();
  resetCounters(counters);
  return { label, page, counters };
}

function unload(instance) {
  activeCounters = instance.counters;
  instance.page.onUnload();
}

function assertRefreshCounts(counters, expected, message) {
  assert.deepStrictEqual(pickRefreshCounts(counters), expected, message);
}

const fullRefreshOnce = {
  loadLearningStats: 1,
  updateRealTimeStats: 1,
  loadRecentRecords: 1,
  calculateAntiForgotTime: 1,
  loadRecommendedWordbooks: 1
};

try {
  // A. The real login full-pull event order must collapse to one complete refresh.
  const loginPull = mount('login-full-pull');
  app.emit('wordMasteryUpdated');
  app.emit('learningRecordAdded');
  app.emit('cloudSyncComplete');
  runZeroDelayTimers();
  console.log('homepage-5e login full-pull counts:', JSON.stringify(loginPull.counters));
  assertRefreshCounts(
    loginPull.counters,
    fullRefreshOnce,
    'login full-pull notifications must produce exactly one complete homepage refresh'
  );
  assert.strictEqual(loginPull.counters.setData, 6);
  assert.strictEqual(loginPull.counters.learningRecordScans, 1);
  assert.strictEqual(loginPull.counters.recentRecordFilters, 1);
  assert.strictEqual(loginPull.counters.getWordbookStats, 1);
  assert.strictEqual(loginPull.counters.antiForgotScans, 1);
  unload(loginPull);

  // B. Normal learning keeps the real record behavior and coalesces preceding mastery work.
  const normalLearning = mount('normal-learning');
  app.emit('wordMasteryUpdated');
  app.emit('learningRecordAdded', { studentId: student.id, wordbookId: wordbook.id, id: 'record-5e' });
  runZeroDelayTimers();
  assertRefreshCounts(normalLearning.counters, {
    loadLearningStats: 0,
    updateRealTimeStats: 1,
    loadRecentRecords: 1,
    calculateAntiForgotTime: 1,
    loadRecommendedWordbooks: 0
  });
  assert.strictEqual(normalLearning.counters.setData, 3);
  assert.strictEqual(normalLearning.counters.learningRecordScans, 1);
  assert.strictEqual(normalLearning.counters.recentRecordFilters, 1);
  assert.strictEqual(normalLearning.counters.antiForgotScans, 1);
  assert.strictEqual(normalLearning.counters.toast, 1);
  unload(normalLearning);

  // C. Mastery-only still refreshes anti-forgetting once through fallback.
  const masteryOnly = mount('mastery-only');
  app.emit('wordMasteryUpdated');
  assert.strictEqual(masteryOnly.counters.calculateAntiForgotTime, 0);
  assert.strictEqual(zeroDelayTimerCount(), 1);
  runZeroDelayTimers();
  assert.strictEqual(masteryOnly.counters.calculateAntiForgotTime, 1);
  assert.strictEqual(masteryOnly.counters.setData, 1);
  unload(masteryOnly);

  // D1. A real record by itself preserves immediate record-specific behavior and toast.
  const realRecordOnly = mount('real-record-only');
  app.emit('learningRecordAdded', { studentId: student.id, wordbookId: wordbook.id, id: 'record-only' });
  runZeroDelayTimers();
  assertRefreshCounts(realRecordOnly.counters, {
    loadLearningStats: 0,
    updateRealTimeStats: 1,
    loadRecentRecords: 1,
    calculateAntiForgotTime: 1,
    loadRecommendedWordbooks: 0
  });
  assert.strictEqual(realRecordOnly.counters.setData, 3);
  assert.strictEqual(realRecordOnly.counters.toast, 1);
  unload(realRecordOnly);

  // D2. A payload-less record event by itself keeps the generic fallback refresh.
  const genericRecordOnly = mount('generic-record-only');
  app.emit('learningRecordAdded');
  runZeroDelayTimers();
  assertRefreshCounts(genericRecordOnly.counters, {
    loadLearningStats: 1,
    updateRealTimeStats: 1,
    loadRecentRecords: 1,
    calculateAntiForgotTime: 1,
    loadRecommendedWordbooks: 0
  });
  assert.strictEqual(genericRecordOnly.counters.setData, 4);
  assert.strictEqual(genericRecordOnly.counters.toast, 0);
  unload(genericRecordOnly);

  // E. A direct full pull without login-service cloudSyncComplete must flush normally.
  const directPull = mount('direct-full-pull');
  app.emit('wordMasteryUpdated');
  app.emit('learningRecordAdded');
  assert.strictEqual(zeroDelayTimerCount(), 1);
  runZeroDelayTimers();
  assertRefreshCounts(directPull.counters, {
    loadLearningStats: 1,
    updateRealTimeStats: 1,
    loadRecentRecords: 1,
    calculateAntiForgotTime: 1,
    loadRecommendedWordbooks: 0
  });
  assert.strictEqual(directPull.counters.setData, 4);
  unload(directPull);

  // F. cloudSyncComplete supersedes pending partial work before the zero-delay fallback.
  const superseded = mount('superseded');
  app.emit('wordMasteryUpdated');
  app.emit('learningRecordAdded');
  assert.strictEqual(zeroDelayTimerCount(), 1);
  app.emit('cloudSyncComplete');
  assert.strictEqual(zeroDelayTimerCount(), 0);
  runZeroDelayTimers();
  assertRefreshCounts(superseded.counters, fullRefreshOnce);
  unload(superseded);

  // G. Unload invalidates pending work and leaves the old Page instance untouched.
  const unloadedPending = mount('unloaded-pending');
  app.emit('wordMasteryUpdated');
  app.emit('learningRecordAdded');
  assert.strictEqual(zeroDelayTimerCount(), 1);
  unload(unloadedPending);
  const afterUnload = { ...unloadedPending.counters };
  assert.strictEqual(zeroDelayTimerCount(), 0);
  runZeroDelayTimers();
  assert.deepStrictEqual(unloadedPending.counters, afterUnload);
  assert.strictEqual(app.listenerCount('wordMasteryUpdated'), 0);
  assert.strictEqual(app.listenerCount('learningRecordAdded'), 0);
  assert.strictEqual(app.listenerCount('cloudSyncComplete'), 0);

  // H. Repeated mount/unmount cycles do not accumulate timers or listeners.
  for (let cycle = 0; cycle < 3; cycle += 1) {
    const instance = mount(`cycle-${cycle}`);
    app.emit('wordMasteryUpdated');
    assert.strictEqual(zeroDelayTimerCount(), 1);
    unload(instance);
    assert.strictEqual(zeroDelayTimerCount(), 0);
    assert.strictEqual(app.listenerCount('wordMasteryUpdated'), 0);
  }

  console.log('homepage-5e scenario counts:', JSON.stringify({
    loginFullPull: loginPull.counters,
    normalLearning: normalLearning.counters,
    masteryOnly: masteryOnly.counters,
    realRecordOnly: realRecordOnly.counters,
    genericRecordOnly: genericRecordOnly.counters,
    directFullPullFallback: directPull.counters,
    cloudSyncSuperseded: superseded.counters,
    unloadedPending: unloadedPending.counters
  }));
  console.log('homepage-full-pull-event-coordination: PASS');
} finally {
  global.setTimeout = originalSetTimeout;
  global.clearTimeout = originalClearTimeout;
}
