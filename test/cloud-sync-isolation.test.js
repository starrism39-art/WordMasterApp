'use strict';

const assert = require('assert');

const storage = {
  openid: 'openid-test',
  students: [
    { id: 'student-a', name: 'A', ownerId: 'openid-test' },
    { id: 'student-b', name: 'B', ownerId: 'openid-test' }
  ],
  wordMastery: {},
  learningRecords: [],
  learningProgress: {}
};

let cloudWritable = false;
const failingDocument = {
  get: () => Promise.reject({ errCode: -1, errMsg: 'document not found' }),
  set: () => cloudWritable
    ? Promise.resolve({ ok: true })
    : Promise.reject(new Error('offline'))
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
  getSyncStatus,
  retryPendingSyncs,
  syncPreviewState,
  syncLearningProgress,
  syncWordMasteryBatch
} = require('../utils/cloud-sync.js');

(async () => {
  await syncWordMasteryBatch('student-a', 'book-one', {
    shared: { reviewCount: 1, lastReviewTime: 1000, mastered: true },
    extra: { reviewCount: 0, lastReviewTime: 900, difficult: true }
  });
  await syncWordMasteryBatch('student-b', 'book-two', {
    shared: { reviewCount: 2, lastReviewTime: 2000, difficult: true }
  });

  const pendingMastery = storage.pendingWordMasterySync || {};
  assert.strictEqual(Object.keys(pendingMastery).length, 3);
  assert.ok(pendingMastery['student-a__book-one__shared']);
  assert.ok(pendingMastery['student-a__book-one__extra']);
  assert.ok(pendingMastery['student-b__book-two__shared']);
  assert.strictEqual(pendingMastery['student-a__book-one__shared'].word_id, 'shared');
  assert.strictEqual(pendingMastery['student-a__book-one__shared'].accountId, 'openid-test');
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
  assert.strictEqual(pendingProgress['student-a'].accountId, 'openid-test');
  assert.strictEqual(pendingProgress['student-b'].studentId, 'student-b');

  await syncPreviewState('student-a', 'book-one', {
    mastery: { alpha: false },
    order: ['alpha'],
    excluded: [],
    reset: true
  });
  await syncPreviewState('student-b', 'book-two', {
    mastery: { beta: true },
    order: ['beta'],
    excluded: ['beta']
  });

  const pendingPreview = storage.pendingPreviewStateSync || {};
  assert.deepStrictEqual(
    Object.keys(pendingPreview).sort(),
    ['student-a__book-one', 'student-b__book-two'],
    'preview state failures must be persisted per student and wordbook'
  );
  assert.strictEqual(
    pendingPreview['student-a__book-one'].previewData.reset,
    true,
    '预习重置指令必须随失败队列保留，恢复网络后仍能清空云端旧状态'
  );
  assert.strictEqual(
    getSyncStatus().pending,
    7,
    'pending status must equal the seven real queued items without inflation'
  );

  cloudWritable = true;
  const retryResult = await retryPendingSyncs();
  assert.deepStrictEqual(retryResult, { ok: true, pending: 0 });
  assert.strictEqual(storage.pendingWordMasterySync, undefined);
  assert.strictEqual(storage.pendingLearningProgressSync, undefined);
  assert.strictEqual(storage.pendingPreviewStateSync, undefined);
  assert.strictEqual(storage.pendingSyncProgress, undefined);
  assert.strictEqual(getSyncStatus().pending, 0);

  delete storage.openid;
  await syncWordMasteryBatch('student-a', 'book-one', {
    no_openid_word: { difficult: true, reviewCount: 0 }
  });
  await syncLearningProgress('student-a', {
    wordbooks: { 'book-one': { completedCount: 3, totalCount: 10 } }
  });
  await syncPreviewState('student-a', 'book-one', {
    mastery: { no_openid_word: false },
    order: ['no_openid_word'],
    excluded: []
  });
  assert.strictEqual(
    getSyncStatus().pending,
    3,
    'missing identity/network preconditions must retain all three retryable payloads'
  );

  storage.openid = 'openid-test';
  const recoveredPreconditions = await retryPendingSyncs();
  assert.deepStrictEqual(recoveredPreconditions, { ok: true, pending: 0 });

  console.log('cloud-sync-isolation: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
