'use strict';

const assert = require('assert');

const storage = {
  students: [{ id: 'student-456', name: '456' }],
  currentStudent: { id: 'student-456', name: '456' },
  learningRecords: [{
    id: 'record-1',
    studentId: 'student-456',
    wordbookId: 'senior_textbook_real',
    learnedWordIds: ['senior_textbook_real_alpha']
  }],
  wordMastery: {
    'student-456': {
      senior_textbook_real: {
        senior_textbook_real_alpha: { mastered: false, difficult: true }
      }
    }
  },
  learningProgress: {
    'student-456': {
      learnedWords: 9,
      totalWords: 1,
      student_name: '456',
      teacher_name: 'teacher',
      customField: { keep: true },
      wordbooks: {
        senior_textbook_real: {
          completedCount: 9,
          learnedWords: 9,
          totalCount: 1,
          dailyStats: { '2026-07-17': { newWords: 1 } }
        }
      }
    }
  }
};
const masteryBefore = JSON.stringify(storage.wordMastery);
const recordsBefore = JSON.stringify(storage.learningRecords);

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
  getStorageInfoSync() {
    return { keys: Object.keys(storage) };
  },
  cloud: null
};

let app = null;
global.App = (config) => {
  app = config;
};
global.getApp = () => app;
global.console = { log() {}, warn() {}, error() {} };

require('../app.js');

const migrationResult = app.migrateLearningProgress();
assert.strictEqual(migrationResult.normalized, true);
assert.strictEqual(storage.learningProgress['student-456'].learnedWords, 1);
assert.strictEqual(storage.learningProgress['student-456'].wordbooks.senior_textbook_real.completedCount, 1);
assert.strictEqual(storage.learningProgress['student-456'].wordbooks.senior_textbook_real.totalCount, 4292);
assert.strictEqual(storage.learningProgress['student-456'].student_name, '456');
assert.strictEqual(storage.learningProgress['student-456'].teacher_name, 'teacher');
assert.deepStrictEqual(storage.learningProgress['student-456'].customField, { keep: true });
assert.deepStrictEqual(storage.learningProgress['student-456'].wordbooks.senior_textbook_real.dailyStats, {
  '2026-07-17': { newWords: 1 }
});
assert.strictEqual(JSON.stringify(storage.wordMastery), masteryBefore, '迁移不能改写掌握明细');
assert.strictEqual(JSON.stringify(storage.learningRecords), recordsBefore, '迁移不能改写学习记录');

const record = {
  studentId: 'student-456',
  wordbookId: 'senior_textbook_real',
  totalWords: 1,
  wordbookTotalWords: 4292,
  studyDate: '2026-07-17T00:00:00.000Z'
};
app.updateLearningProgress(record);
app.updateLearningProgress(record);
assert.strictEqual(storage.learningProgress['student-456'].learnedWords, 1, '重复处理同一记录不能累加进度');
assert.strictEqual(storage.learningProgress['student-456'].wordbooks.senior_textbook_real.completedCount, 1);

process.stdout.write('app-learning-progress: PASS\n');
