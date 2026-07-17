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

// 词书 ID → 云存储文件路径映射
const CLOUD_WORDBOOK_MAP = {
  senior_textbook_real: {
    path: 'wordbooks/senior_real_words.json',
    cloudFileID: `cloud://${CLOUD_ENV_ID}.${CLOUD_BUCKET}/wordbooks/senior_real_words.json`,
    version: 1,
    totalWords: 4209
  },
  gaokao_reading_words: {
    path: 'wordbooks/gaokao_reading_words.json',
    cloudFileID: `cloud://${CLOUD_ENV_ID}.${CLOUD_BUCKET}/wordbooks/gaokao_reading_words.json`,
    version: 1,
    totalWords: 687
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
 * 从本地缓存读取词书数据
 */
const getCachedWords = (bookId) => {
  try {
    const cacheKey = CACHE_PREFIX + bookId;
    const cached = wx.getStorageSync(cacheKey);
    if (cached && Array.isArray(cached)) {
      console.log(`[cloud-wordbook] 命中本地缓存: ${bookId}, ${cached.length} 词`);
      return cached;
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
  try {
    const cacheKey = CACHE_PREFIX + bookId;
    wx.setStorageSync(cacheKey, words);
    console.log(`[cloud-wordbook] 缓存已保存: ${bookId}, ${words.length} 词`);
  } catch (e) {
    console.warn('[cloud-wordbook] 保存缓存失败（可能超出存储上限）:', e);
  }
};

/**
 * 从云端下载词书 JSON 并缓存到本地
 * 使用 wx.cloud.downloadFile（CloudBase SDK），不依赖 request 域名白名单
 * 返回 words 数组，失败时返回 null
 */
const downloadWordsFromCloud = (bookId) => {
  return new Promise((resolve) => {
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
          if (Array.isArray(words) && words.length > 0) {
            console.log(`[cloud-wordbook] 下载成功: ${bookId}, ${words.length} 词`);
            setCachedWords(bookId, words);
            resolve(words);
          } else {
            console.warn('[cloud-wordbook] 下载数据格式异常（非数组或为空）');
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
  getCachedWords,
  setCachedWords,
  downloadWordsFromCloud,
  ensureWordsLoaded,
  getWordsSync,
  isCloudWordbook
};
