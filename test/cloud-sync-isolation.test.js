'use strict';

const assert = require('assert');

const storage = {
  openid: 'openid-test',
  students: [
    { id: 'student-a', name: 'A' },
    { id: 'student-b', name: 'B' }
  ],
  wordMastery: {},
  learningRecords: [],
  learningProgress: {}
};

const failingDocument = {
  get: () => Promise.reject({ errCode: -1, errMsg: 'document not found' }),
  set: () => Promise.reject(new Error('offline'))
};
const db = {
  collection: () => ({
    doc: () => failingDocument
  })
};

global.wx = {
  cloud: {
    database: () => db
  },
  getStorageSync: (key) => storage[key],
  setStorageSync: (key, value) => { storage[key] = value; },
  removeStorageSync: (key) => { delete storage[key]; }
};
global.getApp = () => ({
  globalData: { cloudReadOnly: false }
});

const {
  syncLearningProgress,
  syncWordMasteryBatch
} = require('../utils/cloud-sync.js');

(async () => {
  await syncWordMasteryBatch('student-a', 'book-one', {
    shared: { reviewCount: 1, lastReviewTime: 1000, mastered: true }
  });
  await syncWordMasteryBatch('student-b', 'book-two', {
    shared: { reviewCount: 2, lastReviewTime: 2000, difficult: true }
  });

  const pendingMastery = storage.pendingWordMasterySync || {};
  assert.strictEqual(Object.keys(pendingMastery).length, 2);
  assert.ok(pendingMastery['student-a__book-one__shared']);
  assert.ok(pendingMastery['student-b__book-two__shared']);
  assert.strictEqual(pendingMastery['student-a__book-one__shared'].word_id, 'shared');
  assert.strictEqual(pendingMastery['student-b__book-two__shared'].student_id, 'student-b');

  await syncLearningProgress('student-a', {
    wordbooks: { 'book-one': { completedCount: 1, totalCount: 10 } }
  });
  await syncLearningProgress('student-b', {
    wordbooks: { 'book-two': { completedCount: 2, totalCount: 10 } }
  });

  const pendingProgress = storage.pendingLearningProgressSync || {};
  assert.deepStrictEqual(Object.keys(pendingProgress).sort(), ['student-a', 'student-b']);
  assert.strictEqual(pendingProgress['student-a'].studentId, 'student-a');
  assert.strictEqual(pendingProgress['student-b'].studentId, 'student-b');

  console.log('cloud-sync-isolation: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
