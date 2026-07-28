'use strict';

const assert = require('assert');
const {
  assignStableWordIds,
  selectPreviewNotMasteredWords,
  stripStableWordOccurrenceSuffix
} = require('../utils/learning-word-ids.js');

const sourceWords = [
  { word: 'good' },
  { word: 'world' },
  { word: 'good' },
  { word: 'good' },
  { word: 'Unit 2' },
  { word: 'good__wm_occurrence_2' },
  ...Array.from({ length: 17 }, (_, index) => ({ word: `word${index + 1}` }))
];

const firstPass = assignStableWordIds(sourceWords, 'primary_textbook_real');
const secondPass = assignStableWordIds(sourceWords, 'primary_textbook_real');

assert.deepStrictEqual(
  firstPass.map((word) => word.id),
  secondPass.map((word) => word.id),
  '不同客户端对同一词书必须生成完全一致的稳定ID'
);
assert.strictEqual(
  firstPass[0].id,
  'primary_textbook_real_good',
  '首个词条必须保留旧ID，兼容既有掌握记录'
);
assert.strictEqual(firstPass[2].id, 'primary_textbook_real_good__wm_occurrence_3');
assert.strictEqual(firstPass[3].id, 'primary_textbook_real_good__wm_occurrence_4');
assert.strictEqual(
  firstPass[4].id,
  'primary_textbook_real_unit_2',
  '带数字的真实词组ID不能被当作重复词后缀'
);
assert.strictEqual(
  firstPass[5].id,
  'primary_textbook_real_good__wm_occurrence_2',
  '不同词条的旧ID必须优先保留，重复词后缀不能抢占'
);
assert.strictEqual(
  stripStableWordOccurrenceSuffix('good__wm_occurrence_3'),
  'good',
  '复习和记录展示必须去掉内部重复词后缀'
);
assert.strictEqual(
  stripStableWordOccurrenceSuffix('unit_2'),
  'unit_2',
  '普通数字结尾必须原样保留'
);
assert.strictEqual(
  new Set(firstPass.map((word) => word.id)).size,
  firstPass.length,
  '每个可选择词条都必须拥有唯一ID'
);

const tenSelectedIds = firstPass.slice(2, 12).map((word) => word.id);
const previewMastery = Object.fromEntries(
  tenSelectedIds.map((wordId) => [wordId, 'difficult'])
);
previewMastery.other_book_good_2 = 'difficult';
previewMastery[firstPass[0].id] = 'mastered';

const selectedWords = selectPreviewNotMasteredWords(
  firstPass,
  previewMastery,
  'primary_textbook_real'
);

assert.deepStrictEqual(
  selectedWords.map((word) => word.id),
  tenSelectedIds,
  '标记10个不会必须精确进入10个唯一词，不能扩散到同名词或其他词书'
);
assert.strictEqual(
  selectedWords.filter((word) => word.word === 'good').length,
  2,
  '重复词条必须按完整ID分别保留预习决定'
);

process.stdout.write('learning-word-ids: PASS\n');
