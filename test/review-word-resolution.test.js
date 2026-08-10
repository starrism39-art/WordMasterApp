'use strict';

const assert = require('assert');
const { generateWordsForBook } = require('../data/wordbook-loader.js');
const {
  buildReviewWordLookup,
  getReviewWordMeaning,
  isRealChineseMeaning,
  resolveReviewWordEntry,
  resolveReviewWordObject
} = require('../utils/review-word-resolver.js');

const sampleWords = [
  { id: 'local_book_prospect_17', word: 'prospect', meaning: '前景' },
  { id: 'local_book_likelihood_18', word: 'likelihood', meaning: '可能性' },
  { id: 'local_book_united_states_19', word: 'United States', meaning: '美国' },
  { id: 'local_book_prospect_20', word: 'prospect', meaning: '前景' }
];
const sampleLookup = buildReviewWordLookup(sampleWords, 'local_book');

assert.strictEqual(resolveReviewWordEntry('local_book_prospect', sampleLookup).displayWord, 'prospect');
assert.strictEqual(resolveReviewWordEntry('local_book_likelihood_18', sampleLookup).displayWord, 'likelihood');
assert.strictEqual(resolveReviewWordEntry('local_book_real_united_states', sampleLookup).displayWord, 'United States');
assert.strictEqual(
  resolveReviewWordEntry('local_book_prospect__wm_occurrence_2', sampleLookup).displayWord,
  'prospect'
);
assert.strictEqual(
  resolveReviewWordEntry('local_book_unknown_word_42', sampleLookup).displayWord,
  'unknown word'
);
assert.strictEqual(
  resolveReviewWordObject('local_book_real_united_states', sampleLookup).word,
  'United States',
  '短语必须保持完整，不能截断为首个单词'
);
assert.strictEqual(
  resolveReviewWordObject('local_book_real_united_states', sampleLookup).meaning,
  '美国'
);
assert.deepStrictEqual(
  getReviewWordMeaning({ translation: '兼容翻译字段' }),
  { meaning: '兼容翻译字段', field: 'translation', status: 'resolved' }
);
assert.deepStrictEqual(
  getReviewWordMeaning({ definition: { zh: '兼容嵌套释义' } }),
  { meaning: '兼容嵌套释义', field: 'definition', status: 'resolved' }
);
assert.strictEqual(isRealChineseMeaning('单词释义'), false);
assert.strictEqual(isRealChineseMeaning('真实中文释义'), true);

const storage = {};
global.wx = {
  getStorageSync: (key) => storage[key],
  setStorageSync: (key, value) => {
    storage[key] = value;
  },
  showToast: () => {},
  showLoading: () => {},
  hideLoading: () => {}
};
global.getApp = () => ({
  globalData: {},
  on: () => {},
  off: () => {}
});

let pageDefinition = null;
global.Page = (definition) => {
  pageDefinition = definition;
};
delete require.cache[require.resolve('../pages/review/review.js')];
require('../pages/review/review.js');
assert.ok(pageDefinition, '抗遗忘答题页应注册 Page');

const createDueRecord = () => ({
  difficult: true,
  antiForgettingSource: 'preview_not_mastered',
  nextReviewTime: Date.now() - 1,
  reviewCount: 0
});

const runReviewLoad = (wordbook, wordId) => {
  storage.wordMastery = {
    student456: {
      [wordbook.id]: {
        [wordId]: createDueRecord()
      }
    }
  };
  const beforeStorage = JSON.parse(JSON.stringify(storage.wordMastery));
  const page = Object.assign({}, pageDefinition, {
    data: {
      ...pageDefinition.data,
      currentStudent: { id: 'student456' },
      currentWordbook: wordbook
    },
    setData(nextData) {
      this.data = { ...this.data, ...nextData };
    }
  });

  page.loadReviewWords.call(page, [wordId]);
  assert.deepStrictEqual(storage.wordMastery, beforeStorage, '词面解析不得修改用户掌握数据');
  assert.strictEqual(page.data.currentBatchWords.length, 1);
  return page.data.currentBatchWords[0];
};

const renJiaoBook = {
  id: 'junior_7th_ren_jiao_second_v2',
  title: '人教版七年级下册',
  category: 'junior'
};
const renJiaoWords = generateWordsForBook(renJiaoBook.category, renJiaoBook.id, 0, 99999);
const rawSubway = renJiaoWords.find((word) => word.word === 'subway');
assert.ok(rawSubway, '测试词书应包含 subway');

const currentSubway = runReviewLoad(renJiaoBook, `${renJiaoBook.id}_subway`);
assert.strictEqual(currentSubway.word, 'subway');
assert.notStrictEqual(currentSubway.meaning, '单词释义');

const legacySubway = runReviewLoad(renJiaoBook, rawSubway.id);
assert.strictEqual(legacySubway.word, 'subway');
assert.notStrictEqual(legacySubway.meaning, '单词释义');

const missingBook = {
  id: 'legacy_local_book',
  title: '旧版本地词书',
  category: 'unknown'
};
const unresolvedProspect = runReviewLoad(missingBook, 'legacy_local_book_prospect_42');
assert.strictEqual(unresolvedProspect.word, 'prospect', '未知词条兜底不得擅自首字母大写');
assert.strictEqual(unresolvedProspect.meaning, '单词释义');

const unresolvedLikelihood = runReviewLoad(missingBook, 'legacy_local_book_likelihood_43');
assert.strictEqual(unresolvedLikelihood.word, 'likelihood', '未知词条兜底不得擅自首字母大写');

storage.cloud_wb_gaokao_reading_words = undefined;
const missingCloudWords = generateWordsForBook('senior', 'gaokao_reading_words', 0, 99999);
assert.strictEqual(missingCloudWords.length, 0, '云端词书缓存缺失时不得加载其他词书掩盖失败');

process.stdout.write('review-word-resolution: PASS\n');
