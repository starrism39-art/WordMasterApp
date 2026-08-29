'use strict';

const assert = require('assert');
const Module = require('module');
const model = require('../cloudfunctions/teacherWordbook/model');
const { matchWordIds } = require('../cloudfunctions/teacherWordbook/word-id-matcher');

const clone = (value) => JSON.parse(JSON.stringify(value));
const toFileId = (cloudPath) => `cloud://test-env.bucket/${cloudPath}`;

const matches = (document, criteria) => Object.keys(criteria || {}).every(
  (key) => document && document[key] === criteria[key]
);

const createHarness = ({
  openid = 'teacher-a',
  teachers = [],
  books = [],
  versions = [],
  storageEntries = [],
  failVersionUpload = false,
  failFinalBookUpdate = false,
  throwOnMissingDocumentGet = true,
  missingVersionDocumentError = ''
} = {}) => {
  let callerOpenid = openid;
  let failFinalBookUpdateNow = failFinalBookUpdate;
  const bookDocuments = clone(books).map((book, index) => ({
    _id: book._id || `book-doc-${index + 1}`,
    ...book
  }));
  const versionDocuments = clone(versions).map((version) => ({
    _id: version._id || version.version_id,
    ...version
  }));
  const teacherDocuments = clone(teachers);
  const storage = new Map(storageEntries.map(([fileId, content]) => [
    fileId,
    Buffer.isBuffer(content) ? Buffer.from(content) : Buffer.from(String(content))
  ]));
  const writes = [];
  let transactionTail = Promise.resolve();
  class CosObjectNotFoundError extends Error {}
  const cosAuthorizationMock = {
    buildCloudFileId: toFileId,
    createPresignedPut: ({ objectKey }) => ({
      issuedAt: 1000,
      expiresAt: 301000,
      transport: {
        method: 'PUT',
        url: `https://test-env.bucket.cos.ap-shanghai.myqcloud.com/${objectKey}?signed=1`,
        headers: { 'x-cos-forbid-overwrite': 'true' },
        expiresAt: 301000
      }
    }),
    headObject: async ({ objectKey }) => {
      const fileID = toFileId(objectKey);
      if (!storage.has(fileID)) throw new CosObjectNotFoundError();
      return { size: storage.get(fileID).length, etag: `etag-${storage.get(fileID).length}` };
    },
    CosObjectNotFoundError
  };

  const collectionDocuments = (name) => {
    if (name === 'teachers') return teacherDocuments;
    if (name === 'teacher_wordbooks') return bookDocuments;
    if (name === 'teacher_wordbook_versions') return versionDocuments;
    return [];
  };

  const createDatabaseApi = (inTransaction = false) => ({
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
      add: async ({ data }) => {
        const document = { _id: `book-doc-${bookDocuments.length + 1}`, ...clone(data) };
        collectionDocuments(collectionName).push(document);
        writes.push({ type: 'add', collectionName, data: clone(data), inTransaction });
        return { _id: document._id };
      },
      doc: (documentId) => ({
        get: async () => {
          const document = collectionDocuments(collectionName)
            .find((item) => item._id === documentId);
          if (!document
            && collectionName === 'teacher_wordbook_versions'
            && missingVersionDocumentError) {
            throw new Error(missingVersionDocumentError);
          }
          if (!document && throwOnMissingDocumentGet) {
            throw new Error(`document.get:fail document with _id ${documentId} does not exist`);
          }
          return { data: document || null };
        },
        update: async ({ data }) => {
          if (inTransaction
            && failFinalBookUpdateNow
            && collectionName === 'teacher_wordbooks'
            && data.current_version_id) {
            throw new Error('injected_final_book_update_failure');
          }
          const document = collectionDocuments(collectionName)
            .find((item) => item._id === documentId);
          if (!document) throw new Error(`document_missing:${documentId}`);
          Object.assign(document, clone(data));
          writes.push({
            type: 'update', collectionName, documentId, data: clone(data), inTransaction
          });
          return { updated: 1 };
        },
        set: async ({ data }) => {
          const target = collectionDocuments(collectionName);
          const existing = target.find((item) => item._id === documentId);
          if (existing) Object.assign(existing, clone(data));
          else target.push({ _id: documentId, ...clone(data) });
          writes.push({
            type: 'set', collectionName, documentId, data: clone(data), inTransaction
          });
          return { _id: documentId };
        }
      })
    })
  });

  const database = createDatabaseApi(false);
  database.runTransaction = (callback) => {
    const execute = async () => {
      const booksSnapshot = clone(bookDocuments);
      const versionsSnapshot = clone(versionDocuments);
      try {
        return await callback(createDatabaseApi(true));
      } catch (error) {
        bookDocuments.splice(0, bookDocuments.length, ...booksSnapshot);
        versionDocuments.splice(0, versionDocuments.length, ...versionsSnapshot);
        throw error;
      }
    };
    const result = transactionTail.then(execute, execute);
    transactionTail = result.catch(() => undefined);
    return result;
  };

  const cloudMock = {
    DYNAMIC_CURRENT_ENV: 'dynamic',
    init: () => {},
    getWXContext: () => ({ OPENID: callerOpenid }),
    database: () => database,
    uploadFile: async ({ cloudPath, fileContent }) => {
      if (failVersionUpload && /\/versions\/v2\/words\.json$/.test(cloudPath)) {
        throw new Error('injected_version_upload_failure');
      }
      const fileID = toFileId(cloudPath);
      storage.set(fileID, Buffer.from(fileContent));
      return { fileID };
    },
    downloadFile: async ({ fileID }) => {
      if (!storage.has(fileID)) throw new Error(`storage_missing:${fileID}`);
      return { fileContent: Buffer.from(storage.get(fileID)) };
    }
  };

  const modulePath = require.resolve('../cloudfunctions/teacherWordbook/index.js');
  const originalLoad = Module._load;
  delete require.cache[modulePath];
  Module._load = function load(request, parent, isMain) {
    if (request === 'wx-server-sdk') return cloudMock;
    if (request === './cos-upload-authorization') return cosAuthorizationMock;
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
    setFailFinalBookUpdate: (value) => { failFinalBookUpdateNow = Boolean(value); },
    putClientFile: (cloudPath, content) => {
      const fileID = toFileId(cloudPath);
      storage.set(fileID, Buffer.from(content));
      return fileID;
    },
    state: () => ({
      books: clone(bookDocuments),
      versions: clone(versionDocuments),
      storage,
      writes: clone(writes)
    })
  };
};

const teachers = [
  { teacher_id: 'teacher-a', name: 'Teacher A' },
  { teacher_id: 'teacher-b', name: 'Teacher B' }
];

const createV1Words = (wordbookId) => ([
  {
    id: `${wordbookId}_w_v1apple`,
    wordbookId,
    word: 'apple',
    phonetic: '/apple/',
    meaning: '苹果',
    order: 1
  },
  {
    id: `${wordbookId}_w_v1banana`,
    wordbookId,
    word: 'banana',
    phonetic: '',
    meaning: '香蕉',
    order: 2
  }
]);

const createActiveFixture = (teacherId, wordbookId) => {
  const v1Path = `teacher-wordbooks/${teacherId}/${wordbookId}/versions/v1/words.json`;
  const v1FileId = toFileId(v1Path);
  const words = createV1Words(wordbookId);
  return {
    book: {
      teacher_id: teacherId,
      source_type: 'teacher_custom',
      wordbook_id: wordbookId,
      name: `Active ${wordbookId}`,
      version: 1,
      current_version_id: `${wordbookId}_v1`,
      current_file_id: v1FileId,
      total_words: words.length,
      status: 'active',
      schema_version: 1,
      upload_state: { status: 'published' }
    },
    version: {
      version_id: `${wordbookId}_v1`,
      teacher_id: teacherId,
      source_type: 'teacher_custom',
      wordbook_id: wordbookId,
      version: 1,
      status: 'published',
      publish_token: 'initial-token',
      words_file_id: v1FileId,
      total_words: words.length,
      schema_version: 1
    },
    storageEntry: [v1FileId, Buffer.from(JSON.stringify(words))],
    v1FileId,
    words
  };
};

const createDraft = (teacherId, wordbookId) => ({
  teacher_id: teacherId,
  source_type: 'teacher_custom',
  wordbook_id: wordbookId,
  name: `Draft ${wordbookId}`,
  version: 0,
  current_version_id: '',
  current_file_id: '',
  total_words: 0,
  status: 'draft',
  schema_version: 1
});

const prepareVersionUpdate = async (harness, wordbookId, csvText, expectedBaseVersion = 1) => {
  const content = Buffer.from(csvText, 'utf8');
  const prepared = await harness.main({
    action: 'prepareUpload',
    wordbookId,
    fileName: 'update.csv',
    fileSize: content.length,
    teacherId: 'teacher-b',
    teacher_id: 'teacher-b',
    targetVersion: 99,
    previousVersion: 98,
    storagePath: 'wordbooks/forged.json'
  });
  assert.strictEqual(prepared.success, true);
  assert.strictEqual(prepared.upload.operationType, 'version_update');
  assert.strictEqual(prepared.upload.baseVersion, expectedBaseVersion);
  assert.strictEqual(prepared.upload.targetVersion, expectedBaseVersion + 1);
  assert.ok(/^twp_[0-9a-f]{32}$/.test(prepared.upload.publishToken));
  assert.strictEqual(Object.hasOwn(prepared.upload, 'cloudPath'), false);
  const cloudPath = `teacher-wordbooks/teacher-a/${wordbookId}`
    + `/staging/${prepared.upload.uploadId}/source.csv`;
  const fileId = harness.putClientFile(cloudPath, content);
  const parsed = await harness.main({
    action: 'parseUpload',
    wordbookId,
    uploadId: prepared.upload.uploadId,
    fileId,
    teacherId: 'teacher-b'
  });
  assert.strictEqual(parsed.success, true);
  assert.strictEqual(parsed.upload.status, 'preview_ready');
  return prepared.upload;
};

const updateCsv = 'word,meaning,phonetic\npear,梨,/peə/\ngrape,葡萄,\n';

(async () => {
  assert.strictEqual(model.UPLOAD_STATUS.PUBLISHING, 'publishing');
  assert.strictEqual(model.ERROR_CODES.VERSION_CONFLICT, 'VERSION_CONFLICT');
  assert.ok(model.FEATURES.includes('teacher_wordbook_version_update'));

  const previousWords = createV1Words('twb_match');
  const previousSnapshot = clone(previousWords);
  const firstMatch = matchWordIds({
    wordbookId: 'twb_match',
    previousWords,
    nextRows: [
      { row_key: 'server-row-b', word: 'BANANA', meaning: '香蕉（新释义）', phonetic: '/bəˈnɑːnə/' },
      { row_key: 'server-row-a', word: 'Ａｐｐｌｅ', meaning: '苹果（新释义）', phonetic: '/new/' },
      { row_key: 'server-row-c', word: 'pear', meaning: '梨', phonetic: '' }
    ],
    publishToken: 'token-a'
  });
  const retriedMatch = matchWordIds({
    wordbookId: 'twb_match',
    previousWords,
    nextRows: [
      { row_key: 'server-row-b', word: 'BANANA', meaning: '香蕉（新释义）', phonetic: '/bəˈnɑːnə/' },
      { row_key: 'server-row-a', word: 'Ａｐｐｌｅ', meaning: '苹果（新释义）', phonetic: '/new/' },
      { row_key: 'server-row-c', word: 'pear', meaning: '梨', phonetic: '' }
    ],
    publishToken: 'token-a'
  });
  assert.deepStrictEqual(previousWords, previousSnapshot);
  assert.strictEqual(firstMatch[0].id, previousWords[1].id);
  assert.strictEqual(firstMatch[1].id, previousWords[0].id);
  assert.notStrictEqual(firstMatch[2].id, previousWords[0].id);
  assert.notStrictEqual(firstMatch[2].id, previousWords[1].id);
  assert.deepStrictEqual(firstMatch, retriedMatch);
  assert.strictEqual(new Set(firstMatch.map((word) => word.id)).size, 3);
  assert.throws(() => matchWordIds({
    wordbookId: 'twb_match',
    previousWords,
    nextRows: [
      { row_key: 'duplicate-a', word: 'Apple', meaning: '甲', phonetic: '' },
      { row_key: 'duplicate-b', word: 'ａｐｐｌｅ', meaning: '乙', phonetic: '' }
    ],
    publishToken: 'token-duplicate'
  }), /DUPLICATE_WORD:next/);

  const readdedMatch = matchWordIds({
    wordbookId: 'twb_match',
    previousWords: [previousWords[1]],
    historicalWordSets: [previousWords],
    nextRows: [
      { row_key: 'readd-apple', word: 'apple', meaning: '重新加入', phonetic: '' },
      { row_key: 'keep-banana', word: 'banana', meaning: '保留', phonetic: '' }
    ],
    publishToken: 'token-readd'
  });
  assert.strictEqual(readdedMatch[0].id, previousWords[0].id);
  assert.strictEqual(readdedMatch[1].id, previousWords[1].id);

  const fixture = createActiveFixture('teacher-a', 'twb_update');
  const harness = createHarness({
    teachers,
    books: [fixture.book],
    versions: [fixture.version],
    storageEntries: [fixture.storageEntry]
  });
  const originalV1 = Buffer.from(harness.state().storage.get(fixture.v1FileId));
  const upload = await prepareVersionUpdate(harness, 'twb_update', updateCsv);
  const published = await harness.main({
    action: 'updateVersion',
    wordbookId: 'twb_update',
    uploadId: upload.uploadId,
    publishToken: upload.publishToken,
    teacherId: 'teacher-b',
    teacher_id: 'teacher-b',
    targetVersion: 77,
    previousVersion: 76,
    fileId: 'forged',
    storagePath: 'wordbooks/forged.json'
  });
  assert.strictEqual(published.success, true);
  assert.strictEqual(published.idempotent, false);
  assert.deepStrictEqual(published.version, {
    versionId: 'twb_update_v2',
    version: 2,
    previousVersion: 1,
    totalWords: 2,
    status: 'published'
  });

  const state = harness.state();
  const savedBook = state.books[0];
  assert.strictEqual(savedBook.version, 2);
  assert.strictEqual(savedBook.current_version_id, 'twb_update_v2');
  assert.strictEqual(savedBook.upload_state.status, 'published');
  assert.deepStrictEqual(Buffer.from(state.storage.get(fixture.v1FileId)), originalV1);
  assert.deepStrictEqual(state.versions.map((item) => item.version).sort(), [1, 2]);
  const v2 = state.versions.find((item) => item.version === 2);
  assert.strictEqual(v2.previous_version, 1);
  assert.strictEqual(v2.publish_token, upload.publishToken);
  assert.ok(state.storage.has(v2.words_file_id));
  const v2Words = JSON.parse(state.storage.get(v2.words_file_id).toString('utf8'));
  assert.deepStrictEqual(v2Words.map((word) => word.order), [1, 2]);
  assert.strictEqual(v2Words.every((word) => word.wordbookId === 'twb_update'), true);
  assert.strictEqual(v2Words.every((word) => /^twb_update_w_[0-9a-f]{16}$/.test(word.id)), true);
  assert.strictEqual(new Set(v2Words.map((word) => word.id)).size, 2);

  const duplicate = await harness.main({
    action: 'updateVersion',
    wordbookId: 'twb_update',
    uploadId: upload.uploadId,
    publishToken: upload.publishToken
  });
  assert.strictEqual(duplicate.success, true);
  assert.strictEqual(duplicate.idempotent, true);
  assert.strictEqual(duplicate.version.version, 2);
  assert.deepStrictEqual(harness.state().versions.map((item) => item.version).sort(), [1, 2]);

  const historyFixture = createActiveFixture('teacher-a', 'twb_history');
  const historyHarness = createHarness({
    teachers,
    books: [historyFixture.book],
    versions: [historyFixture.version],
    storageEntries: [historyFixture.storageEntry]
  });
  const historyV1Snapshot = Buffer.from(
    historyHarness.state().storage.get(historyFixture.v1FileId)
  );
  const historyV2Upload = await prepareVersionUpdate(
    historyHarness,
    'twb_history',
    'word,meaning,phonetic\nbanana,香蕉新释义,/new/\npear,梨,\n'
  );
  const historyV2Result = await historyHarness.main({
    action: 'updateVersion',
    wordbookId: 'twb_history',
    uploadId: historyV2Upload.uploadId,
    publishToken: historyV2Upload.publishToken
  });
  assert.strictEqual(historyV2Result.success, true);
  const historyV2Document = historyHarness.state().versions.find((item) => item.version === 2);
  const historyV2Words = JSON.parse(
    historyHarness.state().storage.get(historyV2Document.words_file_id).toString('utf8')
  );
  assert.strictEqual(historyV2Words.find((word) => word.word === 'banana').id, historyFixture.words[1].id);
  assert.strictEqual(historyV2Words.some((word) => word.word === 'apple'), false);
  const pearId = historyV2Words.find((word) => word.word === 'pear').id;
  const historyV2Snapshot = Buffer.from(
    historyHarness.state().storage.get(historyV2Document.words_file_id)
  );

  const historyV3Upload = await prepareVersionUpdate(
    historyHarness,
    'twb_history',
    'word,meaning,phonetic\napple,重新加入的苹果,\npear,梨的新释义,/pear/\nbanana,香蕉再次修改,\n',
    2
  );
  const historyV3Result = await historyHarness.main({
    action: 'updateVersion',
    wordbookId: 'twb_history',
    uploadId: historyV3Upload.uploadId,
    publishToken: historyV3Upload.publishToken
  });
  assert.strictEqual(historyV3Result.success, true);
  assert.strictEqual(historyV3Result.version.version, 3);
  const historyV3Document = historyHarness.state().versions.find((item) => item.version === 3);
  const historyV3Words = JSON.parse(
    historyHarness.state().storage.get(historyV3Document.words_file_id).toString('utf8')
  );
  assert.strictEqual(historyV3Words.find((word) => word.word === 'apple').id, historyFixture.words[0].id);
  assert.strictEqual(historyV3Words.find((word) => word.word === 'banana').id, historyFixture.words[1].id);
  assert.strictEqual(historyV3Words.find((word) => word.word === 'pear').id, pearId);
  assert.strictEqual(new Set(historyV3Words.map((word) => word.id)).size, 3);
  assert.deepStrictEqual(
    Buffer.from(historyHarness.state().storage.get(historyFixture.v1FileId)),
    historyV1Snapshot
  );
  assert.deepStrictEqual(
    Buffer.from(historyHarness.state().storage.get(historyV2Document.words_file_id)),
    historyV2Snapshot
  );
  assert.deepStrictEqual(
    historyHarness.state().versions.map((item) => item.version).sort(),
    [1, 2, 3]
  );

  const draftHarness = createHarness({
    teachers,
    books: [createDraft('teacher-a', 'twb_draft')]
  });
  const draftUpdate = await draftHarness.main({
    action: 'updateVersion',
    wordbookId: 'twb_draft',
    uploadId: 'twu_fake',
    publishToken: 'twp_fake'
  });
  assert.strictEqual(draftUpdate.success, false);
  assert.strictEqual(draftUpdate.reason, 'ACTIVE_WORDBOOK_REQUIRED');

  const otherFixture = createActiveFixture('teacher-b', 'twb_private');
  const isolationHarness = createHarness({
    teachers,
    books: [otherFixture.book],
    versions: [otherFixture.version],
    storageEntries: [otherFixture.storageEntry]
  });
  const isolated = await isolationHarness.main({
    action: 'updateVersion',
    wordbookId: 'twb_private',
    uploadId: 'forged',
    publishToken: 'forged',
    teacherId: 'teacher-b',
    teacher_id: 'teacher-b'
  });
  assert.strictEqual(isolated.success, false);
  assert.strictEqual(isolated.reason, 'WORDBOOK_NOT_FOUND');

  const noIdentityHarness = createHarness({
    openid: '',
    teachers,
    books: [fixture.book],
    versions: [fixture.version],
    storageEntries: [fixture.storageEntry]
  });
  const noIdentity = await noIdentityHarness.main({
    action: 'updateVersion',
    wordbookId: 'twb_update',
    uploadId: 'forged',
    publishToken: 'forged',
    teacherId: 'teacher-a'
  });
  assert.strictEqual(noIdentity.error, 'UNAUTHORIZED');

  const conflictFixture = createActiveFixture('teacher-a', 'twb_conflict');
  const conflictHarness = createHarness({
    teachers,
    books: [conflictFixture.book],
    versions: [conflictFixture.version],
    storageEntries: [conflictFixture.storageEntry]
  });
  const taskA = await prepareVersionUpdate(conflictHarness, 'twb_conflict', updateCsv);
  const taskB = await prepareVersionUpdate(
    conflictHarness,
    'twb_conflict',
    'word,meaning\norange,橙子\nmelon,瓜\n'
  );
  const [resultA, resultB] = await Promise.all([
    conflictHarness.main({
      action: 'updateVersion',
      wordbookId: 'twb_conflict',
      uploadId: taskA.uploadId,
      publishToken: taskA.publishToken
    }),
    conflictHarness.main({
      action: 'updateVersion',
      wordbookId: 'twb_conflict',
      uploadId: taskB.uploadId,
      publishToken: taskB.publishToken
    })
  ]);
  assert.strictEqual(resultA.error, 'VERSION_CONFLICT');
  assert.strictEqual(resultB.success, true);
  assert.strictEqual(conflictHarness.state().versions.filter((item) => item.version === 2).length, 1);

  const staleFixture = createActiveFixture('teacher-a', 'twb_stale');
  staleFixture.book.version = 2;
  staleFixture.book.current_version_id = 'twb_stale_v2';
  staleFixture.book.upload_state = {
    operation_type: 'version_update',
    base_version: 1,
    target_version: 2,
    upload_id: 'twu_stale',
    publish_token: 'twp_stale',
    status: 'preview_ready',
    valid_rows: 2
  };
  const staleHarness = createHarness({
    teachers,
    books: [staleFixture.book],
    versions: [staleFixture.version],
    storageEntries: [staleFixture.storageEntry]
  });
  const staleResult = await staleHarness.main({
    action: 'updateVersion',
    wordbookId: 'twb_stale',
    uploadId: 'twu_stale',
    publishToken: 'twp_stale'
  });
  assert.strictEqual(staleResult.error, 'VERSION_CONFLICT');
  assert.strictEqual(staleResult.reason, 'BASE_VERSION_CHANGED');

  const storageFixture = createActiveFixture('teacher-a', 'twb_storage_fail');
  const storageFailureHarness = createHarness({
    teachers,
    books: [storageFixture.book],
    versions: [storageFixture.version],
    storageEntries: [storageFixture.storageEntry],
    failVersionUpload: true
  });
  const storageTask = await prepareVersionUpdate(storageFailureHarness, 'twb_storage_fail', updateCsv);
  const storageFailure = await storageFailureHarness.main({
    action: 'updateVersion',
    wordbookId: 'twb_storage_fail',
    uploadId: storageTask.uploadId,
    publishToken: storageTask.publishToken
  });
  assert.strictEqual(storageFailure.success, false);
  assert.strictEqual(storageFailure.reason, 'VERSION_STORAGE_FAILED');
  assert.strictEqual(storageFailureHarness.state().books[0].version, 1);
  assert.strictEqual(storageFailureHarness.state().books[0].current_version_id, 'twb_storage_fail_v1');
  assert.strictEqual(storageFailureHarness.state().books[0].current_file_id, storageFixture.v1FileId);
  assert.strictEqual(storageFailureHarness.state().books[0].total_words, storageFixture.words.length);
  assert.strictEqual(storageFailureHarness.state().books[0].upload_state.status, 'preview_ready');
  assert.strictEqual(
    storageFailureHarness.state().books[0].upload_state.failure_reason,
    'VERSION_STORAGE_FAILED'
  );
  assert.strictEqual(storageFailureHarness.state().versions.length, 1);

  const transactionFixture = createActiveFixture('teacher-a', 'twb_transaction_fail');
  const transactionFailureHarness = createHarness({
    teachers,
    books: [transactionFixture.book],
    versions: [transactionFixture.version],
    storageEntries: [transactionFixture.storageEntry],
    failFinalBookUpdate: true
  });
  const transactionTask = await prepareVersionUpdate(
    transactionFailureHarness,
    'twb_transaction_fail',
    updateCsv
  );
  const transactionFailure = await transactionFailureHarness.main({
    action: 'updateVersion',
    wordbookId: 'twb_transaction_fail',
    uploadId: transactionTask.uploadId,
    publishToken: transactionTask.publishToken
  });
  assert.strictEqual(transactionFailure.success, false);
  assert.strictEqual(transactionFailure.reason, 'VERSION_COMMIT_FAILED');
  assert.strictEqual(transactionFailureHarness.state().books[0].version, 1);
  assert.strictEqual(
    transactionFailureHarness.state().books[0].current_version_id,
    'twb_transaction_fail_v1'
  );
  assert.strictEqual(
    transactionFailureHarness.state().books[0].current_file_id,
    transactionFixture.v1FileId
  );
  assert.strictEqual(
    transactionFailureHarness.state().books[0].total_words,
    transactionFixture.words.length
  );
  assert.strictEqual(
    transactionFailureHarness.state().books[0].upload_state.status,
    'preview_ready'
  );
  assert.strictEqual(
    transactionFailureHarness.state().books[0].upload_state.failure_reason,
    'VERSION_COMMIT_FAILED'
  );
  assert.strictEqual(transactionFailureHarness.state().versions.length, 1);

  const permissionFixture = createActiveFixture('teacher-a', 'twb_permission_fail');
  const permissionFailureHarness = createHarness({
    teachers,
    books: [permissionFixture.book],
    versions: [permissionFixture.version],
    storageEntries: [permissionFixture.storageEntry],
    missingVersionDocumentError: 'document.get:fail permission denied'
  });
  const permissionTask = await prepareVersionUpdate(
    permissionFailureHarness,
    'twb_permission_fail',
    updateCsv
  );
  const permissionFailure = await permissionFailureHarness.main({
    action: 'updateVersion',
    wordbookId: 'twb_permission_fail',
    uploadId: permissionTask.uploadId,
    publishToken: permissionTask.publishToken
  });
  assert.strictEqual(permissionFailure.success, false);
  assert.strictEqual(permissionFailure.reason, 'VERSION_COMMIT_FAILED');
  assert.strictEqual(permissionFailureHarness.state().books[0].version, 1);
  assert.strictEqual(permissionFailureHarness.state().books[0].upload_state.status, 'preview_ready');
  assert.strictEqual(permissionFailureHarness.state().versions.length, 1);

  transactionFailureHarness.setFailFinalBookUpdate(false);
  const transactionRetry = await transactionFailureHarness.main({
    action: 'updateVersion',
    wordbookId: 'twb_transaction_fail',
    uploadId: transactionTask.uploadId,
    publishToken: transactionTask.publishToken
  });
  assert.strictEqual(transactionRetry.success, true);
  assert.strictEqual(transactionRetry.idempotent, false);
  assert.strictEqual(transactionFailureHarness.state().books[0].version, 2);
  assert.strictEqual(
    transactionFailureHarness.state().books[0].current_version_id,
    'twb_transaction_fail_v2'
  );
  assert.deepStrictEqual(
    transactionFailureHarness.state().versions.map((item) => item.version).sort(),
    [1, 2]
  );

  const transactionRetryAgain = await transactionFailureHarness.main({
    action: 'updateVersion',
    wordbookId: 'twb_transaction_fail',
    uploadId: transactionTask.uploadId,
    publishToken: transactionTask.publishToken
  });
  assert.strictEqual(transactionRetryAgain.success, true);
  assert.strictEqual(transactionRetryAgain.idempotent, true);
  assert.strictEqual(transactionFailureHarness.state().books[0].version, 2);
  assert.strictEqual(
    Array.from(transactionFailureHarness.state().storage.keys())
      .some((fileId) => /\/versions\/v3\/words\.json$/.test(fileId)),
    false
  );

  const official = require('../data/wordbooks-simple');
  const officialCount = ['primary', 'junior', 'senior']
    .reduce((total, key) => total + official[key].length, 0);
  assert.strictEqual(officialCount, 46);

  process.stdout.write('teacher-wordbook-stage6-version-update: PASS\n');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
