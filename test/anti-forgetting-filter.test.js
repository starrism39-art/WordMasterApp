'use strict';

const assert = require('assert');
const {
  ANTI_FORGETTING_SOURCES,
  REVIEW_INTERVAL_DAYS,
  resolveAntiForgettingSourceForUpdate,
  shouldIncludeAntiForgettingWord
} = require('../utils/anti-forgetting-filter.js');

const now = new Date(2026, 6, 27, 10, 0, 0, 0).getTime();
const dueTime = now - 60 * 1000;
const tomorrow = new Date(2026, 6, 28, 0, 0, 0, 0).getTime();
const context = {
  studentId: 'student456',
  wordbookId: 'senior_unified',
  now
};

assert.deepStrictEqual(REVIEW_INTERVAL_DAYS, [1, 2, 4, 7, 15]);

let result = shouldIncludeAntiForgettingWord('word_1', {
  mastered: false,
  difficult: true,
  reviewCount: 0,
  nextReviewTime: dueTime
}, context);
assert.strictEqual(result.include, true, '缺少来源字段的旧困难词应只读兼容，不能因升级消失');
assert.strictEqual(result.reviewType, 'remedial');
assert.strictEqual(result.reviewTypeLabel, '未掌握复习');
assert.strictEqual(result.round, 1);

result = shouldIncludeAntiForgettingWord('word_2', {
  mastered: true,
  difficult: false,
  antiForgettingSeed: true,
  reviewCount: 2,
  nextReviewTime: dueTime
}, context);
assert.strictEqual(result.include, true, '保留种子且到期的已掌握词应进入巩固复习');
assert.strictEqual(result.reviewType, 'consolidation');
assert.strictEqual(result.reviewTypeLabel, '巩固复习');
assert.strictEqual(result.round, 3);

result = shouldIncludeAntiForgettingWord('word_3', {
  mastered: true,
  antiForgettingSeed: true,
  reviewCount: 0,
  nextReviewTime: tomorrow
}, context);
assert.strictEqual(result.include, false, '未到期的已掌握词不得提前出现');
assert.strictEqual(result.reason, 'not_due');

result = shouldIncludeAntiForgettingWord('word_4', {
  mastered: true,
  reviewCount: 0,
  nextReviewTime: dueTime
}, context);
assert.strictEqual(result.include, false, '没有抗遗忘种子的已掌握词不得进入');
assert.strictEqual(result.reason, 'not_preview_not_mastered');

result = shouldIncludeAntiForgettingWord('word_5', {
  mastered: false,
  difficult: false,
  antiForgettingSeed: true,
  reviewCount: 0,
  firstMasteryTime: now,
  nextReviewTime: dueTime
}, context);
assert.strictEqual(result.include, false, '旧数组误迁移生成的模糊状态对象不得进入');
assert.strictEqual(result.reason, 'ambiguous_legacy_status');

result = shouldIncludeAntiForgettingWord('word_6', {
  mastered: false,
  difficult: true,
  studentId: 'student789',
  wordbookId: 'senior_unified',
  nextReviewTime: dueTime
}, context);
assert.strictEqual(result.include, false, '显式属于其他学生的记录不得进入');
assert.strictEqual(result.reason, 'student_scope');

result = shouldIncludeAntiForgettingWord('word_7', {
  mastered: false,
  difficult: true,
  student_id: 'student456',
  wordbook_id: 'senior_reading',
  nextReviewTime: dueTime
}, context);
assert.strictEqual(result.include, false, '显式属于其他词书的记录不得进入');
assert.strictEqual(result.reason, 'wordbook_scope');

result = shouldIncludeAntiForgettingWord('word_8', {
  masteryStatus: 'not_mastered',
  antiForgettingSource: ANTI_FORGETTING_SOURCES.PREVIEW_NOT_MASTERED,
  reviewCount: 5,
  nextReviewTime: dueTime
}, context);
assert.strictEqual(result.include, false, '完成五轮的记录不得继续出现');
assert.strictEqual(result.reason, 'completed');

result = shouldIncludeAntiForgettingWord('word_9', {
  masteryStatus: 'not_mastered',
  reviewCount: 1,
  firstMasteryTime: now - 10 * 24 * 60 * 60 * 1000
}, context);
assert.strictEqual(result.include, true, '旧对象缺少 nextReviewTime 时应按首次学习时间降级计算');
assert.strictEqual(result.scheduledTime, now - 8 * 24 * 60 * 60 * 1000);

result = shouldIncludeAntiForgettingWord('word_10', {
  mastery: 'mastered',
  antiForgettingSeed: true,
  reviewCount: 0
}, context);
assert.strictEqual(result.include, false, '无法确认复习时间的旧记录必须安全跳过');
assert.strictEqual(result.reason, 'missing_review_time');

result = shouldIncludeAntiForgettingWord('foreign_plain_id', {
  difficult: 'true',
  reviewCount: '0',
  nextReviewTime: String(dueTime)
}, {
  ...context,
  hasScopedWordIds: true
});
assert.strictEqual(result.include, false, '当前容器使用词书前缀时，无前缀且无归属字段的混入记录应跳过');
assert.strictEqual(result.reason, 'wordbook_scope');

result = shouldIncludeAntiForgettingWord('senior_unified_word_11', {
  difficult: 'true',
  reviewCount: '0',
  nextReviewTime: String(dueTime)
}, {
  ...context,
  hasScopedWordIds: true
});
assert.strictEqual(result.include, true, '字符串布尔值和字符串时间戳应兼容旧数据');
assert.strictEqual(result.reviewType, 'remedial');

result = shouldIncludeAntiForgettingWord('word_12', {
  difficult: true,
  antiForgettingSource: ANTI_FORGETTING_SOURCES.PREVIEW_MASTERED,
  reviewCount: 0,
  nextReviewTime: dueTime
}, context);
assert.strictEqual(result.include, false, '明确来自预习会的词即使后来变困难也不得生成抗遗忘');
assert.strictEqual(result.reason, 'not_preview_not_mastered');

result = shouldIncludeAntiForgettingWord('word_13', {
  difficult: true,
  antiForgettingSource: ANTI_FORGETTING_SOURCES.NON_PREVIEW_DIFFICULT,
  reviewCount: 0,
  nextReviewTime: dueTime
}, context);
assert.strictEqual(result.include, false, '其他流程新产生的困难词不得生成抗遗忘');
assert.strictEqual(result.reason, 'not_preview_not_mastered');

result = shouldIncludeAntiForgettingWord('word_14', {
  mastered: true,
  antiForgettingSource: ANTI_FORGETTING_SOURCES.PREVIEW_NOT_MASTERED,
  reviewCount: 3,
  nextReviewTime: dueTime
}, context);
assert.strictEqual(result.include, true, '预习不会入池后，即使后来掌握也应继续完成五轮');
assert.strictEqual(result.round, 4);

assert.strictEqual(
  resolveAntiForgettingSourceForUpdate({}, {
    isPreviewDecision: true,
    isDifficult: true,
    isExistingRecord: false
  }),
  ANTI_FORGETTING_SOURCES.PREVIEW_NOT_MASTERED
);
assert.strictEqual(
  resolveAntiForgettingSourceForUpdate({}, {
    isPreviewDecision: true,
    isDifficult: false,
    isExistingRecord: false
  }),
  ANTI_FORGETTING_SOURCES.PREVIEW_MASTERED
);
assert.strictEqual(
  resolveAntiForgettingSourceForUpdate({}, {
    isDifficult: true,
    isExistingRecord: false
  }),
  ANTI_FORGETTING_SOURCES.NON_PREVIEW_DIFFICULT
);
assert.strictEqual(
  resolveAntiForgettingSourceForUpdate({ difficult: true }, {
    isDifficult: true,
    isExistingRecord: true
  }),
  '',
  '无来源的旧困难记录不得被迁移或改写'
);
assert.strictEqual(
  resolveAntiForgettingSourceForUpdate({ antiForgettingSeed: true }, {
    isDifficult: false,
    isExistingRecord: true
  }),
  ANTI_FORGETTING_SOURCES.PREVIEW_NOT_MASTERED,
  '已有抗遗忘种子必须继续兼容原五轮'
);

const immutableLegacyRecord = {
  difficult: true,
  reviewCount: 0,
  nextReviewTime: dueTime
};
const legacySnapshot = JSON.stringify(immutableLegacyRecord);
shouldIncludeAntiForgettingWord('word_15', immutableLegacyRecord, context);
assert.strictEqual(JSON.stringify(immutableLegacyRecord), legacySnapshot, '筛选旧记录不得修改用户数据');

const scopeMatrix = [
  ['student456', 'senior_textbook_real'],
  ['student456', 'gaokao_reading_words'],
  ['student456', 'senior_book_1_ren_jiao'],
  ['student789', 'junior_8th_first']
];
scopeMatrix.forEach(([studentId, wordbookId]) => {
  const scopedContext = {
    studentId,
    wordbookId,
    now,
    hasScopedWordIds: true
  };
  const ownWordId = `${wordbookId}_word_1`;
  const ownResult = shouldIncludeAntiForgettingWord(ownWordId, {
    studentId,
    wordbookId,
    difficult: true,
    antiForgettingSource: ANTI_FORGETTING_SOURCES.PREVIEW_NOT_MASTERED,
    reviewCount: 0,
    nextReviewTime: dueTime
  }, scopedContext);
  assert.strictEqual(ownResult.include, true, `${studentId}/${wordbookId} 的预习不会词应进入`);

  const otherStudentResult = shouldIncludeAntiForgettingWord(ownWordId, {
    studentId: `${studentId}_other`,
    wordbookId,
    difficult: true,
    antiForgettingSource: ANTI_FORGETTING_SOURCES.PREVIEW_NOT_MASTERED,
    reviewCount: 0,
    nextReviewTime: dueTime
  }, scopedContext);
  assert.strictEqual(otherStudentResult.reason, 'student_scope');

  const otherBookResult = shouldIncludeAntiForgettingWord(ownWordId, {
    studentId,
    wordbookId: `${wordbookId}_other`,
    difficult: true,
    antiForgettingSource: ANTI_FORGETTING_SOURCES.PREVIEW_NOT_MASTERED,
    reviewCount: 0,
    nextReviewTime: dueTime
  }, scopedContext);
  assert.strictEqual(otherBookResult.reason, 'wordbook_scope');
});

process.stdout.write('anti-forgetting-filter: PASS\n');
