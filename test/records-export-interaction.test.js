'use strict';

const assert = require('assert');

const learningRecord = {
  id: 'record-learning-1',
  originalRecordId: 'record-learning-1',
  hasStableRecordId: true,
  recordKind: 'learning',
  completedAt: '2026-08-30T10:00:00+08:00',
  studentSnapshot: { id: 'student-1', name: '学生一' },
  wordbookSnapshot: { id: 'book-1', title: '词书一', sourceType: 'official', version: null },
  wordsSnapshot: [
    { wordId: 'w1', word: 'apple', meaning: '苹果', phonetic: '/ˈæpəl/', masteryStatus: 'mastered' },
    { wordId: 'w2', word: 'example', meaning: '例子', phonetic: '', masteryStatus: 'notMastered' }
  ],
  totalWords: 2,
  timestamp: Date.parse('2026-08-30T10:00:00+08:00')
};

const antiRecord = {
  ...learningRecord,
  id: 'record-anti-1',
  originalRecordId: 'record-anti-1',
  recordKind: 'anti_forgetting_review',
  recordType: 'anti_forgetting_review',
  isAntiForgettingReview: true,
  wordsSnapshot: learningRecord.wordsSnapshot.map(({ masteryStatus, ...word }) => word)
};

const wordbookUtilsPath = require.resolve('../data/wordbook-utils.js');
const wordbookUtils = require(wordbookUtilsPath);
const originalWordbookUtils = {
  mergeWordbooks: wordbookUtils.mergeWordbooks,
  createWordMap: wordbookUtils.createWordMap
};
wordbookUtils.mergeWordbooks = () => [];
wordbookUtils.createWordMap = () => ({});

let exportCalls = [];
let exportBehavior = async (options) => ({ options });
const servicePath = require.resolve('../subpages/records/export/export-service.js');
const service = require(servicePath);
const originalGenerate = service.generateAndOpenRecordExport;
service.generateAndOpenRecordExport = (options) => {
  exportCalls.push(options);
  return exportBehavior(options);
};

const toasts = [];
let showLoadingCount = 0;
let hideLoadingCount = 0;
let modalOptions = null;
global.getApp = () => ({ globalData: {} });
global.wx = {
  getStorageSync() { return []; },
  showToast(options) { toasts.push(options); },
  showLoading() { showLoadingCount += 1; },
  hideLoading() { hideLoadingCount += 1; },
  showModal(options) { modalOptions = options; }
};

let definition = null;
global.Page = (value) => { definition = value; };
const recordsPath = require.resolve('../subpages/records/records.js');
delete require.cache[recordsPath];
require(recordsPath);
assert(definition, 'records page definition must be captured');

const createPage = (records) => {
  const page = {
    ...definition,
    data: {
      ...definition.data,
      currentStudent: { id: 'student-1', name: '学生一' },
      studyRecords: records,
      filteredRecords: records,
      displayedRecords: records
    },
    _cache: { processedRecords: records, filteredRecords: null, lastUpdateTime: 0 }
  };
  page.setData = function setData(patch) {
    this.data = { ...this.data, ...patch };
  };
  return page;
};

const exportEvent = (id) => ({ currentTarget: { dataset: { id } } });
const dataEvent = (key, value) => ({ currentTarget: { dataset: { [key]: value } } });

(async () => {
  const learningPage = createPage([learningRecord]);
  learningPage.onExportTap(exportEvent(learningRecord.id));
  assert.strictEqual(learningPage.data.exportDialogVisible, true);
  assert.strictEqual(learningPage.data.exportDialogStep, 'scope');
  assert.strictEqual(learningPage.data.selectedExportRecordId, learningRecord.id);

  learningPage.onChooseExportScope(dataEvent('scope', 'mastered'));
  assert.strictEqual(learningPage.data.selectedExportScope, 'mastered');
  assert.strictEqual(learningPage.data.exportDialogStep, 'format');

  let selected = null;
  learningPage.executeRecordExport = (options) => { selected = options; };
  learningPage.onChooseExportFormat(dataEvent('format', 'pdf'));
  assert.deepStrictEqual(selected, { recordId: learningRecord.id, scope: 'mastered', format: 'pdf' });
  assert.strictEqual(learningPage.data.exportDialogVisible, false);

  const antiPage = createPage([antiRecord]);
  antiPage.onExportTap(exportEvent(antiRecord.id));
  assert.strictEqual(antiPage.data.exportDialogStep, 'format');
  assert.strictEqual(antiPage.data.selectedExportScope, 'all');

  const merged = {
    id: 'merged-card-1',
    isMerged: true,
    recordType: 'learning',
    originalRecords: [
      {
        ...learningRecord,
        completedAt: '2026-08-30T20:01:00+08:00'
      },
      {
        ...learningRecord,
        id: 'record-learning-2',
        originalRecordId: 'record-learning-2',
        completedAt: '2026-08-30T20:55:00+08:00',
        wordsSnapshot: [
          { wordId: 'w3', word: 'banana', meaning: '香蕉', phonetic: '/bəˈnɑːnə/', masteryStatus: 'notMastered' }
        ],
        totalWords: 1
      },
      {
        ...learningRecord,
        id: 'record-learning-3',
        originalRecordId: 'record-learning-3',
        completedAt: '2026-08-30T21:49:00+08:00',
        wordsSnapshot: [
          { ...learningRecord.wordsSnapshot[0], masteryStatus: 'mastered' }
        ],
        totalWords: 1
      }
    ]
  };
  const mergedPage = createPage([merged]);
  mergedPage.onExportTap(exportEvent(merged.id));
  assert.strictEqual(mergedPage.data.exportDialogStep, 'record');
  assert.strictEqual(mergedPage.data.exportMergedChoice.label, '全部导出 · 3次 · 共3词');
  assert.deepStrictEqual(
    mergedPage.data.exportRecordChoices.map((item) => item.recordId),
    ['record-learning-1', 'record-learning-2', 'record-learning-3']
  );
  mergedPage.onChooseOriginalRecord(dataEvent('recordId', 'record-learning-2'));
  assert.strictEqual(mergedPage.data.selectedExportRecordId, 'record-learning-2');
  assert.strictEqual(mergedPage.data.exportDialogStep, 'scope');

  const mergedAllPage = createPage([merged]);
  mergedAllPage.onExportTap(exportEvent(merged.id));
  mergedAllPage.onChooseMergedRecords();
  assert.deepStrictEqual(
    mergedAllPage.data.selectedExportRecordIds,
    ['record-learning-1', 'record-learning-2', 'record-learning-3']
  );
  assert.strictEqual(mergedAllPage.data.exportDialogStep, 'scope');
  let mergedSelected = null;
  mergedAllPage.executeRecordExport = (options) => { mergedSelected = options; };
  mergedAllPage.onChooseExportScope(dataEvent('scope', 'mastered'));
  mergedAllPage.onChooseExportFormat(dataEvent('format', 'xlsx'));
  assert.deepStrictEqual(mergedSelected, {
    recordIds: ['record-learning-1', 'record-learning-2', 'record-learning-3'],
    scope: 'mastered',
    format: 'xlsx'
  });

  const antiMerged = {
    ...merged,
    id: 'merged-anti-card',
    recordType: 'anti_forgetting_review',
    isAntiForgettingReview: true,
    originalRecords: merged.originalRecords.map((record, index) => ({
      ...record,
      id: `record-anti-${index + 1}`,
      originalRecordId: `record-anti-${index + 1}`,
      recordKind: 'anti_forgetting_review',
      recordType: 'anti_forgetting_review',
      isAntiForgettingReview: true,
      wordsSnapshot: record.wordsSnapshot.map(({ masteryStatus, ...word }) => word)
    }))
  };
  const antiMergedPage = createPage([antiMerged]);
  antiMergedPage.onExportTap(exportEvent(antiMerged.id));
  antiMergedPage.onChooseMergedRecords();
  assert.strictEqual(antiMergedPage.data.exportDialogStep, 'format');
  assert.strictEqual(antiMergedPage.data.selectedExportScope, 'all');
  let antiMergedSelected = null;
  antiMergedPage.executeRecordExport = (options) => { antiMergedSelected = options; };
  antiMergedPage.onChooseExportFormat(dataEvent('format', 'pdf'));
  assert.deepStrictEqual(antiMergedSelected, {
    recordIds: ['record-anti-1', 'record-anti-2', 'record-anti-3'],
    scope: 'all',
    format: 'pdf'
  });

  const singleOriginalPage = createPage([{
    id: 'single-wrapper',
    isMerged: true,
    recordType: 'learning',
    originalRecords: [learningRecord]
  }]);
  singleOriginalPage.onExportTap(exportEvent('single-wrapper'));
  assert.strictEqual(singleOriginalPage.data.exportMergedChoice, null);
  assert.strictEqual(singleOriginalPage.data.exportDialogStep, 'scope');
  assert.strictEqual(singleOriginalPage.data.selectedExportRecordId, learningRecord.id);

  const unstablePage = createPage([{ ...learningRecord, id: 'display-only', originalRecordId: '', hasStableRecordId: false }]);
  unstablePage.onExportTap(exportEvent('display-only'));
  assert(toasts.some((toast) => String(toast.title).includes('稳定 recordId')));

  exportCalls = [];
  toasts.length = 0;
  showLoadingCount = 0;
  hideLoadingCount = 0;
  let resolvePending;
  exportBehavior = () => new Promise((resolve) => { resolvePending = resolve; });
  const duplicatePage = createPage([learningRecord]);
  const first = definition.executeRecordExport.call(duplicatePage, {
    recordId: learningRecord.id,
    scope: 'all',
    format: 'pdf'
  });
  const second = definition.executeRecordExport.call(duplicatePage, {
    recordId: learningRecord.id,
    scope: 'all',
    format: 'pdf'
  });
  assert.strictEqual(await second, null);
  assert.strictEqual(exportCalls.length, 1, '重复点击只能触发一次生成');
  resolvePending({ filePath: 'mock.pdf' });
  await first;
  assert.strictEqual(duplicatePage.data.isExporting, false);
  assert.strictEqual(showLoadingCount, 1);
  assert.strictEqual(hideLoadingCount, 1);

  exportBehavior = async () => { throw { errMsg: 'openDocument:fail mock' }; };
  const failurePage = createPage([learningRecord]);
  await definition.executeRecordExport.call(failurePage, {
    recordId: learningRecord.id,
    scope: 'all',
    format: 'xlsx'
  });
  assert(toasts.some((toast) => toast.title === '文件打开失败，请重试'));
  assert.strictEqual(failurePage.data.isExporting, false);

  let partialAttempt = 0;
  exportBehavior = async (options) => {
    partialAttempt += 1;
    if (!options.allowPartial) {
      const error = new Error('PARTIAL_EXPORT_CONFIRMATION_REQUIRED');
      error.code = 'PARTIAL_EXPORT_CONFIRMATION_REQUIRED';
      error.userMessage = '该记录属于历史兼容记录，部分历史字段不可保证';
      throw error;
    }
    return { filePath: 'partial.xlsx' };
  };
  modalOptions = null;
  const partialPage = createPage([learningRecord]);
  await definition.executeRecordExport.call(partialPage, {
    recordId: learningRecord.id,
    scope: 'all',
    format: 'xlsx'
  });
  assert(modalOptions && String(modalOptions.content).includes('部分历史字段不可保证'));
  modalOptions.success({ confirm: true });
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(partialAttempt, 2);

  const wxml = require('fs').readFileSync(require('path').join(__dirname, '../subpages/records/records.wxml'), 'utf8');
  assert.match(wxml, /catchtap="onExportTap"/);
  assert.match(wxml, /data-scope="all"/);
  assert.match(wxml, /data-scope="mastered"/);
  assert.match(wxml, /data-scope="notMastered"/);
  assert.match(wxml, /抗遗忘复习记录/);
  assert.match(wxml, /catchtap="onChooseMergedRecords"/);
  assert.match(wxml, /exportMergedChoice\.label/);

  process.stdout.write('records-export-interaction: PASS\n');
})().finally(() => {
  wordbookUtils.mergeWordbooks = originalWordbookUtils.mergeWordbooks;
  wordbookUtils.createWordMap = originalWordbookUtils.createWordMap;
  service.generateAndOpenRecordExport = originalGenerate;
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
