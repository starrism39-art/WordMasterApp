'use strict';

const assert = require('assert');

const dueAt = Date.now() - 60 * 1000;
const storage = {
  wordMastery: {
    student456: {
      senior_textbook_real: {
        senior_textbook_real_wrong: {
          mastered: true,
          difficult: false,
          antiForgettingSeed: true,
          nextReviewTime: dueAt,
          reviewCount: 2,
          updatedAt: dueAt - 1000,
          reviewTimeline: []
        },
        senior_textbook_real_right: {
          mastered: false,
          difficult: true,
          antiForgettingSeed: true,
          nextReviewTime: dueAt,
          reviewCount: 1,
          updatedAt: dueAt - 1000,
          reviewTimeline: []
        }
      }
    }
  }
};
const learningRecords = [];
const emittedEvents = [];
const toasts = [];

global.wx = {
  getStorageSync: (key) => storage[key],
  setStorageSync: (key, value) => {
    storage[key] = value;
  },
  removeStorageSync: (key) => {
    delete storage[key];
  },
  showToast: (options) => {
    toasts.push(options);
  },
  showLoading: () => {},
  hideLoading: () => {},
  navigateBack: () => {}
};

const app = {
  globalData: {
    cloudReadOnly: true
  },
  addLearningRecord: (record) => {
    learningRecords.push(record);
  },
  emit: (eventName) => {
    emittedEvents.push(eventName);
  },
  on: () => {},
  off: () => {}
};

global.getApp = () => app;

let pageDefinition = null;
global.Page = (definition) => {
  pageDefinition = definition;
};
require('../pages/review/review.js');
assert.ok(pageDefinition, 'review page should register');

const page = Object.assign({}, pageDefinition);
page.data = {
  currentStudent: { id: 'student456', name: 'Test Student' },
  currentWordbook: { id: 'senior_textbook_real', title: 'Senior Textbook' },
  allWords: [
    { id: 'senior_textbook_real_wrong', word: 'wrong' },
    { id: 'senior_textbook_real_right', word: 'right' }
  ],
  previewMastery: {
    senior_textbook_real_wrong: 'difficult',
    senior_textbook_real_right: 'mastered'
  },
  isReviewSessionPage: true
};
page.setData = function setData(patch) {
  this.data = { ...this.data, ...patch };
};
let backCount = 0;
page.backToRecordList = () => {
  backCount += 1;
};

page.completeReview();

let mastery = storage.wordMastery.student456.senior_textbook_real;
const wrongAfterFirstAttempt = mastery.senior_textbook_real_wrong;
const rightAfterFirstAttempt = mastery.senior_textbook_real_right;

assert.strictEqual(wrongAfterFirstAttempt.mastered, false);
assert.strictEqual(wrongAfterFirstAttempt.difficult, true);
assert.strictEqual(wrongAfterFirstAttempt.reviewCount, 2, 'wrong answer must not advance review round');
assert.strictEqual(
  wrongAfterFirstAttempt.nextReviewTime,
  dueAt,
  'wrong answer must stay due instead of being scheduled into the future'
);
assert.strictEqual(wrongAfterFirstAttempt.reviewTimeline.at(-1).status, 'difficult');
assert.strictEqual(wrongAfterFirstAttempt.reviewTimeline.at(-1).reviewCount, 2);
assert.strictEqual(wrongAfterFirstAttempt.updatedAt, wrongAfterFirstAttempt.lastReviewTime);

assert.strictEqual(rightAfterFirstAttempt.mastered, true);
assert.strictEqual(rightAfterFirstAttempt.difficult, false);
assert.strictEqual(rightAfterFirstAttempt.reviewCount, 2);
assert.ok(rightAfterFirstAttempt.nextReviewTime > Date.now());
assert.strictEqual(rightAfterFirstAttempt.reviewTimeline.at(-1).status, 'mastered');
assert.strictEqual(rightAfterFirstAttempt.updatedAt, rightAfterFirstAttempt.lastReviewTime);

assert.strictEqual(learningRecords.length, 1);
assert.deepStrictEqual(learningRecords[0].learnedWordIds, [
  'senior_textbook_real_wrong',
  'senior_textbook_real_right'
]);
assert.deepStrictEqual(learningRecords[0].reviewStats, {
  masteredCount: 1,
  difficultCount: 1
});
assert.deepStrictEqual(
  page.data.allWords.map((word) => word.id),
  ['senior_textbook_real_wrong'],
  'only the wrong word should remain in the current review session'
);
assert.strictEqual(backCount, 0);

page.data.previewMastery = {
  senior_textbook_real_wrong: 'mastered'
};
page.completeReview();

mastery = storage.wordMastery.student456.senior_textbook_real;
const wrongAfterRetry = mastery.senior_textbook_real_wrong;
assert.strictEqual(wrongAfterRetry.mastered, true);
assert.strictEqual(wrongAfterRetry.difficult, false);
assert.strictEqual(
  wrongAfterRetry.reviewCount,
  3,
  'retry success should advance exactly one round after the prior wrong answer'
);
assert.strictEqual(wrongAfterRetry.reviewTimeline.at(-1).status, 'mastered');
assert.strictEqual(wrongAfterRetry.updatedAt, wrongAfterRetry.lastReviewTime);
assert.strictEqual(learningRecords.length, 2);
assert.strictEqual(learningRecords[1].reviewStats.masteredCount, 1);
assert.strictEqual(learningRecords[1].reviewStats.difficultCount, 0);
assert.strictEqual(backCount, 1);
assert.ok(emittedEvents.filter((eventName) => eventName === 'wordMasteryUpdated').length >= 2);
assert.ok(toasts.every((toast) => toast.title !== '保存失败，请重试'));
assert.strictEqual(storage.pendingWordMasterySync, undefined, 'read-only test must not queue a cloud write');

process.stdout.write('review-result-persistence: PASS\n');
