'use strict';

const assert = require('assert');
const {
  getWordbookMasterySummary,
  reconcileStudentLearningProgress,
  reconcileLearningProgressMap
} = require('../utils/learning-progress.js');

function buildSeniorMastery() {
  const result = {};
  for (let index = 0; index < 27; index += 1) {
    result[`senior_textbook_real_mastered_${index}`] = { mastered: true, difficult: false };
  }
  for (let index = 0; index < 23; index += 1) {
    result[`senior_textbook_real_difficult_${index}`] = { mastered: false, difficult: true };
  }
  result.senior_textbook_real_pending = { mastered: false, difficult: false };
  result.gaokao_reading_words_foreign = { mastered: true, difficult: false };
  return result;
}

const seniorMastery = buildSeniorMastery();
const summary = getWordbookMasterySummary('senior_textbook_real', seniorMastery);
assert.deepStrictEqual(summary, {
  entryCount: 51,
  learnedCount: 50,
  masteredCount: 27,
  unmasteredCount: 23
});
assert.deepStrictEqual(
  getWordbookMasterySummary('legacy_book', {
    legacy_book_known: true,
    legacy_book_difficult: false
  }),
  { entryCount: 2, learnedCount: 2, masteredCount: 1, unmasteredCount: 1 }
);

const sourceProgress = {
  learnedWords: 298,
  totalWords: 51,
  teacher_name: 'teacher',
  wordbooks: {
    senior_textbook_real: {
      completedCount: 298,
      learnedWords: 298,
      totalCount: 51,
      dailyStats: { '2026-07-17': { newWords: 3 } }
    }
  }
};
const sourceSnapshot = JSON.parse(JSON.stringify(sourceProgress));
const reconciled = reconcileStudentLearningProgress({
  studentId: 'student-456',
  progressData: sourceProgress,
  studentMastery: { senior_textbook_real: seniorMastery },
  learningRecords: [],
  bookTotals: { senior_textbook_real: 4292 }
});

assert.strictEqual(reconciled.learnedWords, 50);
assert.strictEqual(reconciled.totalWords, 4292);
assert.strictEqual(reconciled.legacyLearnedWords, 298);
assert.strictEqual(reconciled.legacyTotalWords, 51);
assert.strictEqual(reconciled.teacher_name, 'teacher');
assert.strictEqual(reconciled.wordbooks.senior_textbook_real.completedCount, 50);
assert.strictEqual(reconciled.wordbooks.senior_textbook_real.totalCount, 4292);
assert.strictEqual(reconciled.wordbooks.senior_textbook_real.legacyCompletedCount, 298);
assert.strictEqual(reconciled.wordbooks.senior_textbook_real.legacyTotalCount, 51);
assert.deepStrictEqual(reconciled.wordbooks.senior_textbook_real.dailyStats, sourceProgress.wordbooks.senior_textbook_real.dailyStats);
assert.deepStrictEqual(sourceProgress, sourceSnapshot, '重算不能修改输入数据');

const reconciledAgain = reconcileStudentLearningProgress({
  studentId: 'student-456',
  progressData: reconciled,
  studentMastery: { senior_textbook_real: seniorMastery },
  learningRecords: [],
  bookTotals: { senior_textbook_real: 4292 }
});
assert.deepStrictEqual(reconciledAgain, reconciled, '重复重算必须保持幂等');

const inflatedTotal = reconcileStudentLearningProgress({
  studentId: 'student-inflated-total',
  progressData: {
    learnedWords: 1,
    wordbooks: { senior_textbook_real: { completedCount: 1, totalCount: 9999 } }
  },
  studentMastery: {
    senior_textbook_real: {
      senior_textbook_real_alpha: { mastered: true, difficult: false }
    }
  },
  learningRecords: [],
  bookTotals: { senior_textbook_real: 4292 }
});
assert.strictEqual(inflatedTotal.wordbooks.senior_textbook_real.totalCount, 4292);
assert.strictEqual(inflatedTotal.wordbooks.senior_textbook_real.legacyTotalCount, 9999);

const repeatedRecords = [
  {
    id: 'record-1',
    studentId: 'student-record-only',
    wordbookId: 'record_book',
    learnedWordIds: ['record_book_alpha']
  },
  {
    id: 'record-2',
    studentId: 'student-record-only',
    wordbookId: 'record_book',
    learnedWordIds: ['record_book_alpha']
  },
  {
    id: 'review-1',
    studentId: 'student-record-only',
    wordbookId: 'record_book',
    recordType: 'anti_forgetting_review',
    learnedWordIds: ['record_book_beta']
  }
];
const recordFallback = reconcileStudentLearningProgress({
  studentId: 'student-record-only',
  progressData: {
    learnedWords: 9,
    wordbooks: { record_book: { completedCount: 9, totalCount: 10 } }
  },
  studentMastery: {},
  learningRecords: repeatedRecords,
  bookTotals: { record_book: 10 }
});
assert.strictEqual(recordFallback.learnedWords, 1, '重复学习记录只能按单词去重计数');
assert.strictEqual(recordFallback.wordbooks.record_book.legacyCompletedCount, 9);

const allStudents = reconcileLearningProgressMap(
  {
    'student-456': sourceProgress,
    untouched: { customField: 'keep', learnedWords: 0, totalWords: 0, wordbooks: {} }
  },
  { 'student-456': { senior_textbook_real: seniorMastery } },
  []
);
assert.strictEqual(allStudents['student-456'].learnedWords, 50);
assert.strictEqual(allStudents.untouched.customField, 'keep');

process.stdout.write('learning-progress: PASS\n');
