'use strict';

const assert = require('assert');

const clone = (value) => (
  value === undefined ? undefined : JSON.parse(JSON.stringify(value))
);

const makeRuntime = (initialStorage, options = {}) => {
  const storage = clone(initialStorage || {});
  const files = {};
  let failBusinessWriteOnce = !!options.failBusinessWriteOnce;

  global.wx = {
    env: { USER_DATA_PATH: '/user-data' },
    getStorageSync: (key) => clone(storage[key]),
    setStorageSync: (key, value) => {
      if (failBusinessWriteOnce && key === 'learningRecords') {
        failBusinessWriteOnce = false;
        throw new Error('simulated_business_write_failure');
      }
      storage[key] = clone(value);
    },
    removeStorageSync: (key) => { delete storage[key]; },
    getStorageInfoSync: () => ({ keys: Object.keys(storage) }),
    getFileSystemManager: () => ({
      writeFileSync: (path, content) => {
        if (options.failSnapshotWrite) throw new Error('simulated_snapshot_failure');
        files[path] = String(content);
      },
      readFileSync: (path) => {
        if (!Object.prototype.hasOwnProperty.call(files, path)) throw new Error('file_not_found');
        return files[path];
      }
    })
  };
  return { storage, files };
};

const loadMigration = () => {
  delete require.cache[require.resolve('../utils/data-backup-service.js')];
  delete require.cache[require.resolve('../utils/data-migration.js')];
  return require('../utils/data-migration.js');
};

{
  const runtime = makeRuntime({
    openid: 'teacher-a',
    students: [{ id: 'student-a', teacher_id: 'teacher-a' }],
    learningRecords: [{ id: 'record-a', studentId: 'student-a', date: 1785580000000 }],
    learningProgress: { 'student-a': { wordbooks: {} } },
    wordMastery: {
      'student-a': {
        'book-a': ['alpha', 'alpha', { wordId: 'beta', mastered: true, customField: 'keep' }]
      }
    },
    pendingWordMasterySync: { alpha: { studentId: 'student-a' } },
    previewWordOrder_student_a_book_a: ['alpha', 'beta']
  });
  const migration = loadMigration();
  const result = migration.initializeDataVersion();
  assert.strictEqual(result.upgraded, true);
  assert.strictEqual(result.oldVersion, 'legacy-unversioned');
  assert.strictEqual(runtime.storage.dataVersion, migration.CURRENT_DATA_VERSION);
  assert.strictEqual(runtime.storage.upgradeProtectionState.status, 'complete');
  assert.strictEqual(Object.keys(runtime.storage.wordMastery['student-a']['book-a']).length, 2);
  assert.strictEqual(runtime.storage.wordMastery['student-a']['book-a'].beta.mastered, true);
  assert.strictEqual(runtime.storage.wordMastery['student-a']['book-a'].beta.customField, 'keep');
  assert.strictEqual(runtime.storage.learningRecords[0].date, '2026-08-01');
  assert.deepStrictEqual(runtime.storage.pendingWordMasterySync, {
    alpha: { studentId: 'student-a' }
  });
  assert.deepStrictEqual(runtime.storage.previewWordOrder_student_a_book_a, ['alpha', 'beta']);
  assert.strictEqual(runtime.storage.wordMasterBackupIndex.length, 1);
  assert.strictEqual(Object.keys(runtime.files).length, 1);
}

{
  const original = {
    openid: 'teacher-a',
    dataVersion: '1.0.0',
    students: [{ id: 'student-foreign', teacher_id: 'teacher-b' }],
    learningRecords: [],
    wordMastery: {}
  };
  const runtime = makeRuntime(original);
  const migration = loadMigration();
  const result = migration.initializeDataVersion();
  assert.strictEqual(result.error, true);
  assert.strictEqual(result.blocked, true);
  assert.match(result.message, /backup_contains_foreign_owner/);
  assert.strictEqual(runtime.storage.dataVersion, '1.0.0');
  assert.deepStrictEqual(runtime.storage.students, original.students);
  assert.strictEqual(runtime.storage.wordMasterBackupIndex.length, 1);
}

{
  const runtime = makeRuntime({});
  const migration = loadMigration();
  const result = migration.initializeDataVersion();
  assert.strictEqual(result.isFirstRun, true);
  assert.strictEqual(runtime.storage.dataVersion, migration.CURRENT_DATA_VERSION);
  assert.strictEqual(Object.keys(runtime.files).length, 0);
}

{
  const original = {
    openid: 'teacher-a',
    students: [{ id: 'student-a', teacher_id: 'teacher-a' }],
    learningRecords: [{ id: 'record-a', date: 1785580000000 }],
    wordMastery: { 'student-a': { 'book-a': ['alpha'] } }
  };
  const runtime = makeRuntime(original, { failSnapshotWrite: true });
  const migration = loadMigration();
  const result = migration.initializeDataVersion();
  assert.strictEqual(result.error, true);
  assert.strictEqual(result.blocked, true);
  assert.strictEqual(runtime.storage.dataVersion, undefined);
  assert.deepStrictEqual(runtime.storage.students, original.students);
  assert.deepStrictEqual(runtime.storage.wordMastery, original.wordMastery);
  assert.strictEqual(runtime.storage.upgradeProtectionState.status, 'blocked');
}

{
  const original = {
    openid: 'teacher-a',
    dataVersion: '1.0.0',
    students: [{ id: 'student-a', teacher_id: 'teacher-a' }],
    learningRecords: [{ id: 'record-a', date: 1785580000000 }],
    wordMastery: { 'student-a': { 'book-a': ['alpha', 'beta'] } }
  };
  const runtime = makeRuntime(original, { failBusinessWriteOnce: true });
  const migration = loadMigration();
  const result = migration.initializeDataVersion();
  assert.strictEqual(result.error, true);
  assert.strictEqual(result.blocked, true);
  assert.strictEqual(result.rollbackSucceeded, true);
  assert.strictEqual(runtime.storage.dataVersion, '1.0.0');
  assert.deepStrictEqual(runtime.storage.learningRecords, original.learningRecords);
  assert.deepStrictEqual(runtime.storage.wordMastery, original.wordMastery);
}

process.stdout.write('data-migration-protection: PASS\n');
