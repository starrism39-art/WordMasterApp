'use strict';

const assert = require('assert');

const CLIENT_QUERY_LIMIT = 20;
const teacherId = 'openid-test';
const targetStudentId = 'student-pagination-target';
const targetWordbookId = 'senior_textbook_real';

const storage = {
  students: [{
    id: targetStudentId,
    student_id: targetStudentId,
    name: 'Pagination Target'
  }],
  learningRecords: [],
  learningProgress: {},
  wordMastery: {}
};

const learningRecords = Array.from({ length: 129 }, (_, index) => ({
  _id: `record-${String(index).padStart(3, '0')}`,
  id: `record-${String(index).padStart(3, '0')}`,
  teacher_id: teacherId,
  studentId: index === 50 ? targetStudentId : 'other-student',
  wordbookId: targetWordbookId,
  studyDate: '2026-07-30T08:00:00+08:00',
  updatedAt: '2026-07-30T08:00:00+08:00'
}));

const wordMastery = Array.from({ length: 129 }, (_, index) => {
  const isTarget = index >= 40 && index < 60;
  return {
    _id: `mastery-${String(index).padStart(3, '0')}`,
    teacher_id: teacherId,
    student_id: isTarget ? targetStudentId : 'other-student',
    wordbook_id: targetWordbookId,
    word_id: isTarget
      ? `target-word-${String(index - 40).padStart(2, '0')}`
      : `other-word-${String(index).padStart(3, '0')}`,
    mastered: !isTarget,
    difficult: isTarget,
    antiForgettingSeed: isTarget,
    reviewCount: 0,
    nextReviewTime: Date.now() + 24 * 60 * 60 * 1000
  };
});

const cloudCollections = {
  teachers: [{
    _id: 'teacher-1',
    teacher_id: teacherId,
    userRole: 'external',
    memberLevel: 'free'
  }],
  students: [],
  learning_records: learningRecords,
  learning_progress: [],
  word_mastery: wordMastery,
  student_statistics: [],
  wordbook_statistics: []
};

const requestedLimits = [];
let cloudWriteCount = 0;

const createQuery = (sourceItems) => {
  let items = sourceItems.slice();
  let offset = 0;
  let pageLimit = CLIENT_QUERY_LIMIT;
  const query = {
    count: async () => ({ total: items.length }),
    orderBy(field, direction) {
      items = items.slice().sort((left, right) => {
        const leftValue = String(left[field] || '');
        const rightValue = String(right[field] || '');
        return direction === 'desc'
          ? rightValue.localeCompare(leftValue)
          : leftValue.localeCompare(rightValue);
      });
      return query;
    },
    skip(value) {
      offset = value;
      return query;
    },
    limit(value) {
      requestedLimits.push(value);
      pageLimit = Math.min(value, CLIENT_QUERY_LIMIT);
      return query;
    },
    get: async () => ({
      data: items.slice(offset, offset + pageLimit)
    })
  };
  return query;
};

const db = {
  collection(name) {
    const items = cloudCollections[name] || [];
    return {
      where(condition) {
        const filtered = items.filter((item) => Object.keys(condition).every(
          (key) => item[key] === condition[key]
        ));
        return createQuery(filtered);
      },
      add() {
        cloudWriteCount++;
        throw new Error('cloud write is forbidden in pagination pull test');
      },
      doc() {
        return {
          set() {
            cloudWriteCount++;
            throw new Error('cloud write is forbidden in pagination pull test');
          },
          update() {
            cloudWriteCount++;
            throw new Error('cloud write is forbidden in pagination pull test');
          }
        };
      }
    };
  }
};

global.wx = {
  cloud: {
    init: () => {},
    database: () => db
  },
  getDeviceInfo: () => ({ platform: 'devtools' }),
  getLaunchOptionsSync: () => ({ query: {} }),
  getStorageSync: (key) => storage[key],
  setStorageSync: (key, value) => { storage[key] = value; },
  removeStorageSync: (key) => { delete storage[key]; }
};

const emitted = [];
global.getApp = () => ({
  globalData: { cloudReadOnly: true },
  ensureUserPermissions: (user) => user,
  emit: (name) => emitted.push(name)
});

const { syncDataFromCloud } = require('../utils/cloud-migration.js');

(async () => {
  const result = await syncDataFromCloud(teacherId);
  assert.strictEqual(result.success, true);
  assert.strictEqual(cloudWriteCount, 0, 'cloud pull pagination regression must remain read-only');

  const targetRecords = storage.learningRecords.filter(
    (record) => record.studentId === targetStudentId || record.student_id === targetStudentId
  );
  assert.strictEqual(targetRecords.length, 1, 'pagination must not skip the target learning record');

  const targetMastery = storage.wordMastery[targetStudentId][targetWordbookId];
  assert.strictEqual(
    Object.keys(targetMastery).length,
    20,
    'pagination must hydrate all target mastery documents'
  );
  assert.ok(
    requestedLimits.every((value) => value <= CLIENT_QUERY_LIMIT),
    'Mini Program client queries must not request pages larger than the client limit'
  );
  assert.ok(emitted.includes('wordMasteryUpdated'));
  assert.ok(emitted.includes('learningRecordAdded'));

  console.log('cloud-pull-pagination: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
