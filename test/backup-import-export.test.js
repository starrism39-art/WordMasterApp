'use strict';

const assert = require('assert');

const clone = (value) => (
  value === undefined ? undefined : JSON.parse(JSON.stringify(value))
);

const storage = {
  openid: 'teacher-a',
  dataVersion: '2.0.0',
  students: [{ id: 'student-a', teacher_id: 'teacher-a' }],
  learningRecords: [{ id: 'record-a', studentId: 'student-a', teacher_id: 'teacher-a' }],
  learningProgress: { 'student-a': { wordbooks: { 'book-a': { learnedWords: 1 } } } },
  wordMastery: { 'student-a': { 'book-a': { alpha: { mastered: true } } } },
  antiForgettingRecords: [{ id: 'review-a', studentId: 'student-a', wordId: 'alpha' }],
  previewMastery_student_a_book_a: { alpha: false },
  'student-a_stats': { masteredCount: 1 },
  pendingLearningRecordSync: { 'record-a': { studentId: 'student-a' } }
};
const files = {};

global.wx = {
  env: { USER_DATA_PATH: '/user-data' },
  getStorageSync: (key) => clone(storage[key]),
  setStorageSync: (key, value) => { storage[key] = clone(value); },
  removeStorageSync: (key) => { delete storage[key]; },
  getStorageInfoSync: () => ({ keys: Object.keys(storage) }),
  getFileSystemManager: () => ({
    writeFileSync: (path, content) => { files[path] = String(content); },
    readFileSync: (path) => {
      if (!Object.prototype.hasOwnProperty.call(files, path)) throw new Error('file_not_found');
      return files[path];
    }
  })
};

const migration = require('../utils/data-migration.js');
const exported = migration.exportAllData();
assert.strictEqual(exported.format, 'wordmaster-backup');
assert.strictEqual(exported.ownerId, 'teacher-a');
assert.ok(exported.data);
assert.deepStrictEqual(exported.data.antiForgettingRecords, storage.antiForgettingRecords);
assert.deepStrictEqual(exported.data.pendingLearningRecordSync, storage.pendingLearningRecordSync);
assert.deepStrictEqual(exported.data['student-a_stats'], { masteredCount: 1 });

['students', 'learningRecords', 'learningProgress', 'wordMastery', 'antiForgettingRecords',
  'previewMastery_student_a_book_a', 'student-a_stats', 'pendingLearningRecordSync'].forEach((key) => {
  delete storage[key];
});

const restored = migration.importBackupData(exported, { currentOwnerId: 'teacher-a' });
assert.strictEqual(restored.ok, true);
assert.strictEqual(storage.students.length, 1);
assert.strictEqual(storage.learningRecords.length, 1);
assert.strictEqual(Object.keys(storage.wordMastery['student-a']['book-a']).length, 1);
assert.deepStrictEqual(storage.previewMastery_student_a_book_a, { alpha: false });
assert.deepStrictEqual(storage['student-a_stats'], { masteredCount: 1 });

const beforeForeignImport = clone(storage);
const foreign = clone(exported);
foreign.ownerId = 'teacher-b';
assert.throws(
  () => migration.importBackupData(foreign, { currentOwnerId: 'teacher-a' }),
  /backup_owner_mismatch/
);
assert.deepStrictEqual(storage, beforeForeignImport);

const legacyRaw = {
  students: [{ id: 'student-legacy' }],
  learningRecords: [{ id: 'record-legacy', studentId: 'student-legacy' }],
  learningProgress: {},
  wordMastery: {}
};
const legacyResult = migration.importBackupData(legacyRaw, {
  currentOwnerId: 'teacher-a',
  allowUnownedLegacy: true
});
assert.strictEqual(legacyResult.ok, true);
assert.ok(storage.students.some((student) => student.id === 'student-legacy'));

process.stdout.write('backup-import-export: PASS\n');
