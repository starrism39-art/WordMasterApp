'use strict';

const assert = require('assert');

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const repository = require('../utils/wordbook-repository.js');
const cloudWordbookLoader = require('../utils/cloud-wordbook-loader.js');
const routeResolver = require('../utils/learning-wordbook-route.js');

const officialBook = {
  id: 'official-route-book',
  wordbookId: 'official-route-book',
  title: 'Official Route Book',
  sourceType: 'official',
  status: 'active',
  category: 'senior',
  totalWords: 10
};

const teacherBook = (id, status) => ({
  id,
  wordbookId: id,
  title: `${status} teacher book`,
  sourceType: 'teacher_custom',
  status,
  category: 'senior',
  version: status === 'draft' ? 0 : 4,
  totalWords: status === 'draft' ? 0 : 100
});

const teacherBooks = [
  teacherBook('twb_route_active', 'active'),
  teacherBook('twb_route_disabled', 'disabled'),
  teacherBook('twb_route_draft', 'draft')
];

const originalGetOfficialWordbooks = repository.getOfficialWordbooks;
const originalGetTeacherWordbooks = repository.getTeacherWordbooks;
const originalIsCloudWordbook = cloudWordbookLoader.isCloudWordbook;
const originalEnsureWordsLoaded = cloudWordbookLoader.ensureWordsLoaded;

repository.getOfficialWordbooks = () => [clone(officialBook)];
repository.getTeacherWordbooks = async (options) => {
  assert.deepStrictEqual(options, { scope: 'manage' });
  return clone(teacherBooks);
};

let officialLoaderCalls = 0;
cloudWordbookLoader.isCloudWordbook = () => {
  officialLoaderCalls += 1;
  return false;
};
cloudWordbookLoader.ensureWordsLoaded = async () => {
  officialLoaderCalls += 1;
  throw new Error('official loader must not run for rejected teacher routes');
};

let pageDefinition;
global.Page = (definition) => { pageDefinition = definition; };

const pageModulePath = require.resolve('../pages/learning/learning.js');
delete require.cache[pageModulePath];
require(pageModulePath);

const createHarness = () => {
  const storage = {
    learningRecords: [{ id: 'existing-record' }],
    learningProgress: { student_route: { wordbooks: { old: { completedCount: 1 } } } },
    wordMastery: { student_route: { old: { old_word: { mastered: true } } } }
  };
  const currentStudent = { id: 'student_route', name: 'Route Student' };
  const currentOfficial = clone(officialBook);
  const app = {
    globalData: {
      currentStudent,
      currentWordbook: currentOfficial,
      selectedWordbook: currentOfficial,
      currentWordbookStudentId: currentStudent.id
    }
  };
  global.getApp = () => app;
  global.wx = {
    getStorageSync: (key) => clone(storage[key]),
    setStorageSync: (key, value) => { storage[key] = clone(value); },
    showToast: () => {},
    setNavigationBarTitle: () => {}
  };

  const page = Object.assign({}, pageDefinition);
  page.data = clone(pageDefinition.data);
  page.setData = function setData(patch) {
    this.data = { ...this.data, ...clone(patch) };
  };
  let initCalls = 0;
  page.initStudyProcess = () => {
    initCalls += 1;
    return Promise.resolve();
  };
  return {
    page,
    app,
    storage,
    getInitCalls: () => initCalls,
    learningSnapshot: () => clone({
      learningRecords: storage.learningRecords,
      learningProgress: storage.learningProgress,
      wordMastery: storage.wordMastery
    })
  };
};

const expectRejectedTeacherRoute = async (wordbookId, expectedMessage) => {
  const harness = createHarness();
  const before = harness.learningSnapshot();
  const loaderCallsBefore = officialLoaderCalls;

  await harness.page.onLoad({ wordbookId });
  harness.page.onShow();

  assert.strictEqual(harness.page.data.hasError, true);
  assert.strictEqual(harness.page.data.errorMessage, expectedMessage);
  assert.strictEqual(harness.page.data.currentWordbook, null);
  assert.deepStrictEqual(harness.page.data.allWords, []);
  assert.deepStrictEqual(harness.page.data.currentBatchWords, []);
  assert.strictEqual(harness.getInitCalls(), 0, 'rejected explicit route must not initialize study');
  assert.strictEqual(officialLoaderCalls, loaderCallsBefore, 'rejected teacher route must not touch official loader');
  assert.deepStrictEqual(harness.learningSnapshot(), before, 'rejected route must not mutate learning data');
  assert.strictEqual(harness.app.globalData.currentWordbook.id, officialBook.id, 'failure must not replace global current book');

  await harness.page.retryLoad();
  assert.strictEqual(harness.page.data.hasError, true, 'retry must re-run the explicit route gate');
  assert.strictEqual(harness.page.data.errorMessage, expectedMessage);
  assert.strictEqual(harness.getInitCalls(), 0, 'retrying a rejected route must not initialize study');
  assert.strictEqual(officialLoaderCalls, loaderCallsBefore, 'retry must not touch official loader');
  assert.deepStrictEqual(harness.learningSnapshot(), before, 'retry must not mutate learning data');
};

(async () => {
  assert.strictEqual(
    (await routeResolver.resolveExplicitWordbook('twb_route_active', repository)).id,
    'twb_route_active'
  );
  await assert.rejects(
    routeResolver.resolveExplicitWordbook('twb_route_disabled', repository),
    (error) => error.code === 'TEACHER_WORDBOOK_DISABLED'
  );
  await assert.rejects(
    routeResolver.resolveExplicitWordbook('twb_route_draft', repository),
    (error) => error.code === 'TEACHER_WORDBOOK_DRAFT'
  );
  await assert.rejects(
    routeResolver.resolveExplicitWordbook('twb_route_missing', repository),
    (error) => error.code === 'TEACHER_WORDBOOK_NOT_FOUND'
  );

  {
    const harness = createHarness();
    await harness.page.onLoad({ wordbookId: 'twb_route_active' });
    assert.strictEqual(harness.page.data.currentWordbook.id, 'twb_route_active');
    assert.strictEqual(harness.page.data.currentWordbook.sourceType, 'teacher_custom');
    assert.strictEqual(harness.page.data.hasError, false);
    assert.strictEqual(harness.getInitCalls(), 1);
  }

  await expectRejectedTeacherRoute('twb_route_disabled', '词书已停用，当前不可学习');
  await expectRejectedTeacherRoute('twb_route_draft', '词书尚未发布，当前不可学习');
  await expectRejectedTeacherRoute('twb_route_missing', '教师词书不存在或无权访问，当前不可学习');

  {
    const harness = createHarness();
    await harness.page.onLoad({ wordbookId: officialBook.id });
    assert.strictEqual(harness.page.data.currentWordbook.id, officialBook.id);
    assert.strictEqual(harness.page.data.currentWordbook.sourceType, 'official');
    assert.strictEqual(harness.getInitCalls(), 1);
  }

  {
    const harness = createHarness();
    harness.page.onLoad({});
    assert.strictEqual(harness.page.data.currentWordbook.id, officialBook.id);
    assert.strictEqual(harness.getInitCalls(), 1);
  }

  process.stdout.write('learning-explicit-wordbook-route: PASS\n');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  repository.getOfficialWordbooks = originalGetOfficialWordbooks;
  repository.getTeacherWordbooks = originalGetTeacherWordbooks;
  cloudWordbookLoader.isCloudWordbook = originalIsCloudWordbook;
  cloudWordbookLoader.ensureWordsLoaded = originalEnsureWordsLoaded;
});
