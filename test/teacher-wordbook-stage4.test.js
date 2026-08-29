'use strict';

const assert = require('assert');
const Module = require('module');
const ExcelJS = require('../cloudfunctions/teacherWordbook/node_modules/exceljs');
const JSZip = require('../cloudfunctions/teacherWordbook/node_modules/jszip');
const model = require('../cloudfunctions/teacherWordbook/model');
const {
  UploadParseError,
  parseUploadBuffer
} = require('../cloudfunctions/teacherWordbook/upload-parser');

const clone = (value) => JSON.parse(JSON.stringify(value));

const SPREADSHEETML_NAMESPACE = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

const prefixSpreadsheetMlElements = async (buffer) => {
  const archive = await JSZip.loadAsync(buffer);
  const entry = archive.file('xl/workbook.xml');
  assert.ok(entry, 'fixture must include xl/workbook.xml');
  const xml = await entry.async('string');
  assert.ok(xml.includes(`xmlns="${SPREADSHEETML_NAMESPACE}"`));
  const prefixed = xml
    .replace(
      `xmlns="${SPREADSHEETML_NAMESPACE}"`,
      `xmlns:x="${SPREADSHEETML_NAMESPACE}"`
    )
    .replace(/<(\/?)((?!\?xml\b)[A-Za-z_][\w.-]*)(?=[\s/>])/g, '<$1x:$2');
  archive.file('xl/workbook.xml', prefixed);
  return archive.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
};

const createHarness = ({ openid = '', teachers = [], books = [] } = {}) => {
  let callerOpenid = openid;
  const documents = books.map((book, index) => ({
    _id: book._id || `book-doc-${index + 1}`,
    ...clone(book)
  }));
  const versions = [];
  const storage = new Map();
  const queries = [];
  const writes = [];
  let clock = 0;

  const matches = (document, criteria) => Object.keys(criteria).every((key) => (
    document[key] === criteria[key]
  ));
  const toFileId = (cloudPath) => `cloud://test-env.bucket/${cloudPath}`;
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
    if (name === 'teachers') return teachers;
    if (name === model.COLLECTIONS.TEACHER_WORDBOOKS) return documents;
    if (name === model.COLLECTIONS.TEACHER_WORDBOOK_VERSIONS) return versions;
    throw new Error(`unexpected_collection:${name}`);
  };

  const cloudMock = {
    DYNAMIC_CURRENT_ENV: 'test-env',
    init: () => {},
    getWXContext: () => ({ OPENID: callerOpenid }),
    uploadFile: async ({ cloudPath, fileContent }) => {
      assert.strictEqual(cloudPath.startsWith('wordbooks/'), false);
      const fileID = toFileId(cloudPath);
      storage.set(fileID, Buffer.from(fileContent));
      writes.push({ type: 'storage', cloudPath, fileID });
      return { fileID };
    },
    downloadFile: async ({ fileID }) => {
      if (!storage.has(fileID)) throw new Error('storage_file_missing');
      return { fileContent: Buffer.from(storage.get(fileID)) };
    },
    database: () => ({
      serverDate: () => ({ $serverDate: ++clock }),
      collection: (collectionName) => ({
        where: (criteria) => {
          queries.push({ collectionName, criteria: clone(criteria) });
          const run = async () => ({
            data: collectionDocuments(collectionName).filter((document) => (
              matches(document, criteria)
            ))
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
          const document = { _id: `book-doc-${documents.length + 1}`, ...data };
          documents.push(document);
          writes.push({ type: 'add', collectionName, data: clone(data) });
          return { _id: document._id };
        },
        doc: (documentId) => ({
          update: async ({ data }) => {
            const document = collectionDocuments(collectionName)
              .find((item) => item._id === documentId);
            if (!document) throw new Error(`document_missing:${documentId}`);
            Object.assign(document, clone(data));
            writes.push({ type: 'update', collectionName, documentId, data: clone(data) });
            return { updated: 1 };
          },
          set: async ({ data }) => {
            const target = collectionDocuments(collectionName);
            const existing = target.find((item) => item._id === documentId);
            if (existing) Object.assign(existing, clone(data));
            else target.push({ _id: documentId, ...clone(data) });
            writes.push({ type: 'set', collectionName, documentId, data: clone(data) });
            return { _id: documentId };
          }
        })
      })
    })
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
    putClientFile: (cloudPath, content) => {
      const fileID = toFileId(cloudPath);
      storage.set(fileID, Buffer.from(content));
      return fileID;
    },
    state: () => ({
      books: clone(documents),
      versions: clone(versions),
      storage,
      queries: clone(queries),
      writes: clone(writes)
    })
  };
};

const teachers = [
  { teacher_id: 'teacher-a', name: 'Teacher A' },
  { teacher_id: 'teacher-b', name: 'Teacher B' }
];

const draft = (teacherId, wordbookId) => ({
  teacher_id: teacherId,
  source_type: 'teacher_custom',
  wordbook_id: wordbookId,
  name: `Draft ${wordbookId}`,
  name_key: `draft ${wordbookId}`,
  category: '',
  description: '',
  version: 0,
  current_version_id: '',
  current_file_id: '',
  total_words: 0,
  status: 'draft',
  schema_version: 1
});

const prepareAndPut = async (harness, wordbookId, fileName, content, extra = {}) => {
  const prepared = await harness.main({
    action: 'prepareUpload',
    wordbookId,
    fileName,
    fileSize: content.length,
    teacherId: 'teacher-b',
    teacher_id: 'teacher-b',
    ...extra
  });
  assert.strictEqual(prepared.success, true);
  assert.strictEqual(Object.hasOwn(prepared.upload, 'cloudPath'), false);
  const extension = fileName.split('.').pop().toLowerCase();
  const cloudPath = `teacher-wordbooks/teacher-a/${wordbookId}`
    + `/staging/${prepared.upload.uploadId}/source.${extension}`;
  const fileId = harness.putClientFile(cloudPath, content);
  return { prepared, fileId, cloudPath };
};

(async () => {
  assert.deepStrictEqual(model.UPLOAD_STATUS, {
    CREATED: 'created',
    UPLOADED: 'uploaded',
    PARSING: 'parsing',
    PREVIEW_READY: 'preview_ready',
    PUBLISHING: 'publishing',
    PUBLISHED: 'published',
    FAILED: 'failed'
  });

  const noIdentity = createHarness({ teachers, books: [draft('teacher-a', 'twb_a')] });
  const noIdentityResult = await noIdentity.main({
    action: 'prepareUpload',
    wordbookId: 'twb_a',
    fileName: 'words.csv',
    fileSize: 20,
    teacherId: 'teacher-a'
  });
  assert.strictEqual(noIdentityResult.error, 'UNAUTHORIZED');

  const notTeacher = createHarness({
    openid: 'unknown',
    teachers,
    books: [draft('teacher-a', 'twb_a')]
  });
  assert.strictEqual((await notTeacher.main({
    action: 'prepareUpload',
    wordbookId: 'twb_a',
    fileName: 'words.csv',
    fileSize: 20
  })).error, 'TEACHER_NOT_FOUND');

  const isolation = createHarness({
    openid: 'teacher-a',
    teachers,
    books: [draft('teacher-b', 'twb_b')]
  });
  for (const action of ['prepareUpload', 'parseUpload', 'getPreview', 'publish']) {
    const result = await isolation.main({
      action,
      wordbookId: 'twb_b',
      uploadId: 'twu_forged',
      fileId: 'cloud://test-env.bucket/forged.csv',
      confirmed: true,
      teacherId: 'teacher-b',
      teacher_id: 'teacher-b',
      fileName: 'words.csv',
      fileSize: 20
    });
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.reason, 'WORDBOOK_NOT_FOUND');
  }

  const harness = createHarness({
    openid: 'teacher-a',
    teachers,
    books: [
      draft('teacher-a', 'twb_csv'),
      draft('teacher-a', 'twb_duplicate'),
      draft('teacher-b', 'twb_other')
    ]
  });
  const csv = Buffer.from(
    '\uFEFFWord,释义,音标\r\napple,苹果,/ˈæpəl/\r\n,缺少单词,\r\npear,,/peə/\r\nbanana,香蕉,\r\n\r\n',
    'utf8'
  );
  const { prepared, fileId } = await prepareAndPut(harness, 'twb_csv', 'Words.CSV', csv);
  const parsed = await harness.main({
    action: 'parseUpload',
    wordbookId: 'twb_csv',
    uploadId: prepared.upload.uploadId,
    fileId,
    teacherId: 'teacher-b'
  });
  assert.deepStrictEqual(parsed.summary, {
    totalRows: 4,
    validRows: 2,
    invalidRows: 2
  });
  assert.strictEqual(parsed.upload.status, 'preview_ready');

  const preview = await harness.main({
    action: 'getPreview',
    wordbookId: 'twb_csv',
    uploadId: prepared.upload.uploadId,
    teacher_id: 'teacher-b'
  });
  assert.strictEqual(preview.success, true);
  assert.deepStrictEqual(preview.validPreview, [
    { word: 'apple', meaning: '苹果', phonetic: '/ˈæpəl/' },
    { word: 'banana', meaning: '香蕉', phonetic: '' }
  ]);
  assert.deepStrictEqual(preview.errorPreview.map((item) => item.reasonCode), [
    'MISSING_WORD',
    'MISSING_MEANING'
  ]);

  const duplicateCsv = Buffer.from(
    'word,meaning,phonetic\nApple,苹果,\napple,苹果2,\nＡｐｐｌｅ,苹果3,\nAPPLE,苹果4,\nbanana,香蕉,\n',
    'utf8'
  );
  const duplicateUpload = await prepareAndPut(
    harness,
    'twb_duplicate',
    'duplicate.csv',
    duplicateCsv
  );
  const duplicateParsed = await harness.main({
    action: 'parseUpload',
    wordbookId: 'twb_duplicate',
    uploadId: duplicateUpload.prepared.upload.uploadId
  });
  assert.deepStrictEqual(duplicateParsed.summary, {
    totalRows: 5,
    validRows: 1,
    invalidRows: 4
  });
  const duplicatePreview = await harness.main({
    action: 'getPreview',
    wordbookId: 'twb_duplicate',
    uploadId: duplicateUpload.prepared.upload.uploadId
  });
  assert.deepStrictEqual(duplicatePreview.validPreview, [
    { word: 'banana', meaning: '香蕉', phonetic: '' }
  ]);
  assert.deepStrictEqual(
    duplicatePreview.errorPreview.map((item) => item.rowNumber),
    [2, 3, 4, 5]
  );
  assert.strictEqual(
    duplicatePreview.errorPreview.every((item) => (
      item.reasonCode === 'DUPLICATE_WORD'
      && item.reasonText.includes('重复行：2、3、4、5')
    )),
    true
  );

  const notConfirmed = await harness.main({
    action: 'publish',
    wordbookId: 'twb_csv',
    uploadId: prepared.upload.uploadId
  });
  assert.strictEqual(notConfirmed.success, false);
  assert.strictEqual(notConfirmed.reason, 'CONFIRMATION_REQUIRED');
  assert.strictEqual(harness.state().versions.length, 0);

  const published = await harness.main({
    action: 'publish',
    wordbookId: 'twb_csv',
    uploadId: prepared.upload.uploadId,
    confirmed: true,
    teacherId: 'teacher-b'
  });
  assert.strictEqual(published.success, true);
  assert.strictEqual(published.idempotent, false);
  assert.deepStrictEqual(published.version, {
    versionId: 'twb_csv_v1',
    version: 1,
    totalWords: 2,
    status: 'published'
  });

  const state = harness.state();
  const savedBook = state.books.find((book) => book.wordbook_id === 'twb_csv');
  assert.strictEqual(savedBook.status, 'active');
  assert.strictEqual(savedBook.version, 1);
  assert.strictEqual(savedBook.total_words, 2);
  assert.strictEqual(savedBook.current_version_id, 'twb_csv_v1');
  assert.strictEqual(savedBook.upload_state.status, 'published');
  assert.strictEqual(state.versions.length, 1);
  assert.strictEqual(state.versions[0].publish_token, prepared.upload.uploadId);
  assert.strictEqual(state.versions[0].status, 'published');
  assert.strictEqual(state.versions[0].total_words, 2);

  const words = JSON.parse(state.storage.get(savedBook.current_file_id).toString('utf8'));
  assert.deepStrictEqual(words.map((word) => word.order), [1, 2]);
  assert.strictEqual(words.every((word) => word.wordbookId === 'twb_csv'), true);
  assert.strictEqual(words.every((word) => /^twb_csv_w_[0-9a-f]{16}$/.test(word.id)), true);
  assert.strictEqual(words[1].phonetic, '');
  assert.deepStrictEqual(Object.keys(words[0]), [
    'id', 'wordbookId', 'word', 'phonetic', 'meaning', 'order'
  ]);
  assert.strictEqual(
    Array.from(state.storage.keys()).every((fileIdValue) => (
      fileIdValue.includes('/teacher-wordbooks/')
    )),
    true
  );

  const duplicatePublish = await harness.main({
    action: 'publish',
    wordbookId: 'twb_csv',
    uploadId: prepared.upload.uploadId,
    confirmed: true
  });
  assert.strictEqual(duplicatePublish.success, true);
  assert.strictEqual(duplicatePublish.idempotent, true);
  assert.strictEqual(harness.state().versions.length, 1);

  const xlsxHarness = createHarness({
    openid: 'teacher-a',
    teachers,
    books: [draft('teacher-a', 'twb_xlsx')]
  });
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('词汇');
  worksheet.addRow(['单词', 'Meaning', '音标']);
  worksheet.addRow(['cat', '猫', '/kæt/']);
  worksheet.addRow(['dog', '狗', '']);
  worksheet.addTable({
    name: 'VocabularyTable',
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    columns: [{ name: '单词' }, { name: 'Meaning' }, { name: '音标' }],
    rows: [['cat', '猫', '/kæt/'], ['dog', '狗', '']]
  });
  const xlsxBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const xlsxUpload = await prepareAndPut(
    xlsxHarness,
    'twb_xlsx',
    'teacher-list.xlsx',
    xlsxBuffer
  );
  const xlsxParsed = await xlsxHarness.main({
    action: 'parseUpload',
    wordbookId: 'twb_xlsx',
    uploadId: xlsxUpload.prepared.upload.uploadId,
    fileId: xlsxUpload.fileId
  });
  assert.deepStrictEqual(xlsxParsed.summary, {
    totalRows: 2,
    validRows: 2,
    invalidRows: 0
  });

  const prefixedXlsxBuffer = await prefixSpreadsheetMlElements(xlsxBuffer);
  const prefixedArchive = await JSZip.loadAsync(prefixedXlsxBuffer);
  const prefixedWorkbookXml = await prefixedArchive.file('xl/workbook.xml').async('string');
  assert.ok(prefixedWorkbookXml.includes('<x:workbook'));
  assert.ok(prefixedWorkbookXml.includes('<x:sheets>'));
  assert.ok(prefixedWorkbookXml.includes('<x:sheet '));
  await assert.rejects(async () => {
    const rawWorkbook = new ExcelJS.Workbook();
    await rawWorkbook.xlsx.load(prefixedXlsxBuffer);
  }, /Cannot read properties of undefined \(reading 'sheets'\)/);

  const prefixedDirect = await parseUploadBuffer({
    buffer: prefixedXlsxBuffer,
    extension: 'xlsx',
    ExcelJS
  });
  assert.deepStrictEqual(prefixedDirect.valid, [
    { word: 'cat', meaning: '猫', phonetic: '/kæt/' },
    { word: 'dog', meaning: '狗', phonetic: '' }
  ]);

  const prefixedHarness = createHarness({
    openid: 'teacher-a',
    teachers,
    books: [draft('teacher-a', 'twb_xlsx_prefix')]
  });
  const prefixedUpload = await prepareAndPut(
    prefixedHarness,
    'twb_xlsx_prefix',
    'prefixed.xlsx',
    prefixedXlsxBuffer
  );
  const prefixedParsed = await prefixedHarness.main({
    action: 'parseUpload',
    wordbookId: 'twb_xlsx_prefix',
    uploadId: prefixedUpload.prepared.upload.uploadId
  });
  assert.deepStrictEqual(prefixedParsed.summary, {
    totalRows: 2,
    validRows: 2,
    invalidRows: 0
  });

  const valueWorkbook = new ExcelJS.Workbook();
  const valueWorksheet = valueWorkbook.addWorksheet('values');
  valueWorksheet.addRow(['word', 'meaning', 'phonetic']);
  valueWorksheet.getCell('A2').value = { formula: '"alpha"', result: 'alpha' };
  valueWorksheet.getCell('B2').value = { richText: [{ text: '阿' }, { text: '尔法' }] };
  valueWorksheet.getCell('C2').value = { formula: '"/ˈælfə/"', result: '/ˈælfə/' };
  const valueParsed = await parseUploadBuffer({
    buffer: Buffer.from(await valueWorkbook.xlsx.writeBuffer()),
    extension: 'xlsx',
    ExcelJS
  });
  assert.deepStrictEqual(valueParsed.valid, [
    { word: 'alpha', meaning: '阿尔法', phonetic: '/ˈælfə/' }
  ]);

  await assert.rejects(
    parseUploadBuffer({
      buffer: Buffer.from('word,meaning\none,一\ntwo,二', 'utf8'),
      extension: 'csv',
      maxRows: 1
    }),
    (error) => error instanceof UploadParseError
      && error.reasonCode === 'INVALID_FORMAT'
      && error.reasonText === '数据行不能超过1行'
  );

  const invalidCases = [
    { id: 'twb_empty', name: 'empty.csv', content: Buffer.alloc(0) },
    {
      id: 'twb_headers',
      name: 'missing-headers.csv',
      content: Buffer.from('term,translation\ncat,猫', 'utf8')
    },
    {
      id: 'twb_corrupt_xlsx',
      name: 'corrupt.xlsx',
      content: Buffer.from('not-a-valid-zip', 'utf8')
    }
  ];
  for (const testCase of invalidCases) {
    const invalidHarness = createHarness({
      openid: 'teacher-a',
      teachers,
      books: [draft('teacher-a', testCase.id)]
    });
    const contentForPrepare = testCase.content.length ? testCase.content : Buffer.from('x');
    const invalidUpload = await prepareAndPut(
      invalidHarness,
      testCase.id,
      testCase.name,
      contentForPrepare
    );
    if (!testCase.content.length) {
      invalidHarness.putClientFile(invalidUpload.cloudPath, Buffer.alloc(0));
    }
    const result = await invalidHarness.main({
      action: 'parseUpload',
      wordbookId: testCase.id,
      uploadId: invalidUpload.prepared.upload.uploadId,
      fileId: invalidUpload.fileId
    });
    assert.strictEqual(result.success, false);
    assert.strictEqual(
      result.reason,
      testCase.content.length ? 'INVALID_FORMAT' : 'ACTUAL_FILE_SIZE_INVALID'
    );
    assert.strictEqual(result.upload.status, 'failed');
    if (testCase.content.length) {
      assert.strictEqual(result.errors[0].reasonCode, 'INVALID_FORMAT');
    }
  }

  const touchedCollections = new Set(harness.state().writes
    .filter((write) => write.collectionName)
    .map((write) => write.collectionName));
  assert.deepStrictEqual(Array.from(touchedCollections).sort(), [
    'teacher_wordbook_versions',
    'teacher_wordbooks'
  ]);

  console.log('teacher-wordbook-stage4: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
