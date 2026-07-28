'use strict';

const assert = require('assert');
const {
  ANTI_FORGETTING_SOURCES
} = require('../utils/anti-forgetting-filter.js');

const storage = {
  wordMastery: {
    student456: {
      book_a: {
        book_a_legacy: {
          difficult: true,
          reviewCount: 1,
          nextReviewTime: Date.now()
        }
      }
    }
  }
};

global.wx = {
  getStorageSync: (key) => storage[key],
  setStorageSync: (key, value) => {
    storage[key] = value;
  }
};
global.getApp = () => ({
  globalData: {},
  emit: () => {}
});

let pageDefinition = null;
global.Page = (definition) => {
  pageDefinition = definition;
};

require('../pages/learning/learning.js');
assert.ok(pageDefinition, '学习页应注册 Page');

const page = Object.assign({}, pageDefinition, {
  data: {
    currentStudent: { id: 'student456' },
    currentWordbook: { id: 'book_a' }
  }
});

page.updateWordMasteryStatus(
  ['book_a_known', 'book_a_unknown'],
  'mastered',
  {
    book_a_known: true,
    book_a_unknown: false
  },
  { markAntiForgettingSeed: true }
);

let records = storage.wordMastery.student456.book_a;
assert.strictEqual(
  records.book_a_known.antiForgettingSource,
  ANTI_FORGETTING_SOURCES.PREVIEW_MASTERED
);
assert.strictEqual(records.book_a_known.antiForgettingSeed, false);
assert.strictEqual(
  records.book_a_unknown.antiForgettingSource,
  ANTI_FORGETTING_SOURCES.PREVIEW_NOT_MASTERED
);
assert.strictEqual(records.book_a_unknown.antiForgettingSeed, true);

page.updateWordMasteryStatus(['book_a_other'], 'difficult');
records = storage.wordMastery.student456.book_a;
assert.strictEqual(
  records.book_a_other.antiForgettingSource,
  ANTI_FORGETTING_SOURCES.NON_PREVIEW_DIFFICULT
);
assert.strictEqual(records.book_a_other.antiForgettingSeed, false);

page.updateWordMasteryStatus(['book_a_legacy'], 'difficult');
records = storage.wordMastery.student456.book_a;
assert.strictEqual(
  records.book_a_legacy.antiForgettingSource,
  undefined,
  '旧困难记录在正常更新时也不得被自动迁移来源'
);

page.updateWordMasteryStatus(['book_a_unknown'], 'mastered');
records = storage.wordMastery.student456.book_a;
assert.strictEqual(
  records.book_a_unknown.antiForgettingSource,
  ANTI_FORGETTING_SOURCES.PREVIEW_NOT_MASTERED,
  '预习不会入池后答对仍须保留五轮来源'
);
assert.strictEqual(records.book_a_unknown.antiForgettingSeed, true);

process.stdout.write('preview-anti-forgetting-source: PASS\n');
