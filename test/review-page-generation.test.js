'use strict';

const assert = require('assert');

global.wx = {
  getStorageSync: () => null,
  setStorageSync: () => {},
  showToast: () => {},
  showLoading: () => {},
  hideLoading: () => {}
};
global.getApp = () => ({
  globalData: {},
  on: () => {},
  off: () => {}
});

const loadPageDefinition = (modulePath) => {
  let definition = null;
  global.Page = (pageDefinition) => {
    definition = pageDefinition;
  };
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
  assert.ok(definition, `${modulePath} 应注册 Page`);
  return definition;
};

const verifyGenerator = (modulePath) => {
  const pageDefinition = loadPageDefinition(modulePath);
  const page = Object.assign({
    data: {
      currentWordbook: {
        id: 'book_a',
        title: '测试词书'
      }
    }
  }, pageDefinition);
  const now = Date.now();
  const records = page.generateAntiForgettingRecords.call(
    page,
    'student456',
    'book_a',
    {
      student456: {
        book_a: {
          book_a_due: {
            difficult: true,
            antiForgettingSource: 'preview_not_mastered',
            nextReviewTime: now - 1,
            reviewCount: 0
          },
          book_a_future: {
            difficult: true,
            antiForgettingSource: 'preview_not_mastered',
            nextReviewTime: now + 24 * 60 * 60 * 1000,
            reviewCount: 0
          },
          book_a_mastered: {
            mastered: true,
            antiForgettingSeed: true,
            nextReviewTime: now - 1,
            reviewCount: 1
          },
          book_a_legacy_difficult: {
            difficult: true,
            nextReviewTime: now - 1,
            reviewCount: 1
          },
          book_a_preview_mastered: {
            mastered: true,
            antiForgettingSource: 'preview_mastered',
            nextReviewTime: now - 1,
            reviewCount: 0
          },
          book_a_non_preview: {
            difficult: true,
            antiForgettingSource: 'non_preview_difficult',
            nextReviewTime: now - 1,
            reviewCount: 0
          },
          foreign_due: {
            difficult: true,
            nextReviewTime: now - 1,
            reviewCount: 0
          }
        }
      }
    }
  );

  const ids = records.flatMap((record) => record.words);
  assert.ok(ids.includes('book_a_due'), `${modulePath} 应包含当前词书到期的预习不会词`);
  assert.ok(ids.includes('book_a_mastered'), `${modulePath} 应保留已有种子的历史五轮词`);
  assert.ok(ids.includes('book_a_legacy_difficult'), `${modulePath} 不得清空缺少来源字段的旧困难词`);
  assert.ok(ids.includes('book_a_future'), `${modulePath} 应展示未到期词的五轮计划`);
  assert.ok(!ids.includes('book_a_preview_mastered'), `${modulePath} 不应包含预习标记会的词`);
  assert.ok(!ids.includes('book_a_non_preview'), `${modulePath} 不应包含其他流程新产生的困难词`);
  assert.ok(!ids.includes('foreign_due'), `${modulePath} 不应包含其他词书混入词`);
  assert.ok(records.some((record) => record.reviewType === 'remedial'));
  assert.ok(records.every((record) => record.reviewType === 'remedial'));

  const firstRoundTime = now + 24 * 60 * 60 * 1000;
  const batchRecords = page.generateAntiForgettingRecords.call(
    page,
    'student456',
    'book_a',
    {
      student456: {
        book_a: {
          book_a_batch_alpha: {
            difficult: true,
            antiForgettingSource: 'preview_not_mastered',
            firstMasteryTime: now,
            nextReviewTime: firstRoundTime,
            reviewCount: 0
          },
          book_a_batch_beta: {
            difficult: true,
            antiForgettingSource: 'preview_not_mastered',
            firstMasteryTime: now,
            nextReviewTime: firstRoundTime,
            reviewCount: 0
          }
        }
      }
    }
  );
  assert.strictEqual(batchRecords.length, 5, `${modulePath} 同一批不会词必须合并成五个时间轮次`);
  assert.deepStrictEqual(batchRecords.map((record) => record.round), [1, 2, 3, 4, 5]);
  assert.ok(batchRecords.every((record) => record.wordCount === 2));
  assert.ok(batchRecords.every((record) => record.canReview === false), '未到期的五轮都必须禁用');

  const sameDayMorning = new Date(now);
  sameDayMorning.setHours(9, 0, 0, 0);
  const sameDayAfternoon = new Date(now);
  sameDayAfternoon.setHours(15, 0, 0, 0);
  const sameDayRecords = page.generateAntiForgettingRecords.call(
    page,
    'student456',
    'book_a',
    {
      student456: {
        book_a: {
          book_a_earlier_batch: {
            difficult: true,
            antiForgettingSource: 'preview_not_mastered',
            firstMasteryTime: sameDayMorning.getTime(),
            nextReviewTime: firstRoundTime,
            reviewCount: 0
          },
          book_a_later_batch: {
            difficult: true,
            antiForgettingSource: 'preview_not_mastered',
            firstMasteryTime: sameDayAfternoon.getTime(),
            nextReviewTime: firstRoundTime,
            reviewCount: 0
          }
        }
      }
    }
  );
  assert.strictEqual(sameDayRecords.length, 5, `${modulePath} 同一天多次学习必须合并成一组五轮`);
  assert.strictEqual(new Set(sameDayRecords.map((record) => record.learningBatchKey)).size, 1);
  assert.ok(sameDayRecords.every((record) => record.wordCount === 2));

  const partiallyReviewedSameDayRecords = page.generateAntiForgettingRecords.call(
    page,
    'student456',
    'book_a',
    {
      student456: {
        book_a: {
          book_a_round_one_pending: {
            difficult: true,
            antiForgettingSource: 'preview_not_mastered',
            firstMasteryTime: sameDayMorning.getTime(),
            nextReviewTime: now - 1,
            reviewCount: 0
          },
          book_a_round_one_completed: {
            mastered: true,
            antiForgettingSource: 'preview_not_mastered',
            firstMasteryTime: sameDayAfternoon.getTime(),
            nextReviewTime: firstRoundTime,
            reviewCount: 1
          }
        }
      }
    }
  );
  assert.strictEqual(partiallyReviewedSameDayRecords.length, 5);
  assert.strictEqual(partiallyReviewedSameDayRecords[0].round, 1);
  assert.strictEqual(partiallyReviewedSameDayRecords[0].wordCount, 1, `${modulePath} 已完成第1轮的词不得重复进入第1轮`);
  assert.ok(partiallyReviewedSameDayRecords.slice(1).every((record) => record.wordCount === 2), `${modulePath} 同日学习词应从共同的后续轮次开始合并`);

  const previousDay = new Date(sameDayMorning);
  previousDay.setDate(previousDay.getDate() - 1);
  const separateDayRecords = page.generateAntiForgettingRecords.call(
    page,
    'student456',
    'book_a',
    {
      student456: {
        book_a: {
          book_a_previous_day: {
            difficult: true,
            antiForgettingSource: 'preview_not_mastered',
            firstMasteryTime: previousDay.getTime(),
            nextReviewTime: firstRoundTime,
            reviewCount: 0
          },
          book_a_current_day: {
            difficult: true,
            antiForgettingSource: 'preview_not_mastered',
            firstMasteryTime: sameDayMorning.getTime(),
            nextReviewTime: firstRoundTime,
            reviewCount: 0
          }
        }
      }
    }
  );
  assert.strictEqual(separateDayRecords.length, 10, `${modulePath} 不同学习日期必须各自保留五轮`);
  assert.strictEqual(new Set(separateDayRecords.map((record) => record.learningBatchKey)).size, 2);
  assert.ok(separateDayRecords.every((record) => record.wordCount === 1));

  const mergedByDate = page.mergeRecordsByDate.call(page, separateDayRecords);
  assert.strictEqual(mergedByDate.length, 5, `${modulePath} 显式按日期合并时仍应合成五个日期`);
  assert.ok(mergedByDate.every((record) => record.wordCount === 2));

  const remainingRecords = page.generateAntiForgettingRecords.call(
    page,
    'student456',
    'book_a',
    {
      student456: {
        book_a: {
          book_a_progressed: {
            mastered: true,
            antiForgettingSource: 'preview_not_mastered',
            firstMasteryTime: now - 2 * 24 * 60 * 60 * 1000,
            nextReviewTime: firstRoundTime,
            reviewCount: 2
          }
        }
      }
    }
  );
  assert.deepStrictEqual(
    remainingRecords.map((record) => record.round),
    [3, 4, 5],
    `${modulePath} 已完成轮次不能重复生成`
  );
};

verifyGenerator('../pages/review/review.js');
verifyGenerator('../subpages/review-merged/review-merged.js');

process.stdout.write('review-page-generation: PASS\n');
