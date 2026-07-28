'use strict';

const assert = require('assert');
const {
  compareWordMasteryVersions,
  mergeById,
  mergeWordMasteryRecord,
  toTimestamp
} = require('../utils/sync-merge.js');

const oldLocal = {
  reviewCount: 1,
  lastReviewTime: 1000,
  nextReviewTime: 5000,
  mastered: true,
  difficult: false,
  antiForgettingSeed: true,
  reviewTimeline: [{ time: 1000, reviewCount: 1, status: 'mastered' }]
};
const newerCloud = {
  reviewCount: 2,
  lastReviewTime: '1970-01-01T00:00:02.000Z',
  nextReviewTime: 3000,
  mastered: false,
  difficult: true,
  antiForgettingSeed: true,
  reviewTimeline: [{ time: 2000, reviewCount: 2, status: 'difficult' }]
};
const cloudWinner = mergeWordMasteryRecord(oldLocal, newerCloud);
assert.strictEqual(compareWordMasteryVersions(oldLocal, newerCloud), -1);
assert.strictEqual(cloudWinner.reviewCount, 2);
assert.strictEqual(cloudWinner.mastered, false, 'newer difficult state must not inherit old mastered=true');
assert.strictEqual(cloudWinner.difficult, true);
assert.strictEqual(cloudWinner.nextReviewTime, 3000, 'next review time must come from the coherent winner');
assert.deepStrictEqual(cloudWinner.reviewTimeline.map((item) => item.time), [1000, 2000]);

const newestLocal = {
  reviewCount: 3,
  lastReviewTime: 4000,
  mastered: true,
  difficult: false,
  antiForgettingSeed: false
};
const localWinner = mergeWordMasteryRecord(newestLocal, newerCloud);
assert.strictEqual(localWinner.reviewCount, 3);
assert.strictEqual(localWinner.mastered, true);
assert.strictEqual(localWinner.difficult, false);
assert.strictEqual(localWinner.antiForgettingSeed, false);

const fiveRounds = mergeWordMasteryRecord({}, {
  reviewCount: '5',
  mastered: true,
  antiForgettingSeed: true
});
assert.strictEqual(fiveRounds.antiForgettingSeed, false, 'completed schedule must not be resurrected');

const sameVersionCloudAuthority = mergeWordMasteryRecord(
  { reviewCount: 1, lastReviewTime: 1000, mastered: true },
  { reviewCount: 1, lastReviewTime: 1000, mastered: false, difficult: true }
);
assert.strictEqual(sameVersionCloudAuthority.mastered, false);
assert.strictEqual(sameVersionCloudAuthority.difficult, true);

const mergedRecords = mergeById(
  [{ id: 'record-1', updatedAt: 1000, localOnly: true, totalWords: 5 }],
  [{ id: 'record-1', updatedAt: new Date(2000), cloudOnly: true, totalWords: 6 }],
  'id'
);
assert.strictEqual(mergedRecords[0].totalWords, 6);
assert.strictEqual(mergedRecords[0].localOnly, true);
assert.strictEqual(mergedRecords[0].cloudOnly, true);
assert.strictEqual(toTimestamp({ $date: '1970-01-01T00:00:03.000Z' }), 3000);

console.log('sync-merge: PASS');
