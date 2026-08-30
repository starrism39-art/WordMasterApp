'use strict';

const assert = require('assert');
const {
  COMPATIBILITY_LEVELS,
  EXPORT_ELIGIBILITY,
  RECORD_KINDS,
  RECORD_SCHEMA_VERSION,
  assessRecordCompatibility,
  buildRecordSnapshotFields,
  resolveRecordForExport
} = require('../utils/record-export-contract.js');
const {
  REVIEW_INTERVAL_DAYS,
  buildFiveRoundDates
} = require('../utils/anti-forgetting-filter.js');

const completedAt = '2026-08-29T20:30:00+08:00';
const learningSnapshot = buildRecordSnapshotFields({
  recordKind: RECORD_KINDS.LEARNING,
  completedAt,
  student: { id: 'student456', name: '测试学生' },
  wordbook: {
    id: 'senior_textbook_real',
    title: '高中统编版',
    sourceType: 'official',
    version: 1
  },
  words: [
    {
      id: 'senior_textbook_real_alpha',
      word: 'alpha',
      meaning: '第一',
      phonetic: '/ˈælfə/',
      masteryStatus: 'mastered'
    },
    {
      id: 'senior_textbook_real_beta',
      word: 'beta',
      translation: '第二',
      phonetic: '',
      masteryStatus: 'notMastered'
    }
  ]
});

assert.strictEqual(learningSnapshot.recordSchemaVersion, RECORD_SCHEMA_VERSION);
assert.strictEqual(learningSnapshot.recordKind, RECORD_KINDS.LEARNING);
assert.strictEqual(learningSnapshot.completedAt, '2026-08-29T12:30:00.000Z');
assert.strictEqual(learningSnapshot.wordbookSnapshot.version, null, 'official 不得伪造数字版本');
assert.deepStrictEqual(learningSnapshot.wordsSnapshot.map((word) => word.masteryStatus), [
  'mastered',
  'notMastered'
]);
assert.strictEqual(learningSnapshot.wordsSnapshot[1].phonetic, '', '空音标必须是合法快照值');
assert.ok(Object.isFrozen(learningSnapshot));
assert.ok(Object.isFrozen(learningSnapshot.wordsSnapshot));

const sourceWord = { id: 'immutable_word', word: 'before', meaning: '之前', masteryStatus: 'mastered' };
const immutableSnapshot = buildRecordSnapshotFields({
  recordKind: RECORD_KINDS.LEARNING,
  completedAt,
  student: { id: 'student456', name: '测试学生' },
  wordbook: { id: 'book_a', title: '词书A', sourceType: 'official', version: 1 },
  words: [sourceWord]
});
sourceWord.word = 'after';
sourceWord.meaning = '之后';
assert.strictEqual(immutableSnapshot.wordsSnapshot[0].word, 'before');
assert.strictEqual(immutableSnapshot.wordsSnapshot[0].meaning, '之前');

const newLearningRecord = {
  id: 'learning-record-a',
  ...learningSnapshot,
  studyWordsDetailed: learningSnapshot.wordsSnapshot,
  masteredWordIds: ['senior_textbook_real_alpha'],
  notMasteredWordIds: ['senior_textbook_real_beta']
};
let compatibility = assessRecordCompatibility(newLearningRecord);
assert.strictEqual(compatibility.level, COMPATIBILITY_LEVELS.A);
assert.strictEqual(compatibility.eligibility, EXPORT_ELIGIBILITY.READY);

const legacyReviewRecord = {
  id: 'review-record-c',
  studentId: 'student456',
  wordbookId: 'senior_textbook_real',
  recordType: 'anti_forgetting_review',
  studyDate: completedAt,
  learnedWordIds: ['senior_textbook_real_alpha']
};
const resolvedLegacyReview = resolveRecordForExport('review-record-c', [legacyReviewRecord]);
assert.strictEqual(resolvedLegacyReview.compatibility.level, COMPATIBILITY_LEVELS.C);
assert.strictEqual(resolvedLegacyReview.snapshot.wordsSnapshot[0].word, '');
assert.strictEqual(resolvedLegacyReview.snapshot.wordsSnapshot[0].meaning, '');
assert.strictEqual(resolvedLegacyReview.snapshot.wordsSnapshot[0].phonetic, '');
assert.strictEqual(resolvedLegacyReview.snapshot.wordsSnapshot[0].masteryStatus, null);

compatibility = assessRecordCompatibility({
  id: 'versioned-record-b',
  studentId: 'student456',
  wordbookId: 'twb_book_a',
  wordbookSourceType: 'teacher_custom',
  wordbookVersion: 3,
  learnedWordIds: ['twb_book_a_word_1']
});
assert.strictEqual(compatibility.level, COMPATIBILITY_LEVELS.B);
assert.strictEqual(compatibility.eligibility, EXPORT_ELIGIBILITY.REQUIRES_HISTORICAL_VERSION);

compatibility = assessRecordCompatibility({
  id: 'versioned-detailed-ids-b',
  wordbookSnapshot: { id: 'twb_book_a', sourceType: 'teacher_custom', version: 3 },
  wordsSnapshot: [{ wordId: 'twb_book_a_word_1' }]
});
assert.strictEqual(compatibility.level, COMPATIBILITY_LEVELS.B);

compatibility = assessRecordCompatibility({
  id: 'count-only-record-d',
  studentId: 'student456',
  wordbookId: 'book_a',
  totalWords: 12,
  masteredCount: 8
});
assert.strictEqual(compatibility.level, COMPATIBILITY_LEVELS.D);
assert.strictEqual(compatibility.eligibility, EXPORT_ELIGIBILITY.BLOCKED);

const rawRecordOne = { ...newLearningRecord, id: 'raw-record-1' };
const rawRecordTwo = { ...newLearningRecord, id: 'raw-record-2' };
const mergedCard = {
  id: 'merged_2026-08-29_book_a_learning',
  isMerged: true,
  originalRecords: [rawRecordOne, rawRecordTwo]
};
assert.strictEqual(resolveRecordForExport('raw-record-2', [mergedCard]).recordId, 'raw-record-2');
assert.throws(
  () => resolveRecordForExport(mergedCard.id, [mergedCard]),
  (error) => error && error.code === 'RECORD_NOT_FOUND',
  '合并卡片 id 不得成为导出记录身份'
);
assert.throws(
  () => resolveRecordForExport('raw-record-1', [rawRecordOne, rawRecordOne]),
  (error) => error && error.code === 'DUPLICATE_RECORD_ID',
  '重复 recordId 必须拒绝解析'
);

assert.deepStrictEqual(REVIEW_INTERVAL_DAYS, [1, 2, 4, 7, 15]);
let dates = buildFiveRoundDates('2026-08-29T23:30:00+08:00');
assert.deepStrictEqual(dates.map((item) => item.offsetDays), REVIEW_INTERVAL_DAYS);
assert.deepStrictEqual(dates.map((item) => item.date), [
  '2026-08-30',
  '2026-08-31',
  '2026-09-02',
  '2026-09-05',
  '2026-09-13'
]);
assert.ok(dates.every((item) => item.timeZone === 'Asia/Shanghai'));

dates = buildFiveRoundDates('2026-12-31T23:59:59+08:00');
assert.deepStrictEqual(dates.map((item) => item.date), [
  '2027-01-01',
  '2027-01-02',
  '2027-01-04',
  '2027-01-07',
  '2027-01-15'
]);
assert.throws(
  () => buildFiveRoundDates('not-a-date'),
  (error) => error && error.code === 'INVALID_COMPLETED_AT'
);

process.stdout.write('record-export-contract: PASS\n');
