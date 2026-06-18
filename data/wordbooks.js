// 直接使用主包中的简化版词书数据
const simpleWordbooks = require('./wordbooks-simple.js');

// 导出简化版词书数据
const wordbooksFull = {
  primary: simpleWordbooks.primary,
  junior: simpleWordbooks.junior,
  senior: simpleWordbooks.senior
};

// 辅助函数
const generateWordsForBook = function (bookCategory, bookId, startIndex, count) {
  // 直接调用简化版的generateWordsForBook函数
  if (simpleWordbooks) {
    return simpleWordbooks.generateWordsForBook(bookCategory, bookId, startIndex, count);
  }
  
  // 确保bookCategory存在且是数组
  if (!Array.isArray(wordbooksFull[bookCategory])) {
    console.error('无效的词书分类:', bookCategory);
    return [];
  }
  
  const book = wordbooksFull[bookCategory].find(b => b.id === bookId);
  if (!book || !book.words) return [];
  
  const endIndex = startIndex + count;
  const result = book.words.slice(startIndex, endIndex).map(word => {
    // 确保单词ID为字符串类型，保持与wordbook-loader.js的一致性
    return {
      ...word,
      id: String(word.id)
    };
  });
  result._totalCount = book.words.length;
  return result;
};

const getBookById = function (bookId) {
  for (const category in wordbooksFull) {
    // 确保当前分类是数组
    if (Array.isArray(wordbooksFull[category])) {
      const book = wordbooksFull[category].find(b => b.id === bookId);
      if (book) return book;
    }
  }
  return null;
};

const getBooksByCategory = function (category) {
  return wordbooksFull[category] || [];
};

// 导出完整词书数据和辅助函数
module.exports = {
  ...wordbooksFull,
  generateWordsForBook,
  getBookById,
  getBooksByCategory
};