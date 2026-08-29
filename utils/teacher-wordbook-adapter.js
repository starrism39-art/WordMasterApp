'use strict';

const SOURCE_TYPE = 'teacher_custom';

const normalizeText = (value) => (
  String(value === undefined || value === null ? '' : value).trim()
);

const normalizeNumber = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const adaptTeacherWordbook = (book = {}) => {
  const wordbookId = normalizeText(book.wordbookId || book.wordbook_id || book.id);

  return {
    ...book,
    id: wordbookId,
    wordbookId,
    title: normalizeText(book.title || book.name),
    sourceType: SOURCE_TYPE,
    category: normalizeText(book.category),
    description: normalizeText(book.description),
    version: normalizeNumber(book.version, 0),
    totalWords: normalizeNumber(
      book.totalWords === undefined ? book.total_words : book.totalWords,
      0
    ),
    status: normalizeText(book.status),
    canManage: true
  };
};

const callTeacherWordbook = (data) => {
  if (
    typeof wx === 'undefined'
    || !wx.cloud
    || typeof wx.cloud.callFunction !== 'function'
  ) {
    return Promise.reject(new Error('WX_CLOUD_UNAVAILABLE'));
  }

  return wx.cloud.callFunction({
    name: 'teacherWordbook',
    data
  });
};

const listTeacherWordbooks = async ({
  callFunction = callTeacherWordbook,
  scope = 'active'
} = {}) => {
  const request = scope === 'manage'
    ? { action: 'list', scope: 'manage' }
    : { action: 'list' };
  const response = await callFunction(request);
  const result = response && response.result ? response.result : response;

  if (!result || result.success !== true) {
    const error = new Error(result && result.error ? result.error : 'TEACHER_WORDBOOK_LIST_FAILED');
    error.code = result && result.error ? result.error : 'TEACHER_WORDBOOK_LIST_FAILED';
    throw error;
  }

  const books = Array.isArray(result.books) ? result.books : [];
  const adaptedBooks = books.map(adaptTeacherWordbook);
  return scope === 'manage'
    ? adaptedBooks
    : adaptedBooks.filter((book) => book.status === 'active');
};

const disableTeacherWordbook = async ({
  wordbookId,
  callFunction = callTeacherWordbook
} = {}) => {
  const normalizedWordbookId = normalizeText(wordbookId);
  if (!normalizedWordbookId) throw new Error('WORDBOOK_ID_REQUIRED');

  const response = await callFunction({
    action: 'disable',
    wordbookId: normalizedWordbookId
  });
  const result = response && response.result ? response.result : response;
  if (!result || result.success !== true) {
    const error = new Error(result && (result.reason || result.error)
      ? (result.reason || result.error)
      : 'TEACHER_WORDBOOK_DISABLE_FAILED');
    error.code = result && result.error ? result.error : 'TEACHER_WORDBOOK_DISABLE_FAILED';
    error.reason = result && result.reason ? result.reason : '';
    throw error;
  }

  return {
    ...result,
    book: adaptTeacherWordbook(result.book)
  };
};

module.exports = {
  SOURCE_TYPE,
  adaptTeacherWordbook,
  listTeacherWordbooks,
  disableTeacherWordbook
};
