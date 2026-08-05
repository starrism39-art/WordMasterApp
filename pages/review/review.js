// pages/review/review.js
const { generateWordsForBook } = require('../../data/wordbook-loader.js');
const { mergeWordbooks, createWordMap, findWord } = require('../../data/wordbook-utils.js');
const { resolveDictionaryApiAudioUrl, buildYoudaoAudioUrl } = require('../../utils/audio-fallback.js');
const {
  buildAntiForgettingSchedule,
  shouldIncludeAntiForgettingWord
} = require('../../utils/anti-forgetting-filter.js');
const { syncWordMasteryBatch } = require('../../utils/cloud-sync.js');
const { resolveCurrentStudent, resolveCurrentWordbook } = require('../../utils/learning-context.js');
const { stripStableWordOccurrenceSuffix } = require('../../utils/learning-word-ids.js');

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
    pageTitle: '抗遗忘复习',
    loading: false,
    hasError: false,
    errorMessage: '',
    currentStudent: null,
    currentWordbook: null,
    reviewRecords: [],
    mergedViewRecords: [],
    totalReviewCount: 0,
    currentViewMode: 'normal', // normal: 普通视图, merged: 合并视图
    currentBatchWords: [],
    currentBatchIndex: 0,
    totalBatches: 0,
    currentBatchWordsCount: 0,
    masteredWordsCount: 0,
    notMasteredWordsCount: 0,
    showMeaning: {},
    clickCounts: {},
    showPhonetic: {},
    previewMastery: {},
    allWords: [],
    hasMoreWords: true,
    learningMode: null,
    learningWordbooks: '',
    reviewedCount: 0,
    totalWordsCount: 0,
    correctRate: 0,
    progressPercentage: 0,
    isReviewSessionPage: false,
    fromMerged: false
  },

  onLoad: function(options) {
    console.log('抗遗忘复习页面加载，参数:', options);
    // 重新加载合并词书数据，确保使用最新的单词映射表
    reloadWordMap();
    this.syncFromGlobalData();

    if (options && options.from === 'merged') {
      this.setData({ fromMerged: true });
      // 从合并视图进入时，从 globalData.tempViewWords 读取单词列表
      const mergedApp = getApp();
      const mergedWords = mergedApp && mergedApp.globalData && mergedApp.globalData.tempViewWords;
      if (mergedWords && Array.isArray(mergedWords) && mergedWords.length > 0) {
        console.log('[Review] 从合并视图加载单词:', mergedWords.length, '个');
        this.setData({ isReviewSessionPage: true });
        this.loadReviewWords(mergedWords);
        // 清理临时数据，避免内存泄漏
        mergedApp.globalData.tempViewWords = null;
      } else {
        console.warn('[Review] 合并视图未提供有效单词列表');
      }
    }

    const app = getApp();
    this._onWordMasteryUpdated = () => {
      if (this.data.isReviewSessionPage || this.data.learningMode === 'review') {
        return;
      }
      this.initReviewProcess();
    };
    if (app && app.on) {
      app.on('wordMasteryUpdated', this._onWordMasteryUpdated);
    }

    // 以独立页面实例进入复习，会话返回时应回到上一个抗遗忘列表页
    if (options && options.mode === 'review' && options.words) {
      let sessionWordIds = [];
      try {
        sessionWordIds = JSON.parse(decodeURIComponent(options.words));
      } catch (error) {
        console.error('解析复习单词参数失败:', error);
        sessionWordIds = [];
      }

      this.setData({ isReviewSessionPage: true });
      this.loadReviewWords(sessionWordIds);
    }
  },

  onShow: function() {
    console.log('抗遗忘复习页面显示');
    if (this.data.isReviewSessionPage || this.data.fromMerged) {
      return;
    }
    // 重新加载合并词书数据，确保使用最新的单词映射表
    reloadWordMap();
    this.syncFromGlobalData();
    this.checkSelectedStudentAndWordbook();
  },

  onHide: function() {
    this.clearReviewAvailabilityTimer();
  },

  onUnload: function() {
    this.clearReviewAvailabilityTimer();
    const app = getApp();
    if (app && app.off && this._onWordMasteryUpdated) {
      app.off('wordMasteryUpdated', this._onWordMasteryUpdated);
    }
  },

  // 处理系统返回：复习中先回到抗遗忘列表，而不是直接返回首页
  onBackPress: function() {
    if (this.data.learningMode === 'review') {
      this.backToRecordList();
      return true;
    }
    return false;
  },

  formatLocalDate: function(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  safeGetStorageSync: function(key, defaultValue) {
    try {
      const value = wx.getStorageSync(key);
      return value === undefined || value === null ? defaultValue : value;
    } catch (error) {
      console.error(`读取本地存储失败: ${key}`, error);
      return defaultValue;
    }
  },

  clearReviewAvailabilityTimer: function() {
    if (this._reviewAvailabilityTimer) {
      clearTimeout(this._reviewAvailabilityTimer);
      this._reviewAvailabilityTimer = null;
    }
  },

  getReviewDayStartTime: function(timestamp) {
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    const dayStart = date.getTime();
    return Number.isFinite(dayStart) ? dayStart : 0;
  },

  scheduleReviewAvailabilityRefresh: function(records) {
    this.clearReviewAvailabilityTimer();
    if (this.data.isReviewSessionPage || this.data.learningMode === 'review') {
      return;
    }

    const now = Date.now();
    const nowDayStart = this.getReviewDayStartTime(now);
    let nextRefreshTime = 0;
    (Array.isArray(records) ? records : []).forEach((record) => {
      if (!record || record.canReview === true || !record.time) {
        return;
      }
      const reviewDayStart = this.getReviewDayStartTime(record.time);
      if (!reviewDayStart) {
        return;
      }
      const candidate = reviewDayStart <= nowDayStart
        ? now + 1000
        : reviewDayStart + 1000;
      nextRefreshTime = nextRefreshTime
        ? Math.min(nextRefreshTime, candidate)
        : candidate;
    });

    if (!nextRefreshTime) {
      return;
    }

    const maxDelay = 30 * 60 * 1000;
    const delay = Math.max(1000, Math.min(nextRefreshTime - now, maxDelay));
    this._reviewAvailabilityTimer = setTimeout(() => {
      this._reviewAvailabilityTimer = null;
      if (this.data.isReviewSessionPage || this.data.learningMode === 'review') {
        return;
      }
      this.initReviewProcess();
    }, delay);
  },

  migrateAntiForgettingSeedIfNeeded: function(studentId, wordbookId, wordMastery) {
    const migrateKey = `antiForgettingSeedMigrated_${studentId}_${wordbookId}`;
    if (this.safeGetStorageSync(migrateKey, false)) {
      return wordMastery;
    }

    if (!wordMastery[studentId] || !wordMastery[studentId][wordbookId]) {
      return wordMastery;
    }

    const wordbookMastery = wordMastery[studentId][wordbookId];
    if (Array.isArray(wordbookMastery)) {
      console.warn(
        '[Review] 检测到旧数组掌握数据，保持只读兼容，不推断复习状态:',
        studentId,
        wordbookId
      );
    }

    // 旧数组只表达“已掌握ID集合”，无法安全推断学习时间和复习状态。
    // 对象记录仅通过筛选器做只读兼容，不再补种子或迁移用户掌握数据。
    wx.setStorageSync(migrateKey, true);
    return wordMastery;
  },

  normalizeReviewWordId: function(wordId) {
    return String(wordId || '').trim().toLowerCase().replace(/(_\d+)$/, '');
  },

  canonicalizeReviewWord: function(word, wordId) {
    const text = String(word || '').trim();
    if (!text) {
      return '';
    }

    const normalized = text.toLowerCase().replace(/\./g, '');
    const sourceId = String(wordId || '').toLowerCase();

    // 历史兼容：部分记录链路会把 miss 缩成 ms，这里统一纠偏。
    if ((normalized === 'ms' || normalized === 'mss') && (sourceId.includes('_miss') || sourceId.endsWith('miss') || !!wordMap['miss'])) {
      return 'miss';
    }

    return text;
  },


  syncFromGlobalData: function() {
    console.log('按统一学习上下文同步抗遗忘范围');
    try {
      const app = getApp();
      if (!app || !app.globalData) {
        console.warn('getApp/globalData 不可用，跳过全局数据同步');
        return;
      }

      const currentStudent = resolveCurrentStudent(app);
      const currentWordbook = resolveCurrentWordbook(app, currentStudent);
      this.setData({
        currentStudent: currentStudent || null,
        currentWordbook: currentWordbook || null,
        learningWordbooks: currentWordbook?.title || ''
      });

      if (currentStudent) {
        app.globalData.currentStudent = currentStudent;
        wx.setStorageSync('selectedStudent', currentStudent);
      }
      if (currentWordbook) {
        app.globalData.currentWordbook = currentWordbook;
        app.globalData.selectedWordbook = currentWordbook;
        wx.setStorageSync('selectedWordbook', currentWordbook);
      }
    } catch (error) {
      console.error('同步全局数据失败:', error);
    }
  },

  checkSelectedStudentAndWordbook: function() {
    console.log('检查选择的学生和词书');
    if (this.data.currentStudent && this.data.currentWordbook) {
      console.log('学生和词书已选择，初始化复习过程');
      this.initReviewProcess();
    } else {
      console.log('缺少学生或词书信息');
      this.setData({
        hasError: true,
        errorMessage: '请先选择学生和词书',
        loading: false
      });
    }
  },

  initReviewProcess: function() {
    console.log('初始化抗遗忘复习过程');
    this.setData({
      loading: true,
      hasError: false
    });

    // 显示加载动画
    wx.showLoading({
      title: '准备抗遗忘复习材料...',
    });

    try {
      this.initializeAntiForgettingMode();
    } catch (error) {
      console.error('初始化抗遗忘复习过程失败:', error);
      this.setData({
        loading: false,
        hasError: true,
        errorMessage: '初始化抗遗忘复习失败，请重试'
      });
    } finally {
      // 确保无论成功还是失败都隐藏加载动画
      wx.hideLoading();
    }
  },

  initializeAntiForgettingMode: function() {
    console.log('初始化抗遗忘复习模式');
    
    // 确保有学生和词书信息
    if (!this.data.currentStudent?.id || !this.data.currentWordbook?.id) {
      console.error('初始化抗遗忘复习失败：缺少学生或词书信息');
      throw new Error('缺少学生或词书信息');
    }
    
    const studentId = this.data.currentStudent.id;
    const wordbookId = this.data.currentWordbook.id;
    console.log('当前学生ID:', studentId, '当前词书ID:', wordbookId);
    
    // 获取单词掌握记录
    let wordMastery = this.safeGetStorageSync('wordMastery', {});
    wordMastery = this.migrateAntiForgettingSeedIfNeeded(studentId, wordbookId, wordMastery);

    // 生成抗遗忘复习记录
    const reviewRecords = this.generateAntiForgettingRecords(studentId, wordbookId, wordMastery);
    
    console.log('生成的抗遗忘复习记录数量:', reviewRecords.length);
    
    // 检查是否有复习记录
    if (reviewRecords.length === 0) {
      console.log('没有抗遗忘复习记录，显示空状态');
      this.setData({
        reviewRecords: [],
        totalReviewCount: 0,
        loading: false,
        hasError: true,
        errorMessage: '当前没有抗遗忘复习记录，建议学习新单词'
      });
      this.clearReviewAvailabilityTimer();
      return;
    }
    
    // 更新页面数据
    this.setData({
      reviewRecords: reviewRecords,
      totalReviewCount: reviewRecords.length,
      loading: false
    });
    
    console.log('抗遗忘复习模式初始化完成');
    
    // 初始化时也生成合并视图的记录
    const mergedByDate = this.mergeRecordsByDate(reviewRecords);
    this.setData({
      mergedViewRecords: mergedByDate
    });
    this.scheduleReviewAvailabilityRefresh(reviewRecords);
  },

  generateAntiForgettingRecords: function(studentId, wordbookId, wordMastery) {
    console.log('生成抗遗忘复习记录');

    const records = [];
    const now = Date.now();
    const wordbookName = this.data.currentWordbook?.title || '未知词书';

    // 检查是否有单词掌握记录
    if (!wordMastery[studentId] || !wordMastery[studentId][wordbookId]) {
      console.log('没有找到单词掌握记录，返回空数组');
      return records;
    }

    const wordbookMastery = wordMastery[studentId][wordbookId];
    if (!wordbookMastery || typeof wordbookMastery !== 'object' || Array.isArray(wordbookMastery)) {
      return records;
    }
    const hasScopedWordIds = Object.keys(wordbookMastery)
      .some((wordId) => String(wordId).startsWith(`${wordbookId}_`));

    // 遍历所有单词
    for (const wordId in wordbookMastery) {
      const wordRecord = wordbookMastery[wordId];

      const schedule = buildAntiForgettingSchedule(wordId, wordRecord, {
        studentId,
        wordbookId,
        now,
        hasScopedWordIds
      });
      if (schedule.length === 0) {
        continue;
      }

      schedule.forEach((roundPlan) => {
        records.push({
          id: `${wordId}_round_${roundPlan.round}`,
          date: this.formatLocalDate(roundPlan.scheduledTime),
          time: roundPlan.scheduledTime,
          round: roundPlan.round,
          wordCount: 1,
          canReview: roundPlan.canReview,
          scheduleStatus: roundPlan.scheduleStatus,
          words: [wordId],
          wordbookName,
          learningBatchKey: roundPlan.learningBatchKey,
          learningDate: roundPlan.firstStudyTime
            ? this.formatLocalDate(roundPlan.firstStudyTime)
            : '旧数据',
          reviewType: roundPlan.reviewType,
          reviewTypeLabel: roundPlan.reviewTypeLabel
        });
      });
    }

    // 按日期和轮数分组并合并记录
    const mergedRecords = this.mergeReviewRecords(records);
    
    // 按时间排序
    mergedRecords.sort((a, b) => a.time - b.time);
    
    return mergedRecords;
  },

  mergeReviewRecords: function(records) {
    console.log('合并抗遗忘复习记录');
    
    // 普通视图按学习自然日合并：同一天多次学习共用一组五轮，不同日期互不吞并。
    const groupedRecords = {};
    
    records.forEach(record => {
      const batchKey = record.learningBatchKey || `legacy_${record.time}_${record.round}`;
      const key = `${batchKey}_${record.date}_round_${record.round}_${record.scheduleStatus || 'scheduled'}`;
      
      if (!groupedRecords[key]) {
        groupedRecords[key] = {
          ...record,
          wordCount: 0,
          words: [],
          _wordKeyMap: {}
        };
      }
      
      // 合并单词（按归一化ID去重，避免同词多ID导致数量膨胀）
      (record.words || []).forEach(wordId => {
        const normalizedId = this.normalizeReviewWordId(wordId);
        if (!normalizedId || groupedRecords[key]._wordKeyMap[normalizedId]) {
          return;
        }
        groupedRecords[key]._wordKeyMap[normalizedId] = true;
        groupedRecords[key].words.push(wordId);
      });
      groupedRecords[key].wordCount = groupedRecords[key].words.length;
      
      // 只要有一个记录可以复习，整个分组就可以复习
      if (record.canReview) {
        groupedRecords[key].canReview = true;
      }
      
      // 保留词书名称和学习日期
      if (record.wordbookName) {
        groupedRecords[key].wordbookName = record.wordbookName;
      }
      if (record.learningDate) {
        groupedRecords[key].learningDate = record.learningDate;
      }
    });
    
    // 转换为数组并返回
    return Object.values(groupedRecords).map(record => {
      const cleanedRecord = { ...record };
      delete cleanedRecord._wordKeyMap;
      return cleanedRecord;
    });
  },

  initializeReviewMode: function() {
    console.log('初始化单词复习模式');
    
    // 确保有学生和词书信息
    if (!this.data.currentStudent || !this.data.currentWordbook) {
      console.error('初始化复习失败：缺少学生或词书信息');
      throw new Error('缺少学生或词书信息');
    }
    
    const studentId = this.data.currentStudent.id;
    const wordbookId = this.data.currentWordbook.id;
    console.log('当前学生ID:', studentId, '当前词书ID:', wordbookId);
    
    // 获取当前词书的类别
    const wordbookCategory = this.data.currentWordbook.category || 'primary';
    
    // 使用真实词书数据，与预习界面保持一致
    const batchSize = 15;
    let allWords = [];
    
    try {
      // 与预习界面保持一致：直接使用generateWordsForBook生成单词数据
      console.log('开始生成单词数据，词书类别:', wordbookCategory, '词书ID:', wordbookId);
      const firstBatch = generateWordsForBook(wordbookCategory, wordbookId, 0, batchSize);
      console.log('第一批单词:', firstBatch);
      const totalCount = firstBatch._totalCount || 100;
      console.log('词书总单词数:', totalCount);
      
      // 与预习界面保持一致：加载所有单词
      const maxWordsToLoad = totalCount; // 加载所有单词
      console.log('开始加载单词，计划加载:', maxWordsToLoad, '个');
      
      // 分批加载所有单词
      for (let i = 0; i < maxWordsToLoad; i += batchSize) {
        const batch = generateWordsForBook(wordbookCategory, wordbookId, i, batchSize);
        console.log('加载批次', i, '单词数:', batch.length);
        allWords.push(...batch);
      }
      
      // 与预习界面保持一致：为每个单词添加标准格式的ID
      allWords = allWords.map((word, index) => {
        // 使用与预习界面相同的ID格式
        const baseId = word.word ? `${wordbookId}_${word.word.toLowerCase().replace(/\s+/g, '_')}` : `${wordbookId}_unknown`;
        console.log('生成单词ID:', baseId, '原单词:', word.word);
        return {
          ...word,
          id: baseId
        };
      });
      
      console.log('加载完成，总单词数:', allWords.length);
      console.log('加载的单词示例:', allWords.slice(0, 5));
    } catch (error) {
      console.error('加载词书单词失败:', error);
      // 如果加载失败，使用空数组
      allWords = [];
    }
    
    // 直接使用列表页传过来的单词ID，不再重新筛选
    const reviewWordIdArray = Array.isArray(wordIds) ? wordIds : [];
    const masteredWordIdArray = [];
    
    console.log('复习单词ID列表(来自列表页):', reviewWordIdArray);
    
    // 筛选需要复习的单词
    let filteredReviewWords = [];
    
    // 获取单词掌握记录
    let wordMastery = this.safeGetStorageSync('wordMastery', {});
    
    // 关键修复：如果reviewWordIdArray为空，直接显示没有需要复习的单词
    if (reviewWordIdArray.length === 0) {
      console.log('没有需要复习的单词ID，直接显示空状态');
      // 计算下次复习时间
      const nextReviewInfo = this.calculateNextReviewInfo();
      
      this.setData({
        allWords: [],
        currentBatchWords: [],
        currentBatchIndex: 0,
        totalBatches: 0,
        currentBatchWordsCount: 0,
        previewMastery: {},
        hasMoreWords: false,
        loading: false,
        hasError: true,
        errorMessage: nextReviewInfo ? 
          `当前没有需要复习的单词\n\n下次复习时间：${nextReviewInfo.time}\n距离现在：${nextReviewInfo.daysLeft}天` : 
          '当前没有需要复习的单词，建议学习新单词'
      });
      return;
    }
    
    // 首先尝试从单词掌握记录中直接获取单词信息
    if (reviewWordIdArray.length > 0) {
      console.log('从单词掌握记录中构建复习单词列表');
      console.log('需要复习的单词ID数量:', reviewWordIdArray.length);
      
      filteredReviewWords = reviewWordIdArray.map(wordId => {
        // 从掌握记录中提取单词信息
        if (wordMastery[studentId] && wordMastery[studentId][wordbookId]) {
          const wordInfo = wordMastery[studentId][wordbookId][wordId];
          if (wordInfo) {
            // 尝试从wordId中提取单词 - 优化的逻辑
            let word = wordId;
            
            // 尝试从wordId中提取单词
            try {
              console.log('原始wordId:', wordId);
              
              // 情况1: wordId格式为 "wordbookId_word_real_..."
              if (wordbookId && wordId.includes(`${wordbookId}_`)) {
                word = wordId.replace(`${wordbookId}_`, '').replace('_real_', '');
                console.log('处理情况1后:', word);
              } 
              // 情况2: wordId格式为 "word_real_..."
              else if (wordId.includes('_real_')) {
                word = wordId.replace('_real_', '');
                console.log('处理情况2后:', word);
              } 
              // 情况3: wordId格式为 "wordbookId_word"
              else if (wordId.includes('_') && !wordId.includes('_real_')) {
                // 假设格式为 "wordbookId_word"，提取单词部分
                const parts = wordId.split('_');
                if (parts.length > 1) {
                  // 移除第一个部分（假设是wordbookId），保留其余部分作为单词
                  // 这样可以正确处理包含下划线的单词
                  parts.shift();
                  word = parts.join('_');
                  console.log('处理情况3后:', word);
                }
              }
              // 情况4: wordId是数字，尝试从词书数据中查找对应的单词
              else if (!isNaN(wordId) && !isNaN(parseFloat(wordId))) {
                // 尝试从词书数据中查找对应的单词
                console.log('wordId是数字，尝试从词书数据中查找:', wordId);
                const wordIndex = parseInt(wordId) - 1;
                if (allWords && allWords.length > wordIndex) {
                  const foundWord = allWords[wordIndex];
                  if (foundWord && foundWord.word) {
                    word = foundWord.word;
                    console.log('从词书数据中找到单词:', wordId, '→', word);
                  }
                }
              }
              // 情况5: 直接使用wordId作为单词
              
              // 重复词条的稳定后缀只用于身份隔离，展示和查词时仍使用原单词。
              word = stripStableWordOccurrenceSuffix(word);

              // 替换下划线为空格
              word = word.replace(/_/g, ' ');
              console.log('替换下划线后:', word);
              
              // 去除多余的空白字符
              word = word.trim();

              // 统一纠偏，避免 miss 在复习页被显示成 ms
              word = this.canonicalizeReviewWord(word, wordId);
              console.log('去除空白字符后:', word);
              
              // 特殊处理常见短语
              const commonPhrases = {
                'couch potato': 'couch potato',
                'last but not least': 'last but not least',
                'the united states': 'the united states'
              };
              
              // 检查是否是常见短语
              for (const phrase in commonPhrases) {
                if (word.toLowerCase().includes(phrase) || phrase.includes(word.toLowerCase())) {
                  word = phrase;
                  console.log('匹配常见短语:', word);
                  break;
                }
              }
              
              console.log('最终提取的单词:', wordId, '→', word);
            } catch (error) {
              console.error('提取单词失败:', error);
            }
            
            // 过滤非英语单词的内容
            const nonWordList = ['objectspread', 'undefined', 'null', 'NaN', '{}', '[]'];
            if (nonWordList.includes(word.toLowerCase())) {
              console.log('排除非单词:', word);
              return null;
            }
            
            // 从词书数据中查找完整的单词信息
            let matchedWord = null;
            
            console.log('开始匹配单词:', word, 'wordId:', wordId);
            
            // 1. 首先从allWords中查找（与预习界面保持一致，优先使用词书原始数据）
            if (allWords.length > 0) {
              console.log('allWords长度:', allWords.length);
              console.log('allWords前10个单词:', allWords.slice(0, 10));
              
              // 尝试精确匹配
              matchedWord = allWords.find(w => w.word === word);
              if (matchedWord) {
                console.log('使用精确匹配结果:', word, '→', matchedWord);
              } else {
                // 尝试大小写不敏感匹配
                matchedWord = allWords.find(w => w.word && w.word.toLowerCase() === word.toLowerCase());
                if (matchedWord) {
                  console.log('使用大小写不敏感匹配结果:', word, '→', matchedWord);
                } else {
                  // 尝试从单词ID中提取匹配
                  matchedWord = allWords.find(w => w.id === wordId || w.id.includes(word));
                  if (matchedWord) {
                    console.log('使用单词ID匹配结果:', word, '→', matchedWord);
                  } else {
                    // 尝试使用原始wordId直接匹配
                    matchedWord = allWords.find(w => w.id === wordId);
                    if (matchedWord) {
                      console.log('使用原始wordId匹配结果:', word, '→', matchedWord);
                    } else {
                      // 尝试遍历allWords数组，查找包含目标单词的项
                      for (let i = 0; i < allWords.length; i++) {
                        const w = allWords[i];
                        if (w.word === word || (w.word && w.word.toLowerCase() === word.toLowerCase())) {
                          matchedWord = w;
                          console.log('使用遍历匹配结果:', word, '→', matchedWord);
                          break;
                        }
                      }
                    }
                  }
                }
              }
            }
            
            // 2. 如果还是没找到，尝试重新从词书数据中加载
            if (!matchedWord) {
              try {
                console.log('重新加载词书数据，词书类别:', wordbookCategory, '词书ID:', wordbookId);
                // 直接从词书数据中重新加载，确保获取最新的单词信息
                const batchSize = 15;
                const firstBatch = generateWordsForBook(wordbookCategory, wordbookId, 0, batchSize);
                console.log('重新加载的第一批单词:', firstBatch);
                const totalCount = firstBatch._totalCount || 100;
                let allWordsData = [];
                
                for (let i = 0; i < totalCount; i += batchSize) {
                  const batch = generateWordsForBook(wordbookCategory, wordbookId, i, batchSize);
                  allWordsData.push(...batch);
                }
                
                console.log('重新加载的总单词数:', allWordsData.length);
                console.log('重新加载的单词示例:', allWordsData.slice(0, 10));
                
                // 为每个单词添加标准格式的ID
                allWordsData = allWordsData.map((w, index) => {
                  const baseId = w.word ? `${wordbookId}_${w.word.toLowerCase().replace(/\s+/g, '_')}` : `${wordbookId}_unknown`;
                  return {
                    ...w,
                    id: baseId
                  };
                });
                
                // 再次尝试匹配
                matchedWord = allWordsData.find(w => w.word === word);
                if (matchedWord) {
                  console.log('使用重新加载的词书数据精确匹配结果:', word, '→', matchedWord);
                } else {
                  matchedWord = allWordsData.find(w => w.word && w.word.toLowerCase() === word.toLowerCase());
                  if (matchedWord) {
                    console.log('使用重新加载的词书数据大小写不敏感匹配结果:', word, '→', matchedWord);
                  } else {
                    matchedWord = allWordsData.find(w => w.id === wordId || w.id.includes(word));
                    if (matchedWord) {
                      console.log('使用重新加载的词书数据ID匹配结果:', word, '→', matchedWord);
                    } else {
                      // 尝试遍历allWordsData数组，查找包含目标单词的项
                      for (let i = 0; i < allWordsData.length; i++) {
                        const w = allWordsData[i];
                        if (w.word === word || (w.word && w.word.toLowerCase() === word.toLowerCase())) {
                          matchedWord = w;
                          console.log('使用重新加载的词书数据遍历匹配结果:', word, '→', matchedWord);
                          break;
                        }
                      }
                    }
                  }
                }
              } catch (error) {
                console.error('重新加载词书数据失败:', error);
              }
            }
            
            // 3. 如果还是没找到，尝试直接加载译林牛津版七年级上册的词书数据
            if (!matchedWord && wordbookId === 'junior_7th_yi_lin') {
              try {
                console.log('直接加载译林牛津版七年级上册的词书数据');
                const yiLinData = require('../../data/yi_lin_7th_grade_first.js');
                console.log('译林牛津版七年级上册词书数据长度:', yiLinData.length);
                console.log('译林牛津版七年级上册词书数据示例:', yiLinData.slice(0, 10));
                
                // 尝试匹配
                matchedWord = yiLinData.find(w => w.word === word);
                if (matchedWord) {
                  console.log('使用译林牛津版七年级上册词书数据精确匹配结果:', word, '→', matchedWord);
                } else {
                  matchedWord = yiLinData.find(w => w.word && w.word.toLowerCase() === word.toLowerCase());
                  if (matchedWord) {
                    console.log('使用译林牛津版七年级上册词书数据大小写不敏感匹配结果:', word, '→', matchedWord);
                  }
                }
              } catch (error) {
                console.error('直接加载译林牛津版七年级上册词书数据失败:', error);
              }
            }
            
            // 4. 如果还是没找到，尝试从合并的词书中查找
            if (!matchedWord) {
              console.log('从合并的词书中查找单词:', word);
              // 先尝试精确匹配
              const normalizedWord = word.toLowerCase();
              const exactMatch = wordMap[normalizedWord] || wordMap[normalizedWord.replace(/\./g, '')];
              if (exactMatch) {
                matchedWord = exactMatch;
                console.log('使用合并词书精确匹配结果:', word, '→', matchedWord);
              } else {
                // 短词禁用模糊匹配，避免 ms 误命中无关词条
                if (normalizedWord.length >= 3) {
                  const fallbackMatch = findWord(word, wordMap);
                  if (fallbackMatch) {
                    matchedWord = fallbackMatch;
                    console.log('使用合并词书兜底匹配结果:', word, '→', matchedWord);
                  }
                }
              }
            }
            
            // 定义常见单词列表，确保在整个函数中可见
            const commonWords = {
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
              // 其他常见单词
              'surprisingly': {
                word: 'surprisingly',
                phonetic: '/səˈpraɪzɪŋli/',
                meaning: '令人惊讶地'
              },
              'funny': {
                word: 'funny',
                phonetic: '/ˈfʌni/',
                meaning: '有趣的；滑稽的'
              },
              'ancient': {
                word: 'ancient',
                phonetic: '/ˈeɪnʃənt/',
                meaning: '古代的'
              },
              'review': {
                word: 'review',
                phonetic: '/rɪˈvjuː/',
                meaning: '复习；回顾'
              },
              'the': {
                word: 'the',
                phonetic: '/ðə/',
                meaning: '这；那；这些；那些'
              },
              'the united states': {
                word: 'the United States',
                phonetic: '/ðə juːˈnaɪtɪd steɪts/',
                meaning: '美国'
              },
              'british': {
                word: 'British',
                phonetic: '/ˈbrɪtɪʃ/',
                meaning: '英国的；英国人的'
              },
              'english': {
                word: 'English',
                phonetic: '/ˈɪŋɡlɪʃ/',
                meaning: '英语；英国的'
              },
              // 外研社七年级下册单词
              'ingredient': {
                word: 'ingredient',
                phonetic: '/ɪnˈɡriːdiənt/',
                meaning: '原料；成分'
              },
              'couch potato': {
                word: 'couch potato',
                phonetic: '/ˈkaʊtʃ pəˈteɪtəʊ/',
                meaning: '沙发土豆（指长时间看电视的人）'
              },
              // 外研社七年级下册更多单词
              'last but not least': {
                word: 'last but not least',
                phonetic: '/læst bʌt nɒt liːst/',
                meaning: '最后但同样重要的是'
              }
            };
            
            // 4. 然后检查常见单词，确保重要单词能正确显示
            if (!matchedWord) {
              // 1. 首先检查常见单词，确保重要单词能正确显示
              if (commonWords[word.toLowerCase()]) {
                matchedWord = commonWords[word.toLowerCase()];
                console.log('使用常见单词默认释义:', word, '→', matchedWord);
              }
              // 然后尝试部分匹配
              else {
                for (const key in commonWords) {
                  if (word.toLowerCase().includes(key) || key.includes(word.toLowerCase())) {
                    matchedWord = commonWords[key];
                    console.log('使用常见单词部分匹配释义:', word, '→', matchedWord);
                    break;
                  }
                }
              }
            }
            
            // 5. 处理地名词组的大小写
            if (matchedWord && matchedWord.word) {
              // 检查是否是地名词组或国家名称
              const placeWords = ['south africa', 'north america', 'south america', 'united states', 'united kingdom', 'new york', 'los angeles', 'australia', 'china', 'america', 'japan', 'france', 'germany', 'canada'];
              if (placeWords.includes(matchedWord.word.toLowerCase())) {
                // 地名词组或国家名称首字母大写
                const capitalizedWord = matchedWord.word.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                matchedWord.word = capitalizedWord;
                console.log('地名词组或国家名称首字母大写:', matchedWord.word);
              }
            } else if (word) {
              // 检查是否是地名词组或国家名称
              const placeWords = ['south africa', 'north america', 'south america', 'united states', 'united kingdom', 'new york', 'los angeles', 'australia', 'china', 'america', 'japan', 'france', 'germany', 'canada'];
              if (placeWords.includes(word.toLowerCase())) {
                // 地名词组或国家名称首字母大写
                word = word.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                console.log('地名词组或国家名称首字母大写:', word);
              }
            }
            
            // 6. 如果还是没找到，尝试在线词典查询
            if (!matchedWord) {
              console.log('本地词书数据中未找到，尝试在线词典查询:', word);
              const onlineDefinition = this.fetchWordDefinition(word);
              console.log('在线词典查询结果:', onlineDefinition);
              
              if (onlineDefinition) {
                matchedWord = onlineDefinition;
              } else {
                // 为所有单词提供默认的音标和释义格式，使用更友好的提示信息
                matchedWord = {
                  word: word,
                  meaning: '暂无释义，请尝试其他单词',
                  phonetic: '/fəˈnetɪk/'
                };
              }
            }
            
            // 7. 再次检查常见单词，确保显示正确的信息
            if (commonWords[word.toLowerCase()]) {
              matchedWord = commonWords[word.toLowerCase()];
              console.log('强制使用常见单词定义:', word, '→', matchedWord);
            }
            // 尝试部分匹配
            else {
              for (const key in commonWords) {
                if (word.toLowerCase().includes(key) || key.includes(word.toLowerCase())) {
                  matchedWord = commonWords[key];
                  console.log('强制使用常见单词部分匹配:', word, '→', matchedWord);
                  break;
                }
              }
            }
            
            console.log('单词信息:', wordId, matchedWord.word, matchedWord.meaning, matchedWord.phonetic);
            
            // 创建单词对象，使用词书数据中的单词大小写，与预习界面保持一致
            return {
              id: wordId,
              word: matchedWord ? matchedWord.word : word, // 使用词书数据中的单词大小写，与预习界面保持一致
              meaning: matchedWord.meaning,
              phonetic: matchedWord.phonetic,
              translation: matchedWord.meaning // 确保translation属性也存在
            };
          }
        }
        return null;
      }).filter(word => word !== null);
      
      console.log('从单词掌握记录中构建的复习单词数量:', filteredReviewWords.length);
    }
    
    // 如果从掌握记录中获取失败，再尝试从词书中匹配
    if (filteredReviewWords.length === 0 && allWords.length > 0 && reviewWordIdArray.length > 0) {
      console.log('从词书中匹配复习单词');
      
      // 关键修复：只尝试匹配reviewWordIdArray中存在的单词ID
      // 创建一个映射表提高匹配效率
      const reviewWordIdSet = new Set(reviewWordIdArray);
      
      filteredReviewWords = allWords.filter(word => {
        // 生成所有可能的单词ID格式进行匹配
        const possibleIds = [
          String(word.id),
          `${wordbookId}_${word.word}`,
          `${wordbookId}_real_${word.word}`,
          `${wordbookId}_${word.word.toLowerCase().replace(/\s+/g, '_')}`,
          `${wordbookId}_real_${word.word.toLowerCase().replace(/\s+/g, '_')}`
        ];
        
        // 检查是否有任何一个可能的ID在reviewWordIdSet中
        const needsReview = possibleIds.some(id => reviewWordIdSet.has(id));
        
        if (needsReview) {
          console.log('添加到复习列表的单词:', word.id, word.word, word.phonetic, word.meaning);
        }
        return needsReview;
      });
      
      // 确保只返回匹配到的单词，避免空匹配返回所有单词
      if (filteredReviewWords.length === 0) {
        console.log('没有从词书中匹配到需要复习的单词');
      }
      
      // 确保每个单词都有完整的信息
      filteredReviewWords = filteredReviewWords.map(word => ({
        ...word,
        translation: word.meaning || word.translation || '未知'
      }));
    }
    
    console.log('筛选后需要复习的单词数:', filteredReviewWords.length);
    
    // 检查是否有需要复习的单词
    if (filteredReviewWords.length === 0) {
      console.log('没有找到匹配的单词，显示空状态');
      // 计算下次复习时间
      let nextReviewInfo = null;
      if (wordMastery[studentId] && wordMastery[studentId][wordbookId]) {
        const wordbookMastery = wordMastery[studentId][wordbookId];
        let earliestFutureReviewTime = null;
        let earliestWordId = null;
        const now = new Date().getTime();
        
        for (const wordId in wordbookMastery) {
          const nextReviewTime = wordbookMastery[wordId].nextReviewTime;
          // 只考虑未来的复习时间，避免显示已过期的时间
          if (nextReviewTime && nextReviewTime > now) {
            if (!earliestFutureReviewTime || nextReviewTime < earliestFutureReviewTime) {
              earliestFutureReviewTime = nextReviewTime;
              earliestWordId = wordId;
            }
          }
        }
        
        if (earliestFutureReviewTime) {
          const nextReviewDate = new Date(earliestFutureReviewTime);
          // 格式化日期为只包含年月日
          const formattedDate = `${nextReviewDate.getFullYear()}-${String(nextReviewDate.getMonth() + 1).padStart(2, '0')}-${String(nextReviewDate.getDate()).padStart(2, '0')}`;
          nextReviewInfo = {
            time: formattedDate,
            wordId: earliestWordId
          };
        }
      }
      
      this.setData({
        allWords: [],
        currentBatchWords: [],
        currentBatchIndex: 0,
        totalBatches: 0,
        currentBatchWordsCount: 0,
        previewMastery: {},
        hasMoreWords: false,
        loading: false,
        hasError: true,
        errorMessage: nextReviewInfo ? 
          `当前没有需要复习的单词，下次复习时间：${nextReviewInfo.time}` : 
          '当前没有需要复习的单词，建议学习新单词'
      });
      return;
    }
    
    // 检查过滤后的单词是否包含非单词内容，避免显示错误数据
    filteredReviewWords = filteredReviewWords.filter(word => {
      // 过滤非英语单词的内容
      const nonWordList = ['objectspread', 'undefined', 'null', 'NaN', '{}', '[]'];
      const isNonWord = nonWordList.includes(word.word.toLowerCase()) || 
                       !/^[a-zA-Z\s]+$/.test(word.word);
      if (isNonWord) {
        console.log('排除非单词内容:', word.word);
        return false;
      }
      return true;
    });
    
    // 检查过滤后的单词列表是否为空
    if (filteredReviewWords.length === 0) {
      console.log('过滤后没有单词，显示空状态');
      // 计算下次复习时间
      const nextReviewInfo = this.calculateNextReviewInfo();
      
      this.setData({
        allWords: [],
        currentBatchWords: [],
        currentBatchIndex: 0,
        totalBatches: 0,
        currentBatchWordsCount: 0,
        previewMastery: {},
        hasMoreWords: false,
        loading: false,
        hasError: true,
        errorMessage: nextReviewInfo ? 
          `当前没有需要复习的单词\n\n下次复习时间：${nextReviewInfo.time}\n距离现在：${nextReviewInfo.daysLeft}天` : 
          '当前没有需要复习的单词，建议学习新单词'
      });
      return;
    }
    
    // 更新allWords为筛选后的结果
    const savedPreviewMastery = this.getSavedPreviewMastery(studentId, wordbookId);
    
    this.setData({
      allWords: filteredReviewWords,
      currentBatchWords: filteredReviewWords, // 显示所有复习单词，不分页
      currentBatchIndex: 0,
      totalBatches: 1, // 只有一个批次
      currentBatchWordsCount: filteredReviewWords.length, // 所有单词的数量
      previewMastery: savedPreviewMastery || {},
      hasMoreWords: false, // 不需要显示下一批按钮
      loading: false
    });
    
    console.log('最终单词数量:', filteredReviewWords.length, '批次数量:', this.data.totalBatches);
    
    // 更新掌握统计
    this.updateBatchMasteryStats();
    
    console.log('单词复习模式初始化完成');
  },

  getReviewWords: function(studentId, wordbookId) {
    console.log('获取需要复习的单词 - 参数:', studentId, wordbookId);
    let masteredWordIdArray = [];
    let reviewWordIdArray = [];
    
    try {
      // 尝试获取单词掌握记录
      let wordMastery = this.safeGetStorageSync('wordMastery', {});
      
      // 增加调试信息
      console.log('wordMastery内容:', JSON.stringify(wordMastery, null, 2));
      
      // 检查是否有单词掌握记录
      if (!wordMastery[studentId] || !wordMastery[studentId][wordbookId]) {
        console.log('没有找到单词掌握记录，返回空数组');
        return { masteredWordIdArray, reviewWordIdArray };
      }
      
      if (wordMastery[studentId]) {
        console.log('找到学生记录:', studentId);
        console.log('该学生的词书:', Object.keys(wordMastery[studentId]));
      } else {
        console.log('没有找到学生记录:', studentId);
      }
      
      // 安全地检查和获取已掌握单词
      if (wordMastery[studentId] && wordMastery[studentId][wordbookId]) {
        console.log('使用单词掌握记录过滤已学习单词');
        
        const masteredWords = wordMastery[studentId][wordbookId];
        const now = Date.now();
        console.log('当前时间:', new Date(now).toLocaleString());
        
        if (Array.isArray(masteredWords)) {
          // 兼容旧的数组格式：只将需要复习的单词添加到复习列表
          masteredWordIdArray = masteredWords;
          reviewWordIdArray = []; // 旧格式默认不需要复习
          console.log('使用旧数组格式，已掌握单词数量:', masteredWordIdArray.length);
          console.log('旧格式下需要复习的单词ID:', reviewWordIdArray);
        } else if (typeof masteredWords === 'object') {
          // 新的对象格式：与抗遗忘列表共用同一套作用域、状态和到期口径。
          const hasScopedWordIds = Object.keys(masteredWords)
            .some((wordId) => String(wordId).startsWith(`${wordbookId}_`));
          for (const wordId in masteredWords) {
            const wordRecord = masteredWords[wordId];
            if (wordRecord?.mastered === true) {
              masteredWordIdArray.push(wordId);
            }
            const filterResult = shouldIncludeAntiForgettingWord(wordId, wordRecord, {
              studentId,
              wordbookId,
              now,
              hasScopedWordIds
            });
            if (filterResult.include) {
              reviewWordIdArray.push(wordId);
            }
          }
        }
        
        console.log('统计:');
        console.log('已掌握单词数量:', masteredWordIdArray.length);
        console.log('需要复习单词数量:', reviewWordIdArray.length);
        console.log('需要复习的单词ID:', reviewWordIdArray);
      } else {
        console.log('没有找到已掌握单词记录:', studentId, wordbookId);
      }
    } catch (err) {
      console.error('读取单词掌握记录时出错:', err);
      // 出错时使用空数组，确保继续运行
      masteredWordIdArray = [];
      reviewWordIdArray = [];
    }
    
    return { masteredWordIdArray, reviewWordIdArray };
  },

  getSavedPreviewMastery: function(studentId, wordbookId) {
    console.log('获取保存的复习掌握状态');
    try {
      // 优先读新key，兼容旧key老数据
      let savedPreviewMastery = wx.getStorageSync(`reviewMastery_${studentId}_${wordbookId}`);
      if (!savedPreviewMastery || Object.keys(savedPreviewMastery).length === 0) {
        savedPreviewMastery = wx.getStorageSync(`previewMastery_${studentId}_${wordbookId}`) || {};
        console.log('从旧key迁移复习掌握状态，条目数:', Object.keys(savedPreviewMastery).length);
      }
      return savedPreviewMastery || {};
    } catch (error) {
      console.error('获取保存的复习掌握状态失败:', error);
      return {};
    }
  },

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

  togglePhonetic: function(e) {
    console.log('切换音标显示');
    const wordId = e.currentTarget.dataset.id;
    const showPhonetic = this.data.showPhonetic;
    showPhonetic[wordId] = !showPhonetic[wordId];
    this.setData({ showPhonetic: showPhonetic });
  },

  playWordPronunciation: function(wordId) {
    try {
      // 查找单词
      if (!this.data.currentBatchWords) {
        console.warn('currentBatchWords 未定义，无法查找单词:', wordId);
        return;
      }
      
      const word = this.data.currentBatchWords.find(w => w.id === wordId);
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
          innerAudioContext.destroy();
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

  // 辅助函数：解析按钮状态
  _parseButtonStatus: function(status) {
    if (status === 'true' || status === true) return true;
    if (status === 'false' || status === false) return false;
    return status; // 保留原始状态（如'mastered'或'difficult'）
  },

  // 辅助函数：计算单词掌握统计信息
  _calculateMasteryStats: function(previewMastery, currentBatchWords, allWords) {
    let masteredCount = 0;
    let notMasteredCount = 0;
    
    // 计算总体掌握情况
    for (const wordId in previewMastery) {
      const status = previewMastery[wordId];
      if (status === true || status === 'mastered') {
        masteredCount++;
      } else if (status === false || status === 'difficult') {
        notMasteredCount++;
      }
    }
    
    // 计算当前批次掌握情况（仅在有当前批次单词时计算）
    let currentBatchMasteredCount = 0;
    if (currentBatchWords && currentBatchWords.length > 0) {
      currentBatchMasteredCount = currentBatchWords.filter(word => {
        const status = previewMastery[word.id];
        return status === true || status === 'mastered';
      }).length;
    }
    
    return {
      masteredCount,
      notMasteredCount,
      currentBatchMasteredCount
    };
  },

  // 辅助函数：显示按钮点击反馈效果
  _showButtonFeedback: function(wordId, status) {
    // 添加按钮点击的视觉反馈效果
    const feedbackData = {};
    const feedbackKey = `buttonFeedback.${wordId}`;
    feedbackData[feedbackKey] = true;
    
    this.setData(feedbackData);
    
    // 100ms后移除反馈效果
    setTimeout(() => {
      const resetData = {};
      resetData[feedbackKey] = false;
      this.setData(resetData);
    }, 100);
  },

  updatePreviewMastery: function(e) {
    try {
      // 获取并解析按钮数据
      const { id, status, wordId } = e.currentTarget.dataset;
      const actualId = wordId || id;
      
      console.log('更新单词掌握状态 - ID:', actualId, '状态:', status);
      
      // 解析目标状态
      const targetStatus = this._parseButtonStatus(status);
      const currentStatus = this.data.previewMastery[actualId];
      
      // 如果状态未改变，不执行任何操作（优化性能）
      if (currentStatus === targetStatus) {
        return;
      }
      
      // 创建新的状态对象（避免直接修改原对象）
      const newPreviewMastery = { ...this.data.previewMastery };
      newPreviewMastery[actualId] = targetStatus;
      
      // 计算统计信息（不再提前移除已掌握的单词，等待点击“完成复习”后再处理）
      const {
        masteredCount,
        notMasteredCount,
        currentBatchMasteredCount
      } = this._calculateMasteryStats(
        newPreviewMastery,
        this.data.currentBatchWords,
        this.data.allWords
      );
      
      // 更新页面数据
      this.setData({
        previewMastery: newPreviewMastery,
        currentBatchWordsCount: this.data.currentBatchWords.length,
        masteredWordsCount: masteredCount,
        notMasteredWordsCount: notMasteredCount
      });
      
      // 更新进度条数据
      this.updateProgressData(newPreviewMastery);
      
      // 添加视觉反馈效果
      this._showButtonFeedback(actualId, targetStatus);
      
      // 振动反馈
      wx.vibrateShort({ type: 'light' });
      
      // 异步保存数据到本地（避免阻塞UI）
      setTimeout(() => {
        this.savePreviewMastery();
      }, 0);
    } catch (error) {
      console.error('更新预览掌握状态失败:', error);
      // 可以添加用户友好的错误提示
      wx.showToast({
        title: '操作失败',
        icon: 'none',
        duration: 1500
      });
    }
  },

  savePreviewMastery: function() {
    console.log('保存复习掌握状态');
    try {
      const studentId = this.data.currentStudent.id;
      const wordbookId = this.data.currentWordbook.id;
      
      wx.setStorageSync(`reviewMastery_${studentId}_${wordbookId}`, this.data.previewMastery);
      console.log('复习掌握状态保存成功');
    } catch (error) {
      console.error('保存复习掌握状态失败:', error);
    }
  },

  // 更新掌握统计数据
  updateBatchMasteryStats: function() {
    console.log('更新掌握统计数据');
    const previewMastery = this.data.previewMastery;
    const allWords = this.data.allWords;
    
    let masteredCount = 0;
    let notMasteredCount = 0;
    
    // 统计掌握和未掌握的单词数
    allWords.forEach(word => {
      const status = previewMastery[word.id];
      if (status === true || status === 'mastered') {
        masteredCount++;
      } else if (status === false || status === 'difficult') {
        notMasteredCount++;
      }
    });
    
    this.setData({
      masteredWordsCount: masteredCount,
      notMasteredWordsCount: notMasteredCount
    });
  },
  
  // 更新进度条数据
  updateProgressData: function(previewMastery) {
    console.log('更新进度条数据');
    const allWords = this.data.allWords;
    const totalWords = allWords.length;
    
    let reviewedCount = 0;
    let correctCount = 0;
    
    // 统计已复习和正确的单词数
    for (const wordId in previewMastery) {
      const status = previewMastery[wordId];
      if (status === true || status === 'mastered' || status === false || status === 'difficult') {
        reviewedCount++;
        if (status === true || status === 'mastered') {
          correctCount++;
        }
      }
    }
    
    // 计算正确率和进度百分比
    const correctRate = totalWords > 0 ? Math.round((correctCount / reviewedCount) * 100) : 0;
    const progressPercentage = totalWords > 0 ? Math.round((reviewedCount / totalWords) * 100) : 0;
    
    // 更新页面数据
    this.setData({
      reviewedCount: reviewedCount,
      correctRate: correctRate,
      progressPercentage: progressPercentage
    });
  },

  prevBatch: function() {
    console.log('上一批单词');
    if (this.data.currentBatchIndex > 0) {
      const nextBatchIndex = this.data.currentBatchIndex - 1;
      const batchSize = 15;
      const startIndex = nextBatchIndex * batchSize;
      const endIndex = startIndex + batchSize;
      
      this.setData({
        currentBatchWords: this.data.allWords.slice(startIndex, endIndex),
        currentBatchIndex: nextBatchIndex,
        currentBatchWordsCount: Math.min(batchSize, this.data.allWords.length - startIndex),
        hasMoreWords: endIndex < this.data.allWords.length
      });
    }
  },

  // 下一批单词
  nextBatch: function() {
    console.log('下一批单词');
    
    try {
      if (!this.data.hasMoreWords || this.data.currentBatchIndex >= this.data.totalBatches - 1) {
        console.log('已经是最后一批单词');
        return;
      }
      
      this.setData({
        loading: true
      });
      
      const batchSize = 15;
      const nextBatchIndex = this.data.currentBatchIndex + 1;
      const startIndex = nextBatchIndex * batchSize;
      const endIndex = startIndex + batchSize;
      
      // 获取下一批单词
      const nextBatchWords = this.data.allWords.slice(startIndex, endIndex);
      
      this.setData({
        currentBatchWords: nextBatchWords,
        currentBatchIndex: nextBatchIndex,
        currentBatchWordsCount: nextBatchWords.length,
        loading: false,
        hasMoreWords: endIndex < this.data.allWords.length
      });
      
      console.log('已加载下一批单词，共', nextBatchWords.length, '个单词');
    } catch (error) {
      console.error('加载下一批单词失败:', error);
      this.setData({
        loading: false,
        hasError: true,
        errorMessage: '加载下一批单词失败，请重试'
      });
    }
  },

  // 重试加载
  retryLoad: function() {
    console.log('检查选择的学生和词书');
    if (!this.data.currentStudent || !this.data.currentWordbook) {
      // 尝试从本地存储获取默认数据
      this.loadDefaultData();
    } else {
      // 如果已经有学生和词书信息，初始化复习过程
      this.initReviewProcess();
    }
  },

  collectAntiForgettingDiagnostics: function(student, wordbook) {
    const studentId = student?.id;
    const wordbookId = wordbook?.id;
    const studentLabel = student ? `${student.name || '未命名'}(${studentId || '-'})` : '未选择';
    const wordbookLabel = wordbook ? `${wordbook.title || '未命名'}(${wordbookId || '-'})` : '未选择';

    let wordMastery = this.safeGetStorageSync('wordMastery', {});

    if (studentId && wordbookId) {
      wordMastery = this.migrateAntiForgettingSeedIfNeeded(studentId, wordbookId, wordMastery);
    }

    const migrateKey = (studentId && wordbookId) ? `antiForgettingSeedMigrated_${studentId}_${wordbookId}` : '';
    const migrationDone = migrateKey ? this.safeGetStorageSync(migrateKey, false) : false;
    const backupExists = !!this.safeGetStorageSync('wordMastery_backup_seed_migration', null);

    const hasStudentScope = !!(studentId && wordMastery[studentId]);
    const hasWordbookScope = !!(studentId && wordbookId && wordMastery[studentId] && wordMastery[studentId][wordbookId]);

    let sourceType = 'none';
    let totalWords = 0;
    let seededCount = 0;
    let legacyCandidateCount = 0;
    let completedRoundsCount = 0;

    if (hasWordbookScope) {
      const wordbookMastery = wordMastery[studentId][wordbookId];
      sourceType = Array.isArray(wordbookMastery) ? 'array' : (typeof wordbookMastery);

      if (Array.isArray(wordbookMastery)) {
        totalWords = wordbookMastery.length;
        legacyCandidateCount = wordbookMastery.length;
      } else if (wordbookMastery && typeof wordbookMastery === 'object') {
        const wordIds = Object.keys(wordbookMastery);
        totalWords = wordIds.length;

        wordIds.forEach((wordId) => {
          const record = wordbookMastery[wordId] || {};
          const reviewCount = record.reviewCount || 0;
          const hasHistory = reviewCount > 0 ||
            !!record.nextReviewTime ||
            !!record.firstMasteryTime ||
            (Array.isArray(record.reviewTimeline) && record.reviewTimeline.length > 0) ||
            record.mastered === true ||
            record.difficult === true;

          if (record.antiForgettingSeed) {
            seededCount++;
          } else if (hasHistory) {
            legacyCandidateCount++;
          }

          if (reviewCount >= 5) {
            completedRoundsCount++;
          }
        });
      }
    }

    let generatedCount = 0;
    let dueCount = 0;
    let futureCount = 0;

    if (studentId && wordbookId) {
      const generatedRecords = this.generateAntiForgettingRecords(studentId, wordbookId, wordMastery) || [];
      generatedCount = generatedRecords.length;
      generatedRecords.forEach((record) => {
        if (record && record.canReview) {
          dueCount++;
        } else {
          futureCount++;
        }
      });
    }

    return [
      `学生: ${studentLabel}`,
      `词书: ${wordbookLabel}`,
      `学生记录存在: ${hasStudentScope ? '是' : '否'}`,
      `词书记录存在: ${hasWordbookScope ? '是' : '否'}`,
      `词书数据格式: ${sourceType}`,
      `词条总数: ${totalWords}`,
      `已含种子数: ${seededCount}`,
      `可迁移旧条目: ${legacyCandidateCount}`,
      `已完成5轮: ${completedRoundsCount}`,
      `生成记录数: ${generatedCount}`,
      `可复习/未到期: ${dueCount}/${futureCount}`,
      `迁移标记: ${migrationDone ? '已执行' : '未执行'}`,
      `迁移备份: ${backupExists ? '存在' : '不存在'}`
    ];
  },

  runDiagnostics: function() {
    try {
      this.syncFromGlobalData();
      const app = getApp();
      const student = this.data.currentStudent || this.safeGetStorageSync('selectedStudent', null) || app?.globalData?.currentStudent || null;
      const wordbook = this.data.currentWordbook || this.safeGetStorageSync('selectedWordbook', null) || app?.globalData?.currentWordbook || app?.globalData?.selectedWordbook || null;
      const lines = this.collectAntiForgettingDiagnostics(student, wordbook);

      wx.showModal({
        title: '抗遗忘诊断',
        content: lines.join('\n'),
        showCancel: false,
        confirmText: '知道了'
      });
    } catch (error) {
      console.error('抗遗忘诊断失败:', error);
      wx.showToast({
        title: '诊断失败',
        icon: 'none'
      });
    }
  },

  loadDefaultData: function() {
    console.log('加载默认数据');
    try {
      const app = getApp();
      
      // 尝试从本地存储获取学生信息
      const students = wx.getStorageSync('students') || [];
      if (students.length > 0) {
        console.log('从本地存储获取默认学生信息');
        this.setData({ currentStudent: students[0] });
        app.globalData.currentStudent = students[0];
        wx.setStorageSync('selectedStudent', students[0]);
      }
      
      // 尝试从本地存储获取词书信息
      const wordbooks = wx.getStorageSync('wordbooks') || [];
      if (wordbooks.length > 0) {
        console.log('从本地存储获取默认词书信息');
        this.setData({
          currentWordbook: wordbooks[0],
          learningWordbooks: wordbooks[0].title || '未知词书'
        });
        app.globalData.currentWordbook = wordbooks[0];
        app.globalData.selectedWordbook = wordbooks[0];
        wx.setStorageSync('selectedWordbook', wordbooks[0]);
      }
      
      // 再次检查是否成功获取到学生和词书信息
      this.checkSelectedStudentAndWordbook();
      
    } catch (error) {
      console.error('获取默认数据失败:', error);
      this.setData({
        loading: false,
        hasError: true,
        errorMessage: '无法获取学生或词书信息，请先选择学生和词书'
      });
    }
  },

  // 根据抗遗忘5轮复习法计算下次复习时间（单位：毫秒）
  // reviewCount: 已完成的复习次数（0=刚学习, 1=完成第1轮, ...）
  // lastReviewTime: 上次复习/学习的时间戳
  // masteryLevel: 'full'|'partial'|'none'
  // 返回: 下次复习时间戳，或 null（已完成5轮或不需要复习）
  calculateNextReviewTime: function(reviewCount, lastReviewTime, masteryLevel = 'full') {
    // 5轮抗遗忘复习累积间隔（天）：第1轮1天，第2轮2天，第3轮4天，第4轮7天，第5轮15天
    const intervals = [1, 2, 4, 7, 15];

    // 全部5轮完成，不再需要复习
    if (reviewCount >= intervals.length) {
      return null;
    }

    // 彻底没掌握的单词不推进复习计划
    if (masteryLevel === 'none') {
      return null;
    }

    // 核心公式：相邻轮次的相对间隔 = intervals[rc] - intervals[rc-1]（intervals[-1]视为0）
    // reviewCount=0: 1-0=1天, reviewCount=1: 2-1=1天, reviewCount=2: 4-2=2天, ...
    const prevDays = reviewCount > 0 ? intervals[reviewCount - 1] : 0;
    const intervalDays = intervals[reviewCount] - prevDays;

    let nextReviewTime = lastReviewTime + intervalDays * 24 * 60 * 60 * 1000;

    // 防止计算出的时间落在过去（用户延期复习的情况）
    const now = Date.now();
    if (nextReviewTime <= now) {
      nextReviewTime = now + intervalDays * 24 * 60 * 60 * 1000;
    }

    return nextReviewTime;
  },

  updateWordMasteryStatus: function(wordIds, status, options = {}) {
    console.log('更新单词掌握状态');
    try {
      const studentId = this.data.currentStudent.id;
      const wordbookId = this.data.currentWordbook.id;
      
      // 获取当前单词掌握记录
      let wordMastery = this.safeGetStorageSync('wordMastery', {});
      
      // 确保学生和词书的掌握记录存在
      if (!wordMastery[studentId]) {
        wordMastery[studentId] = {};
      }
      
      if (!wordMastery[studentId][wordbookId]) {
        wordMastery[studentId][wordbookId] = {};
      }
      
      const wordbookMastery = wordMastery[studentId][wordbookId];
      const now = new Date().getTime();
      
      // 更新每个单词的掌握状态
      const statusByWordId = options.statusByWordId || {};
      const shouldAdvanceReview = options.advanceReviewByStatus === true;

      wordIds.forEach(wordId => {
        const nextStatus = statusByWordId[wordId] || status;
        const advanceReview = shouldAdvanceReview
          ? nextStatus === 'mastered'
          : options.advanceReview !== false;
        // 获取当前单词的掌握记录
        const currentWordRecord = wordbookMastery[wordId] || {};
        
        // 答错时立即保存未掌握状态，但不推进抗遗忘轮次；本轮最终答对时只递增一次。
        const reviewCount = (currentWordRecord.reviewCount || 0) + (advanceReview ? 1 : 0);
        
        // 创建复习记录对象
        const reviewRecord = {
          time: now,
          status: nextStatus,
          reviewCount: reviewCount
        };
        
        // 获取现有的复习时间线或创建新的
        const reviewTimeline = currentWordRecord.reviewTimeline || [];
        
        // 添加新的复习记录到时间线
        reviewTimeline.push(reviewRecord);
        
        // 计算下次复习时间
        let nextReviewTime;
        
        if (nextStatus === 'mastered') {
            // 标记为已掌握的单词，使用完全掌握的复习间隔
            nextReviewTime = this.calculateNextReviewTime(reviewCount, now, 'full');
            
            const wordRecord = {
              ...currentWordRecord,
              mastered: true,
              difficult: false, // 重置困难标记
              firstMasteryTime: currentWordRecord.firstMasteryTime || now, // 首次掌握时间
              reviewCount: reviewCount,
              lastReviewTime: now,
              updatedAt: now,
              reviewTimeline: reviewTimeline, // 保存复习时间线
              // 显式保留抗遗忘标记，防止 spread 丢失（与 learning.js 对称保护）
              antiForgettingSeed: currentWordRecord.antiForgettingSeed,
              nextReviewTime: currentWordRecord.nextReviewTime
            };
            
            // 只有当nextReviewTime不为null时才设置；为null表示5轮完成，清理种子标记
            if (nextReviewTime !== null) {
              wordRecord.nextReviewTime = nextReviewTime;
            } else {
              wordRecord.antiForgettingSeed = false;
            }
            
            wordbookMastery[wordId] = wordRecord;
          } else if (nextStatus === 'difficult') {
            // 标记为困难的单词，使用不完全掌握的复习间隔
            nextReviewTime = advanceReview
              ? this.calculateNextReviewTime(reviewCount, now, 'partial')
              : currentWordRecord.nextReviewTime;
            
            const wordRecord = {
              ...currentWordRecord,
              mastered: false, // 标记为困难的单词应该设置为未完全掌握
              difficult: true,
              firstMasteryTime: currentWordRecord.firstMasteryTime || now, // 首次掌握时间
              reviewCount: reviewCount,
              lastReviewTime: now,
              updatedAt: now,
              reviewTimeline: reviewTimeline, // 保存复习时间线
              // 显式保留抗遗忘标记，防止 spread 丢失（与 learning.js 对称保护）
              antiForgettingSeed: currentWordRecord.antiForgettingSeed,
              nextReviewTime: currentWordRecord.nextReviewTime
            };
            
            // 只有当nextReviewTime不为null时才设置；为null表示5轮完成，清理种子标记
            if (nextReviewTime !== null) {
              wordRecord.nextReviewTime = nextReviewTime;
            } else {
              wordRecord.antiForgettingSeed = false;
            }
            
            wordbookMastery[wordId] = wordRecord;
          }
      });
      
      // 保存更新后的单词掌握记录
      wx.setStorageSync('wordMastery', wordMastery);
      console.log('单词掌握状态已更新，掌握单词数量:', Object.keys(wordbookMastery).length);
      
      // 触发全局事件，通知其他页面数据已更新
      const app = getApp();
      if (app.emit) {
        app.emit('wordMasteryUpdated');
      }
      
      // 【V1.0.1 云同步】收集本次变更的单词记录，异步批量同步到云端
      const changedRecords = {};
      (wordIds || []).forEach((rawId) => {
        const wid = String(rawId);
        if (wordbookMastery[wid]) {
          changedRecords[wid] = wordbookMastery[wid];
        }
      });
      if (Object.keys(changedRecords).length > 0) {
        syncWordMasteryBatch(studentId, wordbookId, changedRecords);
      }
      
      return { success: true };
    } catch (error) {
      console.error('更新单词掌握状态失败:', error);
      return { success: false, error: error.message || 'storage_write_failed' };
    }
  },

  // 写入抗遗忘复习记录到学习记录页
  addAntiForgettingLearningRecord: function(allWords, masteredWordIds, difficultWordIds) {
    try {
      const app = getApp();
      const currentStudent = this.data.currentStudent;
      const currentWordbook = this.data.currentWordbook;

      if (!app || !app.addLearningRecord || !currentStudent || !currentWordbook) {
        return;
      }

      const reviewedWordIds = (allWords || []).map(word => word.id).filter(Boolean);
      if (reviewedWordIds.length === 0) {
        return;
      }

      app.addLearningRecord({
        studentId: currentStudent.id,
        wordbookId: currentWordbook.id,
        wordbookTitle: `${currentWordbook.title || '未知词书'}（抗遗忘复习）`,
        totalWords: reviewedWordIds.length,
        learnedWordIds: reviewedWordIds,
        studyWords: reviewedWordIds,
        studyTime: 0,
        duration: 0,
        recordType: 'anti_forgetting_review',
        isAntiForgettingReview: true,
        reviewStats: {
          masteredCount: masteredWordIds.length,
          difficultCount: difficultWordIds.length
        }
      });
    } catch (error) {
      console.error('写入抗遗忘复习学习记录失败:', error);
    }
  },

  completeReview: function() {
    console.log('完成复习');
    const previewMastery = this.data.previewMastery || {};
    const allWords = this.data.allWords || [];
    const masteredWordIds = [];
    const difficultWordIds = [];

    // 确保每个单词都已选择对勾或错叉
    const unmarkedWords = allWords.filter(word => {
      const status = previewMastery[word.id];
      return status !== true && status !== false && status !== 'mastered' && status !== 'difficult';
    });

    if (unmarkedWords.length > 0) {
      wx.showToast({
        title: '请先为所有单词选择对勾或错叉',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 收集所有标记为已掌握和需要重复复习的单词
    allWords.forEach(word => {
      const status = previewMastery[word.id];
      if (status === true || status === 'mastered') {
        masteredWordIds.push(word.id);
      } else if (status === false || status === 'difficult') {
        difficultWordIds.push(word.id);
      }
    });

    // 一次性保存本轮结果：答错词立即转为未掌握但不推进轮次，
    // 本轮最终答对时再递增 reviewCount，避免中途退出仍保留旧的“已掌握”状态。
    const reviewedWordIds = masteredWordIds.concat(difficultWordIds);
    if (reviewedWordIds.length > 0) {
      const statusByWordId = {};
      masteredWordIds.forEach(wordId => { statusByWordId[wordId] = 'mastered'; });
      difficultWordIds.forEach(wordId => { statusByWordId[wordId] = 'difficult'; });
      const writeResult = this.updateWordMasteryStatus(reviewedWordIds, null, {
        statusByWordId,
        advanceReviewByStatus: true
      });
      if (!writeResult || !writeResult.success) {
        console.error('复习掌握状态写入失败');
        wx.showToast({ title: '保存失败，请重试', icon: 'none', duration: 2000 });
        return;
      }
    }

    // 记录本次抗遗忘复习到学习记录页面
    this.addAntiForgettingLearningRecord(allWords, masteredWordIds, difficultWordIds);

    // 如果存在错叉单词，保留这些单词继续复习，其余单词从列表中移除
    if (difficultWordIds.length > 0) {
      const remainingWords = allWords.filter(word => difficultWordIds.includes(word.id));
      const remainingPreviewMastery = {};

      // 新一轮复习重新选择标记，避免误触直接完成
      remainingWords.forEach(word => {
        remainingPreviewMastery[word.id] = undefined;
      });

      this.setData({
        allWords: remainingWords,
        currentBatchWords: remainingWords,
        currentBatchIndex: 0,
        totalBatches: Math.max(1, Math.ceil(remainingWords.length / 15)),
        currentBatchWordsCount: remainingWords.length,
        previewMastery: remainingPreviewMastery,
        showMeaning: {},
        showPhonetic: {},
        clickCounts: {},
        totalWordsCount: remainingWords.length,
        reviewedCount: 0,
        correctRate: 0,
        progressPercentage: 0,
        hasMoreWords: remainingWords.length > 15,
        masteredWordsCount: 0,
        notMasteredWordsCount: 0
      });

      this.updateProgressData(remainingPreviewMastery);
      return; // 留在当前页面继续复习剩余单词
    }

    // 所有单词均已标记为对勾，返回记录列表
    wx.showToast({
      title: '复习完成',
      icon: 'success',
      duration: 1500
    });

    this.backToRecordList();
  },
  
  // 计算下次复习信息
  calculateNextReviewInfo: function() {
    try {
      const studentId = this.data.currentStudent.id;
      const wordbookId = this.data.currentWordbook.id;
      const wordMastery = this.safeGetStorageSync('wordMastery', {});
      
      if (!wordMastery[studentId] || !wordMastery[studentId][wordbookId]) {
        return null;
      }
      
      const wordbookMastery = wordMastery[studentId][wordbookId];
      const now = new Date().getTime();
      let earliestFutureReviewTime = null;
      let earliestWordId = null;
      
      // 找出所有有下次复习时间的单词
      for (const wordId in wordbookMastery) {
        const wordRecord = wordbookMastery[wordId];
        if (!wordRecord || !wordRecord.difficult) {
          continue;
        }

        const nextReviewTime = wordRecord.nextReviewTime;
        // 只考虑未来的复习时间
        if (nextReviewTime && nextReviewTime > now) {
          if (!earliestFutureReviewTime || nextReviewTime < earliestFutureReviewTime) {
            earliestFutureReviewTime = nextReviewTime;
            earliestWordId = wordId;
          }
        }
      }
      
      if (!earliestFutureReviewTime) {
        return null;
      }
      
      // 计算距离现在的天数
      const nextReviewDate = new Date(earliestFutureReviewTime);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      nextReviewDate.setHours(0, 0, 0, 0);
      
      const diffTime = nextReviewDate.getTime() - today.getTime();
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // 格式化日期
      const formattedDate = `${nextReviewDate.getFullYear()}年${String(nextReviewDate.getMonth() + 1).padStart(2, '0')}月${String(nextReviewDate.getDate()).padStart(2, '0')}日`;
      
      return {
        time: formattedDate,
        daysLeft: daysLeft,
        wordId: earliestWordId
      };
    } catch (error) {
      console.error('计算下次复习信息失败:', error);
      return null;
    }
  },

  // 查看单词
  viewWords: function(e) {
    console.log('查看单词');
    const { recordId } = e.currentTarget.dataset;
    
    // 找到对应的复习记录
    const record = this.data.reviewRecords.find(r => r.id === recordId);
    if (!record) {
      console.error('未找到复习记录:', recordId);
      return;
    }

    // 跳转到单词查看页面，传递单词ID列表
    wx.navigateTo({
      url: `/subpages/word-view/word-view?words=${JSON.stringify(record.words)}`
    });
  },

  // 开始复习
  startReview: function(e) {
    console.log('开始抗遗忘复习');
    const { recordId } = e.currentTarget.dataset;
    
    // 根据当前视图模式找到对应的复习记录
    let record;
    if (this.data.currentViewMode === 'merged') {
      // 合并视图模式
      record = this.data.mergedViewRecords.find(r => r.id === recordId);
    } else {
      // 普通视图模式
      record = this.data.reviewRecords.find(r => r.id === recordId);
    }
    
    if (!record) {
      console.error('未找到复习记录:', recordId);
      return;
    }

    if (record.canReview === false || record.reviewable === false) {
      wx.showToast({
        title: '未到复习时间',
        icon: 'none',
        duration: 1500
      });
      return;
    }
    
    console.log('找到复习记录:', record);
    console.log('复习记录中的单词ID列表:', record.words);
    console.log('复习记录中的单词数量:', record.words.length);

    // 使用新的页面实例承载复习流程，返回时自然回到抗遗忘列表页
    wx.navigateTo({
      url: `/pages/review/review?mode=review&words=${encodeURIComponent(JSON.stringify(record.words || []))}`
    });
  },

  // 加载复习单词
  loadReviewWords: function(wordIds) {
    console.log('加载复习单词:', wordIds);
    
    const words = [];
    const studentId = this.data.currentStudent?.id;
    const wordbookId = this.data.currentWordbook?.id;
    
    console.log('当前学生ID:', studentId);
    console.log('当前词书ID:', wordbookId);
    
    // 获取单词掌握记录
    const wordMastery = this.safeGetStorageSync('wordMastery', {});
    const wordbookMastery = studentId && wordbookId ? wordMastery[studentId]?.[wordbookId] : {};
    const hasScopedWordIds = wordbookMastery && typeof wordbookMastery === 'object' && !Array.isArray(wordbookMastery)
      ? Object.keys(wordbookMastery).some((wordId) => String(wordId).startsWith(`${wordbookId}_`))
      : false;
    
    console.log('单词掌握记录:', wordMastery);
    
    // 加载本地词书数据作为备用
    let localWords = [];
    try {
      const wordbookCategory = this.data.currentWordbook?.category || 'primary';
      const wordbookId = this.data.currentWordbook?.id || '';
      console.log('词书类别:', wordbookCategory);
      console.log('词书ID:', wordbookId);
      
      // 根据词书ID加载对应的词书文件
      if (wordbookCategory === 'primary') {
        localWords = require('../../data/primary_real_words.js');
      } else if (wordbookCategory === 'junior') {
        // 根据具体的词书ID加载对应的年级词书
        if (wordbookId.includes('7th') && wordbookId.includes('second')) {
          localWords = require('../../data/new_standard_7th_grade_second_complete.js');
        } else if (wordbookId.includes('7th')) {
          localWords = require('../../data/new_standard_7th_grade_words.js');
        } else if (wordbookId.includes('8th') && wordbookId.includes('second')) {
          localWords = require('../../data/new_standard_8th_grade_second_complete.js');
        } else if (wordbookId.includes('8th')) {
          localWords = require('../../data/new_standard_8th_grade_words.js');
        } else if (wordbookId.includes('9th') && wordbookId.includes('second')) {
          localWords = require('../../data/new_standard_9th_grade_second_complete.js');
        } else if (wordbookId.includes('9th')) {
          localWords = require('../../data/new_standard_9th_grade_words.js');
        } else if (wordbookId.includes('ren_jiao')) {
          // 人教版词书
          if (wordbookId.includes('9th')) {
            localWords = require('../../data/ren_jiao_9th_grade.js');
          } else if (wordbookId.includes('8th') && wordbookId.includes('second')) {
            localWords = require('../../data/ren_jiao_8th_grade_second.js');
          } else if (wordbookId.includes('8th')) {
            localWords = require('../../data/ren_jiao_8th_grade_first.js');
          } else if (wordbookId.includes('7th') && wordbookId.includes('second')) {
            localWords = require('../../data/ren_jiao_7th_grade_second.js');
          } else if (wordbookId.includes('7th')) {
            localWords = require('../../data/ren_jiao_7th_grade_first.js');
          }
        } else if (wordbookId.includes('yi_lin')) {
          // 译林版词书
          if (wordbookId.includes('9th') && wordbookId.includes('second')) {
            localWords = require('../../data/yi_lin_9th_grade_second.js');
          } else if (wordbookId.includes('9th')) {
            localWords = require('../../data/yi_lin_9th_grade_first.js');
          } else if (wordbookId.includes('8th') && wordbookId.includes('second')) {
            localWords = require('../../data/yi_lin_8th_grade_second.js');
          } else if (wordbookId.includes('8th')) {
            localWords = require('../../data/yi_lin_8th_grade_first.js');
          } else if (wordbookId.includes('7th') && wordbookId.includes('second')) {
            localWords = require('../../data/yi_lin_7th_grade_second.js');
          } else {
            localWords = require('../../data/yi_lin_7th_grade_first.js');
          }
        } else if (wordbookId.includes('ji')) {
          // 冀教版词书
          if (wordbookId.includes('7th') && wordbookId.includes('second')) {
            localWords = require('../../data/ji_7th_grade_second.js');
          } else if (wordbookId.includes('7th')) {
            localWords = require('../../data/ji_7th_grade_words.js');
          } else if (wordbookId.includes('8th') && wordbookId.includes('second')) {
            localWords = require('../../data/ji_8th_grade_second.js');
          } else if (wordbookId.includes('8th')) {
            localWords = require('../../data/ji_8th_grade_first.js');
          } else if (wordbookId.includes('9th')) {
            localWords = require('../../data/ji_9th_grade_words.js');
          }
        } else {
          // 默认使用七年级下册完整版
          localWords = require('../../data/new_standard_7th_grade_second_complete.js');
        }
      } else if (wordbookCategory === 'senior') {
        localWords = require('../../data/senior_real_words.js');
      }
      
      console.log('加载的本地词书数据数量:', localWords.length);
    } catch (error) {
      console.error('加载本地词书数据失败:', error);
    }
    
    // 确保wordIds是数组
    if (!Array.isArray(wordIds)) {
      console.error('wordIds不是数组:', wordIds);
      // 处理页面数据，即使没有单词也要切换到复习模式
      this.setData({
        learningMode: 'review',
        allWords: [],
        currentBatchWords: [],
        currentBatchIndex: 0,
        totalBatches: 1,
        currentBatchWordsCount: 0,
        previewMastery: {},
        showMeaning: {},
        showPhonetic: {},
        clickCounts: {},
        loading: false,
        // 初始化进度条数据
        totalWordsCount: 0,
        reviewedCount: 0,
        correctRate: 0,
        progressPercentage: 0
      });
      return;
    }
    
    // 处理每个单词ID
    wordIds.forEach(wordId => {
      console.log('处理单词ID:', wordId);

      const wordRecord = wordbookMastery && wordbookMastery[wordId];
      const filterResult = shouldIncludeAntiForgettingWord(wordId, wordRecord, {
        studentId,
        wordbookId,
        now: Date.now(),
        hasScopedWordIds
      });
      if (!filterResult.include) {
        console.warn('[Review] 复习会话跳过越界或未到期单词:', wordId, filterResult.reason);
        return;
      }
      
      // 从wordId中提取单词 - 改进的逻辑
      let word = wordId;
      
      // 尝试从wordId中提取单词
      try {
        // 情况1: wordId格式为 "wordbookId_word_real_..."
        if (wordbookId && wordId.includes(`${wordbookId}_`)) {
          word = wordId.replace(`${wordbookId}_`, '').replace('_real_', '');
        } 
        // 情况2: wordId格式为 "word_real_..."
        else if (wordId.includes('_real_')) {
          word = wordId.replace('_real_', '');
        } 
        // 情况3: wordId格式为 "wordbookId_word"
        else if (wordId.includes('_') && !wordId.includes('_real_')) {
          // 假设格式为 "wordbookId_word"，提取单词部分
          const parts = wordId.split('_');
          if (parts.length > 1) {
            // 移除第一个部分（假设是wordbookId），保留其余部分作为单词
            // 这样可以正确处理包含下划线的单词
            parts.shift();
            word = parts.join('_');
          }
        }
        // 情况4: wordId是数字，尝试从本地词书数据中查找对应的单词
        else if (!isNaN(wordId) && !isNaN(parseFloat(wordId))) {
          // 尝试从合并后的词书数据中查找对应的单词
          console.log('wordId是数字，尝试从词书数据中查找:', wordId);
          const wordIndex = parseInt(wordId) - 1; // 假设数字是词书数据中的索引
          if (mergedWords && mergedWords.length > wordIndex) {
            const foundWord = mergedWords[wordIndex];
            if (foundWord && foundWord.word) {
              word = foundWord.word;
              console.log('从词书数据中找到单词:', wordId, '→', word);
            }
          }
        }
        // 情况5: 直接使用wordId作为单词
        
        // 重复词条的稳定后缀只用于身份隔离，展示和查词时仍使用原单词。
        word = stripStableWordOccurrenceSuffix(word);

        // 替换下划线为空格
        word = word.replace(/_/g, ' ');
        
        // 去除多余的空白字符
        word = word.trim();

        // 统一纠偏，避免 miss 在复习页被显示成 ms
        word = this.canonicalizeReviewWord(word, wordId);
        
        console.log('从wordId中提取的单词:', wordId, '→', word);
      } catch (error) {
        console.error('提取单词失败:', error);
      }
      
      // 过滤非英语单词的内容
      const nonWordList = ['objectspread', 'undefined', 'null', 'NaN', '{}', '[]'];
      if (nonWordList.includes(word.toLowerCase())) {
        console.log('排除非单词:', word);
        return;
      }
      
      // 确保word不为空
      if (!word || word.trim() === '') {
        console.log('单词为空，跳过:', wordId);
        return;
      }
      
      // 从合并后的词书数据中查找完整的单词信息
      let meaning = '未知';
      let phonetic = '';
      let matchedWord = null;
      
      // 1. 使用合并后的词书数据和单词映射表查找
      if (wordMap) {
        // 先尝试精确匹配
              const normalizedWord = word.toLowerCase();
              const exactMatch = wordMap[normalizedWord] || wordMap[normalizedWord.replace(/\./g, '')];
        if (exactMatch) {
          matchedWord = exactMatch;
          console.log('使用单词映射表精确匹配结果:', word, '→', matchedWord);
        } else {
          // 短词禁用模糊匹配，避免 ms / i / a 误命中无关词条
          if (normalizedWord.length >= 3) {
            const fallbackMatch = findWord(word, wordMap);
            if (fallbackMatch) {
              matchedWord = fallbackMatch;
              console.log('使用单词映射表兜底匹配结果:', word, '→', matchedWord);
            }
          }
        }
      }
      
      // 2. 如果还是没找到，尝试从本地词书数据中查找
      if (!matchedWord && localWords.length > 0) {
        matchedWord = localWords.find(w => w.word === word);
        if (!matchedWord) {
          matchedWord = localWords.find(w => w.word && w.word.toLowerCase() === word.toLowerCase());
        }
        if (matchedWord) {
          console.log('使用本地词书数据匹配结果:', word, '→', matchedWord);
        }
      }
      
      // 3. 如果还是没找到，尝试在线词典查询
      if (!matchedWord) {
        console.log('本地词书数据中未找到，尝试在线词典查询:', word);
        const onlineDefinition = this.fetchWordDefinition(word);
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
      
      // 4. 处理地名词组的大小写
      if (matchedWord && matchedWord.word) {
        // 检查是否是地名词组或国家名称
        const placeWords = ['south africa', 'north america', 'south america', 'united states', 'united kingdom', 'new york', 'los angeles', 'australia', 'china', 'america', 'japan', 'france', 'germany', 'canada'];
        if (placeWords.includes(matchedWord.word.toLowerCase())) {
          // 地名词组或国家名称首字母大写
          const capitalizedWord = matchedWord.word.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          matchedWord.word = capitalizedWord;
          console.log('地名词组或国家名称首字母大写:', matchedWord.word);
        }
      } else if (word) {
        // 检查是否是地名词组或国家名称
        const placeWords = ['south africa', 'north america', 'south america', 'united states', 'united kingdom', 'new york', 'los angeles', 'australia', 'china', 'america', 'japan', 'france', 'germany', 'canada'];
        if (placeWords.includes(word.toLowerCase())) {
          // 地名词组或国家名称首字母大写
          word = word.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          console.log('地名词组或国家名称首字母大写:', word);
        }
      }
      
      // 5. 确保即使从本地词书数据中找到单词，也要检查是否是国家名称并使用正确的释义
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
          },
          // 常见单词
          'had': {
            word: 'had',
            phonetic: '/hæd/',
            meaning: '有；吃；喝；进行（have的过去式和过去分词）'
          },
          'five': {
            word: 'five',
            phonetic: '/faɪv/',
            meaning: '五'
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
      const wordObject = {
        id: wordId,
        word: matchedWord ? matchedWord.word : word, // 使用词书数据中的单词大小写，与预习界面保持一致
        meaning: meaning,
        phonetic: phonetic,
        translation: meaning // 确保translation属性也存在
      };
      
      console.log('创建的单词对象:', wordObject);
      
      words.push(wordObject);
    });
    
    console.log('加载的复习单词数量:', words.length);
    console.log('加载的复习单词详细信息:', words);
    
    // 即使没有单词，也要确保切换到复习模式
    this.setData({
      learningMode: 'review',
      allWords: words,
      currentBatchWords: words,
      currentBatchIndex: 0,
      totalBatches: 1,
      currentBatchWordsCount: words.length,
      previewMastery: {},
      showMeaning: {},
      showPhonetic: {},
      clickCounts: {},
      loading: false,
      // 初始化进度条数据
      totalWordsCount: words.length,
      reviewedCount: 0,
      correctRate: 0,
      progressPercentage: 0
    });
  },

  // 刷新记录
  refreshRecords: function() {
    console.log('刷新抗遗忘复习记录');
    
    // 显示加载动画
    wx.showLoading({
      title: '刷新中...',
      mask: true
    });
    
    // 延迟执行，模拟网络请求
    setTimeout(() => {
      // 重新初始化抗遗忘复习模式
      this.initReviewProcess();
      
      // 隐藏加载动画并显示成功提示
      wx.hideLoading();
      wx.showToast({
        title: '记录已刷新',
        icon: 'success',
        duration: 1500
      });
    }, 1000);
  },

  // 按日期合并重叠记录
  mergeRecordsByDate: function(records) {
    console.log('按日期合并抗遗忘复习记录');
    
    // 按日期分组
    const groupedByDate = {};
    
    records.forEach(record => {
      const dateKey = record.date;
      
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = {
          id: `merged_${dateKey}`,
          date: dateKey,
          time: record.time,
          wordCount: 0,
          words: [],
          canReview: false,
          wordbookName: record.wordbookName,
          learningDates: new Set(),
          reviewTypes: new Set(),
          recordCount: 0,
          _wordKeyMap: {}
        };
      }
      
      // 合并单词（按归一化ID去重）
      (record.words || []).forEach(wordId => {
        const normalizedId = this.normalizeReviewWordId(wordId);
        if (!normalizedId || groupedByDate[dateKey]._wordKeyMap[normalizedId]) {
          return;
        }
        groupedByDate[dateKey]._wordKeyMap[normalizedId] = true;
        groupedByDate[dateKey].words.push(wordId);
      });
      groupedByDate[dateKey].wordCount = groupedByDate[dateKey].words.length;
      
      // 只要有一个记录可以复习，整个分组就可以复习
      if (record.canReview) {
        groupedByDate[dateKey].canReview = true;
      }
      
      // 添加学习日期
      if (record.learningDate) {
        groupedByDate[dateKey].learningDates.add(record.learningDate);
      }
      if (record.reviewTypeLabel) {
        groupedByDate[dateKey].reviewTypes.add(record.reviewTypeLabel);
      }
      
      // 增加记录计数
      groupedByDate[dateKey].recordCount++;
    });
    
    // 转换为数组并处理数据
    const mergedByDate = Object.values(groupedByDate).map(record => {
      // 将学习日期集合转换为排序后的数组
      const sortedLearningDates = Array.from(record.learningDates).sort();
      const reviewTypeLabels = Array.from(record.reviewTypes);
      const cleanedRecord = { ...record };
      delete cleanedRecord._wordKeyMap;
      delete cleanedRecord.reviewTypes;
      
      return {
        ...cleanedRecord,
        learningDate: sortedLearningDates.join(', '), // 合并学习日期
        learningDates: sortedLearningDates, // 保留排序后的学习日期数组
        reviewTypeLabel: reviewTypeLabels.join(' / ')
      };
    });
    
    // 按时间排序
    mergedByDate.sort((a, b) => a.time - b.time);
    
    return mergedByDate;
  },

  toggleMergeView: function() {
    console.log('切换到合并视图页面');
    
    // 导航到合并视图页面
    wx.redirectTo({
      url: '/subpages/review-merged/review-merged'
    });
  },

  // 返回记录列表
  backToRecordList: function() {
    console.log('返回记录列表');

    if (this.data.isReviewSessionPage) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    
    // 重置页面数据，切换回记录列表模式
    this.setData({
      learningMode: null,
      allWords: [],
      currentBatchWords: [],
      currentBatchIndex: 0,
      totalBatches: 0,
      currentBatchWordsCount: 0,
      previewMastery: {},
      showMeaning: {},
      showPhonetic: {},
      clickCounts: {},
      loading: false,
      fromMerged: false
    });
    
    // 重新加载复习记录
    this.initReviewProcess();
  },

  // 从本地规则获取单词释义（同步）
  fetchWordDefinition: function(word) {
    try {
      // 检查单词是否有效
      if (!word || word.trim() === '') {
        console.warn('无效的单词，无法获取在线释义');
        return null;
      }
      
      // 过滤掉可能导致API错误的特殊单词
      const specialWords = ['Hubli-Dharwad', 'undefined', 'null', 'NaN', '{}', '[]'];
      if (specialWords.includes(word.trim())) {
        console.warn('特殊单词，不获取在线释义:', word);
        return null;
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
          },
          // 常见单词
          'had': {
            word: 'had',
            phonetic: '/hæd/',
            meaning: '有；吃；喝；进行（have的过去式和过去分词）'
          },
          'five': {
            word: 'five',
            phonetic: '/faɪv/',
            meaning: '五'
          }
        };
        
      // 检查是否在默认定义中
      const lowerWord = word.toLowerCase();
      if (defaultDefinitions[lowerWord]) {
        console.log('使用默认释义:', word, '→', defaultDefinitions[lowerWord]);
        return defaultDefinitions[lowerWord];
      }
      
      // 检查是否是复合地名（如 South Africa）
      const placeWords = ['south africa', 'north america', 'south america', 'united states', 'united kingdom'];
      if (placeWords.includes(lowerWord)) {
        const capitalizedWord = lowerWord.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const definition = {
          word: capitalizedWord,
          phonetic: '/fəˈnetɪk/',
          meaning: '地名'
        };
        console.log('使用复合地名默认释义:', word, '→', definition);
        return definition;
      }

      // 由于微信小程序域名限制，暂时不使用在线API
      // 直接返回一个基于单词的默认定义
      console.log('使用本地默认定义:', word);
      return {
        word: word.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        phonetic: '/fəˈnetɪk/',
        meaning: '单词释义'
      };
    } catch (error) {
      console.error('获取单词释义失败:', error);
      // 异常时返回本地默认定义
      return {
        word: word.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        phonetic: '/fəˈnetɪk/',
        meaning: '单词释义'
      };
    }
  }
});





