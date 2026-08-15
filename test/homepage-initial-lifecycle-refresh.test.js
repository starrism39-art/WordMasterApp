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

function flushTimers() {
  while (timers.size > 0) {
    const next = Array.from(timers.entries())
      .sort((left, right) => left[1].delay - right[1].delay || left[0] - right[0])[0];
    const [id, timer] = next;
    timers.delete(id);
    timer.handler();
  }
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

const currentUser = { id: 'account-6a', username: 'account-6a' };
const studentA = { id: 'student-6a-a', name: 'Student A', ownerId: currentUser.id };
const studentB = { id: 'student-6a-b', name: 'Student B', ownerId: currentUser.id };
const bookA = { id: 'book-6a-a', title: 'Book A', totalWords: 20 };
const bookB = { id: 'book-6a-b', title: 'Book B', totalWords: 30 };
const storage = {};
const app = createEventBus();

app.getLearningRecords = () => storage.learningRecords || [];
app.migrateLegacyStudentsForUser = () => {};
global.getApp = () => app;

global.wx = {
  getStorageSync(key) {
    return storage[key];
  },
  setStorageSync(key, value) {
    storage[key] = value;
  },
  showToast() {}
};

let indexDefinition = null;
global.Page = (definition) => {
  indexDefinition = definition;
};
require('../pages/index/index.js');
assert.ok(indexDefinition, 'index page must register itself');

function resetEnvironment(student = studentA, wordbook = bookA) {
  timers.clear();
  nextTimerId = 1;
  Object.keys(storage).forEach((key) => delete storage[key]);
  Object.keys(app.eventListeners).forEach((key) => delete app.eventListeners[key]);
  Object.keys(app.globalData).forEach((key) => delete app.globalData[key]);

  storage.currentUser = currentUser;
  storage.currentStudent = student;
  storage.selectedStudent = student;
  storage.students = [studentA, studentB];
  storage.currentWordbook = wordbook;
  storage.selectedWordbook = wordbook;
  storage[`currentWordbook_${student.id}`] = wordbook;
  storage.learningRecords = [];
  storage.wordMastery = {};

  app.globalData.currentUser = currentUser;
  app.globalData.currentStudent = student;
  app.globalData.currentWordbook = wordbook;
  app.globalData.selectedWordbook = wordbook;
}

function emptyCounts() {
  return {
    loadPageData: 0,
    loadLearningStats: 0,
    updateRealTimeStats: 0,
    loadRecentRecords: 0,
    loadRecommendedWordbooks: 0,
    calculateAntiForgotTime: 0,
    setData: 0,
    lateRefresh: 0,
    lateSetData: 0
  };
}

function refreshCounts(counts) {
  return {
    loadPageData: counts.loadPageData,
    loadLearningStats: counts.loadLearningStats,
    updateRealTimeStats: counts.updateRealTimeStats,
    loadRecentRecords: counts.loadRecentRecords,
    loadRecommendedWordbooks: counts.loadRecommendedWordbooks,
    calculateAntiForgotTime: counts.calculateAntiForgotTime
  };
}

const fullPageRefreshOnce = {
  loadPageData: 1,
  loadLearningStats: 1,
  updateRealTimeStats: 1,
  loadRecentRecords: 1,
  loadRecommendedWordbooks: 1,
  calculateAntiForgotTime: 1
};

function createPage(label) {
  const counts = emptyCounts();
  const contexts = [];
  const page = {
    ...indexDefinition,
    data: {
      ...indexDefinition.data,
      currentStudent: null,
      currentWordbook: null
    }
  };

  page.setData = function setData(patch, callback) {
    counts.setData += 1;
    if (this._testUnloaded) counts.lateSetData += 1;
    this.data = { ...this.data, ...patch };
    if (typeof callback === 'function') callback();
  };
  page.resolveCurrentStudentWithFallback = () => app.globalData.currentStudent || null;

  const originalLoadPageData = page.loadPageData;
  page.loadPageData = function loadPageDataSpy() {
    counts.loadPageData += 1;
    if (this._testUnloaded) counts.lateRefresh += 1;
    return originalLoadPageData.apply(this, arguments);
  };
  page.loadLearningStats = function loadLearningStatsSpy() {
    counts.loadLearningStats += 1;
    if (this._testUnloaded) counts.lateRefresh += 1;
    contexts.push({
      operation: 'stats',
      studentId: this.data.currentStudent && this.data.currentStudent.id,
      wordbookId: this.data.currentWordbook && this.data.currentWordbook.id,
      records: storage.learningRecords.length,
      masteryStudents: Object.keys(storage.wordMastery).length
    });
    this.setData({ learningStats: { totalWords: 20, learnedWords: 4, dailyLearning: 1, weekStreak: 1 } });
    return this.updateRealTimeStats(this.data.currentStudent && this.data.currentStudent.id) !== false;
  };
  page.updateRealTimeStats = function updateRealTimeStatsSpy() {
    counts.updateRealTimeStats += 1;
    if (this._testUnloaded) counts.lateRefresh += 1;
    this.setData({ totalUnmasteredWords: 16 });
    return true;
  };
  page.loadRecentRecords = function loadRecentRecordsSpy() {
    counts.loadRecentRecords += 1;
    if (this._testUnloaded) counts.lateRefresh += 1;
    this.setData({ recentRecords: storage.learningRecords.slice() });
  };
  page.loadRecommendedWordbooks = function loadRecommendedWordbooksSpy() {
    counts.loadRecommendedWordbooks += 1;
    if (this._testUnloaded) counts.lateRefresh += 1;
    this.setData({ recommendedWordbooks: [] });
  };
  page.calculateAntiForgotTime = function calculateAntiForgotTimeSpy() {
    counts.calculateAntiForgotTime += 1;
    if (this._testUnloaded) counts.lateRefresh += 1;
    this.setData({ antiForgotTime: '没有' });
  };

  return { label, page, counts, contexts };
}

function mountAndShow(label) {
  const instance = createPage(label);
  instance.page.onLoad({});
  instance.page.onShow();
  return instance;
}

function unload(instance) {
  instance.page._testUnloaded = true;
  instance.page.onUnload();
}

try {
  // A. The real initial onLoad -> onShow lifecycle owns one complete refresh.
  resetEnvironment();
  const initial = mountAndShow('initial');
  const initialTimerCount = timers.size;
  flushTimers();
  console.log('homepage-6a before/after lifecycle counts:', JSON.stringify({
    timersBeforeFlush: initialTimerCount,
    ...initial.counts
  }));
  assert.deepStrictEqual(
    refreshCounts(initial.counts),
    fullPageRefreshOnce,
    'initial onLoad -> onShow must execute one complete homepage refresh'
  );
  assert.strictEqual(initialTimerCount, 1, 'initial lifecycle must leave one owned refresh timer');
  assert.strictEqual(initial.counts.setData, 12, 'initial lifecycle setData work must remain bounded');
  assert.strictEqual(initial.page.data.loading, false);
  unload(initial);

  // B/D. Returning after learning data changes performs one additional complete refresh.
  resetEnvironment();
  const learningReturn = mountAndShow('learning-return');
  flushTimers();
  Object.assign(learningReturn.counts, emptyCounts());
  if (typeof learningReturn.page.onHide === 'function') learningReturn.page.onHide();
  storage.learningRecords = [{ id: 'record-6a', studentId: studentA.id, wordbookId: bookA.id }];
  storage.wordMastery = { [studentA.id]: { [bookA.id]: { word1: { status: 'known' } } } };
  learningReturn.page.onShow();
  assert.strictEqual(timers.size, 1);
  flushTimers();
  assert.deepStrictEqual(refreshCounts(learningReturn.counts), fullPageRefreshOnce);
  assert.strictEqual(learningReturn.page.data.recentRecords.length, 1);
  assert.strictEqual(learningReturn.page.data.loading, false);
  assert.deepStrictEqual(learningReturn.contexts.at(-1), {
    operation: 'stats',
    studentId: studentA.id,
    wordbookId: bookA.id,
    records: 1,
    masteryStudents: 1
  });
  unload(learningReturn);

  // C. Unloading before the initial timer fires prevents every late page side effect.
  resetEnvironment();
  const quickUnload = mountAndShow('quick-unload');
  assert.strictEqual(timers.size, 1);
  unload(quickUnload);
  const setDataAtUnload = quickUnload.counts.setData;
  assert.strictEqual(timers.size, 0, 'unload must clear the owned initial refresh timer');
  flushTimers();
  assert.strictEqual(quickUnload.counts.lateRefresh, 0);
  assert.strictEqual(quickUnload.counts.lateSetData, 0);
  assert.strictEqual(quickUnload.counts.setData, setDataAtUnload);

  // E. A later student/wordbook context is used by the next onShow refresh.
  resetEnvironment();
  const contextSwitch = mountAndShow('context-switch');
  flushTimers();
  Object.assign(contextSwitch.counts, emptyCounts());
  if (typeof contextSwitch.page.onHide === 'function') contextSwitch.page.onHide();
  storage.currentStudent = studentB;
  storage.selectedStudent = studentB;
  storage.currentWordbook = bookB;
  storage.selectedWordbook = bookB;
  storage[`currentWordbook_${studentB.id}`] = bookB;
  app.globalData.currentStudent = studentB;
  app.globalData.currentWordbook = bookB;
  app.globalData.selectedWordbook = bookB;
  contextSwitch.page.onShow();
  flushTimers();
  assert.deepStrictEqual(refreshCounts(contextSwitch.counts), fullPageRefreshOnce);
  assert.strictEqual(contextSwitch.page.data.currentStudent.id, studentB.id);
  assert.strictEqual(contextSwitch.page.data.currentWordbook.id, bookB.id);
  assert.strictEqual(contextSwitch.contexts.at(-1).studentId, studentB.id);
  assert.strictEqual(contextSwitch.contexts.at(-1).wordbookId, bookB.id);
  unload(contextSwitch);

  // F. Login full-pull completion supersedes both partial 5E work and initial refresh.
  resetEnvironment();
  const overlap = mountAndShow('full-pull-overlap');
  app.emit('wordMasteryUpdated');
  app.emit('learningRecordAdded');
  app.emit('cloudSyncComplete');
  flushTimers();
  assert.deepStrictEqual(refreshCounts(overlap.counts), {
    ...fullPageRefreshOnce,
    loadPageData: 0
  });
  assert.strictEqual(overlap.page.data.loading, false);
  unload(overlap);

  // G. Repeated mount/unmount cycles do not accumulate timers or listeners.
  for (let cycle = 0; cycle < 3; cycle += 1) {
    resetEnvironment();
    const instance = mountAndShow(`cycle-${cycle}`);
    assert.strictEqual(timers.size, 1);
    assert.strictEqual(app.listenerCount('wordMasteryUpdated'), 1);
    assert.strictEqual(app.listenerCount('learningRecordAdded'), 1);
    assert.strictEqual(app.listenerCount('cloudSyncComplete'), 1);
    unload(instance);
    assert.strictEqual(timers.size, 0);
    assert.strictEqual(app.listenerCount('wordMasteryUpdated'), 0);
    assert.strictEqual(app.listenerCount('learningRecordAdded'), 0);
    assert.strictEqual(app.listenerCount('cloudSyncComplete'), 0);
  }

  console.log('homepage-initial-lifecycle-refresh: PASS');
} finally {
  global.setTimeout = originalSetTimeout;
  global.clearTimeout = originalClearTimeout;
}
