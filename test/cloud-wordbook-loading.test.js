'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const storage = {
  cloud_wb_gaokao_reading_words: Array.from({ length: 30 }, (_, index) => ({
    word: `partial-${index}`
  }))
};
let downloadCalls = 0;
let downloadedWords = Array.from({ length: 687 }, (_, index) => ({
  word: `word-${index}`,
  meaning: `meaning-${index}`
}));

global.wx = {
  getStorageSync(key) {
    return storage[key];
  },
  setStorageSync(key, value) {
    storage[key] = value;
  },
  getFileSystemManager() {
    return {
      readFileSync() {
        return JSON.stringify(downloadedWords);
      }
    };
  },
  cloud: {
    downloadFile(options) {
      downloadCalls += 1;
      setImmediate(() => options.success({ tempFilePath: 'mock-wordbook.json' }));
    }
  }
};

const loader = require('../utils/cloud-wordbook-loader.js');
const wordbooks = require('../data/wordbooks-simple.js');

async function run() {
  assert.strictEqual(
    fs.existsSync(path.resolve(__dirname, '../data/new_curriculum_senior_words.js')),
    false,
    'new curriculum senior source data must stay out of the mini program package'
  );

  assert.deepStrictEqual(
    loader.CLOUD_WORDBOOK_MAP.new_curriculum_senior,
    {
      path: 'wordbooks/new_curriculum_senior_words.json',
      cloudFileID: 'cloud://cloudbase-4gafzdch60ad597b.636c-cloudbase-4gafzdch60ad597b-1390590336/wordbooks/new_curriculum_senior_words.json',
      version: 1,
      totalWords: 3815
    },
    'new curriculum senior wordbook should use the verified CloudBase object'
  );
  assert.strictEqual(loader.isCloudWordbook('new_curriculum_senior'), true);
  assert.deepStrictEqual(
    loader.CLOUD_WORDBOOK_MAP.senior_exam_syllabus,
    {
      path: 'wordbooks/senior_exam_syllabus_words.json',
      cloudFileID: 'cloud://cloudbase-4gafzdch60ad597b.636c-cloudbase-4gafzdch60ad597b-1390590336/wordbooks/senior_exam_syllabus_words.json',
      version: 1,
      totalWords: 2950
    },
    'exam syllabus wordbook should use the dedicated CloudBase object'
  );
  assert.strictEqual(loader.isCloudWordbook('senior_exam_syllabus'), true);
  const examSyllabusBook = wordbooks.senior.find(book => book.id === 'senior_exam_syllabus');
  assert.ok(examSyllabusBook, '高中词书列表应包含高中考纲词');
  assert.strictEqual(examSyllabusBook.title, '高中考纲词');
  assert.strictEqual(examSyllabusBook.totalWords, 2950);
  assert.strictEqual(
    loader.isCompleteWordList('senior_exam_syllabus', Array.from({ length: 2949 })),
    false,
    '2949 words must not be treated as a complete exam syllabus wordbook'
  );
  assert.strictEqual(
    loader.isCompleteWordList('senior_exam_syllabus', Array.from({ length: 2950 })),
    true,
    '2950 words should be treated as a complete exam syllabus wordbook'
  );
  assert.strictEqual(
    loader.isCompleteWordList('new_curriculum_senior', Array.from({ length: 3814 })),
    false,
    '3814 words must not be treated as a complete new curriculum wordbook'
  );
  assert.strictEqual(
    loader.isCompleteWordList('new_curriculum_senior', Array.from({ length: 3815 })),
    true,
    '3815 words should be treated as a complete new curriculum wordbook'
  );

  assert.strictEqual(
    loader.getCachedWords('gaokao_reading_words'),
    null,
    '不完整缓存不能作为整本词书使用'
  );

  const [first, second] = await Promise.all([
    loader.ensureWordsLoaded('gaokao_reading_words'),
    loader.ensureWordsLoaded('gaokao_reading_words')
  ]);

  assert.strictEqual(downloadCalls, 1, '并发加载同一本词书时只能下载一次');
  assert.strictEqual(first.length, 687, '首次加载应等待完整词书下载');
  assert.strictEqual(second.length, 687, '并发调用应共享完整下载结果');
  assert.strictEqual(storage.cloud_wb_gaokao_reading_words.length, 687, '完整词书应写入缓存');

  const cached = await loader.ensureWordsLoaded('gaokao_reading_words');
  assert.strictEqual(cached.length, 687, '后续加载应直接使用完整缓存');
  assert.strictEqual(downloadCalls, 1, '命中完整缓存后不应再次下载');

  downloadedWords = Array.from({ length: 3815 }, (_, index) => ({
    word: `new-curriculum-${index}`,
    meaning: `meaning-${index}`
  }));
  const newCurriculumWords = await loader.ensureWordsLoaded('new_curriculum_senior');
  assert.strictEqual(newCurriculumWords.length, 3815);
  assert.strictEqual(storage.cloud_wb_new_curriculum_senior.length, 3815);
  assert.strictEqual(downloadCalls, 2, 'new curriculum senior wordbook should download once');

  downloadedWords = Array.from({ length: 2950 }, (_, index) => ({
    word: index === 0 ? 'education' : `exam-syllabus-${index}`,
    phonetic: index === 0 ? '/ˌedʒ.uˈkeɪ.ʃən/' : `/exam-${index}/`,
    meaning: index === 0 ? '教育' : `释义-${index}`
  }));
  const examSyllabusWords = await loader.ensureWordsLoaded('senior_exam_syllabus');
  assert.strictEqual(examSyllabusWords.length, 2950);
  assert.strictEqual(examSyllabusWords[0].word, 'education');
  assert.strictEqual(storage.cloud_wb_senior_exam_syllabus.length, 2950);
  assert.strictEqual(downloadCalls, 3, '高中考纲词应完整下载一次');

  downloadedWords = Array.from({ length: 100 }, (_, index) => ({ word: `short-${index}` }));
  const incomplete = await loader.downloadWordsFromCloud('senior_textbook_real');
  assert.strictEqual(incomplete, null, '数量不足的云端文件不能进入学习流程');
  assert.strictEqual(storage.cloud_wb_senior_textbook_real, undefined, '数量不足的数据不能写入缓存');

  process.stdout.write('cloud-wordbook-loading: PASS\n');
}

run().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
