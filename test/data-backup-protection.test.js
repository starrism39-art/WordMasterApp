'use strict';

const assert = require('assert');

const clone = (value) => (
  value === undefined ? undefined : JSON.parse(JSON.stringify(value))
);

const storage = {
  openid: 'teacher-a',
  dataVersion: '1.0.0',
  students: [{ id: 'student-a', teacher_id: 'teacher-a', name: 'A' }],
  wordbooks: [{ id: 'book-a', name: 'Book A' }],
  learningRecords: [{ id: 'record-a', studentId: 'student-a', wordbookId: 'book-a' }],
  learningProgress: { 'student-a': { wordbooks: { 'book-a': { learnedWords: 1 } } } },
  wordMastery: { 'student-a': { 'book-a': { alpha: { mastered: true } } } },
  antiForgettingRecords: [{ id: 'review-a', studentId: 'student-a', wordId: 'alpha' }],
  currentStudent: { id: 'student-a' },
  currentWordbook: { id: 'book-a' },
  selectedStudent: { id: 'student-a' },
  selectedWordbook: { id: 'book-a' },
  currentWordbookStudentId: 'student-a',
  previewMastery_student_a_book_a: { alpha: false },
  previewWordOrder_student_a_book_a: ['alpha'],
  previewExcludedWordIds_student_a_book_a: ['alpha'],
  reviewMastery_student_a_book_a: { alpha: true },
  gridMastery_student_a_book_a: { alpha: true },
  'student-a_stats': { masteredCount: 1 },
  students_safety_backup_latest: {
    timestamp: '2026-07-31T00:00:00.000Z',
    students: [{ id: 'student-a', teacher_id: 'teacher-a' }]
  },
  pendingWordMasterySync: { alpha: { studentId: 'student-a' } },
  pendingLearningRecordSync: { 'record-a': { studentId: 'student-a' } },
  pendingLearningProgressSync: { 'student-a': { studentId: 'student-a' } },
  pendingPreviewStateSync: { 'student-a_book-a': { studentId: 'student-a' } },
  pendingSyncProgress: { pending: 4 },
  cloudMigrationStateByOpenId: { 'teacher-a': { completed: true } }
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

const service = require('../utils/data-backup-service.js');

const envelope = service.createBackupEnvelope({
  sourceDataVersion: '1.0.0',
  targetDataVersion: '2.0.0',
  reason: 'test-upgrade'
});

assert.strictEqual(envelope.ownerId, 'teacher-a');
assert.strictEqual(service.verifyBackupEnvelope(envelope).ok, true);
assert.deepStrictEqual(envelope.data.students, storage.students);
assert.deepStrictEqual(envelope.data.antiForgettingRecords, storage.antiForgettingRecords);
assert.deepStrictEqual(envelope.data.previewWordOrder_student_a_book_a, ['alpha']);
assert.deepStrictEqual(envelope.data.previewExcludedWordIds_student_a_book_a, ['alpha']);
assert.deepStrictEqual(envelope.data['student-a_stats'], { masteredCount: 1 });
assert.deepStrictEqual(
  envelope.data.students_safety_backup_latest.students,
  [{ id: 'student-a', teacher_id: 'teacher-a' }]
);
assert.deepStrictEqual(envelope.data.pendingPreviewStateSync, storage.pendingPreviewStateSync);
assert.ok(envelope.manifest.keys.includes('pendingWordMasterySync'));
assert.strictEqual(envelope.manifest.counts.students, 1);
assert.strictEqual(envelope.manifest.counts.learningRecords, 1);
assert.strictEqual(envelope.manifest.counts.wordMasteryWords, 1);

const persisted = service.persistVerifiedSnapshot(envelope);
assert.ok(persisted.path.startsWith('/user-data/wordmaster-upgrade-'));
assert.strictEqual(service.verifyBackupEnvelope(persisted.envelope).ok, true);
assert.strictEqual(storage.wordMasterBackupIndex.length, 1);

const tampered = clone(envelope);
tampered.data.students.push({ id: 'tampered' });
assert.strictEqual(service.verifyBackupEnvelope(tampered).ok, false);

const wrongSchema = clone(envelope);
wrongSchema.schemaVersion = 999;
assert.strictEqual(service.verifyBackupEnvelope(wrongSchema).ok, false);

const wrongManifest = clone(envelope);
wrongManifest.manifest.counts.students = 999;
assert.strictEqual(service.verifyBackupEnvelope(wrongManifest).ok, false);

const legacyRaw = {
  students: [{ id: 'legacy-student' }],
  learningRecords: [],
  wordMastery: {}
};
const normalizedRaw = service.normalizeBackupEnvelope(legacyRaw, { currentOwnerId: 'teacher-a' });
assert.deepStrictEqual(normalizedRaw.data.students, legacyRaw.students);
assert.strictEqual(normalizedRaw.legacy, true);

const historicalExportWrapper = {
  exportTime: '2026-08-01T00:00:00.000Z',
  version: '1.0.0',
  data: legacyRaw
};
const normalizedWrapper = service.normalizeBackupEnvelope(historicalExportWrapper, {
  currentOwnerId: 'teacher-a'
});
assert.deepStrictEqual(normalizedWrapper.data.students, legacyRaw.students);

assert.throws(
  () => service.assertBackupOwnerCompatible({ ...envelope, ownerId: 'teacher-b' }, 'teacher-a'),
  /backup_owner_mismatch/
);

const foreignPayload = clone(envelope);
foreignPayload.data.learningRecords.push({
  id: 'foreign-record',
  studentId: 'foreign-student',
  teacher_id: 'teacher-b'
});
foreignPayload.checksum = service.calculatePayloadChecksum(foreignPayload.data);
assert.throws(
  () => service.assertBackupOwnerCompatible(foreignPayload, 'teacher-a'),
  /backup_contains_foreign_owner/
);

const foreignSafetyBackup = clone(envelope);
foreignSafetyBackup.data.students_safety_backup_latest.students[0].teacher_id = 'teacher-b';
foreignSafetyBackup.checksum = service.calculatePayloadChecksum(foreignSafetyBackup.data);
foreignSafetyBackup.manifest = service.buildManifest(foreignSafetyBackup.data);
assert.throws(
  () => service.assertBackupOwnerCompatible(foreignSafetyBackup, 'teacher-a'),
  /backup_contains_foreign_owner/
);

process.stdout.write('data-backup-protection: PASS\n');
