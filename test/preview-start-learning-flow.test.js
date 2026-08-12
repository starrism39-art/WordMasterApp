'use strict';

const assert = require('assert');
const Module = require('module');
const { reconcileStudentLearningProgress } = require('../utils/learning-progress.js');

const learningPath = require.resolve('../pages/learning/learning.js');
const originalLoad = Module._load;
let pageDefinition = null;
let activeApp = null;
let activeWx = null;
let nowSeed = 1700000000000;

global.Page = (definition) => { pageDefinition = definition; };
global.getApp = () => activeApp;

Module._load = function load(request, parent, isMain) {
  if (request === '../../utils/cloud-sync.js') {
    return {
      syncPreviewState: (...args) => activeApp.syncPreviewState(...args),
      loadPreviewStateFromCloud: async () => ({ mastery: {}, order: [], excluded: [] }),
      syncWordMasteryBatch: (...args) => activeApp.syncWordMasteryBatch(...args),
      selectWordMasteryRecords: (records, ids) => Object.fromEntries(
        (ids || []).filter((id) => records && records[id]).map((id) => [id, records[id]])
      )
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
try {
  delete require.cache[learningPath];
  require(learningPath);
} finally {
  Module._load = originalLoad;
}

assert.ok(pageDefinition, 'learning page should register');

const clone = (value) => JSON.parse(JSON.stringify(value));
const makeWords = (count, wordbookId = 'book-a') => Array.from({ length: count }, (_, index) => ({
  id: `${wordbookId}_word_${index + 1}`,
  word: `word ${index + 1}`,
  meaning: `meaning ${index + 1}`,
  translation: `meaning ${index + 1}`,
  phonetic: `/w${index + 1}/`
}));

function createRuntime({
  words,
  previewMastery,
  existingWordMastery = {},
  existingLearningRecords = [],
  wordbookTotalWords = words.length
}) {
  const studentId = 'student-a';
  const wordbookId = 'book-a';
  const previewKey = `previewMastery_${studentId}_${wordbookId}`;
  const excludedKey = `previewExcludedWordIds_${studentId}_${wordbookId}`;
  const storage = {
    wordMastery: clone(existingWordMastery),
    learningRecords: clone(existingLearningRecords),
    learningProgress: {}
  };
  const modalCalls = [];
  const toastCalls = [];
  const previewSyncCalls = [];
  const masterySyncCalls = [];
  const emitted = [];

  activeWx = global.wx = {
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => { storage[key] = value; },
    removeStorageSync: (key) => { delete storage[key]; },
    showModal: (options) => { modalCalls.push(options); },
    showToast: (options) => { toastCalls.push(options); },
    setNavigationBarTitle: () => {},
    vibrateShort: () => {}
  };

  activeApp = {
    globalData: {
      currentStudent: { id: studentId, name: 'Student A' },
      currentWordbook: { id: wordbookId, title: 'Book A', totalWords: wordbookTotalWords }
    },
    emit: (name) => emitted.push(name),
    syncPreviewState: async (...args) => {
      previewSyncCalls.push(args);
      return { ok: true };
    },
    syncWordMasteryBatch: async (...args) => {
      masterySyncCalls.push(args);
      return { ok: true };
    },
    addLearningRecord(record) {
      const recordWithTime = {
        ...clone(record),
        id: record.id || String(++nowSeed),
        timestamp: ++nowSeed,
        studyDate: new Date(++nowSeed).toISOString()
      };
      const records = storage.learningRecords || [];
      records.push(recordWithTime);
      storage.learningRecords = records;
      const progress = storage.learningProgress || {};
      progress[studentId] = reconcileStudentLearningProgress({
        studentId,
        progressData: progress[studentId],
        studentMastery: (storage.wordMastery || {})[studentId],
        learningRecords: records,
        bookTotals: { [wordbookId]: wordbookTotalWords },
        updatedBookId: wordbookId,
        lastStudyTime: recordWithTime.studyDate,
        updatedAt: ++nowSeed
      });
      storage.learningProgress = progress;
      emitted.push('learningRecordAdded');
      return true;
    }
  };

  const page = Object.assign({}, pageDefinition);
  const unmarkedWords = words.filter((word) => !Object.prototype.hasOwnProperty.call(previewMastery, word.id));
  page.data = {
    ...clone(pageDefinition.data),
    currentStudent: activeApp.globalData.currentStudent,
    currentWordbook: activeApp.globalData.currentWordbook,
    studentId,
    wordbookId,
    learningMode: 'preview',
    previewMastery: clone(previewMastery),
    allWords: clone(unmarkedWords),
    currentBatchWords: clone(unmarkedWords),
    testWords: [],
    studyDuration: 30
  };
  page._previewWordMap = Object.fromEntries(words.map((word) => [String(word.id), clone(word)]));
  page._previewSessionMastery = clone(previewMastery);
  page.setData = function setData(patch) {
    this.data = { ...this.data, ...clone(patch) };
  };
  page.syncFromGlobalData = () => ({});
  page.checkSelectedStudentAndWordbook = () => {};
  page.stopStudyTimer = () => {};
  page.startStudyTimer = () => {};
  page.calculateNextReviewTime = (_count, time) => time + 86400000;
  page.showTestResult = function showTestResult(correctRate, totalWords, masteredWords) {
    this._shownResult = { correctRate, totalWords, masteredWords };
  };

  return {
    page,
    storage,
    previewKey,
    excludedKey,
    modalCalls,
    toastCalls,
    previewSyncCalls,
    masterySyncCalls,
    emitted
  };
}

const statusMap = (words, masteredCount, difficultCount) => {
  const result = {};
  words.slice(0, masteredCount).forEach((word) => { result[word.id] = true; });
  words.slice(masteredCount, masteredCount + difficultCount).forEach((word) => { result[word.id] = false; });
  return result;
};

async function flushPromises() {
  await new Promise((resolve) => setImmediate(resolve));
}

function assertFormalScope(runtime, expectedIds) {
  const records = runtime.storage.wordMastery['student-a']['book-a'];
  assert.deepStrictEqual(Object.keys(records).sort(), [...expectedIds].sort());
  const record = runtime.storage.learningRecords[0];
  assert.deepStrictEqual([...record.learnedWordIds].sort(), [...expectedIds].sort());
}

async function runAllMasteredScenario({ totalWords = 5, existingMastery = {} } = {}) {
  const words = makeWords(5);
  const runtime = createRuntime({
    words,
    previewMastery: statusMap(words, 5, 0),
    existingWordMastery: {
      'student-a': { 'book-a': clone(existingMastery) }
    },
    wordbookTotalWords: totalWords
  });
  runtime.page.startNewLearning();
  await flushPromises();
  return { runtime, words };
}

(async () => {
  // 1. 5 mastered + 5 unmastered: only unmastered enter newLearning.
  {
    const words = makeWords(10);
    const runtime = createRuntime({ words, previewMastery: statusMap(words, 5, 5) });
    runtime.page.startNewLearning();
    assert.strictEqual(runtime.page.data.learningMode, 'newLearning');
    assert.deepStrictEqual(runtime.page.data.allWords.map((word) => word.id), words.slice(5).map((word) => word.id));
    assert.deepStrictEqual(runtime.page.data.startLearningSourceWordIds.sort(), words.map((word) => word.id).sort());
    runtime.page.setData({
      testWords: words.slice(5),
      originalTestWordsCount: 5,
      previewMastery: Object.fromEntries(words.slice(5).map((word) => [word.id, true]))
    });
    runtime.page.completeTest();
    await flushPromises();
    assertFormalScope(runtime, words.map((word) => word.id));
    assert.strictEqual(runtime.storage.learningProgress['student-a'].learnedWords, 10);
    words.slice(0, 5).forEach((word) => {
      assert.strictEqual(runtime.storage.wordMastery['student-a']['book-a'][word.id].antiForgettingSource, 'preview_mastered');
    });
    words.slice(5).forEach((word) => {
      assert.strictEqual(runtime.storage.wordMastery['student-a']['book-a'][word.id].antiForgettingSource, 'preview_not_mastered');
    });
  }

  // 2. All mastered: complete without newLearning or the obsolete modal.
  {
    const { runtime, words } = await runAllMasteredScenario();
    assert.strictEqual(runtime.page.data.learningMode, 'completed');
    assert.strictEqual(runtime.page.data.pageTitle, '学习完成');
    assert.strictEqual(runtime.page.data.testProgress, 100);
    assert.strictEqual(runtime.page.data.accuracyRate, 100);
    assert.strictEqual(runtime.modalCalls.length, 0);
    assertFormalScope(runtime, words.map((word) => word.id));
    assert.deepStrictEqual(runtime.storage.learningRecords[0].masteredWordIds.sort(), words.map((word) => word.id).sort());
    assert.deepStrictEqual(runtime.storage.learningRecords[0].notMasteredWordIds, []);
    assert.strictEqual(runtime.storage.learningProgress['student-a'].learnedWords, 5);
    words.forEach((word) => {
      assert.strictEqual(runtime.storage.wordMastery['student-a']['book-a'][word.id].antiForgettingSource, 'preview_mastered');
    });
    assert.strictEqual(runtime.storage[ runtime.previewKey ], undefined);
    assert.strictEqual(runtime.storage[ runtime.excludedKey ], undefined);
    assert.strictEqual(runtime.previewSyncCalls.length, 1);
  }

  // 3. 5 mastered + 5 unmarked: only five mastered are formalized.
  {
    const words = makeWords(10);
    const runtime = createRuntime({ words, previewMastery: statusMap(words, 5, 0), wordbookTotalWords: 10 });
    runtime.page.startNewLearning();
    await flushPromises();
    assertFormalScope(runtime, words.slice(0, 5).map((word) => word.id));
    words.slice(5).forEach((word) => {
      assert.strictEqual(runtime.storage.wordMastery['student-a']['book-a'][word.id], undefined);
    });
  }

  // 4. 3 mastered + 2 unmastered + 5 unmarked.
  {
    const words = makeWords(10);
    const runtime = createRuntime({ words, previewMastery: statusMap(words, 3, 2) });
    runtime.page.startNewLearning();
    assert.deepStrictEqual(runtime.page.data.allWords.map((word) => word.id), words.slice(3, 5).map((word) => word.id));
    assert.deepStrictEqual(runtime.page.data.startLearningSourceWordIds.sort(), words.slice(0, 5).map((word) => word.id).sort());
    runtime.page.setData({
      testWords: words.slice(3, 5),
      originalTestWordsCount: 2,
      previewMastery: Object.fromEntries(words.slice(3, 5).map((word) => [word.id, true]))
    });
    runtime.page.completeTest();
    await flushPromises();
    assertFormalScope(runtime, words.slice(0, 5).map((word) => word.id));
    words.slice(5).forEach((word) => {
      assert.strictEqual(runtime.storage.wordMastery['student-a']['book-a'][word.id], undefined);
    });
  }

  // 5. All unmastered keeps the existing learning flow.
  {
    const words = makeWords(5);
    const runtime = createRuntime({ words, previewMastery: statusMap(words, 0, 5) });
    runtime.page.startNewLearning();
    assert.strictEqual(runtime.page.data.learningMode, 'newLearning');
    assert.deepStrictEqual(runtime.page.data.allWords.map((word) => word.id), words.map((word) => word.id));
  }

  // 6. The final five mastered words reach 100% without duplicate learned IDs.
  {
    const priorWords = makeWords(5).map((word, index) => ({ ...word, id: `book-a_prior_${index + 1}` }));
    const existingMastery = Object.fromEntries(priorWords.map((word) => [word.id, {
      mastered: true,
      difficult: false,
      reviewCount: 0,
      firstMasteryTime: 1600000000000,
      lastReviewTime: 1600000000000,
      nextReviewTime: 1600086400000,
      reviewTimeline: []
    }]));
    const { runtime } = await runAllMasteredScenario({ totalWords: 10, existingMastery });
    const progress = runtime.storage.learningProgress['student-a'];
    assert.strictEqual(progress.learnedWords, 10);
    assert.strictEqual(progress.wordbooks['book-a'].completedCount, 10);
    assert.strictEqual(progress.wordbooks['book-a'].totalCount, 10);
    assert.strictEqual(
      Math.round(progress.wordbooks['book-a'].completedCount / progress.wordbooks['book-a'].totalCount * 100),
      100
    );
  }

  // 7. All unmarked: no prompt, write, cleanup, record, progress, or navigation.
  {
    const words = makeWords(5);
    const runtime = createRuntime({ words, previewMastery: {} });
    const before = clone(runtime.storage);
    runtime.page.startNewLearning();
    await flushPromises();
    assert.strictEqual(runtime.page.data.learningMode, 'preview');
    assert.strictEqual(runtime.modalCalls.length, 0);
    assert.strictEqual(runtime.previewSyncCalls.length, 0);
    assert.deepStrictEqual(runtime.storage, before);
    assert.ok(runtime.toastCalls.some((call) => String(call.title || '').includes('标记')));
  }

  // 8. A non-starting decision must not partially commit or clear state.
  {
    const words = makeWords(3);
    const runtime = createRuntime({ words, previewMastery: {} });
    const before = clone(runtime.storage);
    runtime.page.startNewLearning();
    await flushPromises();
    assert.deepStrictEqual(runtime.storage, before);
    assert.strictEqual(runtime.masterySyncCalls.length, 0);
    assert.strictEqual(runtime.previewSyncCalls.length, 0);
  }

  // Legacy array-shaped mastery remains readable and is normalized without losing old IDs.
  {
    const words = makeWords(5);
    const runtime = createRuntime({
      words,
      previewMastery: statusMap(words, 5, 0),
      existingWordMastery: { 'student-a': { 'book-a': ['book-a_legacy_word'] } },
      wordbookTotalWords: 6
    });
    runtime.page.startNewLearning();
    await flushPromises();
    const bookMastery = runtime.storage.wordMastery['student-a']['book-a'];
    assert.ok(!Array.isArray(bookMastery));
    assert.strictEqual(bookMastery['book-a_legacy_word'].mastered, true);
    words.forEach((word) => assert.strictEqual(bookMastery[word.id].mastered, true));
  }

  process.stdout.write('preview-start-learning-flow: PASS\n');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
