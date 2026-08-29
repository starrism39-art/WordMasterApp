'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const model = require('../cloudfunctions/teacherWordbook/model.js');
const {
  getWordbookMasterySummary,
  reconcileStudentLearningProgress
} = require('../utils/learning-progress.js');
const { buildReviewWordLookup, resolveReviewWordObject } = require('../utils/review-word-resolver.js');

const clone = (value) => JSON.parse(JSON.stringify(value));
const makeWords = (wordbookId, count, label = 'word') => Array.from({ length: count }, (_, index) => ({
  id: `${wordbookId}_w_${String(index + 1).padStart(4, '0')}`,
  wordbookId,
  word: `${label}${index + 1}`,
  phonetic: index === 0 ? '' : `/p${index + 1}/`,
  meaning: `释义${index + 1}`,
  order: index + 1
}));

const createFunctionHarness = () => {
  let callerOpenid = 'teacher-a';
  const teachers = [{ teacher_id: 'teacher-a' }, { teacher_id: 'teacher-b' }];
  const wordsA = makeWords('twb_shared', 10, 'a');
  const wordsB = makeWords('twb_shared', 2, 'b');
  const fileA = 'cloud://test.bucket/teacher-wordbooks/teacher-a/twb_shared/versions/v1/words.json';
  const fileB = 'cloud://test.bucket/teacher-wordbooks/teacher-b/twb_shared/versions/v1/words.json';
  const books = [
    {
      _id: 'book-a', teacher_id: 'teacher-a', source_type: 'teacher_custom',
      wordbook_id: 'twb_shared', name: 'A词书', category: 'senior', description: '',
      status: 'active', version: 1, total_words: 10,
      current_version_id: 'twb_shared_v1', current_file_id: fileA
    },
    {
      _id: 'book-b', teacher_id: 'teacher-b', source_type: 'teacher_custom',
      wordbook_id: 'twb_shared', name: 'B词书', category: 'junior', description: '',
      status: 'active', version: 1, total_words: 2,
      current_version_id: 'twb_shared_v1', current_file_id: fileB
    }
  ];
  const versions = [
    {
      _id: 'version-a', teacher_id: 'teacher-a', source_type: 'teacher_custom',
      wordbook_id: 'twb_shared', version: 1, version_id: 'twb_shared_v1',
      status: 'published', total_words: 10, words_file_id: fileA
    },
    {
      _id: 'version-b', teacher_id: 'teacher-b', source_type: 'teacher_custom',
      wordbook_id: 'twb_shared', version: 1, version_id: 'twb_shared_v1',
      status: 'published', total_words: 2, words_file_id: fileB
    }
  ];
  const storage = new Map([
    [fileA, Buffer.from(JSON.stringify(wordsA))],
    [fileB, Buffer.from(JSON.stringify(wordsB))]
  ]);
  const queries = [];
  const matches = (doc, criteria) => Object.keys(criteria).every((key) => doc[key] === criteria[key]);
  const collectionData = (name) => {
    if (name === 'teachers') return teachers;
    if (name === model.COLLECTIONS.TEACHER_WORDBOOKS) return books;
    if (name === model.COLLECTIONS.TEACHER_WORDBOOK_VERSIONS) return versions;
    throw new Error(`unexpected_collection:${name}`);
  };
  const cloudMock = {
    DYNAMIC_CURRENT_ENV: 'test-env',
    init: () => {},
    getWXContext: () => ({ OPENID: callerOpenid }),
    downloadFile: async ({ fileID }) => ({ fileContent: Buffer.from(storage.get(fileID)) }),
    uploadFile: async () => { throw new Error('read_action_must_not_upload'); },
    database: () => ({
      serverDate: () => new Date(),
      collection: (collectionName) => ({
        where: (criteria) => {
          queries.push({ collectionName, criteria: clone(criteria) });
          const run = async () => ({
            data: collectionData(collectionName).filter((doc) => matches(doc, criteria))
          });
          return { get: run, limit: () => ({ get: run }) };
        },
        add: async () => { throw new Error('read_action_must_not_add'); },
        doc: () => ({
          update: async () => { throw new Error('read_action_must_not_update'); },
          set: async () => { throw new Error('read_action_must_not_set'); }
        })
      })
    })
  };

  const modulePath = require.resolve('../cloudfunctions/teacherWordbook/index.js');
  const originalLoad = Module._load;
  delete require.cache[modulePath];
  Module._load = function load(request, parent, isMain) {
    if (request === 'wx-server-sdk') return cloudMock;
    return originalLoad.call(this, request, parent, isMain);
  };
  let functionModule;
  try {
    functionModule = require(modulePath);
  } finally {
    Module._load = originalLoad;
  }
  return {
    main: functionModule.main,
    setOpenid: (value) => { callerOpenid = value; },
    queries,
    wordsA,
    wordsB
  };
};

(async () => {
  assert.strictEqual(model.FEATURES.includes('teacher_wordbook_learning_read'), true);

  const harness = createFunctionHarness();
  const resultA = await harness.main({
    action: 'getPublished',
    wordbookId: 'twb_shared',
    version: 1,
    teacherId: 'teacher-b',
    teacher_id: 'teacher-b'
  });
  assert.strictEqual(resultA.success, true);
  assert.strictEqual(resultA.teacherId, 'teacher-a');
  assert.strictEqual(resultA.book.words.length, 10);
  assert.deepStrictEqual(resultA.book.words, harness.wordsA);
  assert.strictEqual(harness.queries.some((query) => (
    query.collectionName === model.COLLECTIONS.TEACHER_WORDBOOKS
    && query.criteria.teacher_id === 'teacher-a'
    && query.criteria.wordbook_id === 'twb_shared'
  )), true);

  harness.setOpenid('teacher-b');
  const resultB = await harness.main({ action: 'getPublished', wordbookId: 'twb_shared', version: 1 });
  assert.strictEqual(resultB.success, true);
  assert.strictEqual(resultB.teacherId, 'teacher-b');
  assert.deepStrictEqual(resultB.book.words, harness.wordsB);

  harness.setOpenid('');
  assert.strictEqual((await harness.main({ action: 'getPublished', wordbookId: 'twb_shared' })).error, 'UNAUTHORIZED');
  harness.setOpenid('not-a-teacher');
  assert.strictEqual((await harness.main({ action: 'getPublished', wordbookId: 'twb_shared' })).error, 'TEACHER_NOT_FOUND');
  harness.setOpenid('teacher-a');
  assert.strictEqual((await harness.main({ action: 'getPublished', wordbookId: 'twb_shared', version: 2 })).reason, 'VERSION_NOT_ACTIVE');

  const storage = {};
  global.wx = {
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => { storage[key] = value; }
  };
  storage.openid = 'teacher-a';
  const loaderPath = require.resolve('../utils/teacher-custom-wordbook-loader.js');
  delete require.cache[loaderPath];
  const loader = require(loaderPath);
  let calls = 0;
  const callFunction = async (request) => {
    calls += 1;
    assert.deepStrictEqual(request, { action: 'getPublished', wordbookId: 'twb_shared', version: 1 });
    return { result: resultA };
  };
  const descriptor = {
    id: 'twb_shared', wordbookId: 'twb_shared', title: 'A词书',
    sourceType: 'teacher_custom', status: 'active', version: 1, totalWords: 10
  };
  const loaded = await loader.loadTeacherCustomWordbook(descriptor, { callFunction });
  assert.strictEqual(loaded.words.length, 10);
  assert.strictEqual(loaded.words[0].id, harness.wordsA[0].id);
  assert.strictEqual(loaded.words[0].phonetic, '');
  assert.strictEqual(calls, 1);
  const cacheKeyA = loader.buildCacheKey('teacher-a', 'twb_shared', 1);
  assert.ok(storage[cacheKeyA]);
  await loader.loadTeacherCustomWordbook(descriptor, { callFunction });
  assert.strictEqual(calls, 1, '同教师、同词书、同版本应命中隔离缓存');
  assert.notStrictEqual(
    loader.buildCacheKey('teacher-a', 'twb_shared', 1),
    loader.buildCacheKey('teacher-a', 'twb_shared', 2)
  );
  assert.notStrictEqual(
    loader.buildCacheKey('teacher-a', 'twb_shared', 1),
    loader.buildCacheKey('teacher-b', 'twb_shared', 1)
  );
  await assert.rejects(
    loader.loadTeacherCustomWordbook({ id: 'twb_shared', sourceType: 'official', version: 1 }),
    /TEACHER_WORDBOOK_SOURCE_REQUIRED/
  );

  const lookup = buildReviewWordLookup(harness.wordsA, 'twb_shared', {
    sourceType: 'teacher_custom'
  });
  const resolved = resolveReviewWordObject(harness.wordsA[3].id, lookup);
  assert.strictEqual(resolved.id, harness.wordsA[3].id);
  assert.strictEqual(resolved.word, 'a4');
  assert.strictEqual(resolved.meaning, '释义4');

  const mastery = {};
  harness.wordsA.forEach((word, index) => {
    mastery[word.id] = index < 6
      ? { mastered: true, difficult: false }
      : { mastered: false, difficult: true, antiForgettingSeed: true };
  });
  const summary = getWordbookMasterySummary('twb_shared', mastery);
  assert.deepStrictEqual(summary, {
    entryCount: 10,
    learnedCount: 10,
    masteredCount: 6,
    unmasteredCount: 4
  });
  const record = {
    studentId: 'student-1',
    wordbookId: 'twb_shared',
    wordbookTitle: 'A词书',
    wordbookTotalWords: 10,
    learnedWordIds: harness.wordsA.map((word) => word.id),
    studyWordsDetailed: harness.wordsA.map((word) => ({
      id: word.id,
      sourceWordId: word.id,
      word: word.word,
      meaning: word.meaning,
      phonetic: word.phonetic
    }))
  };
  const progress = reconcileStudentLearningProgress({
    studentId: 'student-1',
    progressData: { wordbooks: { twb_shared: { totalCount: 10 } } },
    studentMastery: { twb_shared: mastery },
    learningRecords: [record],
    bookTotals: { twb_shared: 10 }
  });
  assert.strictEqual(progress.wordbooks.twb_shared.completedCount, 10);
  assert.strictEqual(progress.wordbooks.twb_shared.totalCount, 10);

  storage.wordMastery = { 'student-1': { twb_shared: mastery } };
  storage.learningRecords = [{ ...record, studyDate: '2026-08-25T12:00:00.000Z' }];
  delete require.cache[require.resolve('../utils/stats-engine.js')];
  const stats = require('../utils/stats-engine.js').calculateWordbookStats('student-1', 'twb_shared');
  assert.deepStrictEqual(stats, { masteredCount: 10, notMasteredCount: 4, checkinDays: 1 });

  const learningSource = fs.readFileSync(path.resolve(__dirname, '../pages/learning/learning.js'), 'utf8');
  assert.ok(learningSource.includes('const identifiedWords = isTeacherCustom ? allWords : assignStableWordIds'));
  assert.ok(learningSource.includes('wordbookTitle: this.data.currentWordbook.title'));
  assert.ok(learningSource.includes('studyWordsDetailed: learnedWordsDetailed'));
  assert.ok(learningSource.includes('wordbookTotalWords: Number(this.data.currentWordbook.totalWords || 0)'));

  const syncSource = fs.readFileSync(path.resolve(__dirname, '../utils/cloud-sync.js'), 'utf8');
  assert.ok(syncSource.includes('wordbook_id: String(wordbookId)'));
  assert.ok(syncSource.includes('word_id: String(wordId)'));

  console.log('teacher wordbook stage5 learning integration tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
