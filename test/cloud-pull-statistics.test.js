'use strict';

const assert = require('assert');

const storage = {
  students: [{ id: 'student456', student_id: 'student456', name: '测试学生' }],
  learningRecords: [],
  learningProgress: {},
  wordMastery: {
    student456: {
      senior_textbook_real: {
        alpha: {
          reviewCount: 1,
          lastReviewTime: 1000,
          mastered: true,
          difficult: false
        }
      }
    }
  }
};

const cloudCollections = {
  teachers: [{
    _id: 'teacher-1',
    teacher_id: 'openid-test',
    userRole: 'external',
    memberLevel: 'free'
  }],
  students: [],
  learning_records: [{
    _id: 'record-1',
    id: 'record-1',
    teacher_id: 'openid-test',
    studentId: 'student456',
    wordbookId: 'senior_textbook_real',
    studyDate: '2026-07-20T08:00:00+08:00',
    updatedAt: '2026-07-20T08:00:00+08:00'
  }],
  learning_progress: [],
  word_mastery: [{
    _id: 'mastery-1',
    teacher_id: 'openid-test',
    student_id: 'student456',
    wordbook_id: 'senior_textbook_real',
    word_id: 'alpha',
    reviewCount: 2,
    lastReviewTime: 2000,
    mastered: false,
    difficult: true
  }],
  student_statistics: [{
    _id: 'student456',
    teacher_id: 'openid-test',
    student_id: 'student456',
    isManualOverride: true,
    manualMasteredCount: 5,
    manualNotMasteredCount: 3,
    manualCheckinDays: 2,
    baseMasteredCount: 1,
    baseNotMasteredCount: 1,
    baseCheckinDays: 1,
    updatedAt: '2026-07-21T08:00:00+08:00'
  }],
  wordbook_statistics: [{
    _id: 'student456_senior_textbook_real',
    teacher_id: 'openid-test',
    student_id: 'student456',
    wordbook_id: 'senior_textbook_real',
    isManualOverride: true,
    manualMasteredCount: 4,
    manualNotMasteredCount: 2,
    manualCheckinDays: 3,
    baseMasteredCount: 1,
    baseNotMasteredCount: 1,
    baseCheckinDays: 1,
    updatedAt: '2026-07-21T08:00:00+08:00'
  }]
};

let cloudWriteCount = 0;
const createQuery = (items) => {
  let offset = 0;
  let limit = items.length;
  const query = {
    count: async () => ({ total: items.length }),
    skip(value) {
      offset = value;
      return query;
    },
    limit(value) {
      limit = value;
      return query;
    },
    orderBy() {
      return query;
    },
    get: async () => ({ data: items.slice(offset, offset + limit) })
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
        throw new Error('cloud write is forbidden in read-only test');
      },
      doc() {
        return {
          set() {
            cloudWriteCount++;
            throw new Error('cloud write is forbidden in read-only test');
          },
          update() {
            cloudWriteCount++;
            throw new Error('cloud write is forbidden in read-only test');
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
  const result = await syncDataFromCloud('openid-test');
  assert.strictEqual(result.success, true);
  assert.strictEqual(cloudWriteCount, 0, 'cloud pull regression must not write real cloud data');

  const merged = storage.wordMastery.student456.senior_textbook_real.alpha;
  assert.strictEqual(merged.reviewCount, 2);
  assert.strictEqual(merged.mastered, false);
  assert.strictEqual(merged.difficult, true);

  assert.deepStrictEqual(
    {
      masteredCount: storage.stats_student456.masteredCount,
      notMasteredCount: storage.stats_student456.notMasteredCount,
      checkinDays: storage.stats_student456.checkinDays
    },
    { masteredCount: 5, notMasteredCount: 3, checkinDays: 2 },
    '学生级云端手动修正必须在拉取后可跨设备复现'
  );
  assert.deepStrictEqual(
    {
      masteredCount: storage.wordbook_stats_student456_senior_textbook_real.masteredCount,
      notMasteredCount: storage.wordbook_stats_student456_senior_textbook_real.notMasteredCount,
      checkinDays: storage.wordbook_stats_student456_senior_textbook_real.checkinDays
    },
    { masteredCount: 4, notMasteredCount: 2, checkinDays: 3 },
    '词书级云端手动修正必须被安全拉取到本地'
  );
  assert.ok(emitted.includes('wordMasteryUpdated'));
  assert.ok(emitted.includes('learningRecordAdded'));

  console.log('cloud-pull-statistics: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
