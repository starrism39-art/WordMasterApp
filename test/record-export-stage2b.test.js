'use strict';

const assert = require('assert');
const {
  COMPATIBILITY_LEVELS,
  DISPLAY_VALUE_SOURCES,
  EXPORT_RESOLUTION_STATES,
  RECORD_KINDS,
  buildRecordSnapshotFields,
  resolveRecordExportSnapshot
} = require('../utils/record-export-contract.js');
const {
  REVIEW_INTERVAL_DAYS,
  buildFiveRoundDates
} = require('../utils/anti-forgetting-filter.js');

const completedAt = '2026-08-30T08:00:00+08:00';
const teacherWordId = 'twb_stage2b_w_0000000000000001';
const teacherV1Word = {
  id: teacherWordId,
  wordbookId: 'twb_stage2b',
  word: 'history',
  meaning: '历史（v1）',
  phonetic: '/v1/',
  order: 1,
  masteryStatus: 'mastered'
};
const teacherV2Word = {
  ...teacherV1Word,
  meaning: '当前新版释义（v2）',
  phonetic: '/v2/'
};

(async () => {
  const learningSnapshot = buildRecordSnapshotFields({
    recordKind: RECORD_KINDS.LEARNING,
    completedAt,
    student: { id: 'student456', name: '测试学生' },
    wordbook: {
      id: 'twb_stage2b',
      title: 'Stage2B教师词书',
      sourceType: 'teacher_custom',
      version: 1
    },
    words: [teacherV1Word]
  });
  const learningRecord = { id: 'stage2b-learning-a', ...learningSnapshot };
  assert.strictEqual(learningSnapshot.wordbookSnapshot.version, 1);
  assert.strictEqual(learningSnapshot.wordsSnapshot[0].masteryStatus, 'mastered');
  assert.strictEqual(learningSnapshot.wordsSnapshot[0].phonetic, '/v1/');

  const reviewSnapshot = buildRecordSnapshotFields({
    recordKind: RECORD_KINDS.ANTI_FORGETTING_REVIEW,
    completedAt,
    student: { id: 'student456', name: '测试学生' },
    wordbook: {
      id: 'twb_stage2b',
      title: 'Stage2B教师词书',
      sourceType: 'teacher_custom',
      version: 1
    },
    words: [{ ...teacherV1Word, masteryStatus: 'mastered' }]
  });
  assert.strictEqual(reviewSnapshot.wordsSnapshot[0].masteryStatus, null);
  assert.strictEqual(reviewSnapshot.wordsSnapshot[0].meaning, '历史（v1）');

  // 模拟词书升级到 v2；已写入记录必须保持 v1 的独立值副本。
  teacherV1Word.meaning = teacherV2Word.meaning;
  teacherV1Word.phonetic = teacherV2Word.phonetic;
  assert.strictEqual(learningRecord.wordsSnapshot[0].meaning, '历史（v1）');
  assert.strictEqual(learningRecord.wordsSnapshot[0].phonetic, '/v1/');
  assert.strictEqual(learningRecord.wordbookSnapshot.version, 1);

  let historicalLoaderCalls = 0;
  let resolved = await resolveRecordExportSnapshot(learningRecord, {
    loadHistoricalWordbook: async () => {
      historicalLoaderCalls += 1;
      throw new Error('A_LEVEL_MUST_NOT_LOAD_CURRENT_OR_HISTORY');
    }
  });
  assert.strictEqual(resolved.compatibility.level, COMPATIBILITY_LEVELS.A);
  assert.strictEqual(resolved.state, EXPORT_RESOLUTION_STATES.COMPLETE);
  assert.strictEqual(historicalLoaderCalls, 0);
  assert.strictEqual(resolved.snapshot.wordsSnapshot[0].meaning, '历史（v1）');

  const bRecord = {
    id: 'stage2b-versioned-b',
    recordKind: RECORD_KINDS.LEARNING,
    completedAt,
    studentId: 'student456',
    studentName: '旧记录学生名',
    wordbookSnapshot: {
      id: 'twb_stage2b',
      title: 'Stage2B教师词书',
      sourceType: 'teacher_custom',
      version: 1
    },
    learnedWordIds: [teacherWordId],
    masteredWordIds: [teacherWordId]
  };
  resolved = await resolveRecordExportSnapshot(bRecord, {
    loadHistoricalWordbook: async (descriptor) => {
      historicalLoaderCalls += 1;
      assert.deepStrictEqual(
        { id: descriptor.id, sourceType: descriptor.sourceType, version: descriptor.version },
        { id: 'twb_stage2b', sourceType: 'teacher_custom', version: 1 }
      );
      return {
        id: 'twb_stage2b',
        wordbookId: 'twb_stage2b',
        sourceType: 'teacher_custom',
        version: 1,
        words: [{
          id: teacherWordId,
          word: 'history',
          meaning: '历史（v1）',
          phonetic: '',
          order: 1
        }]
      };
    }
  });
  assert.strictEqual(resolved.compatibility.level, COMPATIBILITY_LEVELS.B);
  assert.strictEqual(resolved.state, EXPORT_RESOLUTION_STATES.COMPLETE);
  assert.strictEqual(resolved.historicalVersionAccessed, true);
  assert.strictEqual(resolved.snapshot.wordbookSnapshot.version, 1);
  assert.strictEqual(resolved.snapshot.wordsSnapshot[0].meaning, '历史（v1）');
  assert.strictEqual(resolved.snapshot.wordsSnapshot[0].phonetic, '');
  assert.strictEqual(resolved.snapshot.wordsSnapshot[0].masteryStatus, 'mastered');

  const officialSnapshot = buildRecordSnapshotFields({
    recordKind: RECORD_KINDS.LEARNING,
    completedAt,
    student: { id: 'student456', name: '测试学生' },
    wordbook: {
      id: 'senior_textbook_real',
      title: '高中统编版',
      sourceType: 'official',
      version: 99
    },
    words: [{
      id: 'senior_textbook_real_word',
      word: 'word',
      meaning: '单词',
      phonetic: '',
      masteryStatus: 'notMastered'
    }]
  });
  assert.strictEqual(officialSnapshot.wordbookSnapshot.version, null);

  let forbiddenCurrentLookupCalls = 0;
  const cRecord = {
    id: 'stage2b-c',
    recordType: 'anti_forgetting_review',
    studyDate: completedAt,
    studentId: 'student456',
    wordbookId: 'senior_textbook_real',
    wordbookTitle: '旧记录词书名',
    learnedWordIds: ['senior_textbook_real_word']
  };
  resolved = await resolveRecordExportSnapshot(cRecord, {
    loadHistoricalWordbook: async () => {
      forbiddenCurrentLookupCalls += 1;
      return { ...teacherV2Word };
    }
  });
  assert.strictEqual(resolved.compatibility.level, COMPATIBILITY_LEVELS.C);
  assert.strictEqual(resolved.state, EXPORT_RESOLUTION_STATES.PARTIAL);
  assert.strictEqual(forbiddenCurrentLookupCalls, 0);
  assert.strictEqual(resolved.snapshot.wordsSnapshot[0].meaning, '');
  assert.strictEqual(resolved.snapshot.wordsSnapshot[0].phonetic, '');

  const dRecord = {
    id: 'stage2b-d',
    studentId: 'student456',
    wordbookId: 'senior_textbook_real',
    totalWords: 9
  };
  resolved = await resolveRecordExportSnapshot(dRecord);
  assert.strictEqual(resolved.compatibility.level, COMPATIBILITY_LEVELS.D);
  assert.strictEqual(resolved.state, EXPORT_RESOLUTION_STATES.BLOCKED);
  assert.strictEqual(resolved.canGenerateCompleteExport, false);
  assert.strictEqual(resolved.userMessage, '该历史记录缺少完整词条数据');

  const fallbackRecord = {
    id: 'stage2b-fallback-a',
    studentId: 'student456',
    studentName: '原记录学生名',
    wordbookId: 'senior_textbook_real',
    wordbookTitle: '原记录词书名',
    sourceType: 'official',
    studyDate: completedAt,
    studyWordsDetailed: [{
      id: 'senior_textbook_real_word',
      word: 'word',
      meaning: '单词',
      phonetic: '',
      masteryStatus: 'mastered'
    }]
  };
  resolved = await resolveRecordExportSnapshot(fallbackRecord);
  assert.strictEqual(resolved.display.studentName.value, '原记录学生名');
  assert.strictEqual(resolved.display.studentName.source, DISPLAY_VALUE_SOURCES.RECORD_FIELD);
  assert.strictEqual(resolved.display.wordbookTitle.value, '原记录词书名');
  assert.strictEqual(resolved.display.wordbookTitle.source, DISPLAY_VALUE_SOURCES.RECORD_FIELD);

  const currentNameFallbackRecord = {
    ...fallbackRecord,
    id: 'stage2b-current-name-fallback-a',
    studentName: ''
  };
  resolved = await resolveRecordExportSnapshot(currentNameFallbackRecord, {
    currentStudent: { id: 'student456', name: '当前展示姓名' }
  });
  assert.strictEqual(resolved.display.studentName.value, '当前展示姓名');
  assert.strictEqual(
    resolved.display.studentName.source,
    DISPLAY_VALUE_SOURCES.CURRENT_STUDENT_DISPLAY
  );
  assert.strictEqual(resolved.display.studentName.isHistoricalSnapshot, false);

  assert.deepStrictEqual(REVIEW_INTERVAL_DAYS, [1, 2, 4, 7, 15]);
  assert.deepStrictEqual(
    buildFiveRoundDates(completedAt).map((item) => item.offsetDays),
    REVIEW_INTERVAL_DAYS
  );

  process.stdout.write('record-export-stage2b: PASS\n');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
