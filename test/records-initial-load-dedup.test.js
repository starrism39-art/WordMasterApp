'use strict';

const assert = require('assert');

function createFakeTimers() {
  let nextId = 1;
  const timers = new Map();
  return {
    setTimeout(callback, delay) {
      const id = nextId;
      nextId += 1;
      timers.set(id, { callback, delay: Number(delay) || 0 });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    runAll() {
      while (timers.size > 0) {
        const entries = Array.from(timers.entries())
          .sort((left, right) => left[1].delay - right[1].delay || left[0] - right[0]);
        timers.delete(entries[0][0]);
        entries[0][1].callback();
      }
    },
    reset() {
      timers.clear();
    }
  };
}

const student = { id: 'student-records-5d', name: 'Records 5D' };
const wordbook = { id: 'records-book', name: 'Records Book', title: 'Records Book' };
const populatedRecords = [
  {
    id: 'record-5d-1',
    studentId: student.id,
    wordbookId: wordbook.id,
    wordbookTitle: wordbook.title,
    recordType: 'learning',
    totalWords: 2,
    duration: 60,
    timestamp: Date.parse('2026-08-13T10:00:00+08:00'),
    studyDate: '2026-08-13T10:00:00+08:00',
    recordSchemaVersion: 1,
    recordKind: 'learning',
    completedAt: '2026-08-13T10:00:00+08:00',
    studentSnapshot: { id: student.id, name: student.name },
    wordbookSnapshot: { id: wordbook.id, title: wordbook.title, sourceType: 'official', version: null },
    wordsSnapshot: [
      { wordId: 'records_word_1', word: 'apple', meaning: '苹果', phonetic: '/ˈæpəl/', masteryStatus: 'mastered' },
      { wordId: 'records_word_2', word: 'example', meaning: '例子', phonetic: '', masteryStatus: 'notMastered' }
    ],
    learnedWordIds: ['records_word_1', 'records_word_2'],
    masteredWordIds: ['records_word_1'],
    notMasteredWordIds: ['records_word_2'],
    masteredCount: 1,
    notMasteredCount: 1
  }
];

const storage = {};
const app = {
  globalData: {},
  emitted: [],
  getLearningRecords(studentId) {
    return (storage.learningRecords || []).filter(
      (record) => String(record.studentId || '') === String(studentId)
    );
  },
  emit(eventName, payload) {
    this.emitted.push({ eventName, payload });
  }
};

let modalSuccess = null;
let stopPullDownRefreshCalls = 0;
let tombstoneDeleteRequests = [];
global.getApp = () => app;
global.wx = {
  cloud: {
    callFunction: async ({ name, data }) => {
      assert.strictEqual(name, 'syncTombstoneAuthority');
      assert.strictEqual(data.action, 'deleteEntity');
      tombstoneDeleteRequests.push({ ...data });
      return {
        result: {
          success: true,
          tombstoneCreated: true,
          removed: 1,
          cleanupPending: false
        }
      };
    }
  },
  getStorageSync(key) {
    return storage[key];
  },
  setStorageSync(key, value) {
    storage[key] = value;
  },
  removeStorageSync(key) {
    delete storage[key];
  },
  showToast() {},
  showLoading() {},
  hideLoading() {},
  showModal(options) {
    modalSuccess = options.success;
  },
  stopPullDownRefresh() {
    stopPullDownRefreshCalls += 1;
  }
};

const fakeTimers = createFakeTimers();
const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;
global.setTimeout = fakeTimers.setTimeout;
global.clearTimeout = fakeTimers.clearTimeout;

const wordbookUtilsPath = require.resolve('../data/wordbook-utils.js');
const statsEnginePath = require.resolve('../utils/stats-engine.js');
const recordsPath = require.resolve('../subpages/records/records.js');
const wordbookUtils = require(wordbookUtilsPath);
const statsEngine = require(statsEnginePath);
const originals = {
  mergeWordbooks: wordbookUtils.mergeWordbooks,
  createWordMap: wordbookUtils.createWordMap,
  refreshStudentStats: statsEngine.refreshStudentStats,
  consoleLog: console.log
};

let reloadWordMapCalls = 0;
let refreshStudentStatsCalls = 0;
wordbookUtils.mergeWordbooks = () => {
  reloadWordMapCalls += 1;
  return [];
};
wordbookUtils.createWordMap = () => ({});
statsEngine.refreshStudentStats = () => {
  refreshStudentStatsCalls += 1;
  return Promise.resolve({});
};
console.log = () => {};

let recordsDefinition = null;
global.Page = (definition) => {
  recordsDefinition = definition;
};
delete require.cache[recordsPath];
require(recordsPath);
assert.ok(recordsDefinition, 'records page definition must be captured');

function resetRuntime(records) {
  Object.keys(storage).forEach((key) => delete storage[key]);
  app.emitted = [];
  app.globalData = {
    currentUser: { id: 'teacher-records-5d' },
    currentStudent: student,
    currentWordbook: wordbook,
    selectedWordbook: wordbook,
    currentWordbookStudentId: student.id
  };
  storage.openid = 'teacher-records-5d';
  storage.currentUser = app.globalData.currentUser;
  storage.students = [student];
  storage.currentStudent = student;
  storage.selectedStudent = student;
  storage.currentWordbook = wordbook;
  storage.selectedWordbook = wordbook;
  storage.currentWordbookStudentId = student.id;
  storage.studentSettings = {
    [`student_${student.id}_wordbook`]: wordbook
  };
  storage.wordbooks = [wordbook];
  storage.learningRecords = (records || []).map((record) => ({ ...record }));
  modalSuccess = null;
  stopPullDownRefreshCalls = 0;
  refreshStudentStatsCalls = 0;
  reloadWordMapCalls = 0;
  tombstoneDeleteRequests = [];
  fakeTimers.reset();
}

function createPage() {
  const counters = {
    loadData: 0,
    forceRefreshValues: [],
    preprocess: 0,
    filterRecords: 0,
    setDataPatches: []
  };
  const page = {
    ...recordsDefinition,
    data: {
      ...recordsDefinition.data,
      studyRecords: [],
      filteredRecords: [],
      displayedRecords: [],
      wordbooks: {},
      wordbookOptions: [],
      movedX: {}
    },
    _cache: {
      processedRecords: null,
      filteredRecords: null,
      lastUpdateTime: 0
    }
  };

  page.setData = function setData(patch, callback) {
    counters.setDataPatches.push(Object.keys(patch));
    this.data = { ...this.data, ...patch };
    if (typeof callback === 'function') callback();
  };

  const originalLoadData = page.loadData;
  page.loadData = function loadDataSpy(forceRefresh) {
    counters.loadData += 1;
    counters.forceRefreshValues.push(forceRefresh === true);
    return originalLoadData.call(this, forceRefresh);
  };

  const originalMergeRecordsByDay = page.mergeRecordsByDay;
  page.mergeRecordsByDay = function mergeRecordsByDaySpy(records) {
    counters.preprocess += 1;
    return originalMergeRecordsByDay.call(this, records);
  };

  const originalFilterRecords = page.filterRecords;
  page.filterRecords = function filterRecordsSpy() {
    counters.filterRecords += 1;
    return originalFilterRecords.call(this);
  };

  return { page, counters };
}

function getSetDataCounts(patches) {
  const loadingOnly = patches.filter(
    (keys) => keys.length === 1 && keys[0] === 'isLoading'
  ).length;
  const recordBatch = patches.filter((keys) => keys.includes('studyRecords')).length;
  const filteredBatch = patches.filter(
    (keys) => keys.includes('filteredRecords') && keys.includes('displayedRecords') && !keys.includes('studyRecords')
  ).length;
  return {
    total: patches.length,
    core: Math.max(0, loadingOnly - 1) + recordBatch + filteredBatch,
    loadingOnly,
    recordBatch,
    filteredBatch
  };
}

function enterPage(records) {
  resetRuntime(records);
  const instance = createPage();
  instance.page.onLoad();
  instance.page.onShow();
  fakeTimers.runAll();
  return instance;
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

(async () => {
  try {
    // 1-4/6. First lifecycle: one word-map reload and one complete populated-data load.
    const initial = enterPage(populatedRecords);
    const initialCounts = {
      loadData: initial.counters.loadData,
      reloadWordMap: reloadWordMapCalls,
      preprocess: initial.counters.preprocess,
      filterRecords: initial.counters.filterRecords,
      setData: getSetDataCounts(initial.counters.setDataPatches)
    };
    originals.consoleLog('records-initial-load-dedup initial counts:', JSON.stringify(initialCounts));
    assert.strictEqual(initialCounts.loadData, 1, 'initial onLoad + onShow must schedule one complete load');
    assert.strictEqual(initialCounts.reloadWordMap, 1, 'initial lifecycle must rebuild the word map once');
    assert.strictEqual(initialCounts.preprocess, 1, 'initial records preprocessing must run once');
    assert.strictEqual(initialCounts.filterRecords, 1, 'initial filterRecords must run once');
    assert.strictEqual(initialCounts.setData.core, 4, 'one complete load must contribute four core setData calls');
    assert.strictEqual(initial.page.data.isLoading, false);
    assert.strictEqual(initial.page.data.studyRecords.length, 1);
    assert.strictEqual(initial.page.data.displayedRecords.length, 1);
    assert.strictEqual(initial.page.data.studyRecords[0].recordSchemaVersion, 1);
    assert.strictEqual(initial.page.data.studyRecords[0].completedAt, populatedRecords[0].completedAt);
    assert.deepStrictEqual(initial.page.data.studyRecords[0].studentSnapshot, populatedRecords[0].studentSnapshot);
    assert.deepStrictEqual(initial.page.data.studyRecords[0].wordbookSnapshot, populatedRecords[0].wordbookSnapshot);
    assert.deepStrictEqual(initial.page.data.studyRecords[0].wordsSnapshot, populatedRecords[0].wordsSnapshot);

    // 2. A genuine later show keeps one necessary refresh.
    if (typeof initial.page.onHide === 'function') initial.page.onHide();
    initial.page.onShow();
    fakeTimers.runAll();
    assert.strictEqual(initial.counters.loadData, 2);
    assert.strictEqual(reloadWordMapCalls, 2);
    assert.strictEqual(initial.counters.preprocess, 2);
    assert.strictEqual(initial.counters.filterRecords, 2);
    initial.page.onUnload();

    // 5. An empty record set settles to the existing empty state in one load.
    const empty = enterPage([]);
    assert.strictEqual(empty.counters.loadData, 1);
    assert.strictEqual(empty.counters.preprocess, 1);
    assert.strictEqual(empty.counters.filterRecords, 1);
    assert.deepStrictEqual(empty.page.data.studyRecords, []);
    assert.deepStrictEqual(empty.page.data.displayedRecords, []);
    assert.strictEqual(empty.page.data.isLoading, false);
    empty.page.onUnload();

    // 7. Delete keeps the immediate local list/cache/filter update path.
    resetRuntime(populatedRecords);
    const deletion = createPage();
    deletion.page._isRecordsPageActive = true;
    deletion.page.data.currentStudent = student;
    deletion.page.data.studyRecords = populatedRecords.map((record) => ({ ...record }));
    deletion.page.data.filteredRecords = populatedRecords.map((record) => ({ ...record }));
    deletion.page.data.displayedRecords = populatedRecords.map((record) => ({ ...record }));
    deletion.page.data.totalRecords = 1;
    deletion.page._cache.processedRecords = populatedRecords.map((record) => ({ ...record }));
    deletion.page._cache.filteredRecords = populatedRecords.map((record) => ({ ...record }));
    deletion.page.deleteRecord({ currentTarget: { dataset: { id: 'record-5d-1' } } });
    assert.strictEqual(typeof modalSuccess, 'function');
    await modalSuccess({ confirm: true });
    await flushPromises();
    assert.deepStrictEqual(storage.learningRecords, []);
    assert.deepStrictEqual(deletion.page.data.studyRecords, []);
    assert.deepStrictEqual(deletion.page.data.displayedRecords, []);
    assert.strictEqual(deletion.page.data.totalRecords, 0);
    assert.strictEqual(deletion.counters.filterRecords, 1);
    assert.strictEqual(refreshStudentStatsCalls, 1);
    assert.strictEqual(app.emitted.filter(({ eventName }) => eventName === 'learningRecordDeleted').length, 1);

    // 8. A same-day merged card must tombstone its original stable record IDs,
    // never the synthetic merged_* display ID.
    const secondRecord = {
      ...populatedRecords[0],
      id: 'record-5d-2',
      timestamp: Date.parse('2026-08-13T11:00:00+08:00'),
      studyDate: '2026-08-13T11:00:00+08:00',
      completedAt: '2026-08-13T11:00:00+08:00',
      wordsSnapshot: [
        { wordId: 'records_word_3', word: 'student', meaning: '学生', phonetic: '/\u02c8stju\u02d0.d\u0259nt/', masteryStatus: 'notMastered' }
      ],
      learnedWordIds: ['records_word_3'],
      masteredWordIds: [],
      notMasteredWordIds: ['records_word_3'],
      totalWords: 1,
      masteredCount: 0,
      notMasteredCount: 1
    };
    resetRuntime([...populatedRecords, secondRecord]);
    const mergedDeletion = createPage();
    mergedDeletion.page._isRecordsPageActive = true;
    mergedDeletion.page.data.currentStudent = student;
    mergedDeletion.page.data.studyRecords = [...populatedRecords, secondRecord].map((record) => ({ ...record }));
    const mergedCards = mergedDeletion.page.mergeRecordsByDay(mergedDeletion.page.data.studyRecords);
    assert.strictEqual(mergedCards.length, 1);
    assert.strictEqual(mergedCards[0].isMerged, true);
    mergedDeletion.page.data.filteredRecords = mergedCards;
    mergedDeletion.page.data.displayedRecords = mergedCards;
    mergedDeletion.page.data.totalRecords = 2;
    mergedDeletion.page._cache.processedRecords = mergedCards;
    mergedDeletion.page._cache.filteredRecords = mergedCards;
    mergedDeletion.page.deleteRecord({ currentTarget: { dataset: { id: mergedCards[0].id } } });
    assert.strictEqual(typeof modalSuccess, 'function');
    await modalSuccess({ confirm: true });
    await flushPromises();
    assert.deepStrictEqual(
      tombstoneDeleteRequests.map((request) => request.entityId).sort(),
      ['record-5d-1', 'record-5d-2'],
      'merged card deletion must target original record IDs'
    );
    assert.strictEqual(
      tombstoneDeleteRequests.some((request) => String(request.entityId).startsWith('merged_')),
      false,
      'synthetic merged ID must never reach tombstone authority'
    );
    assert.deepStrictEqual(storage.learningRecords, []);
    assert.deepStrictEqual(mergedDeletion.page.data.studyRecords, []);
    assert.deepStrictEqual(mergedDeletion.page.data.displayedRecords, []);
    assert.strictEqual(mergedDeletion.page.data.totalRecords, 0);
    assert.strictEqual(refreshStudentStatsCalls, 1);
    assert.strictEqual(app.emitted.filter(({ eventName }) => eventName === 'learningRecordDeleted').length, 2);

    // 9. Manual pull refresh still schedules and completes one fresh load.
    const manual = enterPage(populatedRecords);
    const manualLoadsBefore = manual.counters.loadData;
    manual.page.onPullDownRefresh();
    fakeTimers.runAll();
    assert.strictEqual(manual.counters.loadData, manualLoadsBefore + 1);
    assert.strictEqual(manual.counters.preprocess, 2);
    assert.strictEqual(manual.counters.filterRecords, 2);
    assert.strictEqual(stopPullDownRefreshCalls, 1);
    manual.page.onUnload();

    // 10. Unload before timer flush prevents old-page preprocessing and setData.
    resetRuntime(populatedRecords);
    const fastLeave = createPage();
    fastLeave.page.onLoad();
    fastLeave.page.onShow();
    assert.strictEqual(fastLeave.counters.loadData, 1);
    assert.strictEqual(fastLeave.counters.preprocess, 0);
    fastLeave.page.onUnload();
    const setDataAfterUnload = fastLeave.counters.setDataPatches.length;
    fakeTimers.runAll();
    assert.strictEqual(fastLeave.counters.preprocess, 0);
    assert.strictEqual(fastLeave.counters.filterRecords, 0);
    assert.strictEqual(fastLeave.counters.setDataPatches.length, setDataAfterUnload);

    originals.consoleLog('records-initial-load-dedup final counts:', JSON.stringify({
      initial: initialCounts,
      laterShowTotalLoads: initial.counters.loadData,
      emptyLoads: empty.counters.loadData,
      deleteFilterCalls: deletion.counters.filterRecords,
      manualTotalLoads: manual.counters.loadData,
      fastUnloadPreprocess: fastLeave.counters.preprocess,
      fastUnloadSetDataDelta: fastLeave.counters.setDataPatches.length - setDataAfterUnload
    }));
    originals.consoleLog('records-initial-load-dedup: PASS');
  } finally {
    wordbookUtils.mergeWordbooks = originals.mergeWordbooks;
    wordbookUtils.createWordMap = originals.createWordMap;
    statsEngine.refreshStudentStats = originals.refreshStudentStats;
    console.log = originals.consoleLog;
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
    delete require.cache[recordsPath];
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
