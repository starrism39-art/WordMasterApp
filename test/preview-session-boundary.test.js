'use strict';

const assert = require('assert');
const fs = require('fs');
const Module = require('module');

const learningPath = require.resolve('../pages/learning/learning.js');
const originalLoad = Module._load;
let pageDefinition = null;
let syncCalls = [];
let storage = {};

global.Page = (definition) => { pageDefinition = definition; };
global.getApp = () => ({
  globalData: {
    currentStudent: { id: 'student-a', name: 'Student A' },
    currentWordbook: { id: 'book-a', title: 'Book A', totalWords: 10 }
  },
  emit: () => {}
});

Module._load = function load(request, parent, isMain) {
  if (request === '../../utils/cloud-sync.js') {
    return {
      syncPreviewState: async (...args) => {
        syncCalls.push(args);
        return { ok: true };
      },
      loadPreviewStateFromCloud: async () => ({ mastery: {}, order: [], excluded: [] }),
      syncWordMasteryBatch: async () => ({ ok: true }),
      selectWordMasteryRecords: () => ({})
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
const words = Array.from({ length: 10 }, (_, index) => ({
  id: `book-a_word_${index + 1}`,
  word: `word ${index + 1}`,
  meaning: `meaning ${index + 1}`
}));

function createPage({ historicalMastery = {}, historicalExcluded = [] } = {}) {
  const previewKey = 'previewMastery_student-a_book-a';
  const excludedKey = 'previewExcludedWordIds_student-a_book-a';
  storage = {
    [previewKey]: clone(historicalMastery),
    [excludedKey]: clone(historicalExcluded),
    wordMastery: {},
    learningRecords: [],
    learningProgress: {}
  };
  syncCalls = [];

  global.wx = {
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => { storage[key] = clone(value); },
    removeStorageSync: (key) => { delete storage[key]; },
    vibrateShort: () => {},
    showToast: () => {},
    setNavigationBarTitle: () => {}
  };

  const page = Object.assign({}, pageDefinition);
  page.data = {
    ...clone(pageDefinition.data),
    learningMode: 'preview',
    currentStudent: { id: 'student-a', name: 'Student A' },
    currentWordbook: { id: 'book-a', title: 'Book A', totalWords: 10 },
    previewMastery: clone(historicalMastery),
    allWords: clone(words),
    currentBatchWords: clone(words),
    currentBatchIndex: 0,
    testWords: []
  };
  page._previewWordMap = Object.fromEntries(words.map((word) => [word.id, clone(word)]));
  page._previewSessionMastery = {};
  page.setData = function setData(patch) {
    this.data = { ...this.data, ...clone(patch) };
  };
  page._showButtonFeedback = () => {};
  page.stopStudyTimer = () => {};
  page._destroyCurrentAudioContext = () => {};
  page.syncFromGlobalData = () => ({
    currentStudent: page.data.currentStudent,
    currentWordbook: page.data.currentWordbook
  });
  page.checkSelectedStudentAndWordbook = () => {};

  return { page, previewKey, excludedKey };
}

const click = (page, word, status) => page.updatePreviewMastery({
  currentTarget: { dataset: { id: word.id, status } }
});

const flushTimers = () => new Promise((resolve) => setTimeout(resolve, 30));

(async () => {
  // Scenarios 1/2/5/6: preview clicks are session-only and do not persist or sync.
  {
    const historicalMastery = { 'book-a_legacy': false };
    const historicalExcluded = ['book-a_legacy'];
    const { page, previewKey, excludedKey } = createPage({ historicalMastery, historicalExcluded });
    words.slice(0, 3).forEach((word) => click(page, word, 'true'));
    words.slice(3, 5).forEach((word) => click(page, word, 'false'));
    await flushTimers();

    assert.deepStrictEqual(storage[previewKey], historicalMastery, 'draft must not overwrite historical previewMastery');
    assert.deepStrictEqual(storage[excludedKey], historicalExcluded, 'draft must not enter previewExcludedWordIds');
    assert.strictEqual(syncCalls.length, 0, 'draft must not sync preview_state');
    assert.deepStrictEqual(page._previewSessionMastery, {
      [words[0].id]: true,
      [words[1].id]: true,
      [words[2].id]: true,
      [words[3].id]: false,
      [words[4].id]: false
    });
    assert.deepStrictEqual(page.data.allWords.map((word) => word.id), words.map((word) => word.id), 'selected words must stay in the full preview list');
    assert.deepStrictEqual(page.data.currentBatchWords.map((word) => word.id), words.map((word) => word.id), 'selected words must stay at their original batch positions');
    assert.deepStrictEqual(storage.wordMastery, {});
    assert.deepStrictEqual(storage.learningRecords, []);
    assert.deepStrictEqual(storage.learningProgress, {});
  }

  // Selected-state rendering already exists and must remain driven by previewMastery.
  {
    const wxml = fs.readFileSync(require.resolve('../pages/learning/learning.wxml'), 'utf8');
    assert.ok(wxml.includes("previewMastery[item.id] === true"));
    assert.ok(wxml.includes("previewMastery[item.id] === false"));
    assert.ok(wxml.includes("correct-button {{(previewMastery[item.id] === true"));
    assert.ok(wxml.includes("wrong-button {{(previewMastery[item.id] === false"));
  }

  // Selection is editable in both directions and must not change list order or pagination.
  {
    const { page } = createPage();
    const pagedWords = Array.from({ length: 31 }, (_, index) => ({
      id: `book-a_paged_${index + 1}`,
      word: `paged ${index + 1}`,
      meaning: `meaning ${index + 1}`
    }));
    page.data.allWords = clone(pagedWords);
    page.data.currentBatchWords = clone(pagedWords.slice(15, 30));
    page.data.currentBatchIndex = 1;
    page.data.totalBatches = 3;
    page.data.totalPages = 3;
    page.data.hasMoreWords = true;
    page._previewWordMap = Object.fromEntries(pagedWords.map((word) => [word.id, clone(word)]));

    const originalAllIds = page.data.allWords.map((word) => word.id);
    const originalBatchIds = page.data.currentBatchWords.map((word) => word.id);
    click(page, pagedWords[16], 'true');
    assert.strictEqual(page.data.previewMastery[pagedWords[16].id], true, 'mastered button state must be visible in Page.data');
    click(page, pagedWords[16], 'false');
    assert.strictEqual(page.data.previewMastery[pagedWords[16].id], false, 'mastered -> unmastered must replace the draft value');
    click(page, pagedWords[17], 'false');
    click(page, pagedWords[17], 'true');
    assert.strictEqual(page.data.previewMastery[pagedWords[17].id], true, 'unmastered -> mastered must replace the draft value');

    assert.deepStrictEqual(page.data.allWords.map((word) => word.id), originalAllIds);
    assert.deepStrictEqual(page.data.currentBatchWords.map((word) => word.id), originalBatchIds);
    assert.strictEqual(page.data.currentBatchIndex, 1);
    assert.strictEqual(page.data.totalBatches, 3);
    assert.strictEqual(page.data.totalPages, 3);
    assert.strictEqual(page.data.hasMoreWords, true);

    let submittedMastery = null;
    let continuedWords = null;
    page.updateWordMasteryStatus = (wordIds, status, previewMastery) => {
      submittedMastery = clone(previewMastery);
    };
    page._clearCommittedPreviewState = () => {};
    page._continueStartLearning = (selectedWords) => { continuedWords = clone(selectedWords); };
    page.startNewLearning();

    assert.deepStrictEqual(submittedMastery, {
      [pagedWords[16].id]: false,
      [pagedWords[17].id]: true
    }, 'Start Learning must submit only the final state for each edited word');
    assert.deepStrictEqual(continuedWords.map((word) => word.id), [pagedWords[16].id]);
  }

  // Scenario 5/6: onHide discards the in-memory draft and onShow reloads the preview session.
  {
    const { page } = createPage();
    click(page, words[0], 'true');
    let resetCount = 0;
    let initCount = 0;
    page.resetForLearningContextChange = function reset() {
      resetCount += 1;
      this.data.previewMastery = {};
      this.data.allWords = [];
      this.data.currentBatchWords = [];
    };
    page.initStudyProcess = () => { initCount += 1; };

    page.onHide();
    page.onShow();

    assert.deepStrictEqual(page._previewSessionMastery, {});
    assert.strictEqual(resetCount, 1, 'returning to a hidden preview page must rebuild the business state');
    assert.strictEqual(initCount, 1);
  }

  // Scenarios 3/4/7/8: Start Learning submits the current session, never stale historical preview data.
  {
    const historicalMastery = { [words[9].id]: false };
    const { page } = createPage({ historicalMastery, historicalExcluded: [words[9].id] });
    page._previewSessionMastery = {
      [words[0].id]: true,
      [words[1].id]: true
    };
    page.data.previewMastery = {
      ...historicalMastery,
      ...page._previewSessionMastery
    };
    let completedDecision = null;
    page._completePreviewOnlyRound = (decision) => { completedDecision = decision; };

    page.startNewLearning();

    assert.ok(completedDecision, 'session-only mastered words should use the direct completion path');
    assert.deepStrictEqual(completedDecision.masteredWordIds.sort(), [words[0].id, words[1].id].sort());
    assert.deepStrictEqual(completedDecision.notMasteredWordIds, []);
  }

  // Scenario 9/10: reading legacy preview data remains compatible, but it is not a new formal submission.
  {
    const historicalMastery = { [words[8].id]: true };
    const { page, previewKey } = createPage({ historicalMastery, historicalExcluded: [words[8].id] });
    page._previewSessionMastery = {};
    let formalCallCount = 0;
    page.updateWordMasteryStatus = () => { formalCallCount += 1; };
    page.startNewLearning();

    assert.strictEqual(formalCallCount, 0);
    assert.deepStrictEqual(storage[previewKey], historicalMastery, 'legacy preview data must not be migrated or deleted without a submission');
    assert.strictEqual(syncCalls.length, 0);
  }

  process.stdout.write('preview-session-boundary: PASS\n');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
