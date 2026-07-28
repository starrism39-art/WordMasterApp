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
            nextReviewTime: now - 1,
            reviewCount: 0
          },
          book_a_future: {
            difficult: true,
            nextReviewTime: now + 24 * 60 * 60 * 1000,
            reviewCount: 0
          },
          book_a_mastered: {
            mastered: true,
            antiForgettingSeed: true,
            nextReviewTime: now - 1,
            reviewCount: 1
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
  assert.ok(ids.includes('book_a_due'), `${modulePath} 应包含当前词书到期困难词`);
  assert.ok(ids.includes('book_a_mastered'), `${modulePath} 应包含当前词书到期巩固词`);
  assert.ok(!ids.includes('book_a_future'), `${modulePath} 不应包含未到期词`);
  assert.ok(!ids.includes('foreign_due'), `${modulePath} 不应包含其他词书混入词`);
  assert.ok(records.some((record) => record.reviewType === 'remedial'));
  assert.ok(records.some((record) => record.reviewType === 'consolidation'));
};

verifyGenerator('../pages/review/review.js');
verifyGenerator('../subpages/review-merged/review-merged.js');

process.stdout.write('review-page-generation: PASS\n');
