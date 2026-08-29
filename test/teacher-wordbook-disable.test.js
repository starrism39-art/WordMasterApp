'use strict';

const assert = require('assert');
const Module = require('module');
const model = require('../cloudfunctions/teacherWordbook/model.js');

const clone = (value) => JSON.parse(JSON.stringify(value));
const matches = (document, criteria) => Object.keys(criteria || {}).every(
  (key) => document && document[key] === criteria[key]
);

const createHarness = ({
  openid = '',
  teachers = [],
  books = [],
  versions = [],
  learningRecords = [],
  learningProgress = [],
  wordMastery = [],
  storageEntries = []
} = {}) => {
  let callerOpenid = openid;
  const teacherDocuments = clone(teachers);
  const bookDocuments = clone(books).map((book, index) => ({
    _id: book._id || `book-doc-${index + 1}`,
    ...book
  }));
  const versionDocuments = clone(versions);
  const records = clone(learningRecords);
  const progress = clone(learningProgress);
  const mastery = clone(wordMastery);
  const storage = clone(storageEntries);
  const writes = [];

  const collectionDocuments = (name) => {
    if (name === 'teachers') return teacherDocuments;
    if (name === model.COLLECTIONS.TEACHER_WORDBOOKS) return bookDocuments;
    if (name === model.COLLECTIONS.TEACHER_WORDBOOK_VERSIONS) return versionDocuments;
    if (name === 'learning_records') return records;
    if (name === 'learning_progress') return progress;
    if (name === 'word_mastery') return mastery;
    return [];
  };

  const database = {
    serverDate: () => 'SERVER_DATE',
    collection: (collectionName) => ({
      where: (criteria) => {
        const run = async () => ({
          data: collectionDocuments(collectionName).filter((document) => matches(document, criteria))
        });
        return {
          get: run,
          limit: (limit) => ({
            get: async () => {
              const result = await run();
              return { data: result.data.slice(0, limit) };
            }
          })
        };
      },
      doc: (documentId) => ({
        update: async ({ data }) => {
          const document = collectionDocuments(collectionName)
            .find((item) => item._id === documentId);
          if (!document) throw new Error(`document_missing:${documentId}`);
          Object.assign(document, clone(data));
          writes.push({ collectionName, documentId, data: clone(data) });
          return { updated: 1 };
        }
      })
    })
  };

  const cloudMock = {
    DYNAMIC_CURRENT_ENV: 'test-env',
    init: () => {},
    getWXContext: () => ({ OPENID: callerOpenid }),
    database: () => database
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
    state: () => ({
      books: clone(bookDocuments),
      versions: clone(versionDocuments),
      learningRecords: clone(records),
      learningProgress: clone(progress),
      wordMastery: clone(mastery),
      storage: clone(storage),
      writes: clone(writes)
    })
  };
};

const teacherA = 'teacher-a';
const teacherB = 'teacher-b';
const activeId = 'twb_disable_active';
const activeBook = {
  teacher_id: teacherA,
  source_type: 'teacher_custom',
  wordbook_id: activeId,
  name: '停用验收词书',
  status: 'active',
  version: 2,
  current_version_id: `${activeId}_v2`,
  current_file_id: `cloud://test/teacher-wordbooks/${teacherA}/${activeId}/versions/v2/words.json`,
  total_words: 4,
  upload_state: { status: 'published' }
};
const versions = [1, 2].map((version) => ({
  version_id: `${activeId}_v${version}`,
  teacher_id: teacherA,
  source_type: 'teacher_custom',
  wordbook_id: activeId,
  version,
  status: 'published',
  words_file_id: `cloud://test/teacher-wordbooks/${teacherA}/${activeId}/versions/v${version}/words.json`,
  total_words: version * 2
}));
const learningRecords = [{
  id: 'record-1',
  studentId: 'student-test',
  wordbookId: activeId,
  learnedWordIds: [`${activeId}_w_education`]
}];
const learningProgress = [{
  _id: 'student-test',
  wordbooks: {
    [activeId]: { completedCount: 1, learnedWords: 1, totalCount: 4 }
  }
}];
const wordMastery = [{
  student_id: 'student-test',
  wordbook_id: activeId,
  word_id: `${activeId}_w_education`,
  mastered: true
}];
const storageEntries = versions.map((version) => ({
  fileId: version.words_file_id,
  etag: `etag-v${version.version}`
}));

(async () => {
  const noIdentity = createHarness({ books: [activeBook] });
  const unauthorized = await noIdentity.main({
    action: 'disable',
    wordbookId: activeId,
    teacherId: teacherA
  });
  assert.strictEqual(unauthorized.error, model.ERROR_CODES.UNAUTHORIZED);

  const harness = createHarness({
    openid: teacherA,
    teachers: [{ teacher_id: teacherA }, { teacher_id: teacherB }],
    books: [
      activeBook,
      {
        teacher_id: teacherA,
        source_type: 'teacher_custom',
        wordbook_id: 'twb_disable_draft',
        status: 'draft',
        version: 0
      },
      {
        teacher_id: teacherA,
        source_type: 'official',
        wordbook_id: 'official-not-disableable',
        status: 'active',
        version: 1
      },
      {
        teacher_id: teacherB,
        source_type: 'teacher_custom',
        wordbook_id: 'twb_teacher_b',
        status: 'active',
        version: 1
      }
    ],
    versions,
    learningRecords,
    learningProgress,
    wordMastery,
    storageEntries
  });
  const before = harness.state();

  const disabled = await harness.main({
    action: 'disable',
    wordbookId: activeId,
    teacherId: teacherB,
    teacher_id: teacherB
  });
  assert.strictEqual(disabled.success, true);
  assert.strictEqual(disabled.idempotent, false);
  assert.strictEqual(disabled.book.status, 'disabled');
  assert.strictEqual(disabled.book.version, 2);
  assert.strictEqual(disabled.book.currentVersionId, `${activeId}_v2`);
  assert.strictEqual(disabled.book.totalWords, 4);

  const afterDisable = harness.state();
  const storedBook = afterDisable.books.find((book) => book.wordbook_id === activeId);
  assert.strictEqual(storedBook.status, 'disabled');
  assert.strictEqual(storedBook.version, activeBook.version);
  assert.strictEqual(storedBook.current_version_id, activeBook.current_version_id);
  assert.strictEqual(storedBook.current_file_id, activeBook.current_file_id);
  assert.strictEqual(storedBook.total_words, activeBook.total_words);
  assert.deepStrictEqual(afterDisable.writes, [{
    collectionName: model.COLLECTIONS.TEACHER_WORDBOOKS,
    documentId: storedBook._id,
    data: { status: 'disabled', updatedAt: 'SERVER_DATE' }
  }]);
  assert.deepStrictEqual(afterDisable.versions, before.versions);
  assert.deepStrictEqual(afterDisable.storage, before.storage);
  assert.deepStrictEqual(afterDisable.learningRecords, before.learningRecords);
  assert.deepStrictEqual(afterDisable.learningProgress, before.learningProgress);
  assert.deepStrictEqual(afterDisable.wordMastery, before.wordMastery);

  const repeated = await harness.main({ action: 'disable', wordbookId: activeId });
  assert.strictEqual(repeated.success, true);
  assert.strictEqual(repeated.idempotent, true);
  assert.strictEqual(harness.state().writes.length, 1);

  const activeList = await harness.main({ action: 'list' });
  assert.strictEqual(activeList.books.some((book) => book.wordbookId === activeId), false);
  const manageList = await harness.main({ action: 'list', scope: 'manage' });
  assert.strictEqual(
    manageList.books.find((book) => book.wordbookId === activeId).status,
    'disabled'
  );

  harness.setOpenid(teacherB);
  const crossOwner = await harness.main({ action: 'disable', wordbookId: activeId });
  assert.strictEqual(crossOwner.success, false);
  assert.strictEqual(crossOwner.reason, 'WORDBOOK_NOT_FOUND');
  assert.strictEqual(harness.state().writes.length, 1);

  harness.setOpenid(teacherA);
  const official = await harness.main({
    action: 'disable',
    wordbookId: 'official-not-disableable'
  });
  assert.strictEqual(official.success, false);
  assert.strictEqual(official.reason, 'TEACHER_CUSTOM_REQUIRED');
  const draft = await harness.main({ action: 'disable', wordbookId: 'twb_disable_draft' });
  assert.strictEqual(draft.success, false);
  assert.strictEqual(draft.reason, 'ACTIVE_WORDBOOK_REQUIRED');

  console.log('teacher-wordbook-disable: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
