'use strict';

const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');

const model = require('../cloudfunctions/teacherWordbook/model.js');

const createHarness = ({ openid = '', teacherOpenids = [], queryError = null } = {}) => {
  let callerOpenid = openid;
  let queryCount = 0;
  let writeCount = 0;
  let lastCollection = null;
  let lastWhere = null;
  let lastLimit = null;

  const writeBlocked = () => {
    writeCount += 1;
    throw new Error('write_operation_forbidden');
  };
  const collection = {
    add: writeBlocked,
    where: (criteria) => {
      queryCount += 1;
      lastWhere = criteria;
      return {
        limit: (value) => {
          lastLimit = value;
          return {
            get: async () => {
              if (queryError) throw queryError;
              return {
                data: teacherOpenids.includes(criteria.teacher_id)
                  ? [{ teacher_id: criteria.teacher_id, status: 'active' }]
                  : []
              };
            }
          };
        }
      };
    },
    doc: () => ({
      set: writeBlocked,
      update: writeBlocked,
      remove: writeBlocked
    })
  };
  const cloudMock = {
    DYNAMIC_CURRENT_ENV: 'test-env',
    init: () => {},
    database: () => ({
      collection: (name) => {
        lastCollection = name;
        return collection;
      }
    }),
    getWXContext: () => ({ OPENID: callerOpenid })
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
      queryCount,
      writeCount,
      lastCollection,
      lastWhere,
      lastLimit
    })
  };
};

(async () => {
  assert.deepStrictEqual(model.COLLECTIONS, {
    TEACHER_WORDBOOKS: 'teacher_wordbooks',
    TEACHER_WORDBOOK_VERSIONS: 'teacher_wordbook_versions'
  });
  assert.deepStrictEqual(model.TEACHER_WORDBOOK_STATUS, {
    DRAFT: 'draft',
    ACTIVE: 'active',
    DISABLED: 'disabled'
  });
  assert.deepStrictEqual(model.TEACHER_WORDBOOK_VERSION_STATUS, {
    PUBLISHED: 'published'
  });
  assert.strictEqual(model.SOURCE_TYPE, 'teacher_custom');
  assert.strictEqual(model.SCHEMA_VERSION, 1);
  assert.deepStrictEqual(model.ERROR_CODES, {
    UNAUTHORIZED: 'UNAUTHORIZED',
    TEACHER_NOT_FOUND: 'TEACHER_NOT_FOUND',
    INVALID_ACTION: 'INVALID_ACTION',
    INVALID_ARGUMENT: 'INVALID_ARGUMENT',
    VERSION_CONFLICT: 'VERSION_CONFLICT',
    INTERNAL_ERROR: 'INTERNAL_ERROR'
  });

  const noIdentity = createHarness();
  const noIdentityResult = await noIdentity.main({
    action: 'health',
    teacherId: 'forged-teacher'
  });
  assert.strictEqual(noIdentityResult.success, false);
  assert.strictEqual(noIdentityResult.error, model.ERROR_CODES.UNAUTHORIZED);
  assert.strictEqual(noIdentityResult.authenticated, false);
  assert.strictEqual(noIdentityResult.isTeacher, false);
  assert.strictEqual(noIdentity.state().queryCount, 0);
  assert.strictEqual(noIdentity.state().writeCount, 0);

  const unregistered = createHarness({
    openid: 'caller-not-registered',
    teacherOpenids: ['forged-teacher']
  });
  const forgedResult = await unregistered.main({
    action: 'health',
    teacherId: 'forged-teacher',
    teacher_id: 'forged-teacher'
  });
  assert.strictEqual(forgedResult.success, false);
  assert.strictEqual(forgedResult.error, model.ERROR_CODES.TEACHER_NOT_FOUND);
  assert.strictEqual(forgedResult.authenticated, true);
  assert.strictEqual(forgedResult.isTeacher, false);
  assert.deepStrictEqual(unregistered.state().lastWhere, {
    teacher_id: 'caller-not-registered'
  });
  assert.strictEqual(unregistered.state().lastCollection, 'teachers');
  assert.strictEqual(unregistered.state().lastLimit, 1);
  assert.strictEqual(unregistered.state().writeCount, 0);

  const registered = createHarness({
    openid: 'registered-teacher',
    teacherOpenids: ['registered-teacher']
  });
  const registeredResult = await registered.main({
    action: 'health',
    teacherId: 'another-teacher'
  });
  assert.deepStrictEqual(registeredResult, {
    success: true,
    schemaVersion: 1,
    authenticated: true,
    isTeacher: true
  });
  assert.deepStrictEqual(registered.state().lastWhere, {
    teacher_id: 'registered-teacher'
  });
  assert.strictEqual(registered.state().writeCount, 0);

  const capabilitiesHarness = createHarness();
  const capabilities = await capabilitiesHarness.main({ action: 'capabilities' });
  assert.deepStrictEqual(capabilities, {
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
  assert.strictEqual(capabilitiesHarness.state().queryCount, 0);
  assert.strictEqual(capabilitiesHarness.state().writeCount, 0);

  const unknownHarness = createHarness({ openid: 'registered-teacher' });
  for (const action of ['upload', 'unknown']) {
    const unknown = await unknownHarness.main({ action });
    assert.strictEqual(unknown.success, false);
    assert.strictEqual(unknown.error, model.ERROR_CODES.INVALID_ACTION);
  }
  assert.strictEqual(unknownHarness.state().queryCount, 0);
  assert.strictEqual(unknownHarness.state().writeCount, 0);

  const queryFailure = createHarness({
    openid: 'registered-teacher',
    queryError: new Error('read_failed')
  });
  const queryFailureResult = await queryFailure.main({ action: 'health' });
  assert.strictEqual(queryFailureResult.success, false);
  assert.strictEqual(queryFailureResult.error, model.ERROR_CODES.INTERNAL_ERROR);
  assert.strictEqual(queryFailure.state().writeCount, 0);

  const functionSource = [
    '../cloudfunctions/teacherWordbook/index.js',
    '../cloudfunctions/teacherWordbook/model.js'
  ].map((relativePath) => fs.readFileSync(
    path.resolve(__dirname, relativePath),
    'utf8'
  )).join('\n');
  assert.strictEqual(/\.remove\s*\(/.test(functionSource), false);
  assert.strictEqual((functionSource.match(/\.add\s*\(/g) || []).length, 1);
  assert.strictEqual(/event\s*\.\s*teacher(?:Id|_id)/.test(functionSource), false);
  assert.strictEqual(/['"]wordbooks\//.test(functionSource), false);

  const packageJson = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, '../cloudfunctions/teacherWordbook/package.json'),
    'utf8'
  ));
  assert.strictEqual(packageJson.main, 'index.js');
  assert.strictEqual(packageJson.dependencies.exceljs, '4.4.0');
  assert.strictEqual(packageJson.dependencies['wx-server-sdk'], '^2.7.2');

  console.log('teacher-wordbook-foundation: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
