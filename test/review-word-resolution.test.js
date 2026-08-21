'use strict';

const assert = require('assert');
const { generateWordsForBook } = require('../data/wordbook-loader.js');
const { createWordMap, findWord } = require('../data/wordbook-utils.js');
const {
  buildReviewWordLookup,
  extractDisplayWordFromReviewId,
  getReviewWordMeaning,
  isRealChineseMeaning,
  resolveReviewWordEntry,
  resolveReviewWordObject
} = require('../utils/review-word-resolver.js');
const { assignStableWordIds } = require('../utils/learning-word-ids.js');

const sampleWords = [
  { id: 'local_book_prospect_17', word: 'prospect', meaning: '前景' },
  { id: 'local_book_likelihood_18', word: 'likelihood', meaning: '可能性' },
  { id: 'local_book_united_states_19', word: 'United States', meaning: '美国' },
  { id: 'local_book_prospect_20', word: 'prospect', meaning: '前景' }
];
const sampleLookup = buildReviewWordLookup(sampleWords, 'local_book');

const phraseFallbackMap = createWordMap([
  { word: 'in', meaning: '在...里', phonetic: '/ɪn/' },
  { word: 'of', meaning: '……的', phonetic: '/əv/' }
]);
assert.strictEqual(
  findWord('in front of', phraseFallbackMap),
  null,
  '短语未精确命中时必须保留完整原文，不得退化到首词或尾词'
);
assert.strictEqual(findWord('in', phraseFallbackMap).word, 'in', '普通单词查找不得受影响');

const historicalBookId = 'book_with_under_scores';
const historicalWords = [
  { id: `${historicalBookId}_in_front_of_7`, word: 'in front of', meaning: '在……前面', phonetic: '/ɪn frʌnt əv/' },
  { word: 'Take  Notes, Please!', meaning: '请记笔记', phonetic: '/teɪk nəʊts pliːz/' },
  { word: 'repeat phrase', meaning: '重复短语一' },
  { word: 'repeat phrase', meaning: '重复短语二' }
];
const historicalLookup = buildReviewWordLookup(historicalWords, historicalBookId);
const duplicateStableWords = assignStableWordIds(historicalWords, historicalBookId);

assert.strictEqual(
  resolveReviewWordEntry('BOOK_WITH_UNDER_SCORES_REAL_IN_FRONT_OF_999', historicalLookup).displayWord,
  'in front of',
  '词书 ID 包含下划线且大小写不同时，仍应剥离完整前缀'
);
assert.strictEqual(
  resolveReviewWordEntry(`${historicalBookId}_word_real_in_front_of`, historicalLookup).displayWord,
  'in front of',
  '旧 word_real 格式应恢复完整短语'
);
assert.strictEqual(
  resolveReviewWordEntry(`${historicalBookId}_in_front_of__wm_occurrence_1`, historicalLookup).displayWord,
  'in front of',
  '稳定重复后缀应与完整短语兼容'
);
assert.strictEqual(resolveReviewWordEntry('1', historicalLookup).displayWord, 'in front of');
assert.strictEqual(
  resolveReviewWordEntry(duplicateStableWords[2].id, historicalLookup).entry.meaning,
  '重复短语一'
);
assert.strictEqual(
  resolveReviewWordEntry(duplicateStableWords[3].id, historicalLookup).entry.meaning,
  '重复短语二',
  '同词书重复短语必须按稳定 wordId 独立解析'
);
assert.strictEqual(
  resolveReviewWordObject(duplicateStableWords[1].id, historicalLookup).word,
  'Take  Notes, Please!',
  '精确命中时必须保留词书原始大小写、标点和内部空格'
);
const unmatchedPhrase = resolveReviewWordObject(`${historicalBookId}_missing_phrase_here_42`, historicalLookup);
assert.strictEqual(unmatchedPhrase.word, 'missing phrase here');
assert.strictEqual(unmatchedPhrase.meaning, '');
assert.strictEqual(unmatchedPhrase.phonetic, '');
assert.strictEqual(unmatchedPhrase._reviewResolution.matchFailureReason, 'current_wordbook_exact_entry_not_found');
assert.strictEqual(
  extractDisplayWordFromReviewId(`${historicalBookId}_real_in_front_of_91`, historicalBookId),
  'in front of'
);

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
const recordsPageDefinition = loadPageDefinition('../subpages/records/records.js');

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

const assertResolved = (word, expectedWord, expectedMeaning, expectedPhonetic = null) => {
  assert.strictEqual(word.word, expectedWord);
  assert.strictEqual(word.meaning, expectedMeaning);
  assert.strictEqual(word.translation, expectedMeaning);
  assert.notStrictEqual(word.meaning, '无释义');
  assert.notStrictEqual(word.meaning, '单词释义');
  if (expectedPhonetic !== null) {
    assert.strictEqual(word.phonetic, expectedPhonetic);
  }
};

const assertWordRoute = (book, expected) => {
  const words = generateWordsForBook(book.category, book.id, 0, 99999);
  const firstWords = words.slice(0, expected.firstWords.length).map((word) => word.word);
  assert.strictEqual(words._totalCount, expected.total, `${book.id} 应加载正确词表数量`);
  assert.deepStrictEqual(firstWords, expected.firstWords, `${book.id} 应加载正确词表首词`);
  assert.notDeepStrictEqual(
    firstWords.slice(0, 3),
    ['review', 'chocolate', 'factory'],
    `${book.id} 不得误加载外研社七年级下册词表`
  );
  return words;
};

async function run() {
  const newStandard8thFirstBook = {
    id: 'junior_8th_first',
    title: '外研社八年级上册',
    category: 'junior'
  };
  const newStandard8thFirstWords = assertWordRoute(newStandard8thFirstBook, {
    total: 243,
    firstWords: ['suppose', 'birthmark', 'bright']
  });
  assert.strictEqual(newStandard8thFirstWords[0].meaning, '想，认为');

  const newStandard7thSecondBook = {
    id: 'junior_7th_second',
    title: '外研社七年级下册',
    category: 'junior'
  };
  const newStandard7thSecondWords = generateWordsForBook(newStandard7thSecondBook.category, newStandard7thSecondBook.id, 0, 99999);
  assert.strictEqual(newStandard7thSecondWords._totalCount, 381, '外研社七年级下册仍应加载七下完整词表');
  assert.deepStrictEqual(
    newStandard7thSecondWords.slice(0, 3).map((word) => word.word),
    ['review', 'chocolate', 'factory'],
    '外研社七年级下册首词应保持不变'
  );

  assertWordRoute({
    id: 'junior_8th_ji_first',
    title: '冀教版八年级上册',
    category: 'junior'
  }, {
    total: 429,
    firstWords: ['chat', 'online', 'communication']
  });

  assertWordRoute({
    id: 'junior_8th_yi_lin_first',
    title: '译林牛津版八年级上册',
    category: 'junior'
  }, {
    total: 330,
    firstWords: ['almost', 'along', 'amazing']
  });

  assertResolved(
    await runReviewLoad(reviewPageDefinition, newStandard8thFirstBook, `${newStandard8thFirstBook.id}_suppose`),
    'suppose',
    '想，认为',
    '/səˈpəʊz/'
  );

  const phraseBook = {
    id: 'junior_7th_ren_jiao_v2',
    title: '人教版七年级上册',
    category: 'junior'
  };
  const phraseWords = generateWordsForBook(phraseBook.category, phraseBook.id, 0, 99999);
  const rawInFrontOf = phraseWords.find((word) => word.word === 'in front of');
  assert.ok(rawInFrontOf, '本地词书应包含 in front of');

  for (const definition of [reviewPageDefinition, mergedPageDefinition]) {
    assertResolved(
      await runReviewLoad(definition, phraseBook, rawInFrontOf.id),
      'in front of',
      rawInFrontOf.meaning,
      rawInFrontOf.phonetic || ''
    );
  }
  assertResolved(
    await runWordViewLoad(phraseBook, rawInFrontOf.id),
    'in front of',
    rawInFrontOf.meaning,
    rawInFrontOf.phonetic || ''
  );

  const recordsPage = createPage(recordsPageDefinition, phraseBook);
  assert.strictEqual(
    recordsPage.parseWordFromRecordId(`${phraseBook.id}_real_in_front_of_999`, phraseBook.id),
    'in front of',
    '学习记录入口不得仅取最后一个单词'
  );

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
  cloudWords[335] = { word: 'in front of', meaning: '在……前面', phonetic: '/ɪn frʌnt əv/' };
  storage.cloud_wb_gaokao_reading_words = cloudWords;

  const cloudCases = [
    ['gaokao_reading_words_likelihood', 'likelihood', '可能,可能性'],
    ['gaokao_reading_words_likelihood_332', 'likelihood', '可能,可能性'],
    ['gaokao_reading_words_look_forward_to', 'look forward to', '期待；盼望'],
    ['gaokao_reading_words_united_states', 'United States', '美国'],
    ['gaokao_reading_words_in_front_of', 'in front of', '在……前面', '/ɪn frʌnt əv/']
  ];

  for (const [wordId, expectedWord, expectedMeaning, expectedPhonetic = null] of cloudCases) {
    assertResolved(
      await runReviewLoad(reviewPageDefinition, cloudBook, wordId, wordId.endsWith('_332')),
      expectedWord,
      expectedMeaning,
      expectedPhonetic
    );
    assertResolved(
      await runReviewLoad(mergedPageDefinition, cloudBook, wordId, wordId.endsWith('_332')),
      expectedWord,
      expectedMeaning,
      expectedPhonetic
    );
    assertResolved(await runWordViewLoad(cloudBook, wordId), expectedWord, expectedMeaning, expectedPhonetic);
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
