'use strict';

const officialWordbookData = require('../data/wordbooks.js');
const TeacherWordbookAdapter = require('./teacher-wordbook-adapter.js');
const TeacherCustomWordbookLoader = require('./teacher-custom-wordbook-loader.js');

const SOURCE_TYPES = Object.freeze({
  OFFICIAL: 'official',
  TEACHER_CUSTOM: TeacherWordbookAdapter.SOURCE_TYPE
});

const OFFICIAL_CATEGORIES = Object.freeze(['primary', 'junior', 'senior']);

const flattenOfficialWordbooks = (source = officialWordbookData) => {
  if (Array.isArray(source)) return source.slice();

  return OFFICIAL_CATEGORIES.reduce((books, category) => {
    if (source && Array.isArray(source[category])) {
      books.push(...source[category]);
    }
    return books;
  }, []);
};

const adaptOfficialWordbook = (book = {}) => {
  const id = String(book.id === undefined || book.id === null ? '' : book.id);

  return {
    ...book,
    id,
    wordbookId: id,
    title: book.title || '',
    sourceType: SOURCE_TYPES.OFFICIAL,
    category: book.category || '',
    description: book.description || '',
    version: book.version === undefined ? 1 : book.version,
    totalWords: Number.isFinite(Number(book.totalWords)) ? Number(book.totalWords) : 0,
    status: 'active',
    canManage: false
  };
};

const getOfficialWordbooks = (source = officialWordbookData) => (
  flattenOfficialWordbooks(source).map(adaptOfficialWordbook)
);

const getTeacherWordbooks = async (options = {}) => (
  TeacherWordbookAdapter.listTeacherWordbooks({
    callFunction: options.callFunction,
    scope: options.scope
  })
);

const disableTeacherWordbook = (wordbookId, options = {}) => (
  TeacherWordbookAdapter.disableTeacherWordbook({
    wordbookId,
    callFunction: options.callFunction
  })
);

const listWordbooks = async (options = {}) => {
  const officialBooks = getOfficialWordbooks(
    options.officialSource || officialWordbookData
  );
  let teacherBooks = [];

  try {
    teacherBooks = await getTeacherWordbooks({
      callFunction: options.callFunction,
      scope: options.teacherScope
    });
  } catch (error) {
    if (typeof options.onTeacherError === 'function') {
      options.onTeacherError(error);
    } else {
      console.warn('[wordbook-repository] 教师词书目录读取失败，继续使用官方目录:', error);
    }
  }

  return officialBooks.concat(teacherBooks);
};

const groupWordbooks = (books = []) => ({
  officialWordbooks: books.filter((book) => (
    book && book.sourceType === SOURCE_TYPES.OFFICIAL
  )),
  teacherWordbooks: books.filter((book) => (
    book && book.sourceType === SOURCE_TYPES.TEACHER_CUSTOM
  ))
});

const loadWordbook = async (book, options = {}) => {
  const safeBook = book || {};
  const wordbookId = String(safeBook.wordbookId || safeBook.id || '').trim();
  const sourceType = String(safeBook.sourceType || '').trim();
  if (!wordbookId) throw new Error('WORDBOOK_ID_REQUIRED');

  if (sourceType === SOURCE_TYPES.TEACHER_CUSTOM) {
    return TeacherCustomWordbookLoader.loadTeacherCustomWordbook(safeBook, options);
  }
  if (!sourceType && wordbookId.startsWith('twb_')) {
    throw new Error('TEACHER_WORDBOOK_SOURCE_REQUIRED');
  }
  if (sourceType && sourceType !== SOURCE_TYPES.OFFICIAL) {
    throw new Error('WORDBOOK_SOURCE_UNSUPPORTED');
  }

  const officialBook = adaptOfficialWordbook(safeBook);
  const words = officialWordbookData.generateWordsForBook(
    officialBook.category || 'primary',
    wordbookId,
    0,
    99999
  );
  return {
    id: wordbookId,
    wordbookId,
    title: officialBook.title,
    sourceType: SOURCE_TYPES.OFFICIAL,
    version: officialBook.version,
    totalWords: officialBook.totalWords || (Array.isArray(words) ? words.length : 0),
    words: Array.isArray(words) ? words : []
  };
};

module.exports = {
  SOURCE_TYPES,
  adaptOfficialWordbook,
  getOfficialWordbooks,
  getTeacherWordbooks,
  disableTeacherWordbook,
  listWordbooks,
  groupWordbooks,
  loadWordbook
};
