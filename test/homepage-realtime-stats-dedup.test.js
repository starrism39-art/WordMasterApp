'use strict';

const assert = require('assert');

const student = { id: 'student-5a', name: '5A Student', grade: '高一' };
const oldWordbook = { id: 'book-old', title: 'Old Book', totalWords: 10 };
const newWordbook = { id: 'book-new', title: 'New Book', totalWords: 20 };
const storage = {};
const app = {
  globalData: {},
  emit() {}
};

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
  showToast() {},
  switchTab() {},
  navigateTo() {}
};

let indexDefinition = null;
global.Page = (definition) => {
  indexDefinition = definition;
};
require('../pages/index/index.js');
assert.ok(indexDefinition, 'index page must register itself');

function resetContext(wordbook = oldWordbook) {
  Object.keys(storage).forEach((key) => delete storage[key]);
  Object.keys(app.globalData).forEach((key) => delete app.globalData[key]);

  storage.currentStudent = student;
  storage.selectedStudent = student;
  storage.students = [student];
  storage.studentSettings = {};
  storage[`${student.id}_stats`] = {
    totalWords: 10,
    learnedWords: 2,
    dailyLearning: 1,
    weekStreak: 1
  };
  storage.learningRecords = [];
  storage.wordMastery = {};
  storage.learningProgress = {};

  app.globalData.currentStudent = student;
  if (wordbook) {
    storage.currentWordbook = wordbook;
    storage.selectedWordbook = wordbook;
    storage.currentWordbookStudentId = student.id;
    storage.studentSettings[`student_${student.id}_wordbook`] = wordbook;
    app.globalData.currentWordbook = wordbook;
    app.globalData.selectedWordbook = wordbook;
  }
}

function createPage(dataPatch = {}) {
  const page = {
    ...indexDefinition,
    data: {
      ...indexDefinition.data,
      ...dataPatch
    }
  };
  page.setData = function setData(patch, callback) {
    this.data = { ...this.data, ...patch };
    if (typeof callback === 'function') callback();
  };
  return page;
}

function instrumentRefresh(page) {
  const counts = {
    loadLearningStats: 0,
    updateRealTimeStats: 0,
    loadRecentRecords: 0,
    calculateAntiForgotTime: 0,
    loadRecommendedWordbooks: 0
  };
  const originalLoadLearningStats = page.loadLearningStats;
  page._realTimeContexts = [];

  page.loadLearningStats = function loadLearningStatsSpy() {
    counts.loadLearningStats += 1;
    return originalLoadLearningStats.apply(this, arguments);
  };
  page.updateRealTimeStats = function updateRealTimeStatsSpy(studentId) {
    counts.updateRealTimeStats += 1;
    page._realTimeContexts.push({
      studentId,
      wordbookId: this.data.currentWordbook && this.data.currentWordbook.id
    });
  };
  page.loadRecentRecords = () => { counts.loadRecentRecords += 1; };
  page.calculateAntiForgotTime = () => { counts.calculateAntiForgotTime += 1; };
  page.loadRecommendedWordbooks = () => { counts.loadRecommendedWordbooks += 1; };

  return counts;
}

function runQueuedTimers(callback) {
  const originalSetTimeout = global.setTimeout;
  const timers = [];
  global.setTimeout = (handler, delay) => {
    timers.push({ handler, delay });
    return timers.length;
  };
  try {
    callback();
    timers.sort((left, right) => left.delay - right.delay);
    timers.forEach(({ handler }) => handler());
  } finally {
    global.setTimeout = originalSetTimeout;
  }
}

// A. loadLearningStats owns the normal real-time refresh.
resetContext();
const directPage = createPage({ currentStudent: student, currentWordbook: oldWordbook });
const directCounts = instrumentRefresh(directPage);
const directResult = directPage.loadLearningStats();
assert.strictEqual(directResult, true, 'normal synchronous load must report that real-time stats ran');
assert.strictEqual(directResult && directResult.then, undefined, 'loadLearningStats must stay synchronous');
assert.deepStrictEqual(directCounts, {
  loadLearningStats: 1,
  updateRealTimeStats: 1,
  loadRecentRecords: 0,
  calculateAntiForgotTime: 0,
  loadRecommendedWordbooks: 0
});

// B. A cloud-sync refresh must not repeat the real-time calculation.
resetContext();
const cloudPage = createPage({ currentStudent: null, currentWordbook: null });
cloudPage.resolveCurrentStudentWithFallback = () => student;
const cloudCounts = instrumentRefresh(cloudPage);
const refreshedContext = cloudPage.refreshAfterCloudSync();
assert.strictEqual(refreshedContext.student.id, student.id);
assert.strictEqual(refreshedContext.wordbook.id, oldWordbook.id);
assert.deepStrictEqual(cloudPage._realTimeContexts, [
  { studentId: student.id, wordbookId: oldWordbook.id }
]);
assert.deepStrictEqual(cloudCounts, {
  loadLearningStats: 1,
  updateRealTimeStats: 1,
  loadRecentRecords: 1,
  calculateAntiForgotTime: 1,
  loadRecommendedWordbooks: 1
});

// C. Isolate the onShow 100 ms refresh group from updateLearningWordbooks.
resetContext();
const onShowPage = createPage({ currentStudent: student, currentWordbook: oldWordbook });
onShowPage.resolveCurrentStudentWithFallback = () => student;
onShowPage.updateLearningWordbooks = () => {};
const onShowCounts = instrumentRefresh(onShowPage);
runQueuedTimers(() => onShowPage.onShow());
assert.deepStrictEqual(onShowCounts, {
  loadLearningStats: 1,
  updateRealTimeStats: 1,
  loadRecentRecords: 1,
  calculateAntiForgotTime: 1,
  loadRecommendedWordbooks: 1
});

// D. Switching wordbooks must update the new context exactly once.
resetContext();
const switchPage = createPage({
  currentStudent: student,
  currentWordbook: oldWordbook,
  gradeWordbooks: [oldWordbook, newWordbook]
});
switchPage.saveCurrentPageState = () => {};
const switchCounts = instrumentRefresh(switchPage);
switchPage.selectWordbook({ currentTarget: { dataset: { id: newWordbook.id } } });
assert.strictEqual(switchPage.data.currentWordbook.id, newWordbook.id);
assert.strictEqual(storage.currentWordbook.id, newWordbook.id);
assert.deepStrictEqual(switchPage._realTimeContexts, [
  { studentId: student.id, wordbookId: newWordbook.id }
]);
assert.deepStrictEqual(switchCounts, {
  loadLearningStats: 1,
  updateRealTimeStats: 1,
  loadRecentRecords: 1,
  calculateAntiForgotTime: 0,
  loadRecommendedWordbooks: 1
});

// E. Manual refresh preserves the other refresh operations and one real-time update.
resetContext();
const manualPage = createPage({ currentStudent: student, currentWordbook: oldWordbook });
manualPage.resolveCurrentStudentWithFallback = () => student;
const manualCounts = instrumentRefresh(manualPage);
runQueuedTimers(() => manualPage.refreshPage());
assert.deepStrictEqual(manualCounts, {
  loadLearningStats: 1,
  updateRealTimeStats: 1,
  loadRecentRecords: 1,
  calculateAntiForgotTime: 1,
  loadRecommendedWordbooks: 1
});
assert.strictEqual(manualPage.data.loading, false);

// F. Missing student keeps the existing no-refresh behavior.
resetContext();
const noStudentPage = createPage({ currentStudent: null, currentWordbook: null });
const noStudentCounts = instrumentRefresh(noStudentPage);
assert.strictEqual(noStudentPage.loadLearningStats(), false);
assert.strictEqual(noStudentCounts.updateRealTimeStats, 0);

// G. Missing wordbook still performs one calculation, whose existing result is zero.
resetContext(null);
const noWordbookPage = createPage({ currentStudent: student, currentWordbook: null });
let noWordbookUpdates = 0;
const originalUpdateRealTimeStats = noWordbookPage.updateRealTimeStats;
noWordbookPage.updateRealTimeStats = function updateWithoutWordbookSpy() {
  noWordbookUpdates += 1;
  return originalUpdateRealTimeStats.apply(this, arguments);
};
noWordbookPage.saveCurrentPageState = () => {};
noWordbookPage.loadLearningStats();
assert.strictEqual(noWordbookUpdates, 1);
assert.deepStrictEqual(noWordbookPage.data.learningStats, {
  totalWords: 0,
  learnedWords: 0,
  dailyLearning: 0,
  weekStreak: 0
});
assert.strictEqual(noWordbookPage.data.totalUnmasteredWords, 0);

// H. A stats-storage failure keeps the outer path's one-shot fallback.
resetContext();
const storageFailurePage = createPage({ currentStudent: student, currentWordbook: oldWordbook });
storageFailurePage.resolveCurrentStudentWithFallback = () => student;
const storageFailureCounts = instrumentRefresh(storageFailurePage);
const originalGetStorageSync = global.wx.getStorageSync;
let failStatsReadOnce = true;
global.wx.getStorageSync = (key) => {
  if (key === `${student.id}_stats` && failStatsReadOnce) {
    failStatsReadOnce = false;
    throw new Error('isolated stats storage failure');
  }
  return originalGetStorageSync(key);
};
try {
  storageFailurePage.refreshAfterCloudSync();
} finally {
  global.wx.getStorageSync = originalGetStorageSync;
}
assert.strictEqual(storageFailureCounts.loadLearningStats, 1);
assert.strictEqual(storageFailureCounts.updateRealTimeStats, 1);
assert.deepStrictEqual(storageFailurePage.data.learningStats, {
  totalWords: 0,
  learnedWords: 0,
  dailyLearning: 0,
  weekStreak: 0
});

// An internal real-time failure still permits the original outer one-shot retry.
resetContext();
const realTimeFailurePage = createPage({ currentStudent: student, currentWordbook: oldWordbook });
realTimeFailurePage.resolveCurrentStudentWithFallback = () => student;
const realTimeFailureCounts = instrumentRefresh(realTimeFailurePage);
realTimeFailurePage.updateRealTimeStats = () => {
  realTimeFailureCounts.updateRealTimeStats += 1;
  return realTimeFailureCounts.updateRealTimeStats > 1;
};
realTimeFailurePage.refreshAfterCloudSync();
assert.strictEqual(realTimeFailureCounts.loadLearningStats, 1);
assert.strictEqual(realTimeFailureCounts.updateRealTimeStats, 2);

console.log('homepage-realtime-stats-dedup counts:', JSON.stringify({
  normal: directCounts,
  cloudSync: cloudCounts,
  onShowRefreshGroup: onShowCounts,
  switchWordbook: switchCounts,
  manualRefresh: manualCounts,
  storageFallback: storageFailureCounts,
  realTimeFailureRetry: realTimeFailureCounts
}));
console.log('homepage-realtime-stats-dedup: PASS');
