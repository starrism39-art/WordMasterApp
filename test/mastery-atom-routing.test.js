'use strict';

const assert = require('assert');

const loadCloudSync = ({
  callFunction,
  cloudReadOnly = false,
  directDatabase
}) => {
  const storage = {
    openid: 'caller-a',
    students: [{
      id: 'student456',
      name: '456',
      teacher_name: '张张张123'
    }],
    currentUser: { name: '张张张123' }
  };
  global.wx = {
    cloud: {
      callFunction,
      database: () => directDatabase
    },
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => {
      storage[key] = value;
    },
    removeStorageSync: (key) => {
      delete storage[key];
    }
  };
  global.getApp = () => ({
    globalData: { cloudReadOnly }
  });

  const modulePath = require.resolve('../utils/cloud-sync.js');
  delete require.cache[modulePath];
  return {
    cloudSync: require(modulePath),
    storage
  };
};

const supportedCapabilities = {
  success: true,
  protocolVersion: 2,
  maxBatchSize: 20,
  features: {
    transactionalMasteryMerge: true,
    legacyOwnershipAdoption: true
  }
};

(async () => {
  {
    const calls = [];
    let directOperationCount = 0;
    const { cloudSync, storage } = loadCloudSync({
      callFunction: async (request) => {
        calls.push(request);
        if (request.data.action === 'capabilities') {
          return { result: supportedCapabilities };
        }
        return {
          result: {
            success: true,
            protocolVersion: 2,
            results: request.data.records.map((record) => ({
              wordId: record.wordId,
              ok: true
            }))
          }
        };
      },
      directDatabase: {
        collection: () => ({
          doc: () => ({
            get: async () => {
              directOperationCount++;
              throw new Error('direct path must not be used');
            },
            set: async () => {
              directOperationCount++;
              throw new Error('direct path must not be used');
            }
          })
        })
      }
    });

    const result = await cloudSync.syncWordMasteryBatch(
      'student456',
      'senior_textbook_real',
      {
        alpha: {
          reviewCount: 1,
          lastReviewTime: 1000,
          mastered: false,
          difficult: true
        },
        beta: {
          reviewCount: 2,
          lastReviewTime: 2000,
          mastered: true,
          difficult: false
        }
      }
    );
    assert.deepStrictEqual(result, { succeeded: 2, failed: 0 });
    assert.strictEqual(calls.length, 2);
    assert.deepStrictEqual(calls[0], {
      name: 'syncMasteryAtom',
      data: { action: 'capabilities' }
    });
    assert.strictEqual(calls[1].name, 'syncMasteryAtom');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(calls[1].data, 'openid'), false);
    assert.deepStrictEqual(
      calls[1].data.records.map((record) => ({
        studentId: record.studentId,
        wordbookId: record.wordbookId,
        wordId: record.wordId
      })),
      [{
        studentId: 'student456',
        wordbookId: 'senior_textbook_real',
        wordId: 'alpha'
      }, {
        studentId: 'student456',
        wordbookId: 'senior_textbook_real',
        wordId: 'beta'
      }]
    );
    assert.strictEqual(directOperationCount, 0);
    assert.strictEqual(storage.pendingWordMasterySync, undefined);
  }

  {
    let capabilityCalls = 0;
    let directWriteCount = 0;
    const directDatabase = {
      collection: () => ({
        doc: () => ({
          get: async () => {
            const error = new Error('document not found');
            error.errCode = -1;
            throw error;
          },
          set: async () => {
            directWriteCount++;
          }
        })
      })
    };
    const { cloudSync } = loadCloudSync({
      callFunction: async () => {
        capabilityCalls++;
        return {
          result: {
            success: false,
            error: 'missing_openid'
          }
        };
      },
      directDatabase
    });
    const result = await cloudSync.syncWordMasteryBatch(
      'student456',
      'gaokao_reading_words',
      {
        legacy: {
          reviewCount: 1,
          mastered: false,
          difficult: true
        }
      }
    );
    assert.deepStrictEqual(result, { succeeded: 1, failed: 0 });
    assert.strictEqual(capabilityCalls, 1);
    assert.strictEqual(directWriteCount, 1);
  }

  {
    let callCount = 0;
    let directOperationCount = 0;
    const { cloudSync, storage } = loadCloudSync({
      callFunction: async (request) => {
        callCount++;
        if (request.data.action === 'capabilities') {
          return { result: supportedCapabilities };
        }
        throw new Error('function_timeout_after_dispatch');
      },
      directDatabase: {
        collection: () => ({
          doc: () => ({
            get: async () => {
              directOperationCount++;
            },
            set: async () => {
              directOperationCount++;
            }
          })
        })
      }
    });
    const result = await cloudSync.syncWordMasteryBatch(
      'student-cloud-01',
      'senior_book_1_ren_jiao',
      {
        gamma: {
          reviewCount: 1,
          mastered: false,
          difficult: true
        }
      }
    );
    assert.deepStrictEqual(result, { succeeded: 0, failed: 1 });
    assert.strictEqual(callCount, 2);
    assert.strictEqual(
      directOperationCount,
      0,
      'an uncertain cloud-function result must be queued, not written a second time'
    );
    const pending = storage.pendingWordMasterySync || {};
    assert.strictEqual(Object.keys(pending).length, 1);
    assert.strictEqual(
      pending['student-cloud-01__senior_book_1_ren_jiao__gamma'].word_id,
      'gamma'
    );
  }

  {
    let callCount = 0;
    const { cloudSync } = loadCloudSync({
      callFunction: async () => {
        callCount++;
        throw new Error('must not be called in read-only mode');
      },
      cloudReadOnly: true,
      directDatabase: {}
    });
    const result = await cloudSync.syncWordMasteryBatch(
      'student456',
      'senior_textbook_real',
      { alpha: { reviewCount: 1 } }
    );
    assert.strictEqual(result.skipped, true);
    assert.strictEqual(result.reason, 'cloud_read_only');
    assert.strictEqual(callCount, 0);
  }

  console.log('mastery-atom-routing: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
