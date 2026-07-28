'use strict';

const assert = require('assert');
const { selectWordMasteryRecords } = require('../utils/cloud-sync.js');

const currentBookRecords = {
  changed_known: {
    mastered: true,
    difficult: false,
    antiForgettingSeed: false
  },
  changed_unknown: {
    mastered: false,
    difficult: true,
    antiForgettingSeed: true
  }
};

for (let index = 0; index < 300; index++) {
  currentBookRecords[`legacy_${index}`] = {
    mastered: index % 2 === 0,
    difficult: index % 2 !== 0,
    reviewCount: index % 5
  };
}

const selected = selectWordMasteryRecords(currentBookRecords, [
  'changed_known',
  'changed_unknown',
  'changed_known',
  'missing_word'
]);

assert.deepStrictEqual(Object.keys(selected).sort(), ['changed_known', 'changed_unknown']);
assert.strictEqual(selected.changed_known, currentBookRecords.changed_known);
assert.strictEqual(selected.changed_unknown, currentBookRecords.changed_unknown);
assert.strictEqual(
  Object.keys(currentBookRecords).length,
  302,
  'selection must not delete or rewrite legacy mastery data'
);
assert.deepStrictEqual(selectWordMasteryRecords(currentBookRecords, []), {});
assert.deepStrictEqual(selectWordMasteryRecords(null, ['changed_known']), {});

console.log('mastery-sync-selection: PASS');
