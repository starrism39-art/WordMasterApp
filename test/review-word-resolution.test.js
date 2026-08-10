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
assert.strictEqual(resolveReviewWordEntry('3', sampleLookup).displayWord, 'United States');
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
assert.strictEqual(resolveReviewWordObject('local_book_real_united_states', sampleLookup).meaning, '美国');
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
  hideLoading: () => {},
  setInnerAudioOption: () => {}
};
global.getApp = () => ({
  globalData: {},
  on: () => {},
  off: () => {}
});

const loadPageDefinition = (modulePath) => {
  let definition = null;
  global.Page = (value) => {
    definition = value;
  };
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
  assert.ok(definition, `${modulePath} 应注册 Page`);
  return definition;
};

const reviewPageDefinition = loadPageDefinition('../pages/review/review.js');
const mergedPageDefinition = loadPageDefinition('../subpages/review-merged/review-merged.js');
const wordViewPageDefinition = loadPageDefinition('../subpages/word-view/word-view.js');

const createDueRecord = (legacy = false) => ({
  difficult: true,
  ...(legacy ? {} : { antiForgettingSource: 'preview_not_mastered' }),
  nextReviewTime: Date.now() - 1,
  reviewCount: 0
});

const createPage = (definition, wordbook) => Object.assign({}, definition, {
  data: {
    ...definition.data,
    currentStudent: { id: 'student456' },
    currentWordbook: wordbook
  },
  setData(nextData) {
    this.data = { ...this.data, ...nextData };
  }
});

const runReviewLoad = async (definition, wordbook, wordId, legacyRecord = false) => {
  storage.selectedStudent = { id: 'student456', name: '456' };
  storage.selectedWordbook = wordbook;
  storage.wordMastery = {
    student456: {
      [wordbook.id]: {
        [wordId]: createDueRecord(legacyRecord)
      }
    }
  };
  storage.learningRecords = [{
    id: 'legacy-learning-record',
    studentId: 'student456',
    wordbookId: wordbook.id,
    learnedWordIds: [wordId]
  }];
  const beforeMastery = JSON.parse(JSON.stringify(storage.wordMastery));
  const beforeLearningRecords = JSON.parse(JSON.stringify(storage.learningRecords));
  const page = createPage(definition, wordbook);

  await page.loadReviewWords.call(page, [wordId]);
  assert.deepStrictEqual(storage.wordMastery, beforeMastery, '词面解析不得修改历史 wordMastery');
  assert.deepStrictEqual(storage.learningRecords, beforeLearningRecords, '词面解析不得修改旧学习记录');
  assert.strictEqual(page.data.currentBatchWords.length, 1);
  return page.data.currentBatchWords[0];
};

const runWordViewLoad = async (wordbook, wordId, incomingObjects = null) => {
  storage.selectedStudent = { id: 'student456', name: '456' };
  storage.selectedWordbook = wordbook;
  const page = createPage(wordViewPageDefinition, wordbook);
  if (incomingObjects) {
    await page.loadResolvedWordObjects.call(page, incomingObjects);
  } else {
    await page.loadWords.call(page, [wordId]);
  }
  assert.strictEqual(page.data.words.length, 1);
  return page.data.words[0];
};

const assertResolved = (word, expectedWord, expectedMeaning) => {
  assert.strictEqual(word.word, expectedWord);
  assert.strictEqual(word.meaning, expectedMeaning);
  assert.strictEqual(word.translation, expectedMeaning);
  assert.notStrictEqual(word.meaning, '单词释义');
};

async function run() {
  const renJiaoBook = {
    id: 'junior_7th_ren_jiao_second_v2',
    title: '人教版七年级下册',
    category: 'junior'
  };
  const renJiaoWords = generateWordsForBook(renJiaoBook.category, renJiaoBook.id, 0, 99999);
  const rawSubway = renJiaoWords.find((word) => word.word === 'subway');
  assert.ok(rawSubway, '测试词书应包含 subway');

  assertResolved(
    await runReviewLoad(reviewPageDefinition, renJiaoBook, `${renJiaoBook.id}_subway`),
    'subway',
    '地铁'
  );
  assertResolved(
    await runReviewLoad(reviewPageDefinition, renJiaoBook, rawSubway.id, true),
    'subway',
    '地铁'
  );

  const cloudBook = {
    id: 'gaokao_reading_words',
    title: '高考英语阅读高频词汇',
    category: 'senior'
  };
  const cloudWords = Array.from({ length: 687 }, (_, index) => ({
    word: `cloud-only-${index}`,
    meaning: `云端释义${index}`
  }));
  cloudWords[332] = { word: 'likelihood', meaning: '可能,可能性' };
  cloudWords[333] = { word: 'look forward to', meaning: '期待；盼望' };
  cloudWords[334] = { word: 'United States', translation: '美国' };
  storage.cloud_wb_gaokao_reading_words = cloudWords;

  const cloudCases = [
    ['gaokao_reading_words_likelihood', 'likelihood', '可能,可能性'],
    ['gaokao_reading_words_likelihood_332', 'likelihood', '可能,可能性'],
    ['gaokao_reading_words_look_forward_to', 'look forward to', '期待；盼望'],
    ['gaokao_reading_words_united_states', 'United States', '美国']
  ];

  for (const [wordId, expectedWord, expectedMeaning] of cloudCases) {
    assertResolved(
      await runReviewLoad(reviewPageDefinition, cloudBook, wordId, wordId.endsWith('_332')),
      expectedWord,
      expectedMeaning
    );
    assertResolved(
      await runReviewLoad(mergedPageDefinition, cloudBook, wordId, wordId.endsWith('_332')),
      expectedWord,
      expectedMeaning
    );
    assertResolved(await runWordViewLoad(cloudBook, wordId), expectedWord, expectedMeaning);
  }

  const legacyObject = await runWordViewLoad(cloudBook, 'gaokao_reading_words_likelihood_332', [{
    id: 'legacy-object-id',
    sourceWordId: 'gaokao_reading_words_likelihood_332',
    word: 'Likelihood',
    meaning: '单词释义',
    phonetic: '/fəˈnetɪk/'
  }]);
  assertResolved(legacyObject, 'likelihood', '可能,可能性');
  assert.notStrictEqual(legacyObject.phonetic, '/fəˈnetɪk/');

  storage.cloud_wb_gaokao_reading_words = undefined;
  const missingCloudWords = generateWordsForBook('senior', 'gaokao_reading_words', 0, 99999);
  assert.strictEqual(missingCloudWords.length, 0, '云端词书缓存缺失时不得加载其他词书掩盖失败');

  process.stdout.write('review-word-resolution: PASS\n');
}

run().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
