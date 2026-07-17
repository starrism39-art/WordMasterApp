'use strict';

const assert = require('assert');

const storage = {
  studentSettings: {
    student_student456_wordbook: {
      id: 'senior_textbook_real',
      title: '高中统编版英语词书'
    },
    student_other_wordbook: {
      id: 'junior_textbook_real',
      title: '初中统编版英语词书'
    }
  },
  student456_pageState: {
    learningStats: { learnedWords: 12 },
    timestamp: 1
  },
  selectedWordbook: {
    id: 'gaokao_reading_words',
    title: '旧的全局词书'
  }
};

global.wx = {
  getStorageSync(key) {
    return storage[key];
  },
  setStorageSync(key, value) {
    storage[key] = value;
  }
};

const emitted = [];
const app = {
  globalData: {
    currentStudent: { id: 'student456', name: 'student456' },
    currentWordbook: {
      id: 'gaokao_reading_words',
      title: '旧的全局词书'
    }
  },
  emit(name, payload) {
    emitted.push({ name, payload });
  }
};

const {
  createLearningContextKey,
  resolveCurrentWordbook,
  setCurrentWordbook
} = require('../utils/learning-context.js');

const student456 = app.globalData.currentStudent;
assert.strictEqual(
  resolveCurrentWordbook(app, student456).id,
  'senior_textbook_real',
  '学生级词书选择必须优先于旧的全局词书'
);

const selected = setCurrentWordbook(app, student456, {
  id: 'gaokao_reading_words',
  title: '高考英语阅读高频词汇',
  category: 'senior',
  words: [{ word: 'abandon' }]
});

assert.strictEqual(selected.id, 'gaokao_reading_words');
assert.strictEqual(selected.words, undefined, '当前词书选择只保存元数据，不能复制完整词表');
assert.strictEqual(storage.selectedWordbook.id, 'gaokao_reading_words');
assert.strictEqual(storage.currentWordbook.id, 'gaokao_reading_words');
assert.strictEqual(storage.studentSettings.student_student456_wordbook.id, 'gaokao_reading_words');
assert.strictEqual(storage.studentSettings.student_other_wordbook.id, 'junior_textbook_real', '不能覆盖其他学生设置');
assert.deepStrictEqual(storage.student456_pageState.learningStats, { learnedWords: 12 }, '更新词书时必须保留页面状态中的其他字段');
assert.strictEqual(app.globalData.currentWordbook.id, 'gaokao_reading_words');
assert.strictEqual(app.globalData.selectedWordbook.id, 'gaokao_reading_words');
assert.strictEqual(emitted.length, 1);
assert.strictEqual(emitted[0].name, 'currentWordbookChanged');
assert.deepStrictEqual(emitted[0].payload, {
  studentId: 'student456',
  wordbookId: 'gaokao_reading_words',
  wordbook: selected
});
assert.strictEqual(
  createLearningContextKey(student456, selected),
  'student456|gaokao_reading_words'
);

storage.wordMastery = {
  student456: {
    senior_textbook_real: {
      senior_textbook_real_alpha: { mastered: true, difficult: false },
      senior_textbook_real_beta: { mastered: false, difficult: true }
    },
    gaokao_reading_words: {
      gaokao_reading_words_gamma: { mastered: true, difficult: false }
    }
  }
};
storage.learningRecords = [
  { studentId: 'student456', wordbookId: 'senior_textbook_real', studyDate: '2026-07-15T08:00:00+08:00' },
  { studentId: 'student456', wordbookId: 'senior_textbook_real', studyDate: '2026-07-16T08:00:00+08:00' },
  { studentId: 'student456', wordbookId: 'gaokao_reading_words', studyDate: '2026-07-17T08:00:00+08:00' },
  { studentId: 'other', wordbookId: 'gaokao_reading_words', studyDate: '2026-07-14T08:00:00+08:00' }
];

const { calculateWordbookStats } = require('../utils/stats-engine.js');
assert.deepStrictEqual(
  calculateWordbookStats('student456', 'senior_textbook_real'),
  { masteredCount: 2, notMasteredCount: 1, checkinDays: 2 },
  '高中统编版统计不能混入高考阅读词书数据'
);
assert.deepStrictEqual(
  calculateWordbookStats('student456', 'gaokao_reading_words'),
  { masteredCount: 1, notMasteredCount: 0, checkinDays: 1 },
  '高考阅读词书统计不能混入高中统编版或其他学生数据'
);

process.stdout.write('learning-context: PASS\n');
