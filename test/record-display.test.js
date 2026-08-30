'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  createWordbookOptions,
  normalizeWordbookTitle,
  prepareRecordForDisplay
} = require('../utils/record-display');

const learningRecord = prepareRecordForDisplay({
  wordbookId: 'senior_textbook_real',
  wordbookTitle: '高中统编版英语词书',
  recordCategory: 'word',
  totalWords: 6,
  masteredCount: 2,
  notMasteredCount: 4,
  recordCount: 3
});

const reviewRecord = prepareRecordForDisplay({
  wordbookId: 'senior_textbook_real',
  wordbookTitle: '高中统编版英语词书（抗遗忘复习）',
  recordType: 'anti_forgetting_review',
  totalWords: 8,
  recordCount: 2
});

const readingRecord = prepareRecordForDisplay({
  wordbookId: 'gaokao_reading_words',
  wordbookTitle: '高考英语阅读高频词汇',
  totalWords: 1,
  masteredCount: 0,
  notMasteredCount: 1
});

assert.strictEqual(learningRecord.recordTypeLabel, '学习记录');
assert.strictEqual(learningRecord.masteredPercentage, 33);
assert.strictEqual(learningRecord.notMasteredPercentage, 67);
assert.strictEqual(learningRecord.recordCountLabel, '当日 3 次学习已合并');
assert.strictEqual(reviewRecord.recordCategory, 'anti');
assert.strictEqual(reviewRecord.recordTypeLabel, '抗遗忘复习记录');
assert.strictEqual(reviewRecord.displayWordbookTitle, '高中统编版英语词书');
assert.strictEqual(reviewRecord.recordCountLabel, '当日 2 次抗遗忘复习已合并');
assert.strictEqual(normalizeWordbookTitle('高中统编版英语词书（抗遗忘复习）'), '高中统编版英语词书');
assert.notStrictEqual(learningRecord.wordbookTone, readingRecord.wordbookTone);

const options = createWordbookOptions([learningRecord, reviewRecord, readingRecord]);
assert.deepStrictEqual(options.map(item => item.id), ['all', 'gaokao_reading_words', 'senior_textbook_real']);
assert.strictEqual(options[0].recordCount, 3);
assert.strictEqual(options.find(item => item.id === 'senior_textbook_real').recordCount, 2);

const recordsPageSource = fs.readFileSync(path.join(__dirname, '../subpages/records/records.js'), 'utf8');
const recordsTemplate = fs.readFileSync(path.join(__dirname, '../subpages/records/records.wxml'), 'utf8');
assert.match(recordsPageSource, /recordTypeFilter:\s*'all'/, '记录页默认应同时展示学习和复习记录');
assert.match(recordsTemplate, /data-filter="anti"/, '记录页应提供复习记录筛选');
assert.match(recordsTemplate, /data-wordbook-id=/, '记录页应提供词书筛选');

process.stdout.write('record-display: PASS\n');
