'use strict';

const assert = require('assert');
const {
  assignStableWordIds,
  collectProcessedPreviewWordIds,
  buildCompletionMasterySnapshot,
  mergeLatePreviewMastery
} = require('../utils/learning-word-ids.js');

const studentId = 'student-a';
const otherStudentId = 'student-b';
const wordbookId = 'book_alpha';
const otherWordbookId = 'book_alpha_extra';
const words = assignStableWordIds([
  { word: 'Apple' },
  { word: 'ice cream' },
  { word: 'repeat' },
  { word: 'repeat' },
  { word: 'Unit 2' }
], wordbookId);

const [apple, iceCream, firstRepeat, secondRepeat, unitTwo] = words;

const collect = (overrides = {}) => collectProcessedPreviewWordIds({
  words,
  studentId,
  wordbookId,
  previewMastery: {},
  previewExcludedWordIds: [],
  wordMastery: {},
  learningRecords: [],
  ...overrides
});

assert.deepStrictEqual(
  collect({
    previewMastery: {
      [apple.id.toUpperCase()]: 'mastered',
      [`${wordbookId}_ice   cream`]: 'difficult',
      [`${otherWordbookId}_apple`]: 'mastered'
    }
  }),
  [apple.id, iceCream.id],
  '本地 previewMastery 中掌握和未掌握都应退出预习，并安全兼容大小写与短语空格'
);

assert.deepStrictEqual(
  collect({ previewExcludedWordIds: [secondRepeat.id] }),
  [secondRepeat.id],
  '稳定重复后缀必须只排除实际处理过的重复词条'
);

assert.deepStrictEqual(
  collect({
    wordMastery: {
      [studentId]: {
        [wordbookId]: [apple.id, iceCream.id],
        [otherWordbookId]: [`${otherWordbookId}_unit_2`]
      },
      [otherStudentId]: {
        [wordbookId]: [unitTwo.id]
      }
    }
  }),
  [apple.id, iceCream.id],
  '旧数组 wordMastery 必须严格隔离学生和词书'
);

assert.deepStrictEqual(
  collect({
    wordMastery: {
      [studentId]: {
        [wordbookId]: {
          [apple.id]: { mastered: true, difficult: false },
          [iceCream.id]: { mastered: false, difficult: true }
        }
      }
    }
  }),
  [apple.id, iceCream.id],
  '旧对象 wordMastery 中掌握和未掌握记录都应退出预习'
);

assert.deepStrictEqual(
  collect({
    learningRecords: [
      {
        studentId,
        wordbookId,
        learnedWordIds: [apple.id.toUpperCase(), `${wordbookId}_ice   cream`],
        masteredWordIds: [apple.id],
        notMasteredWordIds: [iceCream.id]
      },
      {
        studentId: otherStudentId,
        wordbookId,
        learnedWordIds: [unitTwo.id]
      },
      {
        studentId,
        wordbookId: otherWordbookId,
        learnedWordIds: [`${otherWordbookId}_unit_2`]
      }
    ]
  }),
  [apple.id, iceCream.id],
  'learningRecords 能兜底 wordMastery 缺失和历史大小写/空格 ID，且不能跨学生或词书'
);

assert.deepStrictEqual(
  collect({
    learningRecords: [{
      studentId,
      wordbookId,
      studyWordsDetailed: [{ word: 'repeat' }]
    }]
  }),
  [],
  '只有英文拼写而无法区分重复位置的旧记录不得一次隐藏所有重复词条'
);

assert.deepStrictEqual(
  collect({
    learningRecords: [{
      studentId,
      wordbookId,
      studyWordsDetailed: [{ sourceWordId: secondRepeat.id, word: 'repeat' }]
    }]
  }),
  [secondRepeat.id],
  '带稳定 sourceWordId 的旧详细记录必须只隐藏实际学习的重复位置'
);

const initialProcessed = collect();
const lateCloudProcessed = collect({
  previewMastery: {
    [apple.id]: 'mastered',
    [iceCream.id]: 'difficult'
  }
});
assert.deepStrictEqual(initialProcessed, []);
assert.deepStrictEqual(
  words.filter(word => !new Set(lateCloudProcessed).has(word.id)).map(word => word.id),
  [firstRepeat.id, secondRepeat.id, unitTwo.id],
  '云端 previewMastery 晚到后必须能立即重新过滤当前预习列表'
);

assert.deepStrictEqual(
  mergeLatePreviewMastery(
    { [apple.id]: 'mastered' },
    { [apple.id]: 'difficult' },
    { [apple.id]: 'mastered', [iceCream.id]: 'difficult' }
  ),
  { [apple.id]: 'difficult', [iceCream.id]: 'difficult' },
  '云端晚到可补齐缺失状态，但不得覆盖请求期间用户刚标记的未掌握状态'
);

const completion = buildCompletionMasterySnapshot({
  learnedWordIds: [apple.id, iceCream.id],
  previewMastery: {
    [apple.id]: 'mastered',
    [iceCream.id]: 'mastered'
  },
  startMasteredWordIds: [apple.id],
  startNotMasteredWordIds: [iceCream.id],
  masteredWordIds: [apple.id],
  notMasteredWordIds: [iceCream.id]
});

assert.deepStrictEqual(completion.masterySnapshot, {
  [apple.id]: 'mastered',
  [iceCream.id]: 'difficult'
}, '完成检测后的临时答对不能把预习时的未掌握状态覆盖成掌握');
assert.deepStrictEqual(completion.antiForgettingSeedSnapshot, {
  [iceCream.id]: true
}, '预习未掌握词必须保留抗遗忘资格');

process.stdout.write('preview-completed-filter: PASS\n');
