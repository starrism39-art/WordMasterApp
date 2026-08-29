'use strict';

const assert = require('assert');
const wordbooks = require('../data/wordbooks-simple.js');

const storage = {
  wordMastery: {},
  learningProgress: {},
  learningRecords: [],
  studentSettings: {}
};

global.wx = {
  getStorageSync: (key) => storage[key],
  setStorageSync: (key, value) => { storage[key] = value; },
  removeStorageSync: (key) => { delete storage[key]; },
  showToast: () => {}
};

const app = {
  globalData: {},
  emit: () => {},
  getLearningRecords(studentId, wordbookId) {
    return storage.learningRecords.filter((record) => (
      String(record.studentId || record.student_id || '') === String(studentId) &&
      String(record.wordbookId || record.wordbook_id || '') === String(wordbookId)
    ));
  }
};
global.getApp = () => app;

const loadPageDefinition = (modulePath) => {
  let definition = null;
  global.Page = (value) => { definition = value; };
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
  assert.ok(definition, `Page definition not captured: ${modulePath}`);
  return definition;
};

const createPage = (definition, dataPatch) => {
  const page = {
    ...definition,
    data: {
      ...definition.data,
      ...dataPatch
    }
  };
  page.setData = function setData(patch, callback) {
    this.data = { ...this.data, ...patch };
    if (typeof callback === 'function') callback();
  };
  return page;
};

const indexDefinition = loadPageDefinition('../pages/index/index.js');
const statsDefinition = loadPageDefinition('../subpages/stats/stats.js');
const wordbookDefinition = loadPageDefinition('../subpages/wordbook/wordbook.js');

const bookIds = [
  'senior_textbook_real',
  'gaokao_reading_words',
  'senior_book_1_ren_jiao',
  'junior_8th_first'
];

bookIds.forEach((wordbookId, bookIndex) => {
  const studentId = bookIndex === bookIds.length - 1 ? 'student789' : 'student456';
  const student = { id: studentId, name: studentId, grade: bookIndex === 3 ? '八年级' : '高一' };
  const wordbook = wordbooks.getBookById(wordbookId);
  assert.ok(wordbook, `missing fixture wordbook: ${wordbookId}`);

  storage.wordMastery[studentId] = storage.wordMastery[studentId] || {};
  storage.wordMastery[studentId][wordbookId] = {
    [`${wordbookId}_alpha`]: { mastered: true, difficult: false },
    [`${wordbookId}_beta`]: { mastered: false, difficult: true }
  };
  storage.learningProgress[studentId] = storage.learningProgress[studentId] || { wordbooks: {} };
  storage.learningProgress[studentId].wordbooks[wordbookId] = {
    completedCount: 99,
    learnedWords: 99,
    totalCount: wordbook.totalWords
  };
  storage.learningRecords.push(
    { id: `${studentId}_${wordbookId}_1`, studentId, wordbookId, studyDate: '2026-07-20T08:00:00+08:00' },
    { id: `${studentId}_${wordbookId}_2`, studentId, wordbookId, studyDate: '2026-07-21T08:00:00+08:00' }
  );

  storage.currentStudent = student;
  storage.selectedStudent = student;
  storage.currentWordbook = wordbook;
  storage.selectedWordbook = wordbook;
  storage.currentWordbookStudentId = studentId;
  storage.studentSettings[`student_${studentId}_wordbook`] = wordbook;
  app.globalData.currentStudent = student;
  app.globalData.currentWordbook = wordbook;
  app.globalData.selectedWordbook = wordbook;
  app.globalData.currentWordbookStudentId = studentId;

  if (wordbookId === 'gaokao_reading_words') {
    storage[`wordbook_stats_${studentId}_${wordbookId}`] = {
      isManualOverride: true,
      manualMasteredCount: 5,
      manualNotMasteredCount: 3,
      manualCheckinDays: 4,
      baseMasteredCount: 2,
      baseNotMasteredCount: 1,
      baseCheckinDays: 2
    };
  }

  const indexPage = createPage(indexDefinition, {
    currentStudent: student,
    currentWordbook: wordbook
  });
  indexPage.saveCurrentPageState = () => {};
  indexPage.updateRealTimeStats(studentId);

  const currentRecords = app.getLearningRecords(studentId, wordbookId);
  const statsPage = createPage(statsDefinition, {});
  statsPage.updateLearningStats(currentRecords);

  const wordbookPage = createPage(wordbookDefinition, {
    currentStudent: student,
    currentWordbookId: wordbookId,
    userInfo: null
  });
  const card = wordbookPage.processWordbooksData([wordbook])[0];

  assert.strictEqual(
    indexPage.data.learningStats.learnedWords,
    statsPage.data.learningStats.totalLearnedWords,
    `${studentId}/${wordbookId}: 首页与统计页已学数必须一致`
  );
  assert.strictEqual(
    indexPage.data.totalUnmasteredWords,
    statsPage.data.totalUnmasteredWords,
    `${studentId}/${wordbookId}: 首页与统计页未掌握数必须一致`
  );
  assert.strictEqual(
    card.learnedWords,
    indexPage.data.learningStats.learnedWords,
    `${studentId}/${wordbookId}: 词书页进度必须与首页一致`
  );
  assert.strictEqual(
    indexPage.data.learningStats.weekStreak,
    wordbookId === 'gaokao_reading_words' ? 4 : 2,
    `${studentId}/${wordbookId}: 打卡天数必须按当前词书去重并应用同一修正`
  );
  assert.notStrictEqual(card.learnedWords, 99, '存在 wordMastery 时不能使用旧 learningProgress');
});

const syncedStudent = {
  id: 'student_1785337316821',
  name: 'E2E-CROSS-CLIENT-ONLY',
  grade: '高一'
};
const syncedWordbook = wordbooks.getBookById('senior_textbook_real');
storage.currentStudent = syncedStudent;
storage.selectedStudent = syncedStudent;
storage.currentWordbook = syncedWordbook;
storage.selectedWordbook = syncedWordbook;
storage.currentWordbookStudentId = syncedStudent.id;
storage.studentSettings[`student_${syncedStudent.id}_wordbook`] = syncedWordbook;
app.globalData.currentStudent = syncedStudent;
app.globalData.currentWordbook = syncedWordbook;
app.globalData.selectedWordbook = syncedWordbook;
app.globalData.currentWordbookStudentId = syncedStudent.id;

const syncRefreshCalls = [];
const syncedIndexPage = createPage(indexDefinition, {
  currentStudent: null,
  currentWordbook: null
});
syncedIndexPage.loadLearningStats = () => syncRefreshCalls.push('stats');
syncedIndexPage.updateRealTimeStats = (studentId) => syncRefreshCalls.push(`realtime:${studentId}`);
syncedIndexPage.loadRecentRecords = () => syncRefreshCalls.push('records');
syncedIndexPage.loadRecommendedWordbooks = () => syncRefreshCalls.push('wordbooks');
syncedIndexPage.calculateAntiForgotTime = () => syncRefreshCalls.push('review');

const refreshedContext = syncedIndexPage.refreshAfterCloudSync();
assert.strictEqual(refreshedContext.student.id, syncedStudent.id);
assert.strictEqual(refreshedContext.wordbook.id, syncedWordbook.id);
assert.strictEqual(syncedIndexPage.data.currentStudent.id, syncedStudent.id);
assert.strictEqual(syncedIndexPage.data.currentWordbook.id, syncedWordbook.id);
assert.deepStrictEqual(syncRefreshCalls, [
  'stats',
  `realtime:${syncedStudent.id}`,
  'records',
  'wordbooks',
  'review'
], '云同步晚于首页加载时必须立即刷新首页、记录和抗遗忘摘要');

const teacherStudent = { id: 'student-teacher-progress', name: 'teacher-progress' };
const teacherBook = {
  id: 'twb_progress_refresh',
  wordbookId: 'twb_progress_refresh',
  title: '教师词书进度刷新',
  sourceType: 'teacher_custom',
  status: 'active',
  totalWords: 100
};
storage.learningProgress[teacherStudent.id] = {
  learnedWords: 1,
  totalWords: 25,
  wordbooks: {
    [teacherBook.id]: {
      completedCount: 1,
      learnedWords: 1,
      totalCount: 25
    }
  }
};
storage.wordMastery[teacherStudent.id] = {
  [teacherBook.id]: {
    [`${teacherBook.id}_education`]: { mastered: true, difficult: false }
  }
};
storage.learningRecords.push({
  id: 'teacher-progress-record',
  studentId: teacherStudent.id,
  wordbookId: teacherBook.id,
  learnedWordIds: [`${teacherBook.id}_education`]
});
app.globalData.currentStudent = teacherStudent;
const teacherWordbookPage = createPage(wordbookDefinition, {
  currentStudent: teacherStudent,
  currentWordbookId: teacherBook.id,
  userInfo: null
});
const recordsBeforeRefresh = JSON.parse(JSON.stringify(storage.learningRecords));
const masteryBeforeRefresh = JSON.parse(JSON.stringify(storage.wordMastery));
assert.strictEqual(teacherWordbookPage.refreshCatalogProgressTotals([teacherBook]), true);
const refreshedTeacherProgress = storage.learningProgress[teacherStudent.id].wordbooks[teacherBook.id];
assert.strictEqual(refreshedTeacherProgress.completedCount, 1);
assert.strictEqual(refreshedTeacherProgress.learnedWords, 1);
assert.strictEqual(refreshedTeacherProgress.totalCount, 100);
const teacherCard = teacherWordbookPage.processWordbooksData([teacherBook])[0];
assert.strictEqual(teacherCard.learnedWords, 1);
assert.strictEqual(teacherCard.progressPercent, 1);
assert.deepStrictEqual(storage.learningRecords, recordsBeforeRefresh);
assert.deepStrictEqual(storage.wordMastery, masteryBeforeRefresh);

console.log('page-stat-consistency: PASS');
