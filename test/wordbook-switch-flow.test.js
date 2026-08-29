'use strict';

const assert = require('assert');
const WordbookRepository = require('../utils/wordbook-repository.js');
const { resolveCurrentWordbook, setCurrentWordbook } = require('../utils/learning-context.js');
const { getCategoryForStage, resolveGradeStage } = require('../utils/grade-stage.js');

const originalGlobals = {
  Page: global.Page,
  wx: global.wx,
  getApp: global.getApp,
  getCurrentPages: global.getCurrentPages,
  setTimeout: global.setTimeout
};
const originalListWordbooks = WordbookRepository.listWordbooks;

const storage = {
  studentSettings: {},
  learningProgress: {},
  learningRecords: [],
  wordMastery: {}
};
const toasts = [];
const navigations = [];
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

global.wx = {
  getStorageSync: (key) => storage[key],
  setStorageSync: (key, value) => { storage[key] = value; },
  showToast: (options) => { toasts.push(options); },
  navigateBack: (options) => { navigations.push({ type: 'navigateBack', ...options }); },
  switchTab: (options) => { navigations.push({ type: 'switchTab', ...options }); },
  navigateTo: (options) => { navigations.push({ type: 'navigateTo', ...options }); }
};
global.getApp = () => app;
global.getCurrentPages = () => [
  { route: 'pages/index/index' },
  { route: 'subpages/wordbook/wordbook' }
];
global.setTimeout = (callback) => {
  callback();
  return 1;
};

const loadPageDefinition = (modulePath) => {
  let definition = null;
  global.Page = (value) => { definition = value; };
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
  assert.ok(definition, `Page definition not captured: ${modulePath}`);
  return definition;
};

const createPage = (definition, dataPatch = {}) => {
  const page = {
    ...definition,
    data: { ...definition.data, ...dataPatch }
  };
  page.setData = function setData(update, callback) {
    this.data = { ...this.data, ...update };
    if (typeof callback === 'function') callback();
  };
  return page;
};

(async () => {
  ['初一', '初二', '初三', '七年级', '8th', '9'].forEach((grade) => {
    assert.strictEqual(resolveGradeStage(grade), '初中', `${grade} must resolve to 初中`);
  });
  assert.strictEqual(resolveGradeStage('高二'), '高中');
  assert.strictEqual(resolveGradeStage('大学三年级'), '大学');
  assert.strictEqual(resolveGradeStage('本科'), '大学');
  assert.strictEqual(resolveGradeStage('一年级'), '小学');
  assert.strictEqual(getCategoryForStage('大学'), 'college');

  const officialBooks = WordbookRepository.getOfficialWordbooks();
  assert.strictEqual(officialBooks.length, 46, 'official catalog baseline must stay at 46');
  assert.strictEqual(officialBooks.filter((book) => book.category === 'junior').length, 35);

  const studentA = { id: 'student-a', name: 'A', grade: '初二' };
  const studentB = { id: 'student-b', name: 'B', grade: '高一' };
  const oldOfficial = officialBooks.find((book) => book.id === 'junior_8th_second');
  const newOfficial = officialBooks.find((book) => book.id === 'junior_9th_first');
  const otherStudentBook = officialBooks.find((book) => book.id === 'senior_book_1_ren_jiao');
  const activeTeacherBook = {
    id: 'twb_active_switch',
    wordbookId: 'twb_active_switch',
    title: 'Active teacher book',
    category: '高中',
    sourceType: 'teacher_custom',
    status: 'active',
    version: 2,
    totalWords: 30
  };
  const draftTeacherBook = {
    ...activeTeacherBook,
    id: 'twb_draft_switch',
    wordbookId: 'twb_draft_switch',
    title: 'Draft teacher book',
    status: 'draft',
    version: 0,
    totalWords: 0
  };
  const disabledTeacherBook = {
    ...activeTeacherBook,
    id: 'twb_disabled_switch',
    wordbookId: 'twb_disabled_switch',
    title: 'Disabled teacher book',
    status: 'disabled'
  };

  storage.learningProgress = {
    [studentA.id]: {
      wordbooks: {
        [oldOfficial.id]: { completedCount: 20, learnedWords: 20, totalCount: oldOfficial.totalWords },
        [activeTeacherBook.id]: { completedCount: 7, learnedWords: 7, totalCount: 30 }
      }
    },
    [studentB.id]: {
      wordbooks: {
        [otherStudentBook.id]: { completedCount: 9, learnedWords: 9, totalCount: otherStudentBook.totalWords }
      }
    }
  };
  storage.currentStudent = studentA;
  storage.selectedStudent = studentA;
  app.globalData.currentStudent = studentA;
  setCurrentWordbook(app, studentA, oldOfficial, { emit: false });
  setCurrentWordbook(app, studentB, otherStudentBook, { emit: false });
  app.globalData.currentStudent = studentA;
  setCurrentWordbook(app, studentA, oldOfficial, { emit: false });

  WordbookRepository.listWordbooks = async () => officialBooks.concat([
    activeTeacherBook,
    draftTeacherBook,
    disabledTeacherBook
  ]);

  const wordbookDefinition = loadPageDefinition('../subpages/wordbook/wordbook.js');
  const wordbookPage = createPage(wordbookDefinition, { currentStudent: studentA });
  wordbookPage.syncCurrentContext();
  assert.strictEqual(wordbookPage.data.currentFilter, '初中');
  await wordbookPage.loadWordbooks();
  assert.strictEqual(wordbookPage.data.allWordbooks.length, 46);
  assert.strictEqual(wordbookPage.data.wordbooks.length, 35, 'default stage must show all junior official books');
  assert.deepStrictEqual(wordbookPage.data.teacherWordbooks.map((book) => book.id), [activeTeacherBook.id]);
  assert.deepStrictEqual(
    wordbookPage.data.managedInactiveTeacherWordbooks.map((book) => book.status).sort(),
    ['disabled', 'draft']
  );

  wordbookPage.changeFilter({ currentTarget: { dataset: { filter: 'all' } } });
  assert.strictEqual(wordbookPage.data.wordbooks.length, 46, 'all filter must keep every official book');
  wordbookPage.changeFilter({ currentTarget: { dataset: { filter: '大学' } } });
  assert.strictEqual(wordbookPage.data.wordbooks.length, 0, 'no university official book may fall back to another stage');
  assert.strictEqual(wordbookPage.data.teacherWordbooks.length, 1, 'active teacher book ignores student grade');

  const progressSnapshot = JSON.parse(JSON.stringify(storage.learningProgress));
  const studentBSelectionSnapshot = JSON.parse(JSON.stringify(
    storage.studentSettings[`student_${studentB.id}_wordbook`]
  ));
  wordbookPage.switchWordbook({ currentTarget: { dataset: { id: newOfficial.id } } });
  assert.strictEqual(resolveCurrentWordbook(app, studentA).id, newOfficial.id);
  assert.deepStrictEqual(storage.learningProgress, progressSnapshot, 'switch must not create or reset progress');
  assert.deepStrictEqual(
    storage.studentSettings[`student_${studentB.id}_wordbook`],
    studentBSelectionSnapshot,
    'switch must not affect another student'
  );
  assert.strictEqual(toasts.some((toast) => toast.title === '切换成功'), true);
  assert.strictEqual(navigations.some((item) => item.type === 'navigateTo' && /learning/.test(item.url || '')), false);
  assert.strictEqual(navigations.some((item) => item.type === 'navigateBack'), true);

  wordbookPage.switchWordbook({ currentTarget: { dataset: { id: activeTeacherBook.id } } });
  const selectedTeacherBook = resolveCurrentWordbook(app, studentA);
  assert.strictEqual(selectedTeacherBook.id, activeTeacherBook.id);
  assert.strictEqual(selectedTeacherBook.sourceType, 'teacher_custom');
  assert.deepStrictEqual(storage.learningProgress, progressSnapshot);

  const teacherCard = wordbookPage.processWordbooksData([activeTeacherBook])[0];
  const oldOfficialCard = wordbookPage.processWordbooksData([oldOfficial])[0];
  const newOfficialCard = wordbookPage.processWordbooksData([newOfficial])[0];
  assert.strictEqual(teacherCard.learnedWords, 7);
  assert.strictEqual(oldOfficialCard.learnedWords, 20, 'old wordbook progress must remain recoverable');
  assert.strictEqual(newOfficialCard.learnedWords, 0, 'unlearned wordbook must display zero');

  wordbookPage.switchWordbook({ currentTarget: { dataset: { id: oldOfficial.id } } });
  assert.strictEqual(resolveCurrentWordbook(app, studentA).id, oldOfficial.id);
  assert.deepStrictEqual(storage.learningProgress, progressSnapshot, 'official/teacher switching must not cross progress');

  const indexDefinition = loadPageDefinition('../pages/index/index.js');
  const indexPage = createPage(indexDefinition, {
    currentStudent: studentA,
    currentWordbook: null
  });
  indexPage.cancelScheduledHomepageRefresh = () => {};
  indexPage.scheduleHomepageDataRefresh = () => {};
  indexPage.updateLearningWordbooks = () => {};
  indexPage.onShow();
  assert.strictEqual(indexPage.data.currentWordbook.id, oldOfficial.id);
  assert.strictEqual(indexPage.data.learningWordbooks, oldOfficial.title);
  indexPage.updateRealTimeStats(studentA.id);
  assert.strictEqual(indexPage.data.learningStats.learnedWords, 20);
  assert.strictEqual(indexPage.data.learningStats.totalWords, oldOfficial.totalWords);

  console.log('wordbook-switch-flow: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  WordbookRepository.listWordbooks = originalListWordbooks;
  global.Page = originalGlobals.Page;
  global.wx = originalGlobals.wx;
  global.getApp = originalGlobals.getApp;
  global.getCurrentPages = originalGlobals.getCurrentPages;
  global.setTimeout = originalGlobals.setTimeout;
});
