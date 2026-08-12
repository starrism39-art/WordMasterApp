'use strict';

const assert = require('assert');
const Module = require('module');

const storage = {};
const syncCalls = [];

global.wx = {
  getStorageSync: (key) => storage[key],
  setStorageSync: (key, value) => { storage[key] = value; },
  vibrateShort: () => {},
  showToast: () => {}
};
global.getApp = () => ({ globalData: {}, emit: () => {} });

let pageDefinition = null;
global.Page = (definition) => { pageDefinition = definition; };

const learningPath = require.resolve('../pages/learning/learning.js');
const originalLoad = Module._load;
delete require.cache[learningPath];
Module._load = function load(request, parent, isMain) {
  if (request === '../../utils/cloud-sync.js') {
    return {
      syncPreviewState: async (studentId, wordbookId, previewData) => {
        syncCalls.push({ studentId, wordbookId, previewData });
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
  require(learningPath);
} finally {
  Module._load = originalLoad;
}

assert.ok(pageDefinition, 'learning page should register');
const page = Object.assign({}, pageDefinition);
page.data = {
  learningMode: 'preview',
  currentStudent: { id: 'student-a' },
  currentWordbook: { id: 'book-a' },
  previewMastery: {},
  allWords: [{ id: 'book-a-last' }],
  currentBatchWords: [{ id: 'book-a-last' }],
  currentBatchIndex: 0,
  testWords: [],
  showMeaning: {},
  clickCounts: {},
  showPhonetic: {}
};
page.setData = function setData(patch) {
  this.data = { ...this.data, ...patch };
};

(async () => {
  page.updatePreviewMastery({
    currentTarget: { dataset: { id: 'book-a-last', status: 'false' } }
  });
  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.strictEqual(syncCalls.length, 0, '预习会话草稿不得在按钮点击时同步到云端');
  assert.strictEqual(storage['previewMastery_student-a_book-a'], undefined);
  assert.strictEqual(storage['previewExcludedWordIds_student-a_book-a'], undefined);
  assert.deepStrictEqual(page._previewSessionMastery, { 'book-a-last': false });
  assert.strictEqual(page.data.previewMastery['book-a-last'], false);
  process.stdout.write('preview-state-sync-order: PASS\n');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
