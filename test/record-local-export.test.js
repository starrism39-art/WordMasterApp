'use strict';

const assert = require('assert');
const {
  EXPORT_FORMATS,
  EXPORT_SCOPES,
  buildOriginalRecordChoices,
  buildRecordExportFilename,
  filterWordsForExport,
  sanitizeFilenamePart
} = require('../utils/local-record-export.js');
const {
  RECORD_KINDS,
  WORDBOOK_SOURCE_TYPES
} = require('../utils/record-export-contract.js');
const {
  generateAndOpenRecordExport,
  prepareRecordExport
} = require('../subpages/records/export/export-service.js');

const learningRecord = {
  id: 'learning-original-1',
  recordSchemaVersion: 1,
  recordKind: RECORD_KINDS.LEARNING,
  completedAt: '2026-12-31T18:30:00Z',
  studentSnapshot: { id: 'student-1', name: '张/老师' },
  wordbookSnapshot: {
    id: 'book-1',
    title: '词书:一*册?',
    sourceType: WORDBOOK_SOURCE_TYPES.OFFICIAL,
    version: null
  },
  wordsSnapshot: [
    { wordId: 'w1', word: 'apple', meaning: '苹果', phonetic: 'ˈæpəl', masteryStatus: 'mastered' },
    { wordId: 'w2', word: 'example', meaning: '例子', phonetic: '', masteryStatus: 'notMastered' },
    { wordId: 'w3', word: 'third', meaning: '第三', phonetic: 'θɜːd', masteryStatus: 'mastered' }
  ]
};

const antiRecord = {
  ...learningRecord,
  id: 'anti-original-1',
  recordKind: RECORD_KINDS.ANTI_FORGETTING_REVIEW,
  wordsSnapshot: learningRecord.wordsSnapshot.map(({ masteryStatus, ...word }) => word)
};

const deepClone = (value) => JSON.parse(JSON.stringify(value));

(async () => {
  assert.strictEqual(filterWordsForExport(learningRecord, EXPORT_SCOPES.ALL).length, 3);
  assert.deepStrictEqual(
    filterWordsForExport(learningRecord, EXPORT_SCOPES.MASTERED).map((word) => word.wordId),
    ['w1', 'w3']
  );
  assert.deepStrictEqual(
    filterWordsForExport(learningRecord, EXPORT_SCOPES.NOT_MASTERED).map((word) => word.wordId),
    ['w2']
  );
  assert.throws(
    () => filterWordsForExport(antiRecord, EXPORT_SCOPES.MASTERED),
    (error) => error.code === 'ANTI_FORGETTING_SCOPE_MUST_BE_ALL'
  );

  const merged = {
    id: 'merged-card-only',
    isMerged: true,
    originalRecords: [learningRecord, { ...learningRecord, id: 'learning-original-2', completedAt: '2027-01-01T10:20:00+08:00' }]
  };
  const choices = buildOriginalRecordChoices(merged);
  assert.deepStrictEqual(choices.map((item) => item.recordId), ['learning-original-1', 'learning-original-2']);
  assert(choices.every((item) => item.label.includes('词')));
  assert.strictEqual(buildOriginalRecordChoices({ ...learningRecord, hasStableRecordId: false })[0].stable, false);

  const filename = buildRecordExportFilename({
    studentName: learningRecord.studentSnapshot.name,
    wordbookTitle: learningRecord.wordbookSnapshot.title,
    recordKind: RECORD_KINDS.LEARNING,
    scope: EXPORT_SCOPES.MASTERED,
    completedAt: learningRecord.completedAt,
    extension: 'pdf'
  });
  assert.strictEqual(filename, '张_老师_词书_一_册_学习记录_已掌握_2027-01-01.pdf');
  assert(!/[\\/:*?"<>|]/.test(filename));
  assert(buildRecordExportFilename({
    studentName: '很长的学生姓名'.repeat(20),
    wordbookTitle: '很长的词书名称'.repeat(20),
    recordKind: RECORD_KINDS.LEARNING,
    completedAt: learningRecord.completedAt,
    extension: 'xlsx'
  }).length <= 116);
  assert.strictEqual(sanitizeFilenamePart('a/b:c*?"<>|'), 'a_b_c');

  const allPrepared = await prepareRecordExport({
    recordId: learningRecord.id,
    records: [merged],
    scope: EXPORT_SCOPES.ALL,
    format: EXPORT_FORMATS.PDF
  });
  assert.strictEqual(allPrepared.wordsSnapshot.length, 3);
  assert.strictEqual(allPrepared.resolution.recordId, learningRecord.id);
  assert.strictEqual(allPrepared.filename.endsWith('.pdf'), true);

  const versionedRecord = {
    id: 'versioned-1',
    recordKind: RECORD_KINDS.LEARNING,
    completedAt: '2026-02-01T10:00:00+08:00',
    studentId: 'student-1',
    studentName: '版本学生',
    wordbookId: 'teacher-book-1',
    wordbookTitle: '教师词书',
    sourceType: WORDBOOK_SOURCE_TYPES.TEACHER_CUSTOM,
    wordbookVersion: 3,
    learnedWordIds: ['history-w1'],
    masteredWordIds: ['history-w1']
  };
  const versioned = await prepareRecordExport({
    recordId: versionedRecord.id,
    records: [versionedRecord],
    format: EXPORT_FORMATS.PDF,
    loadHistoricalWordbook: async () => ({
      wordbookId: 'teacher-book-1',
      sourceType: WORDBOOK_SOURCE_TYPES.TEACHER_CUSTOM,
      version: 3,
      words: [{ id: 'history-w1', word: 'historic', meaning: '历史释义', phonetic: '/hɪˈstɒrɪk/' }]
    })
  });
  assert.strictEqual(versioned.resolution.historicalVersionAccessed, true);
  assert.strictEqual(versioned.wordsSnapshot[0].meaning, '历史释义');
  assert.strictEqual(versioned.resolution.snapshot.wordbookSnapshot.version, 3);

  const emptyScope = {
    ...learningRecord,
    id: 'empty-scope',
    wordsSnapshot: learningRecord.wordsSnapshot.map((word) => ({ ...word, masteryStatus: 'mastered' }))
  };
  await assert.rejects(
    prepareRecordExport({
      recordId: emptyScope.id,
      records: [emptyScope],
      scope: EXPORT_SCOPES.NOT_MASTERED,
      format: EXPORT_FORMATS.PDF
    }),
    (error) => error.code === 'EMPTY_EXPORT_SCOPE' && error.userMessage === '该范围没有可导出的单词'
  );

  const partialRecord = {
    id: 'partial-1',
    studentId: 'student-1',
    studentName: '旧姓名字段',
    wordbookId: 'book-legacy',
    wordbookTitle: '旧词书字段',
    studyDate: '2025-03-01T10:00:00+08:00',
    learnedWordIds: ['legacy-w1']
  };
  await assert.rejects(
    prepareRecordExport({ recordId: partialRecord.id, records: [partialRecord], format: 'xlsx' }),
    (error) => error.code === 'PARTIAL_EXPORT_CONFIRMATION_REQUIRED'
  );
  const partial = await prepareRecordExport({
    recordId: partialRecord.id,
    records: [partialRecord],
    format: 'xlsx',
    allowPartial: true
  });
  assert.strictEqual(partial.isPartial, true);
  assert.strictEqual(partial.wordsSnapshot[0].meaning, '');
  assert.strictEqual(partial.wordsSnapshot[0].phonetic, '');

  const blockedRecord = { id: 'blocked-1', totalWords: 10, completedAt: '2026-01-01T00:00:00+08:00' };
  await assert.rejects(
    prepareRecordExport({ recordId: blockedRecord.id, records: [blockedRecord], format: 'pdf' }),
    (error) => error.code === 'RECORD_EXPORT_BLOCKED'
      && error.userMessage === '该历史记录缺少完整词条数据，无法完整导出'
  );

  const before = deepClone(learningRecord);
  const calls = { write: [], open: [], pdf: [], xlsx: [] };
  const platform = {
    env: { USER_DATA_PATH: '/tmp-user-data' },
    getFileSystemManager() {
      return { writeFileSync: (filePath, bytes) => calls.write.push({ filePath, bytes }) };
    },
    openDocument(options) {
      calls.open.push(options);
      options.success();
    }
  };
  const pdfResult = await generateAndOpenRecordExport({
    recordId: learningRecord.id,
    records: [learningRecord],
    scope: EXPORT_SCOPES.ALL,
    format: EXPORT_FORMATS.PDF
  }, {
    platform,
    fonts: { chineseFontBytes: new Uint8Array([1]), ipaFontBytes: new Uint8Array([2]) },
    generatePdf: (options) => {
      calls.pdf.push(options);
      return { bytes: new Uint8Array([1, 2, 3]), pageCount: 2 };
    }
  });
  assert.strictEqual(pdfResult.pageCount, 2);
  assert.strictEqual(calls.pdf[0].wordsSnapshot[1].phonetic, '');
  assert.strictEqual(calls.open[0].showMenu, true);
  assert.strictEqual(calls.open[0].fileType, 'pdf');
  assert.deepStrictEqual(learningRecord, before, '导出不得修改历史记录');

  await generateAndOpenRecordExport({
    recordId: antiRecord.id,
    records: [antiRecord],
    scope: EXPORT_SCOPES.ALL,
    format: EXPORT_FORMATS.XLSX
  }, {
    platform,
    generateXlsx: (options) => {
      calls.xlsx.push(options);
      return { bytes: new Uint8Array([4, 5]), rowCount: options.wordsSnapshot.length };
    }
  });
  assert.strictEqual(calls.xlsx[0].wordsSnapshot.length, 3);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(calls.xlsx[0], 'completedAt'), false, 'XLSX 不应接收五轮表数据');

  const failingPlatform = {
    ...platform,
    openDocument(options) { options.fail({ errMsg: 'openDocument:fail mock' }); }
  };
  await assert.rejects(
    generateAndOpenRecordExport({
      recordId: learningRecord.id,
      records: [learningRecord],
      format: EXPORT_FORMATS.XLSX
    }, {
      platform: failingPlatform,
      generateXlsx: () => ({ bytes: new Uint8Array([8]), rowCount: 3 })
    }),
    (error) => String(error.errMsg).includes('openDocument:fail')
  );

  process.stdout.write('record-local-export: PASS\n');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
