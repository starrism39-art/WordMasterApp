/**
 * utils/cloud-wordbook-loader.js
 * 云端词书数据下载与缓存工具
 * 将词书 JSON 从 CloudBase 云存储下载到本地缓存，
 * 减少主包体积，支持按需加载。
 */
'use strict';

const CACHE_PREFIX = 'cloud_wb_';
const CLOUD_ENV_ID = 'cloudbase-4gafzdch60ad597b';
const CLOUD_BUCKET = '636c-cloudbase-4gafzdch60ad597b-1390590336';
const pendingDownloads = Object.create(null);

// 词书 ID → 云存储文件路径映射
const CLOUD_WORDBOOK_MAP = {
  senior_textbook_real: {
    path: 'wordbooks/senior_real_words.json',
    cloudFileID: `cloud://${CLOUD_ENV_ID}.${CLOUD_BUCKET}/wordbooks/senior_real_words.json`,
    version: 1,
    totalWords: 4209
  },
  new_curriculum_senior: {
    path: 'wordbooks/new_curriculum_senior_words.json',
    cloudFileID: `cloud://${CLOUD_ENV_ID}.${CLOUD_BUCKET}/wordbooks/new_curriculum_senior_words.json`,
    version: 1,
    totalWords: 3815
  },
  gaokao_reading_words: {
    path: 'wordbooks/gaokao_reading_words.json',
    cloudFileID: `cloud://${CLOUD_ENV_ID}.${CLOUD_BUCKET}/wordbooks/gaokao_reading_words.json`,
    version: 1,
    totalWords: 687
  },
  senior_exam_syllabus: {
    path: 'wordbooks/senior_exam_syllabus_words.json',
    cloudFileID: `cloud://${CLOUD_ENV_ID}.${CLOUD_BUCKET}/wordbooks/senior_exam_syllabus_words.json`,
    version: 1,
    totalWords: 2950
  },
  senior_exam_syllabus_level_0: {
    path: 'wordbooks/senior_exam_syllabus_level_0_words.json',
    cloudFileID: `cloud://${CLOUD_ENV_ID}.${CLOUD_BUCKET}/wordbooks/senior_exam_syllabus_level_0_words.json`,
    version: 1,
    totalWords: 1450
  },
  senior_exam_syllabus_level_1: {
    path: 'wordbooks/senior_exam_syllabus_level_1_words.json',
    cloudFileID: `cloud://${CLOUD_ENV_ID}.${CLOUD_BUCKET}/wordbooks/senior_exam_syllabus_level_1_words.json`,
    version: 1,
    totalWords: 500
  },
  senior_exam_syllabus_level_2: {
    path: 'wordbooks/senior_exam_syllabus_level_2_words.json',
    cloudFileID: `cloud://${CLOUD_ENV_ID}.${CLOUD_BUCKET}/wordbooks/senior_exam_syllabus_level_2_words.json`,
    version: 1,
    totalWords: 1000
  },
  junior_exam_syllabus: {
    path: 'wordbooks/junior_exam_syllabus_words.json',
    cloudFileID: `cloud://${CLOUD_ENV_ID}.${CLOUD_BUCKET}/wordbooks/junior_exam_syllabus_words.json`,
    version: 1,
    totalWords: 1569
  }
};

/**
 * 获取词书文件的 cloudFileID（供 wx.cloud.downloadFile 使用）
 */
const getCloudFileID = (bookId) => {
  const info = CLOUD_WORDBOOK_MAP[bookId];
  if (!info) return null;
  return info.cloudFileID;
};

/**
 * 只把达到配置数量的词书视为完整数据，避免半包缓存被当成整本词书。
 */
const isCompleteWordList = (bookId, words) => {
  if (!Array.isArray(words) || words.length === 0) return false;
  const info = CLOUD_WORDBOOK_MAP[bookId];
  const expectedTotal = info ? Number(info.totalWords || 0) : 0;
  return expectedTotal <= 0 || words.length >= expectedTotal;
};

/**
 * 从本地缓存读取词书数据
 */
const getCachedWords = (bookId) => {
  try {
    const cacheKey = CACHE_PREFIX + bookId;
    const cached = wx.getStorageSync(cacheKey);
    if (isCompleteWordList(bookId, cached)) {
      console.log(`[cloud-wordbook] 命中本地缓存: ${bookId}, ${cached.length} 词`);
      return cached;
    }
    if (Array.isArray(cached) && cached.length > 0) {
      console.warn(`[cloud-wordbook] 忽略不完整缓存: ${bookId}, ${cached.length} 词`);
    }
  } catch (e) {
    console.warn('[cloud-wordbook] 读取缓存失败:', e);
  }
  return null;
};

/**
 * 保存词书数据到本地缓存
 */
const setCachedWords = (bookId, words) => {
  if (!isCompleteWordList(bookId, words)) {
    console.warn(`[cloud-wordbook] 拒绝缓存不完整词书: ${bookId}, ${Array.isArray(words) ? words.length : 0} 词`);
    return false;
  }

  try {
    const cacheKey = CACHE_PREFIX + bookId;
    wx.setStorageSync(cacheKey, words);
    console.log(`[cloud-wordbook] 缓存已保存: ${bookId}, ${words.length} 词`);
    return true;
  } catch (e) {
    console.warn('[cloud-wordbook] 保存缓存失败（可能超出存储上限）:', e);
    return false;
  }
};

/**
 * 从云端下载词书 JSON 并缓存到本地
 * 使用 wx.cloud.downloadFile（CloudBase SDK），不依赖 request 域名白名单
 * 返回 words 数组，失败时返回 null
 */
const downloadWordsFromCloud = (bookId) => {
  if (pendingDownloads[bookId]) {
    console.log(`[cloud-wordbook] 复用进行中的下载: ${bookId}`);
    return pendingDownloads[bookId];
  }

  const downloadPromise = new Promise((resolve) => {
    const cloudFileID = getCloudFileID(bookId);
    if (!cloudFileID) {
      console.warn(`[cloud-wordbook] 未知词书: ${bookId}`);
      resolve(null);
      return;
    }

    // 检查 CloudBase 是否已初始化
    if (!wx.cloud) {
      console.warn('[cloud-wordbook] wx.cloud 不可用，无法下载云端词书');
      resolve(null);
      return;
    }

    console.log(`[cloud-wordbook] 开始下载: ${bookId}, cloudFileID: ${cloudFileID}`);

    wx.cloud.downloadFile({
      fileID: cloudFileID,
      success: (res) => {
        if (!res.tempFilePath) {
          console.warn('[cloud-wordbook] 下载成功但 tempFilePath 为空');
          resolve(null);
          return;
        }
        try {
          // 读取下载的临时文件内容
          const fs = wx.getFileSystemManager();
          const fileContent = fs.readFileSync(res.tempFilePath, 'utf-8');
          let words;
          try {
            words = JSON.parse(fileContent);
          } catch (parseErr) {
            console.warn('[cloud-wordbook] JSON 解析失败:', parseErr);
            resolve(null);
            return;
          }

          // 兼容可能包在对象里的情况
          if (!Array.isArray(words) && words && Array.isArray(words.data)) {
            words = words.data;
          }
          if (isCompleteWordList(bookId, words)) {
            console.log(`[cloud-wordbook] 下载成功: ${bookId}, ${words.length} 词`);
            setCachedWords(bookId, words);
            resolve(words);
          } else {
            const expectedTotal = CLOUD_WORDBOOK_MAP[bookId] && CLOUD_WORDBOOK_MAP[bookId].totalWords;
            console.warn(`[cloud-wordbook] 下载数据不完整: ${bookId}, 实际 ${Array.isArray(words) ? words.length : 0}, 预期 ${expectedTotal || '未知'}`);
            resolve(null);
          }
        } catch (readErr) {
          console.warn('[cloud-wordbook] 读取临时文件失败:', readErr);
          resolve(null);
        }
      },
      fail: (err) => {
        console.warn('[cloud-wordbook] 下载请求失败:', err);
        resolve(null);
      }
    });
  });

  pendingDownloads[bookId] = downloadPromise;
  const clearPending = () => {
    if (pendingDownloads[bookId] === downloadPromise) {
      delete pendingDownloads[bookId];
    }
  };
  downloadPromise.then(clearPending, clearPending);
  return downloadPromise;
};

/**
 * 获取词书数据（优先缓存，无缓存时下载）
 * 用于异步预加载场景
 */
const ensureWordsLoaded = async (bookId) => {
  const cached = getCachedWords(bookId);
  if (cached) return cached;
  const downloaded = await downloadWordsFromCloud(bookId);
  return downloaded;
};

/**
 * 同步获取词书数据（仅从缓存读取，不触发下载）
 * 供 generateWordsForBook 等同步函数调用
 */
const getWordsSync = (bookId) => {
  return getCachedWords(bookId);
};

/**
 * 检查词书是否已配置为云端加载
 */
const isCloudWordbook = (bookId) => {
  return !!CLOUD_WORDBOOK_MAP[bookId];
};

module.exports = {
  CLOUD_WORDBOOK_MAP,
  getCloudFileID,
  isCompleteWordList,
  getCachedWords,
  setCachedWords,
  downloadWordsFromCloud,
  ensureWordsLoaded,
  getWordsSync,
  isCloudWordbook
};
