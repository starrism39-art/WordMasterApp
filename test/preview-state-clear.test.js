'use strict';

const assert = require('assert');

const storage = { openid: 'openid-test', students: [{ id: 'student-a', name: 'A' }] };
let cloudDocument = {
  teacher_id: 'openid-test',
  student_id: 'student-a',
  wordbook_id: 'book-a',
  mastery: { alpha: false },
  order: ['alpha'],
  excluded: ['alpha']
};

const documentRef = {
  get: async () => ({ data: { ...cloudDocument } }),
  set: async ({ data }) => {
    cloudDocument = JSON.parse(JSON.stringify(data));
    return { ok: true };
  }
};

global.wx = {
  cloud: { database: () => ({ collection: () => ({ doc: () => documentRef }) }) },
  getStorageSync: (key) => storage[key],
  setStorageSync: (key, value) => { storage[key] = value; },
  removeStorageSync: (key) => { delete storage[key]; }
};
global.getApp = () => ({ globalData: { cloudReadOnly: false } });

const { syncPreviewState } = require('../utils/cloud-sync.js');

(async () => {
  await syncPreviewState('student-a', 'book-a', {
    mastery: {},
    order: [],
    excluded: []
  });
  assert.deepStrictEqual(cloudDocument.order, ['alpha']);
  assert.deepStrictEqual(cloudDocument.excluded, ['alpha']);

  await syncPreviewState('student-a', 'book-a', {
    mastery: {},
    order: [],
    excluded: [],
    reset: true
  });
  assert.deepStrictEqual(cloudDocument.mastery, {});
  assert.deepStrictEqual(cloudDocument.order, []);
  assert.deepStrictEqual(cloudDocument.excluded, []);
  process.stdout.write('preview-state-clear: PASS\n');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
