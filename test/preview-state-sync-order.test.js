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

  assert.strictEqual(syncCalls.length, 1);
  assert.deepStrictEqual(
    syncCalls[0].previewData.excluded,
    ['book-a-last'],
    '当前点击的最后一个词必须包含在同一次云同步中，不能让云端排除列表慢一拍'
  );
  process.stdout.write('preview-state-sync-order: PASS\n');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
