'use strict';

const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');

const model = require('../cloudfunctions/teacherWordbook/model.js');
const officialNameSnapshot = require('../cloudfunctions/teacherWordbook/official-wordbook-names.js');
const {
  normalizeWordbookName
} = require('../cloudfunctions/teacherWordbook/name-utils.js');
const officialSource = require('../data/wordbooks.js');

const createHarness = ({
  openid = '',
  teachers = [],
  books = [],
  failingCollection = '',
  failAdd = false
} = {}) => {
  let callerOpenid = openid;
  const documents = books.map((book) => ({ ...book }));
  const queries = [];
  const writes = [];
  const serverDate = { $serverDate: true };

  const matches = (document, criteria) => Object.keys(criteria).every((key) => (
    document[key] === criteria[key]
  ));

  const queryCollection = (collectionName, criteria) => {
    const run = async () => {
      if (collectionName === failingCollection) {
        throw new Error(`${collectionName}_failed`);
      }

      if (collectionName === 'teachers') {
        return { data: teachers.filter((teacher) => matches(teacher, criteria)) };
      }

      if (collectionName === model.COLLECTIONS.TEACHER_WORDBOOKS) {
        return { data: documents.filter((book) => matches(book, criteria)) };
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
      serverDate: () => serverDate,
      collection: (collectionName) => ({
        where: (criteria) => {
          queries.push({ collectionName, criteria });
          return queryCollection(collectionName, criteria);
        },
        add: async ({ data }) => {
          if (collectionName !== model.COLLECTIONS.TEACHER_WORDBOOKS) {
            throw new Error(`unexpected_write_collection:${collectionName}`);
          }
          if (failAdd) throw new Error('add_failed');
          const saved = { ...data };
          documents.push(saved);
          writes.push({ collectionName, data: saved });
          return { _id: `doc-${writes.length}` };
        }
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
    state: () => ({
      documents: documents.map((book) => ({ ...book })),
      queries: queries.slice(),
      writes: writes.map((write) => ({
        collectionName: write.collectionName,
        data: { ...write.data }
      }))
    })
  };
};

const teachers = [
  { teacher_id: 'teacher-a', name: 'Teacher A' },
  { teacher_id: 'teacher-b', name: 'Teacher B' }
];

(async () => {
  const officialBooks = ['primary', 'junior', 'senior'].flatMap((category) => (
    officialSource[category] || []
  ));
  assert.strictEqual(officialBooks.length, 46);
  assert.deepStrictEqual(
    officialNameSnapshot.slice(),
    officialBooks.map((book) => book.title),
    'cloud function official-name snapshot must match the current official catalog'
  );
  assert.strictEqual(normalizeWordbookName(' English  Word '), 'english word');
  assert.strictEqual(normalizeWordbookName('ＥＮＧＬＩＳＨ　ＷＯＲＤ'), 'english word');

  const noIdentity = createHarness({ teachers });
  const noIdentityResult = await noIdentity.main({
    action: 'createDraft',
    name: 'Forged Draft',
    teacherId: 'teacher-a',
    teacher_id: 'teacher-a'
  });
  assert.strictEqual(noIdentityResult.success, false);
  assert.strictEqual(noIdentityResult.error, model.ERROR_CODES.UNAUTHORIZED);
  assert.deepStrictEqual(noIdentity.state().queries, []);
  assert.deepStrictEqual(noIdentity.state().writes, []);

  const notTeacher = createHarness({ openid: 'not-teacher', teachers });
  const notTeacherResult = await notTeacher.main({
    action: 'createDraft',
    name: 'Forged Draft',
    teacherId: 'teacher-a'
  });
  assert.strictEqual(notTeacherResult.success, false);
  assert.strictEqual(notTeacherResult.error, model.ERROR_CODES.TEACHER_NOT_FOUND);
  assert.deepStrictEqual(notTeacher.state().queries[0], {
    collectionName: 'teachers',
    criteria: { teacher_id: 'not-teacher' }
  });
  assert.deepStrictEqual(notTeacher.state().writes, []);

  const duplicate = createHarness({
    openid: 'teacher-a',
    teachers,
    books: [{
      teacher_id: 'teacher-a',
      name: 'English Word',
      name_key: 'english word',
      status: 'draft'
    }]
  });
  const duplicateResult = await duplicate.main({
    action: 'createDraft',
    name: '  English   Word  ',
    teacherId: 'teacher-b'
  });
  assert.strictEqual(duplicateResult.success, false);
  assert.strictEqual(duplicateResult.error, model.ERROR_CODES.INVALID_ARGUMENT);
  assert.strictEqual(duplicateResult.reason, 'DUPLICATE_NAME');
  assert.deepStrictEqual(duplicate.state().writes, []);
  assert.deepStrictEqual(duplicate.state().queries[1].criteria, {
    teacher_id: 'teacher-a',
    name_key: 'english word'
  });

  const officialName = createHarness({ openid: 'teacher-a', teachers });
  const officialNameResult = await officialName.main({
    action: 'createDraft',
    name: '  人教版英语八年级上册（新版）  '
  });
  assert.strictEqual(officialNameResult.success, false);
  assert.strictEqual(officialNameResult.error, model.ERROR_CODES.INVALID_ARGUMENT);
  assert.strictEqual(officialNameResult.reason, 'OFFICIAL_NAME_RESERVED');
  assert.deepStrictEqual(officialName.state().writes, []);

  const teacherB = createHarness({
    openid: 'teacher-b',
    teachers,
    books: [{
      teacher_id: 'teacher-a',
      name: 'English Word',
      name_key: 'english word',
      status: 'draft'
    }]
  });
  const teacherBResult = await teacherB.main({
    action: 'createDraft',
    name: ' English  Word ',
    teacherId: 'teacher-a',
    teacher_id: 'teacher-a'
  });
  assert.strictEqual(teacherBResult.success, true);
  assert.strictEqual(teacherB.state().writes.length, 1);
  assert.strictEqual(teacherB.state().writes[0].data.teacher_id, 'teacher-b');

  const creator = createHarness({ openid: 'teacher-a', teachers });
  const created = await creator.main({
    action: 'createDraft',
    name: '  高一   拓展词汇  ',
    category: '  高中   拓展  ',
    description: '  适用于高一上学期  ',
    teacherId: 'teacher-b',
    teacher_id: 'teacher-b'
  });
  assert.strictEqual(created.success, true);
  assert.strictEqual(created.schemaVersion, 1);
  assert.strictEqual(creator.state().writes.length, 1);

  const saved = creator.state().writes[0].data;
  assert.deepStrictEqual(Object.keys(saved), [
    'teacher_id',
    'source_type',
    'wordbook_id',
    'name',
    'name_key',
    'category',
    'description',
    'version',
    'current_version_id',
    'current_file_id',
    'total_words',
    'status',
    'schema_version',
    'createdAt',
    'updatedAt'
  ]);
  assert.strictEqual(saved.teacher_id, 'teacher-a');
  assert.strictEqual(saved.source_type, model.SOURCE_TYPE);
  assert.match(saved.wordbook_id, /^twb_[0-9a-f]{24}$/);
  assert.strictEqual(saved.wordbook_id.includes('高一'), false);
  assert.strictEqual(saved.name, '高一 拓展词汇');
  assert.strictEqual(saved.name_key, '高一 拓展词汇');
  assert.strictEqual(saved.category, '高中 拓展');
  assert.strictEqual(saved.description, '适用于高一上学期');
  assert.strictEqual(saved.version, 0);
  assert.strictEqual(saved.current_version_id, '');
  assert.strictEqual(saved.current_file_id, '');
  assert.strictEqual(saved.total_words, 0);
  assert.strictEqual(saved.status, model.TEACHER_WORDBOOK_STATUS.DRAFT);
  assert.strictEqual(saved.schema_version, 1);
  assert.deepStrictEqual(saved.createdAt, { $serverDate: true });
  assert.deepStrictEqual(saved.updatedAt, { $serverDate: true });
  assert.strictEqual(created.book.wordbookId, saved.wordbook_id);
  assert.strictEqual(created.book.title, '高一 拓展词汇');
  assert.strictEqual(created.book.status, 'draft');

  const defaultList = await creator.main({ action: 'list' });
  assert.deepStrictEqual(defaultList.books, []);
  const managementList = await creator.main({ action: 'list', scope: 'manage' });
  assert.deepStrictEqual(
    managementList.books.map((book) => book.wordbookId),
    [saved.wordbook_id]
  );
  const teacherBView = createHarness({
    openid: 'teacher-b',
    teachers,
    books: creator.state().documents
  });
  const teacherBManagementList = await teacherBView.main({ action: 'list', scope: 'manage' });
  assert.deepStrictEqual(teacherBManagementList.books, []);

  const databaseFailure = createHarness({
    openid: 'teacher-a',
    teachers,
    failingCollection: model.COLLECTIONS.TEACHER_WORDBOOKS
  });
  const databaseFailureResult = await databaseFailure.main({
    action: 'createDraft',
    name: 'Database Failure'
  });
  assert.strictEqual(databaseFailureResult.success, false);
  assert.strictEqual(databaseFailureResult.error, model.ERROR_CODES.INTERNAL_ERROR);
  assert.deepStrictEqual(databaseFailure.state().writes, []);

  const functionSource = fs.readFileSync(
    path.resolve(__dirname, '../cloudfunctions/teacherWordbook/index.js'),
    'utf8'
  );
  assert.strictEqual(/event\s*\.\s*teacher(?:Id|_id)/.test(functionSource), false);
  assert.strictEqual((functionSource.match(/\.add\s*\(/g) || []).length, 1);
  const createDraftSource = functionSource.slice(
    functionSource.indexOf('const handleCreateDraft'),
    functionSource.indexOf('const resolveOwnedDraft')
  );
  assert.strictEqual(/\.(?:set|update|remove|uploadFile)\s*\(/.test(createDraftSource), false);

  const pageSource = fs.readFileSync(
    path.resolve(__dirname, '../subpages/wordbook-create/wordbook-create.js'),
    'utf8'
  );
  assert.strictEqual(/teacher(?:Id|_id)\s*:/.test(pageSource), false);
  assert.strictEqual(pageSource.includes("action: 'createDraft'"), true);
  assert.strictEqual(/\.add\s*\(/.test(pageSource), false);

  console.log('teacher-wordbook-create-draft: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
