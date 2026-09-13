'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  COMPATIBILITY_LEVELS,
  EXPORT_RESOLUTION_STATES,
  RECORD_KINDS,
  WORDBOOK_SOURCE_TYPES,
  resolveRecordExportSnapshot
} = require('../utils/record-export-contract.js');
const {
  resolveLegacyRecordWords
} = require('../utils/review-word-resolver.js');
const {
  EXPORT_FORMATS,
  EXPORT_SCOPES
} = require('../utils/local-record-export.js');
const {
  HISTORICAL_COMPATIBILITY_MESSAGE,
  UNRECOVERABLE_CONTENT_MESSAGE,
  generateAndOpenRecordExport,
  prepareMergedRecordExport,
  prepareRecordExport
} = require('../subpages/records/export/export-service.js');

const currentWords = [
  {
    id: 'senior_textbook_real_behave',
    word: 'behave',
    meaning: '表现',
    phonetic: '/bɪˈheɪv/'
  },
  {
    id: 'senior_textbook_real_candle',
    word: 'candle',
    meaning: '蜡烛',
    phonetic: ''
  },
  {
    id: 'senior_textbook_real_dangerous',
    word: 'dangerous',
    meaning: '危险的',
    phonetic: '/ˈdeɪndʒərəs/'
  }
];
const wordMap = Object.fromEntries(currentWords.map((word) => [word.word.toLowerCase(), word]));
const lookupOptions = {
  words: currentWords,
  wordMap,
  findWord: (word) => wordMap[String(word || '').toLowerCase()] || null,
  lookUpPhrase: (word) => word
};
const recoverCompatibleWords = (record) => resolveLegacyRecordWords(record, lookupOptions);

const oldReviewRecord = {
  id: 'legacy-review-10',
  recordType: RECORD_KINDS.ANTI_FORGETTING_REVIEW,
  isAntiForgettingReview: true,
  studentId: 'student-legacy',
  studentName: '旧学生',
  wordbookId: 'senior_textbook',
  wordbookTitle: '高中统编版英语词书（抗遗忘复习）',
  completedAt: '2026-08-20T11:10:40.189Z',
  learnedWordIds: currentWords.map((word) => word.id),
  totalWords: currentWords.length
};

const deepClone = (value) => JSON.parse(JSON.stringify(value));

(async () => {
  const before = deepClone(oldReviewRecord);
  const detailRecovery = resolveLegacyRecordWords(oldReviewRecord, lookupOptions);
  assert.strictEqual(detailRecovery.source, 'historical_compatibility_recovery');
  assert.strictEqual(detailRecovery.recoveredCount, 3);
  assert.strictEqual(detailRecovery.failedCount, 0);
  assert.deepStrictEqual(
    detailRecovery.words.map((word) => word.word),
    ['behave', 'candle', 'dangerous']
  );
  assert.strictEqual(detailRecovery.words[0].meaning, '表现');
  assert.strictEqual(detailRecovery.words[0].phonetic, '/bɪˈheɪv/');
  assert.strictEqual(detailRecovery.words[1].phonetic, '', '空音标必须合法');

  let resolved = await resolveRecordExportSnapshot(oldReviewRecord, { recoverCompatibleWords });
  assert.strictEqual(resolved.compatibility.level, COMPATIBILITY_LEVELS.C);
  assert.strictEqual(resolved.state, EXPORT_RESOLUTION_STATES.PARTIAL);
  assert.strictEqual(resolved.compatibilityRecovery.recoveredCount, 3);
  assert.deepStrictEqual(
    resolved.snapshot.wordsSnapshot.map((word) => word.word),
    detailRecovery.words.map((word) => word.word),
    '查看明细与导出必须消费同一 resolver 的词条集合'
  );

  await assert.rejects(
    prepareRecordExport({
      recordId: oldReviewRecord.id,
      records: [oldReviewRecord],
      format: EXPORT_FORMATS.PDF,
      recoverCompatibleWords
    }),
    (error) => error.code === 'PARTIAL_EXPORT_CONFIRMATION_REQUIRED'
      && error.userMessage === HISTORICAL_COMPATIBILITY_MESSAGE
  );
  const preparedReview = await prepareRecordExport({
    recordId: oldReviewRecord.id,
    records: [oldReviewRecord],
    scope: EXPORT_SCOPES.ALL,
    format: EXPORT_FORMATS.XLSX,
    allowPartial: true,
    recoverCompatibleWords
  });
  assert.deepStrictEqual(
    preparedReview.wordsSnapshot.map((word) => word.word),
    ['behave', 'candle', 'dangerous']
  );
  assert.strictEqual(preparedReview.wordsSnapshot[1].meaning, '蜡烛');

  const generatedCalls = { pdf: [], xlsx: [], open: [], write: [] };
  const platform = {
    env: { USER_DATA_PATH: '/compatibility-export-test' },
    getFileSystemManager() {
      return {
        writeFileSync(filePath, bytes) {
          generatedCalls.write.push({ filePath, bytes });
        }
      };
    },
    openDocument(options) {
      generatedCalls.open.push(options);
      options.success();
    }
  };
  await generateAndOpenRecordExport({
    recordId: oldReviewRecord.id,
    records: [oldReviewRecord],
    format: EXPORT_FORMATS.PDF,
    allowPartial: true,
    recoverCompatibleWords
  }, {
    platform,
    fonts: { chineseFontBytes: new Uint8Array([1]), ipaFontBytes: new Uint8Array([2]) },
    generatePdf: (options) => {
      generatedCalls.pdf.push(options);
      return { bytes: new Uint8Array([1, 2, 3]), pageCount: 1 };
    }
  });
  await generateAndOpenRecordExport({
    recordId: oldReviewRecord.id,
    records: [oldReviewRecord],
    format: EXPORT_FORMATS.XLSX,
    allowPartial: true,
    recoverCompatibleWords
  }, {
    platform,
    generateXlsx: (options) => {
      generatedCalls.xlsx.push(options);
      return { bytes: new Uint8Array([4, 5, 6]), rowCount: options.wordsSnapshot.length };
    }
  });
  assert.strictEqual(generatedCalls.pdf[0].wordsSnapshot.length, 3);
  assert.strictEqual(generatedCalls.xlsx[0].wordsSnapshot.length, 3);
  assert(generatedCalls.pdf[0].wordsSnapshot.every((word) => String(word.word).trim()));
  assert(generatedCalls.xlsx[0].wordsSnapshot.every((word) => String(word.word).trim()));
  assert.deepStrictEqual(generatedCalls.open.map((item) => item.fileType), ['pdf', 'xlsx']);
  assert(generatedCalls.open.every((item) => item.showMenu === true));

  const unrecoverableRecord = {
    ...oldReviewRecord,
    id: 'legacy-unrecoverable',
    learnedWordIds: ['opaque-id-without-reliable-word'],
    totalWords: 1
  };
  await assert.rejects(
    prepareRecordExport({
      recordId: unrecoverableRecord.id,
      records: [unrecoverableRecord],
      format: EXPORT_FORMATS.PDF,
      recoverCompatibleWords
    }),
    (error) => error.code === 'UNRECOVERABLE_EXPORT_CONTENT'
      && error.userMessage === UNRECOVERABLE_CONTENT_MESSAGE,
    '存在数组元素但所有 word 为空时必须在确认弹窗和生成器之前阻止'
  );

  const partialRecoveryRecord = {
    ...oldReviewRecord,
    id: 'legacy-partial-recovery',
    learnedWordIds: [currentWords[0].id, 'opaque-id-without-reliable-word'],
    totalWords: 2
  };
  await assert.rejects(
    prepareRecordExport({
      recordId: partialRecoveryRecord.id,
      records: [partialRecoveryRecord],
      format: EXPORT_FORMATS.PDF,
      recoverCompatibleWords
    }),
    (error) => error.code === 'PARTIAL_EXPORT_CONFIRMATION_REQUIRED'
      && String(error.userMessage).includes('已恢复1词，1词无法恢复且不会导出')
  );
  const partialPrepared = await prepareRecordExport({
    recordId: partialRecoveryRecord.id,
    records: [partialRecoveryRecord],
    format: EXPORT_FORMATS.PDF,
    allowPartial: true,
    recoverCompatibleWords
  });
  assert.deepStrictEqual(partialPrepared.wordsSnapshot.map((word) => word.word), ['behave']);
  assert.strictEqual(partialPrepared.resolution.compatibilityRecovery.failedCount, 1);

  let compatibilityCalls = 0;
  const completeLearningRecord = {
    id: 'new-learning',
    recordSchemaVersion: 1,
    recordKind: RECORD_KINDS.LEARNING,
    completedAt: '2026-08-30T10:00:00+08:00',
    studentSnapshot: { id: 'student-new', name: '新学生' },
    wordbookSnapshot: {
      id: 'official-book',
      title: '官方词书',
      sourceType: WORDBOOK_SOURCE_TYPES.OFFICIAL,
      version: null
    },
    wordsSnapshot: [{
      wordId: 'snapshot-apple',
      word: 'snapshot apple',
      meaning: '历史苹果',
      phonetic: '',
      masteryStatus: 'mastered'
    }]
  };
  resolved = await resolveRecordExportSnapshot(completeLearningRecord, {
    recoverCompatibleWords: () => {
      compatibilityCalls += 1;
      throw new Error('A 级不得访问当前词书');
    }
  });
  assert.strictEqual(resolved.state, EXPORT_RESOLUTION_STATES.COMPLETE);
  assert.strictEqual(resolved.snapshot.wordsSnapshot[0].meaning, '历史苹果');
  assert.strictEqual(compatibilityCalls, 0);

  const versionedRecord = {
    id: 'teacher-v1-record',
    recordKind: RECORD_KINDS.LEARNING,
    completedAt: '2026-08-30T10:00:00+08:00',
    studentId: 'student-teacher',
    studentName: '教师学生',
    wordbookId: 'teacher-book',
    wordbookTitle: '教师词书',
    sourceType: WORDBOOK_SOURCE_TYPES.TEACHER_CUSTOM,
    wordbookVersion: 1,
    learnedWordIds: ['teacher-word-1'],
    masteredWordIds: ['teacher-word-1']
  };
  resolved = await resolveRecordExportSnapshot(versionedRecord, {
    recoverCompatibleWords: () => {
      compatibilityCalls += 1;
      throw new Error('B 级不得访问当前词书');
    },
    loadHistoricalWordbook: async () => ({
      id: 'teacher-book',
      wordbookId: 'teacher-book',
      sourceType: WORDBOOK_SOURCE_TYPES.TEACHER_CUSTOM,
      version: 1,
      words: [{ id: 'teacher-word-1', word: 'version one', meaning: '版本一', phonetic: '' }]
    })
  });
  assert.strictEqual(resolved.state, EXPORT_RESOLUTION_STATES.COMPLETE);
  assert.strictEqual(resolved.snapshot.wordsSnapshot[0].meaning, '版本一');
  assert.strictEqual(resolved.historicalVersionAccessed, true);
  assert.strictEqual(compatibilityCalls, 0);

  const legacyLearningRecord = {
    ...oldReviewRecord,
    id: 'legacy-learning',
    recordKind: RECORD_KINDS.LEARNING,
    recordType: RECORD_KINDS.LEARNING,
    isAntiForgettingReview: false,
    learnedWordIds: [],
    masteredWordIds: [currentWords[0].id, currentWords[1].id],
    notMasteredWordIds: [currentWords[2].id]
  };
  const allLearning = await prepareRecordExport({
    recordId: legacyLearningRecord.id,
    records: [legacyLearningRecord],
    scope: EXPORT_SCOPES.ALL,
    format: EXPORT_FORMATS.PDF,
    allowPartial: true,
    recoverCompatibleWords
  });
  const masteredLearning = await prepareRecordExport({
    recordId: legacyLearningRecord.id,
    records: [legacyLearningRecord],
    scope: EXPORT_SCOPES.MASTERED,
    format: EXPORT_FORMATS.PDF,
    allowPartial: true,
    recoverCompatibleWords
  });
  const notMasteredLearning = await prepareRecordExport({
    recordId: legacyLearningRecord.id,
    records: [legacyLearningRecord],
    scope: EXPORT_SCOPES.NOT_MASTERED,
    format: EXPORT_FORMATS.PDF,
    allowPartial: true,
    recoverCompatibleWords
  });
  assert.strictEqual(allLearning.wordsSnapshot.length, 3);
  assert.deepStrictEqual(masteredLearning.wordsSnapshot.map((word) => word.word), ['behave', 'candle']);
  assert.deepStrictEqual(notMasteredLearning.wordsSnapshot.map((word) => word.word), ['dangerous']);

  const laterReviewRecord = {
    ...oldReviewRecord,
    id: 'legacy-review-later',
    completedAt: '2026-08-20T12:10:40.189Z',
    learnedWordIds: [currentWords[0].id, currentWords[1].id]
  };
  const merged = await prepareMergedRecordExport({
    recordIds: [oldReviewRecord.id, laterReviewRecord.id],
    records: [oldReviewRecord, laterReviewRecord],
    format: EXPORT_FORMATS.XLSX,
    allowPartial: true,
    recoverCompatibleWords
  });
  assert.deepStrictEqual(
    merged.wordsSnapshot.map((word) => word.word),
    ['behave', 'candle', 'dangerous'],
    '合并兼容记录必须继续按稳定 wordId 去重'
  );

  const recordsSource = fs.readFileSync(
    path.join(__dirname, '../subpages/records/records.js'),
    'utf8'
  );
  assert.match(recordsSource, /resolveLegacyRecordWords\(record,/);
  assert.match(recordsSource, /使用历史兼容共享 resolver/);
  assert.deepStrictEqual(oldReviewRecord, before, '兼容解析与导出不得修改旧记录');

  process.stdout.write('historical-record-export-recovery: PASS\n');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
