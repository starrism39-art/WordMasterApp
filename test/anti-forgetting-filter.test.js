'use strict';

const assert = require('assert');
const {
  REVIEW_INTERVAL_DAYS,
  shouldIncludeAntiForgettingWord,
  repairMissingAntiForgettingSeed
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
assert.strictEqual(result.include, true, '到期困难词应进入未掌握复习');
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
assert.strictEqual(result.reason, 'mastered_without_seed');

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

const storage = {
  wordMastery: {
    student456: {
      senior_unified: {
        target: {
          difficult: true,
          nextReviewTime: dueTime
        },
        unchanged: {
          mastered: true,
          nextReviewTime: dueTime
        }
      },
      senior_reading: {
        otherBook: {
          difficult: true,
          nextReviewTime: dueTime
        }
      }
    },
    student789: {
      senior_unified: {
        otherStudent: {
          difficult: true,
          nextReviewTime: dueTime
        }
      }
    }
  }
};
let writeCount = 0;
global.wx = {
  getStorageSync: (key) => storage[key],
  setStorageSync: (key, value) => {
    storage[key] = value;
    writeCount++;
  }
};

assert.strictEqual(
  repairMissingAntiForgettingSeed('student456', 'senior_unified'),
  1,
  '只应修复当前学生当前词书的明确困难词'
);
assert.strictEqual(storage.wordMastery.student456.senior_unified.target.antiForgettingSeed, true);
assert.strictEqual(storage.wordMastery.student456.senior_reading.otherBook.antiForgettingSeed, undefined);
assert.strictEqual(storage.wordMastery.student789.senior_unified.otherStudent.antiForgettingSeed, undefined);
assert.strictEqual(writeCount, 1);

assert.strictEqual(repairMissingAntiForgettingSeed(), 0, '没有明确作用域时不得写入');
assert.strictEqual(writeCount, 1);

process.stdout.write('anti-forgetting-filter: PASS\n');
