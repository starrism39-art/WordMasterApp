'use strict';

const assert = require('assert');
const clientMerge = require('../utils/sync-merge.js');
const cloudMerge = require('../cloudfunctions/syncMasteryAtom/sync-merge.js');

const scenarios = [
  {
    local: {
      reviewCount: 1,
      lastReviewTime: 1000,
      mastered: true,
      difficult: false,
      antiForgettingSeed: true,
      legacyUnknownField: 'preserve',
      reviewTimeline: [{ time: 1000, reviewCount: 1, status: 'mastered' }]
    },
    cloud: {
      reviewCount: 2,
      lastReviewTime: 2000,
      mastered: false,
      difficult: true,
      antiForgettingSeed: true,
      reviewTimeline: [{ time: 2000, reviewCount: 2, status: 'difficult' }]
    }
  },
  {
    local: {
      reviewCount: 5,
      mastered: true,
      difficult: false,
      antiForgettingSeed: true
    },
    cloud: {}
  },
  {
    local: {
      reviewCount: 2,
      lastReviewTime: '1970-01-01T00:00:02.000Z',
      mastered: false,
      difficult: true
    },
    cloud: {
      reviewCount: 2,
      lastReviewTime: 2000,
      mastered: true,
      difficult: false
    }
  }
];

scenarios.forEach(({ local, cloud }, index) => {
  assert.deepStrictEqual(
    cloudMerge.mergeWordMasteryRecord(local, cloud),
    clientMerge.mergeWordMasteryRecord(local, cloud),
    `cloud and client mastery merge must stay identical for scenario ${index + 1}`
  );
  assert.strictEqual(
    cloudMerge.compareWordMasteryVersions(local, cloud),
    clientMerge.compareWordMasteryVersions(local, cloud),
    `cloud and client version comparison must stay identical for scenario ${index + 1}`
  );
});

console.log('cloud-mastery-merge-parity: PASS');
