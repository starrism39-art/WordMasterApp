'use strict';

const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');

const model = require('../cloudfunctions/teacherWordbook/model.js');

const createHarness = ({
  openid = '',
  teachers = [],
  books = [],
  failingCollection = ''
} = {}) => {
  let callerOpenid = openid;
  const queries = [];
  let writeCount = 0;

  const writeBlocked = () => {
    writeCount += 1;
    throw new Error('write_operation_forbidden');
  };

  const createQuery = (collectionName, criteria) => {
    const run = async () => {
      if (collectionName === failingCollection) {
        throw new Error(`${collectionName}_read_failed`);
      }

      if (collectionName === 'teachers') {
        return {
          data: teachers.filter((teacher) => (
            teacher.teacher_id === criteria.teacher_id
          ))
        };
      }

      if (collectionName === model.COLLECTIONS.TEACHER_WORDBOOKS) {
        return {
          data: books.filter((book) => Object.keys(criteria).every((key) => (
            book[key] === criteria[key]
          )))
        };
      }

      throw new Error(`unexpected_collection:${collectionName}`);
    };

    return {
      get: run,
      limit: (value) => ({
        get: async () => {
          const result = await run();
          return { data: result.data.slice(0, value) };
        }
      })
    };
  };

  const cloudMock = {
    DYNAMIC_CURRENT_ENV: 'test-env',
    init: () => {},
    getWXContext: () => ({ OPENID: callerOpenid }),
    database: () => ({
      collection: (collectionName) => ({
        add: writeBlocked,
        where: (criteria) => {
          queries.push({ collectionName, criteria });
          return createQuery(collectionName, criteria);
        },
        doc: () => ({
          set: writeBlocked,
          update: writeBlocked,
          remove: writeBlocked
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
    setOpenid: (value) => {
      callerOpenid = value;
    },
    state: () => ({ queries: queries.slice(), writeCount })
  };
};

const teachers = [
  { teacher_id: 'teacher-a', name: 'Teacher A' },
  { teacher_id: 'teacher-b', name: 'Teacher B' },
  { teacher_id: 'teacher-empty', name: 'Teacher Empty' }
];

const books = [
  {
    _id: 'internal-document-a',
    teacher_id: 'teacher-a',
    wordbook_id: 'book-a',
    title: 'Book A',
    category: '英语',
    description: 'A description',
    source_type: 'unexpected-source',
    status: 'active',
    version: 2,
    total_words: 120,
    current_version_id: 'book-a-v2',
    updatedAt: '2026-08-25T00:00:00.000Z',
    storage_file_id: 'cloud://secret-a',
    internal_path: 'teacher-wordbooks/teacher-a/book-a.json',
    version_content: [{ word: 'secret' }]
  },
  {
    _id: 'internal-document-b',
    teacher_id: 'teacher-b',
    wordbook_id: 'book-b',
    title: 'Book B',
    category: '',
    description: '',
    source_type: model.SOURCE_TYPE,
    status: 'draft',
    version: 1,
    total_words: 8,
    current_version_id: 'book-b-v1',
    updatedAt: '2026-08-24T00:00:00.000Z'
  }
];

(async () => {
  const noIdentity = createHarness({ teachers, books });
  const noIdentityResult = await noIdentity.main({
    action: 'list',
    teacherId: 'teacher-a',
    teacher_id: 'teacher-a'
  });
  assert.strictEqual(noIdentityResult.success, false);
  assert.strictEqual(noIdentityResult.error, model.ERROR_CODES.UNAUTHORIZED);
  assert.deepStrictEqual(noIdentity.state().queries, []);

  const notTeacher = createHarness({
    openid: 'not-a-teacher',
    teachers,
    books
  });
  const notTeacherResult = await notTeacher.main({
    action: 'list',
    teacherId: 'teacher-a'
  });
  assert.strictEqual(notTeacherResult.success, false);
  assert.strictEqual(notTeacherResult.error, model.ERROR_CODES.TEACHER_NOT_FOUND);
  assert.deepStrictEqual(notTeacher.state().queries, [{
    collectionName: 'teachers',
    criteria: { teacher_id: 'not-a-teacher' }
  }]);

  const teacherA = createHarness({ openid: 'teacher-a', teachers, books });
  const teacherAResult = await teacherA.main({
    action: 'list',
    teacherId: 'teacher-b',
    teacher_id: 'teacher-b'
  });
  assert.deepStrictEqual(teacherAResult, {
    success: true,
    schemaVersion: 1,
    books: [{
      wordbookId: 'book-a',
      title: 'Book A',
      category: '英语',
      description: 'A description',
      sourceType: 'teacher_custom',
      status: 'active',
      version: 2,
      totalWords: 120,
      currentVersionId: 'book-a-v2',
      updatedAt: '2026-08-25T00:00:00.000Z'
    }]
  });
  assert.deepStrictEqual(teacherA.state().queries, [
    { collectionName: 'teachers', criteria: { teacher_id: 'teacher-a' } },
    {
      collectionName: model.COLLECTIONS.TEACHER_WORDBOOKS,
      criteria: { teacher_id: 'teacher-a', status: 'active' }
    }
  ]);
  assert.strictEqual(teacherA.state().writeCount, 0);
  assert.deepStrictEqual(Object.keys(teacherAResult.books[0]), [
    'wordbookId',
    'title',
    'category',
    'description',
    'sourceType',
    'status',
    'version',
    'totalWords',
    'currentVersionId',
    'updatedAt'
  ]);

  const teacherB = createHarness({ openid: 'teacher-b', teachers, books });
  const teacherBResult = await teacherB.main({
    action: 'list',
    teacherId: 'teacher-a',
    teacher_id: 'teacher-a'
  });
  assert.strictEqual(teacherBResult.success, true);
  assert.deepStrictEqual(teacherBResult.books, []);
  assert.deepStrictEqual(teacherB.state().queries[1].criteria, {
    teacher_id: 'teacher-b',
    status: 'active'
  });

  const teacherBManagement = createHarness({ openid: 'teacher-b', teachers, books });
  const teacherBManagementResult = await teacherBManagement.main({
    action: 'list',
    scope: 'manage',
    teacherId: 'teacher-a'
  });
  assert.deepStrictEqual(
    teacherBManagementResult.books.map((book) => book.wordbookId),
    ['book-b']
  );
  assert.deepStrictEqual(teacherBManagement.state().queries[1].criteria, {
    teacher_id: 'teacher-b'
  });

  const emptyTeacher = createHarness({
    openid: 'teacher-empty',
    teachers,
    books
  });
  const emptyResult = await emptyTeacher.main({ action: 'list' });
  assert.deepStrictEqual(emptyResult, {
    success: true,
    schemaVersion: 1,
    books: []
  });

  const teacherReadFailure = createHarness({
    openid: 'teacher-a',
    teachers,
    books,
    failingCollection: 'teachers'
  });
  const teacherReadFailureResult = await teacherReadFailure.main({ action: 'list' });
  assert.strictEqual(teacherReadFailureResult.success, false);
  assert.strictEqual(
    teacherReadFailureResult.error,
    model.ERROR_CODES.INTERNAL_ERROR
  );

  const bookReadFailure = createHarness({
    openid: 'teacher-a',
    teachers,
    books,
    failingCollection: model.COLLECTIONS.TEACHER_WORDBOOKS
  });
  const bookReadFailureResult = await bookReadFailure.main({ action: 'list' });
  assert.strictEqual(bookReadFailureResult.success, false);
  assert.strictEqual(bookReadFailureResult.error, model.ERROR_CODES.INTERNAL_ERROR);

  const regression = createHarness({ openid: 'teacher-a', teachers, books });
  assert.deepStrictEqual(await regression.main({ action: 'capabilities' }), {
    success: true,
    schemaVersion: 1,
    features: [
      'teacher_wordbook_foundation',
      'teacher_wordbook_create_draft',
      'teacher_wordbook_upload_preview_publish',
      'teacher_wordbook_learning_read',
      'teacher_wordbook_version_update',
      'teacher_wordbook_disable'
    ]
  });
  assert.deepStrictEqual(await regression.main({ action: 'health' }), {
    success: true,
    schemaVersion: 1,
    authenticated: true,
    isTeacher: true
  });
  const unknown = await regression.main({ action: 'unknown' });
  assert.strictEqual(unknown.success, false);
  assert.strictEqual(unknown.error, model.ERROR_CODES.INVALID_ACTION);

  const functionSource = fs.readFileSync(
    path.resolve(__dirname, '../cloudfunctions/teacherWordbook/index.js'),
    'utf8'
  );
  assert.strictEqual(
    /event\s*\.\s*teacher(?:Id|_id)/.test(functionSource),
    false,
    'list must never read event teacher identity fields'
  );
  const listSource = functionSource.slice(
    functionSource.indexOf('const handleList'),
    functionSource.indexOf('const handleCreateDraft')
  );
  assert.strictEqual(/\.(?:add|set|update|remove|uploadFile)\s*\(/.test(listSource), false);

  console.log('teacher-wordbook-list: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
