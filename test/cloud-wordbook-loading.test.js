'use strict';

const assert = require('assert');

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

async function run() {
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
