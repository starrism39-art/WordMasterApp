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
