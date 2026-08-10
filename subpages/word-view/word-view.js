// pages/word-view/word-view.js
const { generateWordsForBook } = require('../../data/wordbook-loader.js');
const { mergeWordbooks, createWordMap, findWord } = require('../../data/wordbook-utils.js');
const { resolveDictionaryApiAudioUrl, buildYoudaoAudioUrl } = require('../../utils/audio-fallback.js');
const {
  buildReviewWordLookup,
  getReviewWordMeaning,
  loadReviewWordbookWords,
  resolveReviewWordObject
} = require('../../utils/review-word-resolver.js');

// 初始化合并后的词书数据和单词映射表
let mergedWords = mergeWordbooks();
let wordMap = createWordMap(mergedWords);

// 重新加载合并词书数据的函数
function reloadWordMap() {
  console.log('重新加载合并词书数据');
  mergedWords = mergeWordbooks();
  wordMap = createWordMap(mergedWords);
  console.log('重新加载后的单词映射表大小:', Object.keys(wordMap).length);
}

Page({
  data: {
    allWords: [],
    words: [],
    loading: true,
    hasError: false,
    errorMessage: '',
    showMeaning: {},
    showPhonetic: {},
    clickCounts: {},
    showRecordFilter: false,
    wordFilter: 'all',
    masteryStats: {
      total: 0,
      mastered: 0,
      notMastered: 0
    }
  },

  onLoad: function(options) {
    console.log('单词查看页面加载，参数:', options);
    this.applyInnerAudioOption();
    // 重新加载合并词书数据，确保使用最新的单词映射表
    reloadWordMap();
    
    if (options.words) {
      try {
        // 先解码URL编码的字符串
        const decodedWords = decodeURIComponent(options.words);
        const wordsData = JSON.parse(decodedWords);
        const showRecordFilter = options.fromRecord === '1';
        let masteryStats = {
          total: 0,
          mastered: 0,
          notMastered: 0
        };

        if (options.masteryStats) {
          try {
            masteryStats = JSON.parse(decodeURIComponent(options.masteryStats));
          } catch (statsError) {
            console.warn('解析掌握统计失败，使用默认值:', statsError);
          }
        }
        
        // 检查是否是单词对象数组（从合并视图传递）
        if (Array.isArray(wordsData) && wordsData.length > 0 && wordsData[0].word) {
          console.log('按当前词书校验传递的单词对象数组');
          this.loadResolvedWordObjects(wordsData, showRecordFilter, masteryStats);
        } else {
          // 否则视为单词ID列表
          console.log('使用单词ID列表加载单词');
          this.loadWords(wordsData, showRecordFilter, masteryStats);
        }
      } catch (error) {
        console.error('解析单词数据失败:', error);
        this.setData({
          loading: false,
          hasError: true,
          errorMessage: '加载单词失败，请重试'
        });
      }
    } else {
      this.setData({
        loading: false,
        hasError: true,
        errorMessage: '没有单词可查看'
      });
    }
  },

  applyInnerAudioOption: function() {
    try {
      wx.setInnerAudioOption({
        obeyMuteSwitch: false
      });
    } catch (error) {
      console.error('设置查看页音频选项失败:', error);
    }
  },

  initializeWordsView: function(wordsData, showRecordFilter = false, inputStats = null) {
    // 直接信任上游快照：这里不做任何词面清洗/纠偏/反解析。
    // 仅做结构兜底与去重，确保查看页按传入内容原样展示。
    const sourceList = Array.isArray(wordsData) ? wordsData : [];
    const seenWordKeys = new Set();
    const allWords = sourceList.map((word, index) => {
      const sourceWordId = String((word && (word.sourceWordId || word.id || '')) || '').trim();
      const fallbackId = sourceWordId || ('word_' + index);
      const incomingWord = (word && word.word !== undefined && word.word !== null) ? String(word.word) : '';
      const incomingPhonetic = (word && word.phonetic !== undefined && word.phonetic !== null) ? String(word.phonetic) : '';
      const incomingMeaning = (word && word.meaning !== undefined && word.meaning !== null) ? String(word.meaning) : '';
      const incomingTranslation = (word && word.translation !== undefined && word.translation !== null) ? String(word.translation) : '';

      return {
        ...(word || {}),
        id: String((word && word.id) || fallbackId),
        sourceWordId: sourceWordId || String((word && word.id) || fallbackId),
        word: incomingWord,
        phonetic: incomingPhonetic,
        meaning: incomingMeaning || incomingTranslation,
        translation: incomingTranslation || incomingMeaning,
        masteryStatus: (word && word.masteryStatus) ? word.masteryStatus : 'unknown'
      };
    }).filter(item => {
      if (!item || typeof item.word !== 'string' || item.word.trim() === '') {
        return false;
      }

      const sourceKey = this.normalizeSourceWordId(item.sourceWordId || item.id || '');
      const displayKey = this.normalizeDisplayWordKey(item.word);
      const key = sourceKey || displayKey;
      if (!key) {
        return false;
      }
      if (seenWordKeys.has(key)) {
        return false;
      }

      seenWordKeys.add(key);
      return true;
    });

    // 记录详情页使用兜底口径：已掌握 = 全部 - 未掌握
    // 这样即使缺少显式 mastered 标记，也能正常显示“已掌握”列表。
    if (showRecordFilter) {
      for (let i = 0; i < allWords.length; i++) {
        const status = allWords[i].masteryStatus;
        if (status === undefined || status === null || status === '') {
          allWords[i].masteryStatus = 'unknown';
        }
      }
    }

    let masteryStats = inputStats;
    if (showRecordFilter || !masteryStats || typeof masteryStats !== 'object') {
      masteryStats = this.calculateMasteryStats(allWords);
    }

    let initialFilter = 'all';
    if (showRecordFilter) {
      initialFilter = 'all';
    }

    this.setData({
      allWords: allWords,
      words: allWords,
      showRecordFilter: showRecordFilter,
      wordFilter: initialFilter,
      masteryStats: {
        total: Number(masteryStats.total || allWords.length),
        mastered: Number(masteryStats.mastered || 0),
        notMastered: Number(masteryStats.notMastered || 0)
      },
      loading: false,
      hasError: allWords.length === 0,
    }, () => {
      if (showRecordFilter) {
        this.applyWordFilter(initialFilter);
      }
    });
  },

  extractWordFromViewId: function(wordId, wordbookId) {
    try {
      let raw = wordId;
      if (raw && typeof raw === 'object') {
        raw = raw.id || raw.word || '';
      }

      raw = String(raw || '').trim();
      if (!raw) {
        return '';
      }

      // 纯英文单词/短语直接返回
      if (/^[a-zA-Z][a-zA-Z\s'\-]*$/.test(raw)) {
        return raw.replace(/\s+/g, ' ').trim();
      }

      let candidate = raw;

      // 稳健去掉词书前缀（兼容连接符/空格变体）
      const prefix = String(wordbookId || '').trim();
      if (prefix) {
        const prefixVariants = [
          prefix,
          prefix.replace(/-/g, '_'),
          prefix.replace(/\s+/g, '_')
        ];
        const lowerCandidate = candidate.toLowerCase();
        for (let i = 0; i < prefixVariants.length; i++) {
          const withUnderscore = `${prefixVariants[i]}_`;
          if (lowerCandidate.startsWith(withUnderscore.toLowerCase())) {
            candidate = candidate.slice(withUnderscore.length);
            break;
          }
        }
      }

      if (candidate.startsWith('real_')) {
        candidate = candidate.slice(5);
      }
      candidate = candidate.replace(/_real_/g, '_');

      const phrase = candidate.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

      // 包含特殊符号的短语（如 p.m./pm, P.M. /PM）优先原样返回，避免误落入词书ID兜底逻辑。
      if (phrase && /[./,]/.test(phrase)) {
        const punctuationTokens = phrase.split(/\s+/).filter(Boolean);
        if (punctuationTokens.length > 0 && punctuationTokens.length <= 6) {
          return phrase;
        }
      }

      if (phrase && /^[a-zA-Z][a-zA-Z\s'\-]*$/.test(phrase)) {
        const phraseTokens = phrase.split(/\s+/).filter(Boolean);
        const idLikeGenericTokens = new Set([
          'real', 'word', 'words', 'book', 'wordbook', 'grade',
          'first', 'second', 'third', 'fourth', 'fifth', 'sixth',
          'seventh', 'eighth', 'ninth', 'new', 'standard', 'complete',
          'junior', 'senior', 'curriculum', 'ren', 'jiao', 'yi', 'lin', 'ji'
        ]);

        const looksLikeStructuredNoise =
          phrase.length > 24 ||
          phraseTokens.length >= 4 ||
          phraseTokens.some(token => idLikeGenericTokens.has(String(token).toLowerCase()));

        if (candidate.includes('_') && phraseTokens.length > 1 && looksLikeStructuredNoise) {
          for (let i = phraseTokens.length - 1; i >= 0; i--) {
            const token = String(phraseTokens[i]).trim();
            const lower = token.toLowerCase();
            const isShortExactWord = token.length === 2 && !!wordMap[lower];
            if ((token.length >= 3 || isShortExactWord) && !idLikeGenericTokens.has(lower)) {
              return token;
            }
          }
        }

        // 结构化ID场景下，单字母通常是误提取噪音（如 life -> i）
        if (phrase.length === 1 && !/^[a-zA-Z]$/.test(raw)) {
          return '';
        }
        return phrase;
      }

      // 从后往前提取最后一个可靠英文token，避免命中词书ID片段
      const tokens = candidate.match(/[a-zA-Z][a-zA-Z'\-]*/g) || [];
      const generic = new Set([
        'real', 'word', 'words', 'book', 'wordbook', 'grade',
        'first', 'second', 'third', 'fourth', 'fifth', 'sixth',
        'seventh', 'eighth', 'ninth', 'new', 'standard', 'junior',
        'senior', 'ren', 'jiao', 'yi', 'lin', 'ji'
      ]);

      for (let i = tokens.length - 1; i >= 0; i--) {
        const token = String(tokens[i]).trim();
        const lower = token.toLowerCase();
        const isShortExactWord = token.length === 2 && !!wordMap[lower];
        if ((token.length >= 3 || isShortExactWord) && !generic.has(lower)) {
          return token;
        }
      }

      return '';
    } catch (error) {
      console.error('从查看页ID提取单词失败:', error, wordId, wordbookId);
      return '';
    }
  },

  canonicalizeViewWord: function(word, wordId) {
    const text = String(word || '').trim();
    if (!text) {
      return '';
    }

    const normalized = text.toLowerCase().replace(/\./g, '');
    const sourceId = String(wordId || '').toLowerCase();

    // 历史兼容：部分记录链路会把 miss 缩成 ms
    if ((normalized === 'ms' || normalized === 'mss') && (sourceId.includes('_miss') || sourceId.endsWith('miss') || !!wordMap['miss'])) {
      return 'miss';
    }

    return text;
  },

  recoverSuspiciousSingleLetterWord: function(word, sourceId, wordbookId) {
    const text = String(word || '').trim();
    if (!text) {
      return '';
    }

    const lower = text.toLowerCase();
    // 仅对易误命中的单字母做纠偏
    if (text.length !== 1 || (lower !== 'i' && lower !== 'a')) {
      return text;
    }

    const raw = String(sourceId || '').trim();
    // 原始ID本身就是单字母，视为合法词条（如 I / a）
    if (/^[a-zA-Z]$/.test(raw) && raw.toLowerCase() === lower) {
      return text;
    }

    // 尝试从原始ID重新提取更可靠的单词
    const recovered = this.extractWordFromViewId(raw, wordbookId);
    if (recovered && recovered.length >= 2) {
      return recovered;
    }

    // 无法恢复时直接剔除，避免展示噪音单字母
    return '';
  },

  normalizeDisplayWordKey: function(word) {
    return String(word || '').toLowerCase().replace(/\s+/g, ' ').trim();
  },

  normalizeSourceWordId: function(wordId) {
    return String(wordId || '').trim().toLowerCase().replace(/(_\d+)$/, '');
  },

  normalizeWordForExactMatch: function(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/\./g, '')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  findStrictWordEntry: function(rawWord) {
    const target = this.normalizeWordForExactMatch(rawWord);
    if (!target || !wordMap) {
      return null;
    }

    if (wordMap[target]) {
      return wordMap[target];
    }

    const compactTarget = target.replace(/\s+/g, '');
    if (wordMap[compactTarget]) {
      return wordMap[compactTarget];
    }

    for (const key in wordMap) {
      const entry = wordMap[key];
      if (!entry) {
        continue;
      }
      const keyNormalized = this.normalizeWordForExactMatch(key);
      if (keyNormalized === target || keyNormalized.replace(/\s+/g, '') === compactTarget) {
        return entry;
      }

      const entryWord = this.normalizeWordForExactMatch(entry.word || '');
      if (entryWord === target || entryWord.replace(/\s+/g, '') === compactTarget) {
        return entry;
      }
    }

    return null;
  },

  isSafeFallbackMatch: function(inputWord, fallbackWord) {
    const inputNormalized = this.normalizeWordForExactMatch(inputWord);
    const fallbackNormalized = this.normalizeWordForExactMatch(fallbackWord);

    if (!inputNormalized || !fallbackNormalized) {
      return false;
    }
    if (inputNormalized === fallbackNormalized) {
      return true;
    }

    const inputSingle = !inputNormalized.includes(' ');
    const fallbackSingle = !fallbackNormalized.includes(' ');

    // 防止把 lend/mean 这类原形误纠偏成 lent/meant
    if (inputSingle && fallbackSingle) {
      return false;
    }

    return inputNormalized.includes(fallbackNormalized) || fallbackNormalized.includes(inputNormalized);
  },

  sanitizeDisplayWord: function(word, sourceId, wordbookId) {
    let text = String(word || '').replace(/\s+/g, ' ').trim();
    if (!text) {
      return '';
    }

    // 合并历史噪音：去掉重复拼接（如 "raw raw" / "raw material raw material"）
    const dupPhraseMatch = text.match(/^(.+?)\s+\1$/i);
    if (dupPhraseMatch && dupPhraseMatch[1]) {
      text = dupPhraseMatch[1].trim();
    }

    const sourceText = String(sourceId || '').trim();
    const tokenCount = text.split(/\s+/).filter(Boolean).length;
    const tooLongLikeId = text.length > 24 || tokenCount >= 4;

    if (tooLongLikeId) {
      // 长串优先按ID重新提取，避免出现 "new curriculum senior ..." 这类词书前缀串
      const recovered = this.extractWordFromViewId(sourceText || text, wordbookId);
      if (recovered && recovered.length <= 24) {
        text = recovered;
      } else {
        const tokens = text.split(/\s+/).filter(Boolean);
        if (tokens.length > 0) {
          text = tokens[tokens.length - 1];
        }
      }
    }

    // 仅保留合法英文词/短语字符
    text = text.replace(/[^a-zA-Z\s'\-]/g, ' ').replace(/\s+/g, ' ').trim();
    return text;
  },

  resolveDisplayWordInfo: function(word, sourceWordId) {
    const sourceExtracted = this.extractWordFromViewId(sourceWordId, this.data.currentWordbook?.id || '');
    const candidates = [word, sourceExtracted, sourceWordId].filter(Boolean);

    for (const candidate of candidates) {
      const exact = this.findStrictWordEntry(candidate);
      if (exact && exact.word) {
        return {
          word: exact.word,
          phonetic: exact.phonetic || '',
          meaning: exact.meaning || exact.translation || '未知释义'
        };
      }
    }

    const fallbackInput = sourceExtracted || word || sourceWordId;
    if (fallbackInput) {
      const fallback = findWord(fallbackInput, wordMap);
      if (fallback && fallback.word && this.isSafeFallbackMatch(fallbackInput, fallback.word)) {
        return {
          word: fallback.word,
          phonetic: fallback.phonetic || '',
          meaning: fallback.meaning || fallback.translation || '未知释义'
        };
      }
    }

    return {
      word: String(word || '').trim(),
      phonetic: '',
      meaning: '未知释义'
    };
  },

  calculateMasteryStats: function(words) {
    const stats = {
      total: words.length,
      mastered: 0,
      notMastered: 0
    };

    words.forEach(word => {
      if (word.masteryStatus === 'mastered') {
        stats.mastered += 1;
      } else if (word.masteryStatus === 'notMastered') {
        stats.notMastered += 1;
      }
    });

    return stats;
  },

  changeWordFilter: function(e) {
    const filter = e.currentTarget.dataset.filter;
    if (!filter || filter === this.data.wordFilter) {
      return;
    }

    this.setData({
      wordFilter: filter
    });
    this.applyWordFilter(filter);
  },

  applyWordFilter: function(filter) {
    const allWords = this.data.allWords || [];
    let filteredWords = allWords;

    if (filter === 'mastered') {
      filteredWords = allWords.filter(word => word.masteryStatus === 'mastered');
    } else if (filter === 'notMastered') {
      filteredWords = allWords.filter(word => word.masteryStatus === 'notMastered');
    } else {
      // 全部视图按掌握状态分组：已掌握 -> 未掌握 -> 未知，组内保持原顺序。
      const statusOrder = {
        mastered: 0,
        notMastered: 1,
        unknown: 2
      };

      filteredWords = allWords
        .map((word, index) => ({ word, index }))
        .sort((a, b) => {
          const orderA = statusOrder[a.word.masteryStatus] !== undefined ? statusOrder[a.word.masteryStatus] : 2;
          const orderB = statusOrder[b.word.masteryStatus] !== undefined ? statusOrder[b.word.masteryStatus] : 2;
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          return a.index - b.index;
        })
        .map(item => item.word);
    }

    this.setData({
      wordFilter: filter,
      words: filteredWords,
      showMeaning: {},
      showPhonetic: {},
      clickCounts: {}
    });
  },

  resolveWordsForCurrentWordbook: async function(sourceItems, sourceIsObject) {
    const selectedStudent = this.data.currentStudent || wx.getStorageSync('selectedStudent') || {};
    const currentWordbook = this.data.currentWordbook || wx.getStorageSync('selectedWordbook') || {};
    const studentId = selectedStudent.id;
    const wordbookId = currentWordbook.id;
    const loadResult = await loadReviewWordbookWords(currentWordbook);
    const lookup = buildReviewWordLookup(loadResult.words, wordbookId);
    const wordMastery = wx.getStorageSync('wordMastery') || {};
    const wordbookMastery = studentId && wordbookId ? wordMastery[studentId]?.[wordbookId] : {};
    const words = [];

    (Array.isArray(sourceItems) ? sourceItems : []).forEach((sourceItem, index) => {
      const incoming = sourceIsObject && sourceItem && typeof sourceItem === 'object' ? sourceItem : {};
      const wordId = String(sourceIsObject
        ? (incoming.sourceWordId || incoming.id || '')
        : (sourceItem || '')).trim();
      const resolved = resolveReviewWordObject(wordId, lookup);
      const incomingMeaningInfo = getReviewWordMeaning(incoming);
      const word = resolved.word || String(incoming.word || '').replace(/\s+/g, ' ').trim();
      const meaning = resolved.meaning || incomingMeaningInfo.meaning;
      const incomingPhonetic = String(incoming.phonetic || '').trim();
      const safeIncomingPhonetic = incomingPhonetic === '/fəˈnetɪk/' ? '' : incomingPhonetic;
      const record = wordbookMastery && wordbookMastery[wordId];
      let masteryStatus = incoming.masteryStatus || 'unknown';
      if (record && record.mastered === true) {
        masteryStatus = 'mastered';
      } else if (record && (record.difficult === true || record.status === 'difficult' || record.status === 'notMastered')) {
        masteryStatus = 'notMastered';
      }

      if (!word) {
        console.error('[WordView][word-source-issue]', {
          wordbookId,
          wordId,
          dataSource: loadResult.dataSource,
          loadError: loadResult.loadError,
          reason: resolved._reviewResolution.status
        });
        return;
      }
      if (!meaning) {
        console.error('[WordView][word-source-issue]', {
          wordbookId,
          wordId,
          word,
          dataSource: loadResult.dataSource,
          loadError: loadResult.loadError,
          lookupSource: resolved._reviewResolution.source,
          reason: resolved._reviewResolution.status
        });
      }

      words.push({
        ...incoming,
        id: String(incoming.id || wordId || `word_${index}`),
        sourceWordId: wordId || String(incoming.id || `word_${index}`),
        word,
        meaning,
        translation: meaning,
        phonetic: resolved.phonetic || safeIncomingPhonetic,
        masteryStatus,
        _reviewResolution: resolved._reviewResolution
      });
    });

    return words;
  },

  loadResolvedWordObjects: async function(wordsData, showRecordFilter = false, masteryStats = null) {
    const words = await this.resolveWordsForCurrentWordbook(wordsData, true);
    this.initializeWordsView(words, showRecordFilter, masteryStats);
    return words;
  },

  loadResolvedWords: async function(wordIds, showRecordFilter = false, masteryStats = null) {
    const words = await this.resolveWordsForCurrentWordbook(wordIds, false);
    this.initializeWordsView(words, showRecordFilter, masteryStats);
    return words;
  },

  loadWords: async function(wordIds, showRecordFilter = false, masteryStats = null) {
    return this.loadResolvedWords(wordIds, showRecordFilter, masteryStats);
  },

  // 保留旧实现仅供历史排障对照；产品入口统一走 loadResolvedWords。
  loadWordsLegacyUnused: async function(wordIds, showRecordFilter = false, masteryStats = null) {
    console.log('加载单词:', wordIds);
    
    const words = [];
    const studentId = wx.getStorageSync('selectedStudent')?.id;
    const wordbookId = wx.getStorageSync('selectedWordbook')?.id;
    
    // 获取单词掌握记录
    const wordMastery = wx.getStorageSync('wordMastery') || {};
    const wordbookMastery = studentId && wordbookId ? wordMastery[studentId]?.[wordbookId] : {};
    
    // 处理每个单词ID
    for (const wordId of wordIds) {
      let word = this.extractWordFromViewId(wordId, wordbookId);

      if (!word && !isNaN(wordId) && !isNaN(parseFloat(wordId))) {
        console.log('wordId是数字，尝试从词书数据中查找:', wordId);
        const wordIndex = parseInt(wordId) - 1;
        if (mergedWords && mergedWords.length > wordIndex) {
          const foundWord = mergedWords[wordIndex];
          if (foundWord && foundWord.word) {
            word = foundWord.word;
            console.log('从词书数据中找到单词:', wordId, '→', word);
          }
        }
      }

      word = this.canonicalizeViewWord(word, wordId);
      word = this.recoverSuspiciousSingleLetterWord(word, wordId, wordbookId);
      console.log('从wordId中提取的单词:', wordId, '→', word);

      if (!word) {
        continue;
      }
      
      // 过滤非英语单词的内容
      const nonWordList = ['objectspread', 'undefined', 'null', 'NaN', '{}', '[]'];
      if (nonWordList.includes(word.toLowerCase())) {
        console.log('排除非单词:', word);
        continue;
      }
      
      // 从合并后的词书数据中查找完整的单词信息
      let meaning = '未知';
      let phonetic = '';
      let matchedWord = null;
      
      // 1. 使用合并后的词书数据和单词映射表查找
      if (wordMap) {
        // 先尝试严格匹配，避免把原形词误配到过去式
        const exactMatch = this.findStrictWordEntry(word) || this.findStrictWordEntry(wordId);
        if (exactMatch) {
          matchedWord = exactMatch;
          console.log('使用单词映射表精确匹配结果:', word, '→', matchedWord);
        } else {
          // 短词禁用模糊匹配，避免 life 类ID噪音误命中 i
          const normalizedWord = this.normalizeWordForExactMatch(word);
          if (normalizedWord.length >= 3) {
            const fallbackMatch = findWord(word, wordMap);
            if (fallbackMatch && this.isSafeFallbackMatch(word, fallbackMatch.word)) {
              matchedWord = fallbackMatch;
              console.log('使用单词映射表兜底匹配结果:', word, '→', matchedWord);
            }
          }
        }
      }
      
      // 2. 如果还是没找到，尝试在线词典查询
      if (!matchedWord) {
        console.log('本地词书数据中未找到，尝试在线词典查询:', word);
        const onlineDefinition = await this.fetchWordDefinition(word);
        console.log('在线词典查询结果:', onlineDefinition);
        
        if (onlineDefinition) {
          matchedWord = onlineDefinition;
          meaning = onlineDefinition.meaning || '无释义';
          phonetic = onlineDefinition.phonetic || '';
        } else {
          // 为所有单词提供默认的音标和释义格式，使用更友好的提示信息
          meaning = '暂无释义，请尝试其他单词';
          phonetic = '/fəˈnetɪk/';
        }
      } else {
        meaning = matchedWord.meaning || matchedWord.translation || '未知';
        phonetic = matchedWord.phonetic || '';
      }
      
      // 3. 处理地名词组的大小写
      if (matchedWord && matchedWord.word) {
        // 检查是否是地名词组或国家名称
        const placeWords = ['south africa', 'north america', 'south america', 'united states', 'united kingdom', 'new york', 'los angeles', 'australia', 'china', 'america', 'japan', 'france', 'germany', 'canada'];
        if (placeWords.includes(matchedWord.word.toLowerCase())) {
          // 地名词组或国家名称首字母大写
          const capitalizedWord = matchedWord.word.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
          matchedWord.word = capitalizedWord;
          console.log('地名词组或国家名称首字母大写:', matchedWord.word);
        }
      } else if (word) {
        // 检查是否是地名词组或国家名称
        const placeWords = ['south africa', 'north america', 'south america', 'united states', 'united kingdom', 'new york', 'los angeles', 'australia', 'china', 'america', 'japan', 'france', 'germany', 'canada'];
        if (placeWords.includes(word.toLowerCase())) {
          // 地名词组或国家名称首字母大写
          word = word.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
          console.log('地名词组或国家名称首字母大写:', word);
        }
      }
      
      // 4. 确保即使从本地词书数据中找到单词，也要检查是否是国家名称并使用正确的释义
      if (matchedWord && matchedWord.word) {
        const lowerWord = matchedWord.word.toLowerCase();
        const commonDefinitions = {
          // 国家名称
          'australia': {
            word: 'Australia',
            phonetic: '/ɒˈstreɪliə/',
            meaning: '澳大利亚'
          },
          'china': {
            word: 'China',
            phonetic: '/ˈtʃaɪnə/',
            meaning: '中国'
          },
          'america': {
            word: 'America',
            phonetic: '/əˈmerɪkə/',
            meaning: '美国'
          },
          'japan': {
            word: 'Japan',
            phonetic: '/dʒəˈpæn/',
            meaning: '日本'
          },
          'france': {
            word: 'France',
            phonetic: '/frɑːns/',
            meaning: '法国'
          },
          'germany': {
            word: 'Germany',
            phonetic: '/ˈdʒɜːməni/',
            meaning: '德国'
          },
          'canada': {
            word: 'Canada',
            phonetic: '/ˈkænədə/',
            meaning: '加拿大'
          },
          // 国家形容词形式
          'american': {
            word: 'American',
            phonetic: '/əˈmerɪkən/',
            meaning: '美国的；美国人的'
          },
          'australian': {
            word: 'Australian',
            phonetic: '/ɒˈstreɪliən/',
            meaning: '澳大利亚的；澳大利亚人的'
          },
          'chinese': {
            word: 'Chinese',
            phonetic: '/ˌtʃaɪˈniːz/',
            meaning: '中国的；中国人的'
          },
          'japanese': {
            word: 'Japanese',
            phonetic: '/ˌdʒæpəˈniːz/',
            meaning: '日本的；日本人的'
          },
          'french': {
            word: 'French',
            phonetic: '/frentʃ/',
            meaning: '法国的；法国人的'
          },
          'german': {
            word: 'German',
            phonetic: '/ˈdʒɜːmən/',
            meaning: '德国的；德国人的'
          },
          'canadian': {
            word: 'Canadian',
            phonetic: '/kəˈneɪdiən/',
            meaning: '加拿大的；加拿大人的'
          },
          // 其他常见单词
          'surprisingly': {
            word: 'surprisingly',
            phonetic: '/səˈpraɪzɪŋli/',
            meaning: '令人惊讶地'
          },
          'chocolate': {
            word: 'chocolate',
            phonetic: '/ˈtʃɒklət/',
            meaning: '巧克力'
          },
          'other': {
            word: 'other',
            phonetic: '/ˈʌðə(r)/',
            meaning: '其他的；另外的'
          },
          'cat': {
            word: 'cat',
            phonetic: '/kæt/',
            meaning: '猫'
          },
          'water': {
            word: 'water',
            phonetic: '/ˈwɔːtə(r)/',
            meaning: '水'
          }
        };
        
        // 强制检查常见单词默认释义，避免错误的音标和释义
        if (commonDefinitions[lowerWord]) {
          console.log('使用常见单词默认释义:', matchedWord.word, '→', commonDefinitions[lowerWord]);
          matchedWord = commonDefinitions[lowerWord];
          meaning = commonDefinitions[lowerWord].meaning;
          phonetic = commonDefinitions[lowerWord].phonetic;
          word = commonDefinitions[lowerWord].word;
        }
      }
      
      // 创建单词对象，使用词书数据中的单词大小写，与预习界面保持一致
      words.push({
        id: wordId,
        word: matchedWord ? matchedWord.word : word, // 使用词书数据中的单词大小写，与预习界面保持一致
        meaning: meaning,
        phonetic: phonetic,
        translation: meaning // 确保translation属性也存在
      });
    }
    
    console.log('加载的单词数量:', words.length);
    
    this.initializeWordsView(words, showRecordFilter, masteryStats);
  },

  // 切换单词意思显示
  toggleWordMeaning: function(e) {
    console.log('切换单词意思显示');
    const { id } = e.currentTarget.dataset;
    // 初始化数据
    const showMeaning = {}; // 重置为新对象，自动收起所有其他单词的释义
    const showPhonetic = this.data.showPhonetic || {};
    // 初始化点击计数器
    const clickCounts = this.data.clickCounts || {};
    clickCounts[id] = (clickCounts[id] || 0) + 1;
    
    // 奇数次点击是发音，偶数次点击是发音+显示中文
    if (clickCounts[id] % 2 === 1) {
      // 奇数次点击 - 只播放读音
      this.playWordPronunciation(id);
      
      // 隐藏音标和释义
      showPhonetic[id] = false;
      showMeaning[id] = false;
      
      // 实时更新UI
      this.setData({
        showPhonetic: showPhonetic,
        showMeaning: showMeaning,
        clickCounts: clickCounts
      });
    } else {
      // 偶数次点击 - 播放读音并显示中文释义
      this.playWordPronunciation(id);
      
      // 显示当前单词的释义，其他单词的释义自动隐藏
      showMeaning[id] = true;
      
      // 隐藏音标
      showPhonetic[id] = false;
      
      // 实时更新UI
      this.setData({
        showMeaning: showMeaning,
        showPhonetic: showPhonetic,
        clickCounts: clickCounts
      });
      
      console.log(`单词释义显示切换: 单词ID=${id}, 显示状态=${showMeaning[id]}, 音标已隐藏`);
    }
  },

  // 播放单词读音
  playWordPronunciation: function(wordId) {
    try {
      this.applyInnerAudioOption();

      // 查找单词
      if (!this.data.words) {
        console.warn('words 未定义，无法查找单词:', wordId);
        return;
      }
      
      const word = this.data.words.find(w => w.id === wordId);
      if (!word) {
        console.warn('未找到单词:', wordId);
        return;
      }
      
      // 检查单词是否有效
      if (!word.word || word.word.trim() === '') {
        console.warn('无效的单词:', word);
        return;
      }
      
      console.log(`播放单词读音: ${word.word} ${word.phonetic || ''}`);
      
      // 使用微信的语音播放API
      const audioUrl = this.getWordAudioUrl(word.word);
      if (audioUrl) {
        const innerAudioContext = wx.createInnerAudioContext();
        let hasRetriedWithFallback = false;
        
        // 监听播放完成事件
        innerAudioContext.onEnded(() => {
          console.log('音频播放完成');
          try {
            innerAudioContext.destroy();
          } catch (destroyError) {
            console.error('销毁音频上下文失败:', destroyError);
          }
        });
        
        // 监听播放错误事件
        innerAudioContext.onError((res) => {
          const errMsg = (res && res.errMsg) ? res.errMsg : 'unknown';
          console.error('音频播放失败:', errMsg);

          if (hasRetriedWithFallback) {
            try {
              innerAudioContext.destroy();
            } catch (destroyError) {
              console.error('销毁音频上下文失败:', destroyError);
            }
            return;
          }

          hasRetriedWithFallback = true;
          resolveDictionaryApiAudioUrl(word.word).then((fallbackUrl) => {
            try {
              innerAudioContext.destroy();
            } catch (destroyError) {
              console.error('销毁主音频上下文失败:', destroyError);
            }

            if (!fallbackUrl) {
              return;
            }

            this.applyInnerAudioOption();
            const fallbackAudioContext = wx.createInnerAudioContext();
            fallbackAudioContext.onEnded(() => {
              try {
                fallbackAudioContext.destroy();
              } catch (destroyError) {
                console.error('销毁兜底音频上下文失败:', destroyError);
              }
            });
            fallbackAudioContext.onError((fallbackRes) => {
              const fallbackErrMsg = (fallbackRes && fallbackRes.errMsg) ? fallbackRes.errMsg : 'unknown';
              console.error('兜底音频播放失败:', fallbackErrMsg);
              try {
                fallbackAudioContext.destroy();
              } catch (destroyError) {
                console.error('销毁兜底音频上下文失败:', destroyError);
              }
            });

            try {
              fallbackAudioContext.src = fallbackUrl;
              fallbackAudioContext.play();
            } catch (retryError) {
              console.error('兜底音频重试失败:', retryError);
              try {
                fallbackAudioContext.destroy();
              } catch (destroyError) {
                console.error('销毁兜底音频上下文失败:', destroyError);
              }
            }
          }).catch((fallbackError) => {
            console.error('解析兜底音频失败:', fallbackError);
          });
        });
        
        try {
          innerAudioContext.src = audioUrl;
          innerAudioContext.play();
        } catch (audioError) {
          console.error('设置音频源失败:', audioError);
          // 确保即使设置失败也能销毁上下文
          try {
            innerAudioContext.destroy();
          } catch (destroyError) {
            console.error('销毁音频上下文失败:', destroyError);
          }
        }
      }
    } catch (error) {
      console.error('播放单词读音失败:', error);
    }
  },

  // 获取单词音频URL
  getWordAudioUrl: function(word) {
    try {
      const app = getApp();
      if (!app || !app.globalData || app.globalData.enableOnlineDictAudio !== true) {
        return null;
      }

      // 检查单词是否有效
      if (!word || word.trim() === '') {
        console.warn('无效的单词，无法获取音频URL');
        return null;
      }
      
      // 过滤掉可能导致API错误的特殊单词
      const specialWords = ['Hubli-Dharwad', 'undefined', 'null', 'NaN', 'Lungfish', 'table tennis table'];
      if (specialWords.includes(word.trim())) {
        console.warn('特殊单词，不获取音频URL:', word);
        return null;
      }
      
      // 过滤包含多个空格或特殊格式的短语，避免API错误
      if (word.trim().split(/\s+/).length > 3) {
        console.warn('过长短语，不获取音频URL:', word);
        return null;
      }
      
      // 使用有道词典音频，先归一化查询词，避免如 penny(pl.pence) 这类词形说明影响发音
      return buildYoudaoAudioUrl(word);
    } catch (error) {
      console.error('获取单词音频URL失败:', error);
      return null;
    }
  },

  // 从在线词典获取单词释义
  fetchWordDefinition: function(word) {
    return new Promise((resolve, reject) => {
      try {
        // 检查单词是否有效
        if (!word || word.trim() === '') {
          console.warn('无效的单词，无法获取在线释义');
          resolve(null);
          return;
        }
        
        // 过滤掉可能导致API错误的特殊单词
        const specialWords = ['Hubli-Dharwad', 'undefined', 'null', 'NaN', '{}', '[]'];
        if (specialWords.includes(word.trim())) {
          console.warn('特殊单词，不获取在线释义:', word);
          resolve(null);
          return;
        }
        
        console.log('尝试获取单词释义:', word);
        
        // 为常见国家名称和地名提供默认释义和音标
        const defaultDefinitions = {
          // 国家名称
          'australia': {
            word: 'Australia',
            phonetic: '/ɒˈstreɪliə/',
            meaning: '澳大利亚'
          },
          'china': {
            word: 'China',
            phonetic: '/ˈtʃaɪnə/',
            meaning: '中国'
          },
          'america': {
            word: 'America',
            phonetic: '/əˈmerɪkə/',
            meaning: '美国'
          },
          'japan': {
            word: 'Japan',
            phonetic: '/dʒəˈpæn/',
            meaning: '日本'
          },
          'france': {
            word: 'France',
            phonetic: '/frɑːns/',
            meaning: '法国'
          },
          'germany': {
            word: 'Germany',
            phonetic: '/ˈdʒɜːməni/',
            meaning: '德国'
          },
          'canada': {
            word: 'Canada',
            phonetic: '/ˈkænədə/',
            meaning: '加拿大'
          },
          'britain': {
            word: 'Britain',
            phonetic: '/ˈbrɪtn/',
            meaning: '英国'
          },
          'england': {
            word: 'England',
            phonetic: '/ˈɪŋɡlənd/',
            meaning: '英格兰'
          },
          'italy': {
            word: 'Italy',
            phonetic: '/ˈɪtəli/',
            meaning: '意大利'
          },
          'spain': {
            word: 'Spain',
            phonetic: '/speɪn/',
            meaning: '西班牙'
          },
          'russia': {
            word: 'Russia',
            phonetic: '/ˈrʌʃə/',
            meaning: '俄罗斯'
          },
          'india': {
            word: 'India',
            phonetic: '/ˈɪndiə/',
            meaning: '印度'
          },
          // 地名
          'new york': {
            word: 'New York',
            phonetic: '/nuː jɔːk/',
            meaning: '纽约'
          },
          'los angeles': {
            word: 'Los Angeles',
            phonetic: '/lɒs ˈændʒəliːz/',
            meaning: '洛杉矶'
          },
          'london': {
            word: 'London',
            phonetic: '/ˈlʌndən/',
            meaning: '伦敦'
          },
          'paris': {
            word: 'Paris',
            phonetic: '/ˈpærɪs/',
            meaning: '巴黎'
          },
          'tokyo': {
            word: 'Tokyo',
            phonetic: '/ˈtəʊkiəʊ/',
            meaning: '东京'
          },
          'beijing': {
            word: 'Beijing',
            phonetic: '/ˌbeɪˈdʒɪŋ/',
            meaning: '北京'
          },
          'shanghai': {
            word: 'Shanghai',
            phonetic: '/ˈʃæŋhaɪ/',
            meaning: '上海'
          }
        };
        
        // 检查是否在默认定义中
        const lowerWord = word.toLowerCase();
        if (defaultDefinitions[lowerWord]) {
          console.log('使用默认释义:', word, '→', defaultDefinitions[lowerWord]);
          resolve(defaultDefinitions[lowerWord]);
          return;
        }
        
        // 检查是否是复合地名（如 South Africa）
        const placeWords = ['south africa', 'north america', 'south america', 'united states', 'united kingdom'];
        if (placeWords.includes(lowerWord)) {
          const capitalizedWord = lowerWord.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          const definition = {
            word: capitalizedWord,
            phonetic: '',
            meaning: '地名'
          };
          console.log('使用复合地名默认释义:', word, '→', definition);
          resolve(definition);
          return;
        }
        
        // 由于微信小程序域名限制，暂时不使用在线API
        // 直接返回一个基于单词的默认定义
        console.log('使用本地默认定义:', word);
        const defaultDefinition = {
          word: word.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          phonetic: '',
          meaning: ''
        };
        resolve(defaultDefinition);
        
        // 以下是在线API调用代码，暂时注释掉
        /*
        // 使用有道词典的免费API获取单词释义
        // 注意：实际生产环境中应该使用自己的API密钥
        const apiUrl = `https://dict.youdao.com/suggest?q=${encodeURIComponent(word)}&doctype=json`;
        
        wx.request({
          url: apiUrl,
          method: 'GET',
          success: (res) => {
            console.log('在线词典查询成功:', res.data);
            
            if (res.data && res.data.data && res.data.data.length > 0) {
              const firstResult = res.data.data[0];
              const definition = {
                word: word,
                phonetic: firstResult.ukphonen ? `/${firstResult.ukphonen}/` : `/${firstResult.usphonen || ''}/`,
                meaning: firstResult.expl || '无释义'
              };
              resolve(definition);
            } else {
              resolve(null);
            }
          },
          fail: (err) => {
            console.error('在线词典查询失败:', err);
            // 失败时返回本地默认定义
            const defaultDefinition = {
              word: word.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
              phonetic: '',
              meaning: ''
            };
            resolve(defaultDefinition);
          }
        });
        */
      } catch (error) {
        console.error('获取单词释义失败:', error);
        // 异常时返回本地默认定义
        const defaultDefinition = {
          word: word.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          phonetic: '',
          meaning: ''
        };
        resolve(defaultDefinition);
      }
    });
  },

  // 页面卸载时清理资源
  onUnload: function() {
    console.log('Word view page unloaded');
    // 确保所有数据和状态被正确清理
    this.setData({
      words: [],
      showMeaning: {},
      showPhonetic: {},
      clickCounts: {}
    });
  }
});
