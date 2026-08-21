// WordbookLoader类实现
class WordbookLoader {
  constructor() {
    this.cachedWords = {};
    this.wordFiles = {
      primary: './primary_real_words.js',
      primary_basic: './primary_real_words.js',
      primary_intermediate: './primary_real_words.js',
      primary_advanced: './primary_real_words.js',
      junior_7th: './new_standard_7th_grade_words.js',
      junior_8th: './new_standard_8th_grade_words.js',
      junior_8th_second: './new_standard_8th_grade_second.js',
      junior_9th: './new_standard_9th_grade_words.js',
      junior_9th_second: './new_standard_9th_grade_second.js',
      junior_7th_ji: './ji_7th_grade_words.js',
      junior_7th_ji_second: './ji_7th_grade_second.js',
      junior_8th_ji_first: './ji_8th_grade_first.js',
      junior_8th_ji_second: './ji_8th_grade_second.js',
      junior_9th_ji: './ji_9th_grade_words.js',
      junior_7th_yi_lin: './yi_lin_7th_grade_first.js',
      junior_7th_yi_lin_second: './yi_lin_7th_grade_second.js',
      junior_8th_yi_lin_first: './yi_lin_8th_grade_first.js',
      junior_8th_yi_lin_second: './yi_lin_8th_grade_second.js',
      junior_9th_yi_lin_first: './yi_lin_9th_grade_first.js',
      junior_9th_yi_lin_second: './yi_lin_9th_grade_second.js',
      // 【云端迁移】senior_real_words.js 已迁移至云端，保留映射但允许加载失败时静默降级
      senior: '',
      senior_book_1_ren_jiao: './ren_jiao_senior_book_1.js',
      senior_book_2_ren_jiao: './ren_jiao_senior_book_2.js',
      senior_book_3_ren_jiao: './ren_jiao_senior_book_3.js'
    };
  }

  normalizeWordStem(word) {
    if (typeof word !== 'string') return '';
    const match = word.trim().toLowerCase().match(/[a-z]+/);
    return match ? match[0] : '';
  }

  containsChinese(text) {
    return /[\u4e00-\u9fa5]/.test(text || '');
  }

  sanitizeWordText(word) {
    if (typeof word !== 'string') return word;
    let cleaned = word;

    // 去除括号及其内容：sweep(swept, swept) -> sweep
    cleaned = cleaned.replace(/\s*[\(（][^()（）]*[\)）]\s*/g, ' ');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned || word;
  }

  sanitizeMergedMeaning(meaning, nextWord) {
    if (typeof meaning !== 'string') return meaning;
    let cleaned = meaning.replace(/\s+/g, ' ').trim();

    // 统一全角点号并清理开头噪声字符
    cleaned = cleaned
      .replace(/．/g, '.')
      .replace(/^[\]\[\/\s]+/, '');

    // 全局修复词性缩写OCR错误（不局限于字符串开头）
    cleaned = cleaned
      .replace(/\bd\.\s*onj\./gi, 'prep. conj.')
      .replace(/\bprep\.\s*onj\./gi, 'prep. conj.')
      .replace(/\bconj\.\s*rep\./gi, 'conj. prep.')
      .replace(/\bad\.\s*ron\./gi, 'adv. pron.')
      .replace(/\b(?:\.?\s*)ron\./gi, 'pron.')
      .replace(/\b(?:\.?\s*)rep\./gi, 'prep.')
      .replace(/\b(?:\.?\s*)onj\./gi, 'conj.')
      .replace(/\b(?:\.?\s*)dv\./gi, 'adv.')
      .replace(/\b(?:\.?\s*)odal\s*v\./gi, 'modal v.')
      .replace(/\b(?:\.?\s*)um\./gi, 'num.')
      .replace(/\b(?:\.?\s*)ink\.?\s*v\.?/gi, 'linking v.')
      .replace(/\b(?:\.?\s*)t\./gi, 'vt.')
      .replace(/\b(?:\.?\s*)i\./gi, 'vi.')
      // 统一词性标签间的连接格式
      .replace(/\b(vt|vi|adj|adv|prep|conj|pron|det|num|n|v)\.\s*(vt|vi|adj|adv|prep|conj|pron|det|num|n|v)\./gi, '$1., $2.')
      .replace(/\b(conj|prep|adv|pron|det|num)\.\s*(conj|prep|adv|pron|det|num)\./gi, '$1., $2.')
      // 修复词性标签与后文粘连（如 "由于prep.从……"）
      .replace(/([\u4e00-\u9fa5；;，,])\s*(prep\.|conj\.|adv\.|pron\.|det\.|num\.|adj\.|vt\.|vi\.|n\.|v\.)/gi, '$1 $2')
      .replace(/(prep\.|conj\.|adv\.|pron\.|det\.|num\.|adj\.|vt\.|vi\.|n\.|v\.)(?=[\u4e00-\u9fa5A-Za-z])/g, '$1 ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const nextStem = this.normalizeWordStem(nextWord);
    if (nextStem) {
      const candidates = [nextStem];
      if (nextStem.length > 3) {
        candidates.push(nextStem.slice(1));
      }

      const lowerCleaned = cleaned.toLowerCase();
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        const idx = lowerCleaned.indexOf(candidate);
        if (idx > 0) {
          const before = cleaned.slice(0, idx).trim();
          const after = cleaned.slice(idx);
          const looksLikeNextEntry = /\/\[[^\]]+\]/.test(after) || /\b(n\.|v\.|vt\.|vi\.|adj\.|adv\.|pron\.|prep\.|conj\.)\b/i.test(after);
          if (this.containsChinese(before) && looksLikeNextEntry) {
            cleaned = before.replace(/[，,;；、\s]+$/, '');
            break;
          }
        }
      }
    }

    const genericMatch = cleaned.match(/^(.+?[\u4e00-\u9fa5）\)])\s+[A-Za-z][A-Za-z()\-\s.'/]*\/\[[^\]]+\].*$/);
    if (genericMatch) {
      cleaned = genericMatch[1].replace(/[，,;；、\s]+$/, '');
    }

    return cleaned;
  }

  sanitizeWordEntries(words) {
    if (!Array.isArray(words)) return [];
    return words.map((item, index) => {
      if (!item || typeof item !== 'object') return item;
      const nextWord = words[index + 1] && words[index + 1].word ? words[index + 1].word : '';
      const fixedMeaning = this.sanitizeMergedMeaning(item.meaning, nextWord);
      const fixedWord = this.sanitizeWordText(item.word);
      if (fixedMeaning === item.meaning && fixedWord === item.word) {
        return item;
      }
      return {
        ...item,
        word: fixedWord,
        meaning: fixedMeaning
      };
    });
  }

  // 初始化方法，在应用启动时调用
  init() {
    console.log('WordbookLoader initialized in mini-program environment');
    this.cacheAllWordbooks();
  }

  // 缓存所有词书数据
  cacheAllWordbooks() {
    for (const [key, path] of Object.entries(this.wordFiles)) {
      try {
        // 使用小程序环境下的同步加载方式
        const jsonData = require(path);
        this.cachedWords[key] = this.sanitizeWordEntries(jsonData);
        console.log(`Successfully loaded ${key} from ${path}`);
      } catch (e) {
        console.error(`Failed to load ${key} from ${path}:`, e);
        // 加载失败时使用空数组
        this.cachedWords[key] = [];
      }
    }
  }

  // 加载指定级别的词书
  loadWordbook(level) {
    return new Promise((resolve, reject) => {
      try {
        const filePath = this.wordFiles[level];
        if (!filePath) {
          reject(new Error(`未知的词书级别: ${level}`));
          return;
        }

        // 使用小程序环境下的同步加载方式
        const jsonData = require(filePath);
        this.cachedWords[level] = this.sanitizeWordEntries(jsonData);
        console.log(`成功加载${level}级词汇，共${jsonData.length}个单词`);
        resolve(this.cachedWords[level]);
      } catch (error) {
        console.error(`加载${level}级词书失败:`, error);
        // 使用备用数据
        const fallbackData = this.getFallbackWords(level);
        this.cachedWords[level] = fallbackData;
        resolve(fallbackData);
      }
    });
  }

  /**
   * 获取指定级别的词汇数据
   * @param {string} level - 级别
   * @returns {Array} - 词汇数组
   */
  getWordsByLevel(level) {
    return this.cachedWords[level] || this.getFallbackWords(level);
  }

  /**
   * 获取备用词汇数据
   * @param {string} level - 级别
   * @returns {Array} - 备用词汇数组
   */
  getFallbackWords(level) {
    return [];
  }

  /**
   * 根据词书类别和ID生成词书单词
   * @param {string} wordbookCategory - 词书类别
   * @param {string} wordbookId - 词书ID
   * @param {number} startIndex - 起始索引
   * @param {number} batchSize - 批量大小
   * @returns {Array} - 单词数组，包含_totalCount属性
   */
  generateWordsForBook(wordbookCategory, wordbookId, startIndex, batchSize) {
    console.log('生成词书单词:', wordbookCategory, wordbookId, startIndex, batchSize);

    let allWords = [];
    let cloudWordbookLoader = null;
    let isCloudWordbookId = false;
    try {
      cloudWordbookLoader = require('../utils/cloud-wordbook-loader.js');
      isCloudWordbookId = cloudWordbookLoader.isCloudWordbook(wordbookId);
    } catch (error) {
      console.warn('检查云端词书配置失败:', error);
    }

    if (isCloudWordbookId && cloudWordbookLoader) {
      try {
        const cloudWords = cloudWordbookLoader.getWordsSync(wordbookId);
        if (cloudWords && cloudWords.length > 0) {
          allWords = cloudWords;
          console.log('成功从云端缓存加载词书，数量:', allWords.length);
        }
      } catch (e) {
        console.warn('云端词书缓存读取失败:', e);
      }
    }
    
    // 首先检查是否是人教版重录版（v2）
    if (allWords.length > 0) {
      // 云端词书已从缓存加载，跳过本地文件路由。
    } else if (wordbookId === 'junior_7th_ren_jiao_v2') {
      try {
        allWords = require('./ren_jiao_7th_grade_first_v2.js');
        console.log('成功加载人教版七年级上册 v2（重录版），数量:', allWords.length);
      } catch (e) {
        console.error('加载人教版七年级上册 v2 失败:', e);
      }
    } else if (wordbookId === 'junior_7th_ren_jiao_second_v2') {
      try {
        allWords = require('./ren_jiao_7th_grade_second_v2.js');
        console.log('成功加载人教版七年级下册 v2（重录版），数量:', allWords.length);
      } catch (e) {
        console.error('加载人教版七年级下册 v2 失败:', e);
      }
    } else if (wordbookId === 'junior_8th_ren_jiao_v2') {
      try {
        allWords = require('./ren_jiao_8th_grade_first_v2.js');
        console.log('成功加载人教版八年级上册 v2（重录版），数量:', allWords.length);
      } catch (e) {
        console.error('加载人教版八年级上册 v2 失败:', e);
      }
    } else if (wordbookId === 'junior_8th_ren_jiao_second_v2') {
      try {
        allWords = require('./ren_jiao_8th_grade_second_v2.js');
        console.log('成功加载人教版八年级下册 v2（重录版），数量:', allWords.length);
      } catch (e) {
        console.error('加载人教版八年级下册 v2 失败:', e);
      }
    } else if (wordbookId === 'junior_9th_ren_jiao_v2') {
      try {
        allWords = require('./ren_jiao_9th_grade_v2.js');
        console.log('成功加载人教版九年级全一册 v2（重录版），数量:', allWords.length);
      } catch (e) {
        console.error('加载人教版九年级全一册 v2 失败:', e);
      }
    } else if (wordbookId.includes('ren_jiao')) {
      // 加载人教版单词
      try {
        let renJiaoWords = [];
        if (wordbookId.includes('senior') && wordbookId.includes('book_2')) {
          // 人教版高中必修二
          renJiaoWords = require('./ren_jiao_senior_book_2.js');
          console.log('成功加载人教版高中必修二单词，数量:', renJiaoWords.length);
        } else if (wordbookId.includes('senior') && wordbookId.includes('book_1')) {
          // 人教版高中必修一
          renJiaoWords = require('./ren_jiao_senior_book_1.js');
          console.log('成功加载人教版高中必修一单词，数量:', renJiaoWords.length);
        } else if (wordbookId.includes('9th')) {
          // 人教版九年级全一册
          renJiaoWords = require('./ren_jiao_9th_grade.js');
          console.log('成功加载人教版九年级全一册单词，数量:', renJiaoWords.length);
        } else if (wordbookId.includes('8th') && wordbookId.includes('second')) {
          // 人教版八年级下册
          renJiaoWords = require('./ren_jiao_8th_grade_second.js');
          console.log('成功加载人教版八年级下册单词，数量:', renJiaoWords.length);
        } else if (wordbookId.includes('8th')) {
          // 人教版八年级上册
          renJiaoWords = require('./ren_jiao_8th_grade_first.js');
          console.log('成功加载人教版八年级上册单词，数量:', renJiaoWords.length);
        } else if (wordbookId.includes('7th') && wordbookId.includes('second')) {
          // 人教版七年级下册
          renJiaoWords = require('./ren_jiao_7th_grade_second.js');
          console.log('成功加载人教版七年级下册单词，数量:', renJiaoWords.length);
        } else if (wordbookId.includes('7th')) {
          // 人教版七年级上册
          renJiaoWords = require('./ren_jiao_7th_grade_first.js');
          console.log('成功加载人教版七年级上册单词，数量:', renJiaoWords.length);
        }
        allWords = renJiaoWords;
      } catch (error) {
        console.error('加载人教版单词失败:', error);
        allWords = [];
      }
    }
    
    // 如果没有加载到单词，再根据词书ID确定加载哪个单词文件
    if (allWords.length === 0 && !isCloudWordbookId) {
      if (wordbookId.includes('yi_lin')) {
        // 加载译林牛津版单词
        try {
          let yiLinWords = [];
          if (wordbookId.includes('9th') && wordbookId.includes('second')) {
            yiLinWords = require('./yi_lin_9th_grade_second.js');
            console.log('成功加载译林牛津版九年级下册单词，数量:', yiLinWords.length);
          } else if (wordbookId.includes('9th')) {
            yiLinWords = require('./yi_lin_9th_grade_first.js');
            console.log('成功加载译林牛津版九年级上册单词，数量:', yiLinWords.length);
          } else if (wordbookId.includes('8th') && wordbookId.includes('second')) {
            yiLinWords = require('./yi_lin_8th_grade_second.js');
            console.log('成功加载译林牛津版八年级下册单词，数量:', yiLinWords.length);
          } else if (wordbookId.includes('8th')) {
            yiLinWords = require('./yi_lin_8th_grade_first.js');
            console.log('成功加载译林牛津版八年级上册单词，数量:', yiLinWords.length);
          } else if (wordbookId.includes('7th') && wordbookId.includes('second')) {
            yiLinWords = require('./yi_lin_7th_grade_second.js');
            console.log('成功加载译林牛津版七年级下册单词，数量:', yiLinWords.length);
          } else {
            yiLinWords = require('./yi_lin_7th_grade_first.js');
            console.log('成功加载译林牛津版七年级上册单词，数量:', yiLinWords.length);
          }
          allWords = yiLinWords;
        } catch (error) {
          console.error('加载译林牛津版单词失败:', error);
          allWords = [];
        }
      } else if (wordbookId.includes('ji')) {
        // 加载冀教版单词
        try {
          let jiWords = [];
          if (wordbookId.includes('7th') && wordbookId.includes('second')) {
            jiWords = require('./ji_7th_grade_second.js');
            console.log('成功加载冀教版七年级下册单词，数量:', jiWords.length);
          } else if (wordbookId.includes('7th')) {
            jiWords = require('./ji_7th_grade_words.js');
            console.log('成功加载冀教版七年级上册单词，数量:', jiWords.length);
          } else if (wordbookId.includes('8th') && wordbookId.includes('second')) {
            jiWords = require('./ji_8th_grade_second.js');
            console.log('成功加载冀教版八年级下册单词，数量:', jiWords.length);
          } else if (wordbookId.includes('8th')) {
            jiWords = require('./ji_8th_grade_first.js');
            console.log('成功加载冀教版八年级上册单词，数量:', jiWords.length);
          } else if (wordbookId.includes('9th')) {
            jiWords = require('./ji_9th_grade_words.js');
            console.log('成功加载冀教版九年级单词，数量:', jiWords.length);
          }
          console.log('成功加载冀教版单词，数量:', jiWords.length);
          allWords = jiWords;
        } catch (error) {
          console.error('加载冀教版单词失败:', error);
          allWords = [];
        }
      } else if (wordbookId.includes('7th') && wordbookId.includes('second')) {
        // 加载外研社七年级下册单词
        try {
          // 尝试加载完整版本的外研社七年级下册单词
          const words = require('./new_standard_7th_grade_second_complete.js');
          console.log('成功加载外研社七年级下册单词（完整版），数量:', words.length);
          allWords = words;
        } catch (error) {
          console.error('加载外研社七年级下册单词（完整版）失败，尝试加载标准版:', error);
          try {
            const words = require('./new_standard_7th_grade_second.js');
            console.log('成功加载外研社七年级下册单词（标准版），数量:', words.length);
            allWords = words;
          } catch (error) {
            console.error('加载外研社七年级下册单词（标准版）失败:', error);
            allWords = [];
          }
        }
      } else if (wordbookId.includes('7th')) {
        // 加载外研社七年级上册单词
        try {
          const words = require('./new_standard_7th_grade_words.js');
          console.log('成功加载外研社七年级上册单词，数量:', words.length);
          allWords = words;
        } catch (error) {
          console.error('加载外研社七年级上册单词失败:', error);
          allWords = [];
        }
      } else if (wordbookId.includes('8th') && wordbookId.includes('second')) {
        // 加载外研社八年级下册单词
        try {
          const words = require('./new_standard_8th_grade_second_complete.js');
          console.log('成功加载外研社八年级下册单词（完整版），数量:', words.length);
          allWords = words;
        } catch (error) {
          console.error('加载外研社八年级下册单词（完整版）失败，尝试加载标准版:', error);
          try {
            const words = require('./new_standard_8th_grade_second.js');
            console.log('成功加载外研社八年级下册单词（标准版），数量:', words.length);
            allWords = words;
          } catch (fallbackError) {
            console.error('加载外研社八年级下册单词（标准版）失败:', fallbackError);
            allWords = [];
          }
        }
      } else if (wordbookId.includes('8th')) {
        // 加载外研社八年级上册单词
        try {
          const words = require('./new_standard_8th_grade_words_complete.js');
          console.log('成功加载外研社八年级上册单词（完整版），数量:', words.length);
          allWords = words;
        } catch (error) {
          console.error('加载外研社八年级上册单词（完整版）失败，尝试加载标准版:', error);
          try {
            const words = require('./new_standard_8th_grade_words.js');
            console.log('成功加载外研社八年级上册单词（标准版），数量:', words.length);
            allWords = words;
          } catch (fallbackError) {
            console.error('加载外研社八年级上册单词（标准版）失败:', fallbackError);
            allWords = [];
          }
        }
      } else if (wordbookId.includes('9th') && wordbookId.includes('second')) {
        // 加载外研社九年级下册单词
        try {
          const words = require('./new_standard_9th_grade_second_complete.js');
          console.log('成功加载外研社九年级下册单词（完整版），数量:', words.length);
          allWords = words;
        } catch (error) {
          console.error('加载外研社九年级下册单词（完整版）失败，尝试加载标准版:', error);
          try {
            const words = require('./new_standard_9th_grade_second.js');
            console.log('成功加载外研社九年级下册单词（标准版），数量:', words.length);
            allWords = words;
          } catch (fallbackError) {
            console.error('加载外研社九年级下册单词（标准版）失败:', fallbackError);
            allWords = [];
          }
        }
      } else if (wordbookId.includes('9th')) {
        // 加载外研社九年级上册单词
        try {
          const words = require('./new_standard_9th_grade_first_complete.js');
          console.log('成功加载外研社九年级上册单词（完整版），数量:', words.length);
          allWords = words;
        } catch (error) {
          console.error('加载外研社九年级上册单词（完整版）失败，尝试加载标准版:', error);
          try {
            const words = require('./new_standard_9th_grade_words.js');
            console.log('成功加载外研社九年级上册单词（标准版），数量:', words.length);
            allWords = words;
          } catch (fallbackError) {
            console.error('加载外研社九年级上册单词（标准版）失败:', fallbackError);
            allWords = [];
          }
        }
      } else if (wordbookCategory === 'primary') {
        // 加载小学单词
        allWords = this.getWordsByLevel('primary') || [];
      } else if (wordbookCategory === 'junior') {
        // 加载初中单词
        try {
          const words = require('./new_standard_7th_grade_second_complete.js');
          console.log('加载外研社七年级下册单词（完整版）作为初中单词，数量:', words.length);
          allWords = words;
        } catch (error) {
          console.error('加载外研社七年级下册单词（完整版）失败:', error);
          allWords = this.getWordsByLevel('junior') || [];
        }
      } else if (wordbookCategory === 'senior') {
        // 加载高中单词
        // 【云端迁移】优先检查云端缓存
        try {
          const cloudWords = cloudWordbookLoader && cloudWordbookLoader.getWordsSync(wordbookId);
          if (cloudWords && cloudWords.length > 0) {
            allWords = cloudWords;
            console.log('成功从云端缓存加载高中词书，数量:', allWords.length);
          } else {
            allWords = this.getWordsByLevel('senior') || [];
          }
        } catch (e) {
          allWords = this.getWordsByLevel('senior') || [];
        }
      }
    }

    // 确保加载外研社七年级下册单词
    if (allWords.length === 0 && !isCloudWordbookId) {
      try {
        // 优先加载完整版本的外研社七年级下册单词
        const words = require('./new_standard_7th_grade_second_complete.js');
        console.log('最后尝试加载外研社七年级下册单词（完整版），数量:', words.length);
        allWords = words;
      } catch (error) {
        console.error('最后尝试加载外研社七年级下册单词（完整版）失败:', error);
        try {
          const words = require('./new_standard_7th_grade_second.js');
          console.log('最后尝试加载外研社七年级下册单词（标准版），数量:', words.length);
          allWords = words;
        } catch (error) {
          console.error('最后尝试加载外研社七年级下册单词（标准版）失败:', error);
        }
      }
    }

    if (allWords.length === 0 && isCloudWordbookId) {
      console.warn('云端词书缓存尚未就绪，拒绝使用其他词书兜底:', wordbookId);
    }

    // 如果没有词汇数据，使用备用数据
    if (allWords.length === 0) {
      allWords = this.getFallbackWords(wordbookCategory);
      console.log('使用备用数据，单词数量:', allWords.length);
    }

    allWords = this.sanitizeWordEntries(allWords);

    console.log('加载完成，总单词数:', allWords.length);

    // 添加ID属性（如果没有的话），确保ID始终为字符串类型
    const wordsWithId = allWords.map((word, index) => ({
      ...word,
      id: String(word.id || `${wordbookId}_${word.word.toLowerCase().replace(/\s+/g, '_')}_${index}`)
    }));

    console.log('处理完成，总单词数:', wordsWithId.length);

    // 截取指定范围的单词
    const endIndex = Math.min(startIndex + batchSize, wordsWithId.length);
    const result = wordsWithId.slice(startIndex, endIndex);

    // 添加_totalCount属性
    result._totalCount = wordsWithId.length;

    console.log('生成单词结果，数量:', result.length, '总单词数:', result._totalCount);
    return result;
  }
}

// 创建WordbookLoader实例
const wordbookLoaderInstance = new WordbookLoader();

// 为generateWordsForBook绑定WordbookLoader上下文
wordbookLoaderInstance.generateWordsForBook = wordbookLoaderInstance.generateWordsForBook.bind(wordbookLoaderInstance);

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = wordbookLoaderInstance;
  // 导出单独的generateWordsForBook函数
  module.exports.generateWordsForBook = wordbookLoaderInstance.generateWordsForBook;
} else if (typeof define === 'function' && define.amd) {
  define(function() {
    return wordbookLoaderInstance;
  });
} else {
  // 为小程序环境添加到全局对象
  global.WordbookLoader = wordbookLoaderInstance;
  global.generateWordsForBook = wordbookLoaderInstance.generateWordsForBook;
}

// 小程序环境下不做全量预加载，避免真机启动阶段阻塞导致 timeout。
// 词书数据按需在 generateWordsForBook 时加载即可。
