'use strict';

const assert = require('assert');
const Module = require('module');

const ACCOUNT_A = 'stage1c-account-a';
const ACCOUNT_B = 'stage1c-account-b';
const STUDENT_A = 'stage1c-student-a';
const STUDENT_B = 'stage1c-student-b';
const BOOK_A = 'stage1c-book-a';
const BOOK_B = 'stage1c-book-b';
const RECORD_X = 'stage1c-deleted-record-x';
const clone = (value) => JSON.parse(JSON.stringify(value));

const storage = {
  openid: ACCOUNT_A,
  currentUser: { id: ACCOUNT_A, username: ACCOUNT_A },
  students: [],
  learningRecords: [],
  learningProgress: {},
  wordMastery: {}
};
const app = {
  globalData: { cloudReadOnly: false, currentUser: storage.currentUser },
  ensureUserPermissions: (user) => user,
  emit: () => {}
};

const cloudRecords = new Map();
const cloudStudents = new Map();
const cloudProgress = new Map();
const cloudMastery = new Map();
const tombstonesByOwner = new Map();
const authorityCalls = [];
let cloudWritable = true;
let failTombstoneWrite = false;
let failRawCleanup = false;

const entityKey = (entityType, entityId) => `${entityType}::${entityId}`;
const ownerTombstones = (owner = storage.openid) => {
  if (!tombstonesByOwner.has(owner)) tombstonesByOwner.set(owner, new Map());
  return tombstonesByOwner.get(owner);
};
const logicalId = (value, type) => String(type === 'student'
  ? value && (value.student_id || value.id || value._id) || ''
  : value && (value.id || value.recordId || value.record_id || value._id) || '');
const ownerId = (value) => String(value && (value.teacher_id || value._openid) || '');

const putRecord = (record, owner = storage.openid) => {
  const id = String(record.id);
  const docId = `${owner}__record__${id}`;
  cloudRecords.set(docId, { _id: docId, _openid: owner, teacher_id: owner, ...clone(record) });
  return docId;
};
const putStudent = (student, owner = storage.openid) => {
  const id = String(student.student_id || student.id);
  cloudStudents.set(id, { _id: id, _openid: owner, teacher_id: owner, student_id: id, id, ...clone(student) });
};
const hasCloudRecord = (recordId, owner = storage.openid) => Array.from(cloudRecords.values()).some(
  (record) => ownerId(record) === owner && logicalId(record, 'record') === String(recordId)
);
const hasCloudStudent = (studentId, owner = storage.openid) => Array.from(cloudStudents.values()).some(
  (student) => ownerId(student) === owner && logicalId(student, 'student') === String(studentId)
);

const listCollection = (name) => {
  if (name === 'teachers') {
    return [{
      _id: `teacher-${storage.openid}`,
      teacher_id: storage.openid,
      userRole: 'external',
      memberLevel: 'free'
    }];
  }
  if (name === 'students') return Array.from(cloudStudents.values()).map(clone);
  if (name === 'learning_records') return Array.from(cloudRecords.values()).map(clone);
  if (name === 'learning_progress') return Array.from(cloudProgress.values()).map(clone);
  if (name === 'word_mastery') return Array.from(cloudMastery.values()).map(clone);
  return [];
};

const createQuery = (name, source, condition = {}) => {
  let items = source.filter((item) => Object.keys(condition).every((key) => item[key] === condition[key]));
  let offset = 0;
  let pageSize = 20;
  const query = {
    count: async () => ({ total: items.length }),
    orderBy(field, direction) {
      items = items.slice().sort((left, right) => {
        const l = String(left[field] || '');
        const r = String(right[field] || '');
        return direction === 'desc' ? r.localeCompare(l) : l.localeCompare(r);
      });
      return query;
    },
    skip(value) { offset = Number(value) || 0; return query; },
    limit(value) { pageSize = Number(value) || 20; return query; },
    get: async () => ({ data: items.slice(offset, offset + pageSize).map(clone) }),
    remove: async () => {
      let removed = 0;
      const map = name === 'learning_records' ? cloudRecords : cloudStudents;
      for (const [key, value] of map.entries()) {
        if (items.some((item) => item._id === value._id)) {
          map.delete(key);
          removed += 1;
        }
      }
      return { stats: { removed } };
    }
  };
  return query;
};

const collectionMap = (name) => {
  if (name === 'learning_records') return cloudRecords;
  if (name === 'students') return cloudStudents;
  if (name === 'learning_progress') return cloudProgress;
  if (name === 'word_mastery') return cloudMastery;
  return null;
};

const db = {
  collection(name) {
    return {
      where(condition) {
        return createQuery(name, listCollection(name), condition || {});
      },
      doc(docId) {
        return {
          get: async () => {
            const document = listCollection(name).find((item) => item._id === docId);
            if (document) return { data: clone(document) };
            throw { errCode: -1, errMsg: 'document not found' };
          },
          set: async ({ data }) => {
            if (!cloudWritable) throw new Error('network unavailable');
            const map = collectionMap(name);
            if (!map) throw new Error(`unexpected write to ${name}`);
            map.set(docId, { _id: docId, _openid: storage.openid, ...clone(data) });
            return { ok: true };
          },
          update: async ({ data }) => {
            const map = collectionMap(name);
            const current = map && map.get(docId);
            if (!current) return { updated: 0 };
            map.set(docId, { ...current, ...clone(data) });
            return { updated: 1 };
          },
          remove: async () => {
            const map = collectionMap(name);
            const removed = map && map.delete(docId) ? 1 : 0;
            return { stats: { removed } };
          }
        };
      },
      add: async ({ data }) => ({ _id: `added-${name}`, data })
    };
  }
};

const callTombstoneAuthority = async ({ name, data }) => {
  assert.strictEqual(name, 'syncTombstoneAuthority');
  const owner = storage.openid;
  authorityCalls.push({ owner, data: clone(data) });
  if (data.action === 'list') {
    const requested = Array.isArray(data.entities)
      ? new Set(data.entities.map((entity) => entityKey(entity.entityType, entity.entityId)))
      : null;
    const tombstones = Array.from(ownerTombstones(owner).values())
      .filter((tombstone) => !requested || requested.has(entityKey(tombstone.entityType, tombstone.entityId)))
      .map(clone);
    return { result: { success: true, tombstones } };
  }
  if (data.action !== 'deleteEntity') {
    return { result: { success: false, error: 'unsupported_action' } };
  }
  if (failTombstoneWrite) {
    return { result: { success: false, error: 'forced_tombstone_write_failure', phase: 'tombstone' } };
  }
  const key = entityKey(data.entityType, data.entityId);
  const existed = ownerTombstones(owner).has(key);
  ownerTombstones(owner).set(key, {
    entityType: data.entityType,
    entityId: String(data.entityId),
    ...(data.studentId ? { studentId: String(data.studentId) } : {}),
    ...(data.wordbookId ? { wordbookId: String(data.wordbookId) } : {}),
    deletedAt: 1788230000000,
    schemaVersion: 1
  });
  if (failRawCleanup) {
    return { result: { success: true, tombstoneCreated: true, tombstoneExisted: existed, removed: 0, cleanupPending: true } };
  }
  let removed = 0;
  if (data.entityType === 'learning_record') {
    for (const [docId, record] of cloudRecords.entries()) {
      if (ownerId(record) === owner && logicalId(record, 'record') === String(data.entityId)) {
        cloudRecords.delete(docId);
        removed += 1;
      }
    }
  } else if (data.entityType === 'student') {
    for (const [docId, student] of cloudStudents.entries()) {
      if (ownerId(student) === owner && logicalId(student, 'student') === String(data.entityId)) {
        cloudStudents.delete(docId);
        removed += 1;
      }
    }
  }
  return { result: { success: true, tombstoneCreated: true, tombstoneExisted: existed, removed, cleanupPending: false } };
};

global.wx = {
  cloud: { init: () => {}, database: () => db, callFunction: callTombstoneAuthority },
  getDeviceInfo: () => ({ platform: 'android' }),
  getLaunchOptionsSync: () => ({ query: {} }),
  getStorageSync: (key) => storage[key],
  setStorageSync: (key, value) => { storage[key] = value; },
  removeStorageSync: (key) => { delete storage[key]; },
  showToast: () => {}
};
global.getApp = () => app;

const {
  buildScopedDocId,
  discardLearningRecordAfterTombstone,
  retryPendingSyncs,
  syncAllLocalLearningRecords,
  syncLearningRecord
} = require('../utils/cloud-sync.js');
const { migrateLocalDataToCloud, syncDataFromCloud } = require('../utils/cloud-migration.js');
const { ENTITY_TYPES, deleteEntityWithTombstone } = require('../utils/sync-tombstones.js');

const makeRecord = (id, studentId = STUDENT_A, wordbookId = BOOK_A, extra = {}) => ({
  id,
  studentId,
  wordbookId,
  teacher_id: storage.openid,
  studyDate: '2026-09-01T02:00:00.000Z',
  completedAt: '2026-09-01T02:00:00.000Z',
  timestamp: 1788228000000,
  updatedAt: 1788228000000,
  recordSchemaVersion: 2,
  wordsSnapshot: [{ wordId: `${id}-word`, word: id, masteryStatus: 'mastered' }],
  ...extra
});

const loadAuthorityTestHelpers = () => {
  const originalLoad = Module._load;
  const authorityPath = require.resolve('../cloudfunctions/syncTombstoneAuthority/index.js');
  const mockCloud = {
    DYNAMIC_CURRENT_ENV: 'stage1c-test-env',
    init: () => {},
    database: () => ({ command: {} })
  };
  delete require.cache[authorityPath];
  try {
    Module._load = function(request, parent, isMain) {
      if (request === 'wx-server-sdk') return mockCloud;
      return originalLoad.call(this, request, parent, isMain);
    };
    return require(authorityPath)._test;
  } finally {
    Module._load = originalLoad;
    delete require.cache[authorityPath];
  }
};

const authorityHelpers = loadAuthorityTestHelpers();
assert.deepStrictEqual(
  authorityHelpers.buildLearningRecordCleanupConditions(
    { entityId: RECORD_X },
    ACCOUNT_A
  ),
  [
    { teacher_id: ACCOUNT_A, id: RECORD_X },
    { _openid: ACCOUNT_A, id: RECORD_X },
    { teacher_id: ACCOUNT_A, recordId: RECORD_X },
    { _openid: ACCOUNT_A, recordId: RECORD_X },
    { teacher_id: ACCOUNT_A, record_id: RECORD_X },
    { _openid: ACCOUNT_A, record_id: RECORD_X }
  ],
  'authority cleanup must cover current and legacy learning-record identity aliases'
);
const switchAccount = (accountId) => {
  storage.openid = accountId;
  storage.currentUser = { id: accountId, username: accountId };
  app.globalData.currentUser = storage.currentUser;
};

(async () => {
  const staleRecord = makeRecord(RECORD_X);
  storage.students = [
    { id: STUDENT_A, student_id: STUDENT_A, ownerId: ACCOUNT_A, name: 'Stage1C A' },
    { id: STUDENT_B, student_id: STUDENT_B, ownerId: ACCOUNT_A, name: 'Stage1C B' }
  ];
  putStudent(storage.students[0], ACCOUNT_A);
  putStudent(storage.students[1], ACCOUNT_A);

  // 1-2. Create a durable tombstone and prove repeated delete is idempotent.
  putRecord(staleRecord, ACCOUNT_A);
  const firstDelete = await deleteEntityWithTombstone({
    entityType: ENTITY_TYPES.LEARNING_RECORD, entityId: RECORD_X,
    studentId: STUDENT_A, wordbookId: BOOK_A
  });
  assert.strictEqual(firstDelete.tombstoneCreated, true);
  assert.strictEqual(hasCloudRecord(RECORD_X, ACCOUNT_A), false);
  const tombstoneCount = ownerTombstones(ACCOUNT_A).size;
  const repeatedDelete = await deleteEntityWithTombstone({
    entityType: ENTITY_TYPES.LEARNING_RECORD, entityId: RECORD_X,
    studentId: STUDENT_A, wordbookId: BOOK_A
  });
  assert.strictEqual(repeatedDelete.tombstoneExisted, true);
  assert.strictEqual(ownerTombstones(ACCOUNT_A).size, tombstoneCount);

  // 3. Direct upload cannot recreate X.
  storage.learningRecords = [clone(staleRecord)];
  const directResult = await syncLearningRecord(clone(staleRecord), { accountId: ACCOUNT_A });
  assert.strictEqual(directResult.tombstoned, true);
  assert.strictEqual(hasCloudRecord(RECORD_X, ACCOUNT_A), false);
  assert.strictEqual(storage.learningRecords.some((record) => record.id === RECORD_X), false);

  // 4-5. Stale pending is discarded as deleted, never uploaded or counted as a normal success.
  const pendingKey = JSON.stringify([STUDENT_A, BOOK_A, RECORD_X]);
  storage.pendingLearningRecordSync = {
    [pendingKey]: { ...clone(staleRecord), accountId: ACCOUNT_A, _pendingVersion: 1 }
  };
  const retryResult = await retryPendingSyncs({ accountId: ACCOUNT_A });
  assert.strictEqual(retryResult.tombstonedDiscarded, 1);
  assert.strictEqual(storage.pendingLearningRecordSync, undefined);
  assert.strictEqual(hasCloudRecord(RECORD_X, ACCOUNT_A), false);

  // 8. Legacy/all-local upload uses one batch lookup and cannot resurrect X.
  const activeA = makeRecord('stage1c-active-a', STUDENT_A, BOOK_A);
  const callsBeforeBatch = authorityCalls.filter((call) => call.data.action === 'list').length;
  storage.learningRecords = [clone(staleRecord), clone(activeA)];
  const allLocalResult = await syncAllLocalLearningRecords();
  const callsAfterBatch = authorityCalls.filter((call) => call.data.action === 'list').length;
  assert.strictEqual(allLocalResult.tombstoned, 1);
  assert.strictEqual(hasCloudRecord(RECORD_X, ACCOUNT_A), false);
  assert.strictEqual(hasCloudRecord(activeA.id, ACCOUNT_A), true);
  assert.strictEqual(callsAfterBatch - callsBeforeBatch, 1, 'bulk upload must not query tombstones per record');

  // 6-7. Full Pull drops local X and suppresses a raw X recreated by an old client.
  putRecord(staleRecord, ACCOUNT_A);
  storage.learningRecords = [clone(staleRecord), clone(activeA)];
  const pullResult = await syncDataFromCloud(ACCOUNT_A, { allowFreshness: false });
  assert.strictEqual(pullResult.success, true);
  assert.strictEqual(storage.learningRecords.some((record) => record.id === RECORD_X), false);
  assert.strictEqual(hasCloudRecord(RECORD_X, ACCOUNT_A), true, 'Full Pull need not mutate raw evidence');
  assert.strictEqual(ownerTombstones(ACCOUNT_A).has(entityKey('learning_record', RECORD_X)), true);

  // 9-10. Ordinary and review/anti-forgetting records share the same authority.
  const reviewRecord = makeRecord('stage1c-review-record', STUDENT_A, BOOK_A, { type: 'review' });
  putRecord(reviewRecord, ACCOUNT_A);
  await deleteEntityWithTombstone({
    entityType: ENTITY_TYPES.LEARNING_RECORD, entityId: reviewRecord.id,
    studentId: STUDENT_A, wordbookId: BOOK_A
  });
  const reviewRetry = await syncLearningRecord(reviewRecord, { accountId: ACCOUNT_A });
  assert.strictEqual(reviewRetry.tombstoned, true);
  assert.strictEqual(hasCloudRecord(reviewRecord.id, ACCOUNT_A), false);

  // 11 and 13. Other students and wordbooks remain independent.
  const otherStudentRecord = makeRecord('stage1c-other-student', STUDENT_B, BOOK_A);
  const otherBookRecord = makeRecord('stage1c-other-book', STUDENT_A, BOOK_B);
  assert.strictEqual((await syncLearningRecord(otherStudentRecord, { accountId: ACCOUNT_A })).ok, true);
  assert.strictEqual((await syncLearningRecord(otherBookRecord, { accountId: ACCOUNT_A })).ok, true);
  assert.strictEqual(hasCloudRecord(otherStudentRecord.id, ACCOUNT_A), true);
  assert.strictEqual(hasCloudRecord(otherBookRecord.id, ACCOUNT_A), true);

  // 12 and 14. Trusted caller identity isolates the same entityId across owners.
  switchAccount(ACCOUNT_B);
  storage.students = [{ id: STUDENT_A, student_id: STUDENT_A, ownerId: ACCOUNT_B, name: 'Stage1C B owner' }];
  const accountBRecord = makeRecord(RECORD_X);
  accountBRecord.teacher_id = ACCOUNT_B;
  const accountBResult = await syncLearningRecord(accountBRecord, { accountId: ACCOUNT_B });
  assert.strictEqual(accountBResult.ok, true);
  assert.strictEqual(accountBResult.tombstoned, undefined);
  assert.strictEqual(hasCloudRecord(RECORD_X, ACCOUNT_B), true);
  assert.strictEqual(ownerTombstones(ACCOUNT_B).size, 0);

  // 15-16. Student identity cannot revive; child data is not cascaded.
  switchAccount(ACCOUNT_A);
  storage.students = [{ id: STUDENT_A, student_id: STUDENT_A, ownerId: ACCOUNT_A, name: 'Stage1C A' }];
  putStudent(storage.students[0], ACCOUNT_A);
  const childRecord = makeRecord('stage1c-student-child', STUDENT_A, BOOK_A);
  putRecord(childRecord, ACCOUNT_A);
  cloudProgress.set('stage1c-progress', {
    _id: 'stage1c-progress', teacher_id: ACCOUNT_A, student_id: STUDENT_A, wordbooks: {}
  });
  cloudMastery.set('stage1c-mastery', {
    _id: 'stage1c-mastery', teacher_id: ACCOUNT_A, student_id: STUDENT_A,
    wordbook_id: BOOK_A, word_id: 'stage1c-word', status: 'learning'
  });
  await deleteEntityWithTombstone({
    entityType: ENTITY_TYPES.STUDENT, entityId: STUDENT_A, studentId: STUDENT_A
  });
  assert.strictEqual(hasCloudStudent(STUDENT_A, ACCOUNT_A), false);
  assert.strictEqual(hasCloudRecord(childRecord.id, ACCOUNT_A), true);
  assert.strictEqual(cloudProgress.size, 1);
  assert.strictEqual(cloudMastery.size, 1);
  await syncDataFromCloud(ACCOUNT_A, { allowFreshness: false });
  assert.strictEqual(storage.students.some((student) => student.id === STUDENT_A), false);
  delete storage.hasMigratedToCloud;
  storage.students = [{ id: STUDENT_A, student_id: STUDENT_A, ownerId: ACCOUNT_A, name: 'stale student' }];
  storage.learningRecords = [];
  storage.learningProgress = {};
  storage.wordMastery = {};
  await migrateLocalDataToCloud({ accountId: ACCOUNT_A, suppressToast: true });
  assert.strictEqual(hasCloudStudent(STUDENT_A, ACCOUNT_A), false, 'migration must not revive student identity');
  assert.strictEqual(hasCloudRecord(childRecord.id, ACCOUNT_A), true, 'student tombstone must not delete child record');

  // 17. Tombstone write failure cannot be presented as deletion.
  const failRecord = makeRecord('stage1c-tombstone-write-fails', STUDENT_B, BOOK_A);
  storage.learningRecords = [clone(failRecord)];
  putRecord(failRecord, ACCOUNT_A);
  failTombstoneWrite = true;
  await assert.rejects(() => deleteEntityWithTombstone({
    entityType: ENTITY_TYPES.LEARNING_RECORD, entityId: failRecord.id,
    studentId: STUDENT_B, wordbookId: BOOK_A
  }), /forced_tombstone_write_failure/);
  failTombstoneWrite = false;
  assert.strictEqual(hasCloudRecord(failRecord.id, ACCOUNT_A), true);
  assert.strictEqual(storage.learningRecords.some((record) => record.id === failRecord.id), true);

  // 18. Tombstone success remains logical deletion if raw cleanup is deferred.
  const cleanupRecord = makeRecord('stage1c-raw-cleanup-fails', STUDENT_B, BOOK_B);
  storage.learningRecords = [clone(cleanupRecord)];
  putRecord(cleanupRecord, ACCOUNT_A);
  failRawCleanup = true;
  const cleanupResult = await deleteEntityWithTombstone({
    entityType: ENTITY_TYPES.LEARNING_RECORD, entityId: cleanupRecord.id,
    studentId: STUDENT_B, wordbookId: BOOK_B
  });
  failRawCleanup = false;
  assert.strictEqual(cleanupResult.cleanupPending, true);
  assert.strictEqual(hasCloudRecord(cleanupRecord.id, ACCOUNT_A), true);
  await syncDataFromCloud(ACCOUNT_A, { allowFreshness: false });
  assert.strictEqual(storage.learningRecords.some((record) => record.id === cleanupRecord.id), false);

  // 19. An old completion cannot clear a newer pending generation.
  const generationRecord = makeRecord('stage1c-pending-generation', STUDENT_B, BOOK_A);
  const generationKey = JSON.stringify([STUDENT_B, BOOK_A, generationRecord.id]);
  const oldPending = { ...clone(generationRecord), accountId: ACCOUNT_A, _pendingVersion: 1 };
  const newPending = {
    ...clone(generationRecord), accountId: ACCOUNT_A,
    _pendingVersion: 2, updatedAt: 1788231000000
  };
  storage.pendingLearningRecordSync = { [generationKey]: newPending };
  discardLearningRecordAfterTombstone(generationRecord, ACCOUNT_A, oldPending);
  assert.strictEqual(storage.pendingLearningRecordSync[generationKey]._pendingVersion, 2);

  assert.strictEqual(hasCloudRecord(RECORD_X, ACCOUNT_A), true, 'old-client raw recreation remains evidence');
  assert.strictEqual(ownerTombstones(ACCOUNT_A).has(entityKey('learning_record', RECORD_X)), true);
  assert.ok(buildScopedDocId(ACCOUNT_A, 'record', RECORD_X));
  console.log('stage1c-tombstone-resurrection-failure: PASS');
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
