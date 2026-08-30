'use strict';

const SOURCE_TYPE = 'teacher_custom';
const CACHE_PREFIX = 'teacher_wb_';
const SERVER_WORD_ID_MARKER = '_w_';

const normalizeText = (value) => (
  String(value === undefined || value === null ? '' : value).trim()
);

const normalizeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const getLocalTeacherId = () => {
  if (typeof wx === 'undefined' || typeof wx.getStorageSync !== 'function') return '';
  try {
    const openid = normalizeText(wx.getStorageSync('openid'));
    if (openid) return openid;
    const currentUser = wx.getStorageSync('currentUser') || {};
    return normalizeText(currentUser.id || currentUser.username);
  } catch (error) {
    return '';
  }
};

const buildCacheKey = (teacherId, wordbookId, version) => (
  `${CACHE_PREFIX}${normalizeText(teacherId)}_${normalizeText(wordbookId)}_v${normalizeNumber(version)}`
);

const readCache = (cacheKey) => {
  if (typeof wx === 'undefined' || typeof wx.getStorageSync !== 'function') return null;
  try {
    return wx.getStorageSync(cacheKey) || null;
  } catch (error) {
    return null;
  }
};

const writeCache = (cacheKey, value) => {
  if (typeof wx === 'undefined' || typeof wx.setStorageSync !== 'function') return;
  try {
    wx.setStorageSync(cacheKey, value);
  } catch (error) {
    console.warn('[teacher-wordbook-loader] 缓存写入失败，继续使用内存结果:', error);
  }
};

const callTeacherWordbook = (data) => {
  if (typeof wx === 'undefined'
    || !wx.cloud
    || typeof wx.cloud.callFunction !== 'function') {
    return Promise.reject(new Error('WX_CLOUD_UNAVAILABLE'));
  }
  return wx.cloud.callFunction({ name: 'teacherWordbook', data });
};

const validateWords = (words, wordbookId, totalWords) => {
  if (!Array.isArray(words) || words.length !== totalWords || totalWords < 1) return false;
  const seenIds = new Set();
  return words.every((entry, index) => {
    const id = normalizeText(entry && entry.id);
    const valid = id.startsWith(`${wordbookId}${SERVER_WORD_ID_MARKER}`)
      && normalizeText(entry && entry.wordbookId) === wordbookId
      && !!normalizeText(entry && entry.word)
      && !!normalizeText(entry && entry.meaning)
      && normalizeNumber(entry && entry.order) === index + 1
      && !seenIds.has(id);
    if (valid) seenIds.add(id);
    return valid;
  });
};

const normalizeLoadedBook = (book, teacherId, options = {}) => {
  const wordbookId = normalizeText(book && (book.wordbookId || book.id));
  const version = normalizeNumber(book && book.version);
  const totalWords = normalizeNumber(book && book.totalWords);
  const status = normalizeText(book && book.status);
  const words = Array.isArray(book && book.words) ? book.words.map((entry) => ({
    id: normalizeText(entry.id),
    wordbookId: normalizeText(entry.wordbookId),
    word: normalizeText(entry.word),
    phonetic: normalizeText(entry.phonetic),
    meaning: normalizeText(entry.meaning),
    order: normalizeNumber(entry.order)
  })) : [];

  const statusAllowed = options.allowHistorical === true
    ? status === 'active' || status === 'disabled'
    : status === 'active';

  if (!wordbookId || version < 1 || !statusAllowed
    || !validateWords(words, wordbookId, totalWords)) {
    throw new Error('TEACHER_WORDBOOK_PAYLOAD_INVALID');
  }

  return {
    id: wordbookId,
    wordbookId,
    title: normalizeText(book.title),
    sourceType: SOURCE_TYPE,
    category: normalizeText(book.category),
    description: normalizeText(book.description),
    version,
    totalWords,
    status,
    teacherId,
    words
  };
};

const loadTeacherCustomWordbook = async (book, options = {}) => {
  const sourceType = normalizeText(book && book.sourceType);
  const wordbookId = normalizeText(book && (book.wordbookId || book.id));
  const version = normalizeNumber(book && book.version);
  if (sourceType !== SOURCE_TYPE) throw new Error('TEACHER_WORDBOOK_SOURCE_REQUIRED');
  if (!wordbookId || version < 1) throw new Error('TEACHER_WORDBOOK_ARGUMENT_INVALID');
  if (normalizeText(book.status) && normalizeText(book.status) !== 'active') {
    throw new Error('TEACHER_WORDBOOK_NOT_ACTIVE');
  }

  const localTeacherId = normalizeText(options.teacherId) || getLocalTeacherId();
  const cacheKey = localTeacherId ? buildCacheKey(localTeacherId, wordbookId, version) : '';
  if (!options.forceRefresh && cacheKey) {
    const cached = readCache(cacheKey);
    if (cached
      && normalizeText(cached.teacherId) === localTeacherId
      && normalizeText(cached.wordbookId) === wordbookId
      && normalizeNumber(cached.version) === version) {
      return normalizeLoadedBook(cached, localTeacherId);
    }
  }

  const callFunction = options.callFunction || callTeacherWordbook;
  const response = await callFunction({
    action: 'getPublished',
    wordbookId,
    version
  });
  const result = response && response.result ? response.result : response;
  if (!result || result.success !== true) {
    const error = new Error(result && (result.reason || result.error)
      ? (result.reason || result.error)
      : 'TEACHER_WORDBOOK_LOAD_FAILED');
    error.code = result && result.error ? result.error : 'TEACHER_WORDBOOK_LOAD_FAILED';
    throw error;
  }

  const responseTeacherId = normalizeText(result.teacherId);
  if (!responseTeacherId || (localTeacherId && responseTeacherId !== localTeacherId)) {
    throw new Error('TEACHER_WORDBOOK_OWNER_MISMATCH');
  }
  const loadedBook = normalizeLoadedBook(result.book, responseTeacherId);
  if (loadedBook.wordbookId !== wordbookId || loadedBook.version !== version) {
    throw new Error('TEACHER_WORDBOOK_VERSION_MISMATCH');
  }

  writeCache(buildCacheKey(responseTeacherId, wordbookId, version), {
    ...loadedBook,
    cachedAt: Date.now()
  });
  return loadedBook;
};

const loadTeacherCustomWordbookVersion = async (book, options = {}) => {
  const sourceType = normalizeText(book && book.sourceType);
  const wordbookId = normalizeText(book && (book.wordbookId || book.id));
  const version = normalizeNumber(book && book.version);
  if (sourceType !== SOURCE_TYPE) throw new Error('TEACHER_WORDBOOK_SOURCE_REQUIRED');
  if (!wordbookId || version < 1) throw new Error('TEACHER_WORDBOOK_ARGUMENT_INVALID');

  const localTeacherId = normalizeText(options.teacherId) || getLocalTeacherId();
  const cacheKey = localTeacherId ? buildCacheKey(localTeacherId, wordbookId, version) : '';
  if (!options.forceRefresh && cacheKey) {
    const cached = readCache(cacheKey);
    if (cached
      && normalizeText(cached.teacherId) === localTeacherId
      && normalizeText(cached.wordbookId) === wordbookId
      && normalizeNumber(cached.version) === version) {
      return normalizeLoadedBook(cached, localTeacherId, { allowHistorical: true });
    }
  }

  const callFunction = options.callFunction || callTeacherWordbook;
  const response = await callFunction({
    action: 'getPublishedVersion',
    wordbookId,
    version
  });
  const result = response && response.result ? response.result : response;
  if (!result || result.success !== true || result.historicalVersion !== true) {
    const error = new Error(result && (result.reason || result.error)
      ? (result.reason || result.error)
      : 'TEACHER_WORDBOOK_HISTORY_LOAD_FAILED');
    error.code = result && result.error ? result.error : 'TEACHER_WORDBOOK_HISTORY_LOAD_FAILED';
    throw error;
  }

  const responseTeacherId = normalizeText(result.teacherId);
  if (!responseTeacherId || (localTeacherId && responseTeacherId !== localTeacherId)) {
    throw new Error('TEACHER_WORDBOOK_OWNER_MISMATCH');
  }
  const loadedBook = normalizeLoadedBook(
    result.book,
    responseTeacherId,
    { allowHistorical: true }
  );
  if (loadedBook.wordbookId !== wordbookId || loadedBook.version !== version) {
    throw new Error('TEACHER_WORDBOOK_VERSION_MISMATCH');
  }

  writeCache(buildCacheKey(responseTeacherId, wordbookId, version), {
    ...loadedBook,
    cachedAt: Date.now()
  });
  return loadedBook;
};

module.exports = {
  SOURCE_TYPE,
  CACHE_PREFIX,
  buildCacheKey,
  getLocalTeacherId,
  loadTeacherCustomWordbook,
  loadTeacherCustomWordbookVersion,
  validateWords
};
