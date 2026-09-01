'use strict';

const assert = require('assert');
const {
  buildProgressMap,
  buildWordMasteryMap
} = require('../utils/cloud-migration.js');

const masteryDocs = [{
  _id: 'legacy-a',
  teacher_id: 'teacher-a',
  student_id: 'student456',
  wordbook_id: 'senior_textbook_real',
  word_id: 'shared-word',
  reviewCount: 1,
  lastReviewTime: 1000,
  mastered: true,
  difficult: false,
  antiForgettingSeed: true,
  legacyOnly: 'preserve'
}, {
  _id: 'scoped-z',
  teacher_id: 'teacher-a',
  student_id: 'student456',
  wordbook_id: 'senior_textbook_real',
  word_id: 'shared-word',
  reviewCount: 2,
  lastReviewTime: 2000,
  mastered: false,
  difficult: true,
  antiForgettingSeed: true,
  scopedOnly: 'preserve'
}, {
  _id: 'five-rounds',
  teacher_id: 'teacher-a',
  student_id: 'student-cloud-01',
  wordbook_id: 'gaokao_reading_words',
  word_id: 'completed-word',
  reviewCount: 5,
  mastered: true,
  difficult: false,
  antiForgettingSeed: true
}];

const forwardMastery = buildWordMasteryMap(masteryDocs);
const reversedMastery = buildWordMasteryMap(masteryDocs.slice().reverse());
assert.deepStrictEqual(
  reversedMastery,
  forwardMastery,
  'duplicate mastery merge must not depend on CloudBase return order'
);
const mergedMastery = forwardMastery.student456.senior_textbook_real['shared-word'];
assert.strictEqual(mergedMastery.reviewCount, 2);
assert.strictEqual(mergedMastery.mastered, false);
assert.strictEqual(mergedMastery.difficult, true);
assert.strictEqual(mergedMastery.legacyOnly, 'preserve');
assert.strictEqual(mergedMastery.scopedOnly, 'preserve');
assert.strictEqual(
  forwardMastery['student-cloud-01'].gaokao_reading_words['completed-word'].antiForgettingSeed,
  false
);

const progressDocs = [{
  _id: 'legacy-progress-a',
  teacher_id: 'teacher-a',
  student_id: 'student456',
  learnedWords: 200,
  totalWords: 4209,
  updatedAt: 1000,
  legacyOnly: 'preserve',
  wordbooks: {
    senior_textbook_real: {
      completedCount: 200,
      totalCount: 4209,
      lastStudyTime: '2026-07-01'
    }
  }
}, {
  _id: 'scoped-progress-z',
  teacher_id: 'teacher-a',
  student_id: 'student456',
  learnedWords: 301,
  totalWords: 4292,
  updatedAt: 2000,
  currentOnly: 'preserve',
  wordbooks: {
    senior_textbook_real: {
      completedCount: 301,
      totalCount: 4292,
      lastStudyTime: '2026-07-20'
    },
    gaokao_reading_words: {
      completedCount: 20,
      totalCount: 687,
      lastStudyTime: '2026-07-21'
    }
  }
}, {
  _id: 'cloud01-progress',
  teacher_id: 'teacher-a',
  student_id: 'student-cloud-01',
  learnedWords: 10,
  totalWords: 365,
  wordbooks: {
    senior_book_1_ren_jiao: {
      completedCount: 10,
      totalCount: 365
    }
  }
}];

const forwardProgress = buildProgressMap(progressDocs);
const reversedProgress = buildProgressMap(progressDocs.slice().reverse());
assert.deepStrictEqual(
  reversedProgress,
  forwardProgress,
  'duplicate progress merge must not depend on CloudBase return order'
);
const mergedProgress = forwardProgress.student456;
assert.strictEqual(mergedProgress.learnedWords, 321);
assert.strictEqual(mergedProgress.totalWords, 4979);
assert.strictEqual(mergedProgress.legacyOnly, 'preserve');
assert.strictEqual(mergedProgress.currentOnly, 'preserve');
assert.strictEqual(
  mergedProgress.wordbooks.senior_textbook_real.completedCount,
  301
);
assert.strictEqual(
  mergedProgress.wordbooks.gaokao_reading_words.completedCount,
  20
);
assert.strictEqual(
  forwardProgress['student-cloud-01'].wordbooks.senior_book_1_ren_jiao.completedCount,
  10
);

console.log('cloud-duplicate-merge: PASS');
