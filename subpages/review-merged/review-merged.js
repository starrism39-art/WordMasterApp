// pages/review-merged/review-merged.js
const { generateWordsForBook } = require('../../data/wordbook-loader.js');
const { mergeWordbooks, createWordMap, findWord } = require('../../data/wordbook-utils.js');
const { shouldIncludeAntiForgettingWord } = require('../../utils/anti-forgetting-filter.js');
const { resolveCurrentStudent, resolveCurrentWordbook } = require('../../utils/learning-context.js');

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
    pageTitle: '21天抗遗忘复习',
    loading: false,
    hasError: false,
    errorMessage: '',
    currentStudent: null,
    currentWordbook: null,
    reviewRecords: [],
    mergedViewRecords: [],
    totalReviewCount: 0,
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
    progressPercentage: 0
  },

  onLoad: function(options) {
    console.log('合并视图页面加载，参数:', options);
    // 重新加载合并词书数据，确保使用最新的单词映射表
    reloadWordMap();
    this.syncFromGlobalData();

    const app = getApp();
    this._onWordMasteryUpdated = () => {
      if (this.data.learningMode === 'review') {
        return;
      }
      this.initMergedViewProcess();
    };
    if (app && app.on) {
      app.on('wordMasteryUpdated', this._onWordMasteryUpdated);
    }
  },

  onShow: function() {
    console.log('合并视图页面显示');
    // 重新加载合并词书数据，确保使用最新的单词映射表
    reloadWordMap();
    this.syncFromGlobalData();
    this.checkSelectedStudentAndWordbook();
  },

  onUnload: function() {
    const app = getApp();
    if (app && app.off && this._onWordMasteryUpdated) {
      app.off('wordMasteryUpdated', this._onWordMasteryUpdated);
    }
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
        '[ReviewMerged] 检测到旧数组掌握数据，保持只读兼容，不推断复习状态:',
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
      console.log('学生和词书已选择，初始化合并视图过程');
      this.initMergedViewProcess();
    } else {
      console.log('缺少学生或词书信息');
      this.setData({
        hasError: true,
        errorMessage: '请先选择学生和词书',
        loading: false
      });
    }
  },

  initMergedViewProcess: function() {
    console.log('初始化合并视图过程');
    this.setData({
      loading: true,
      hasError: false
    });

    // 显示加载动画
    wx.showLoading({
      title: '准备合并视图数据...',
    });

    try {
      this.initializeMergedViewMode();
    } catch (error) {
      console.error('初始化合并视图过程失败:', error);
      this.setData({
        loading: false,
        hasError: true,
        errorMessage: '初始化合并视图失败，请重试'
      });
    } finally {
      // 确保无论成功还是失败都隐藏加载动画
      wx.hideLoading();
    }
  },

  initializeMergedViewMode: function() {
    console.log('初始化合并视图模式');
    
    // 确保有学生和词书信息
    if (!this.data.currentStudent?.id || !this.data.currentWordbook?.id) {
      console.error('初始化合并视图失败：缺少学生或词书信息');
      throw new Error('缺少学生或词书信息');
    }
    
    const studentId = this.data.currentStudent.id;
    const wordbookId = this.data.currentWordbook.id;
    console.log('当前学生ID:', studentId, '当前词书ID:', wordbookId);
    
    // 获取单词掌握记录
    let wordMastery = this.safeGetStorageSync('wordMastery', {});
    wordMastery = this.migrateAntiForgettingSeedIfNeeded(studentId, wordbookId, wordMastery);
    console.log('单词掌握记录:', wordMastery);
    console.log('当前学生的单词掌握记录:', wordMastery[studentId]);
    console.log('当前词书的单词掌握记录:', wordMastery[studentId]?.[wordbookId]);
    
    // 生成抗遗忘复习记录
    const reviewRecords = this.generateAntiForgettingRecords(studentId, wordbookId, wordMastery);
    
    console.log('生成的抗遗忘复习记录数量:', reviewRecords.length);
    console.log('生成的抗遗忘复习记录:', reviewRecords);
    
    // 检查是否有复习记录
    if (reviewRecords.length === 0) {
      console.log('没有抗遗忘复习记录，显示空状态');
      this.setData({
        reviewRecords: [],
        mergedViewRecords: [],
        totalReviewCount: 0,
        loading: false,
        hasError: true,
        errorMessage: '当前没有抗遗忘复习记录，建议学习新单词'
      });
      return;
    }
    
    // 按日期合并记录
    const mergedByDate = this.mergeRecordsByDate(reviewRecords);
    console.log('按日期合并后的记录:', mergedByDate);
    
    // 更新页面数据
    this.setData({
      reviewRecords: reviewRecords,
      mergedViewRecords: mergedByDate,
      totalReviewCount: reviewRecords.length,
      loading: false
    });
    
    console.log('合并视图模式初始化完成');
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

      const filterResult = shouldIncludeAntiForgettingWord(wordId, wordRecord, {
        studentId,
        wordbookId,
        now,
        hasScopedWordIds
      });
      if (!filterResult.include) {
        if (filterResult.reason === 'invalid_record' || filterResult.reason === 'missing_wordId') {
          console.warn('[generateAntiForgettingRecords] 跳过无效单词记录, wordId:', wordId);
        }
        continue;
      }

      records.push({
        id: `${wordId}_round_${filterResult.round}`,
        date: this.formatLocalDate(filterResult.scheduledTime),
        time: filterResult.scheduledTime,
        round: filterResult.round,
        wordCount: 1,
        canReview: true,
        words: [wordId],
        wordbookName,
        learningDate: filterResult.firstStudyTime
          ? this.formatLocalDate(filterResult.firstStudyTime)
          : '旧数据',
        reviewType: filterResult.reviewType,
        reviewTypeLabel: filterResult.reviewTypeLabel
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

    // 【防御性编程】过滤掉空/残缺记录，防止单条脏数据导致整页崩溃
    if (!Array.isArray(records)) {
      console.warn('[mergeReviewRecords] records 不是数组，返回空');
      return [];
    }

    // 按日期、轮数和复习类型分组，避免未掌握复习与巩固复习混在同一卡片。
    const groupedRecords = {};

    records.forEach(record => {
      // 跳过无效记录
      if (!record || typeof record !== 'object') {
        console.warn('[mergeReviewRecords] 跳过无效记录:', record);
        return;
      }
      if (!record.date || !record.round) {
        console.warn('[mergeReviewRecords] 跳过缺少 date/round 的记录:', record.id);
        return;
      }

      const key = `${record.date}_round_${record.round}_${record.reviewType || 'unknown'}`;
      
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

  // 按日期合并重叠记录
  mergeRecordsByDate: function(records) {
    console.log('按日期合并抗遗忘复习记录');

    // 【防御性编程】过滤掉空/残缺记录
    if (!Array.isArray(records)) {
      console.warn('[mergeRecordsByDate] records 不是数组，返回空');
      return [];
    }

    // 按日期分组
    const groupedByDate = {};

    records.forEach(record => {
      // 跳过无效记录
      if (!record || typeof record !== 'object') {
        console.warn('[mergeRecordsByDate] 跳过无效记录:', record);
        return;
      }
      if (!record.date) {
        console.warn('[mergeRecordsByDate] 跳过缺少 date 的记录:', record.id);
        return;
      }

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
      
      // 上游筛选器只会生成当天已到期记录，直接沿用其明确状态，避免 YYYY-MM-DD 的时区解析差异。
      const reviewable = record.canReview === true;
      
      return {
        ...cleanedRecord,
        learningDate: sortedLearningDates.join(', '), // 合并学习日期
        learningDates: sortedLearningDates, // 保留排序后的学习日期数组
        reviewable: reviewable, // 是否可复习
        reviewTypeLabel: reviewTypeLabels.join(' / ')
      };
    });
    
    // 按时间排序
    mergedByDate.sort((a, b) => a.time - b.time);
    
    return mergedByDate;
  },

  // 开始复习
  startReview: function(e) {
    console.log('开始抗遗忘复习');
    try {
      // 获取recordId
      const recordId = e.currentTarget.dataset.recordId;
      console.log('记录ID:', recordId);
      console.log('完整的dataset:', e.currentTarget.dataset);
      
      // 检查mergedViewRecords是否有数据
      console.log('mergedViewRecords长度:', this.data.mergedViewRecords.length);
      console.log('mergedViewRecords内容:', this.data.mergedViewRecords);
      
      // 找到对应的合并记录
      const record = this.data.mergedViewRecords.find(r => r.id === recordId);
      if (!record) {
        console.error('未找到合并复习记录:', recordId);
        wx.showToast({
          title: '未找到复习记录',
          icon: 'none'
        });
        return;
      }
      
      console.log('找到合并复习记录:', record);
      console.log('复习记录中的单词ID列表:', record.words);
      console.log('复习记录中的单词数量:', record.words ? record.words.length : 0);
      
      // 确保record.words是数组
      if (!Array.isArray(record.words)) {
        console.error('复习记录中的words不是数组:', record.words);
        wx.showToast({
          title: '复习记录数据错误',
          icon: 'none'
        });
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

      console.log('复习记录的canReview状态:', record.canReview);

      const mergedWords = Array.isArray(record.words) ? record.words.slice() : [];
      const app = getApp();
      if (app && app.globalData) {
        app.globalData.tempViewWords = mergedWords;
      }

      // 跳转到复习页面：由 review.js 根据 from=merged 从内存取词并强制开练
      wx.navigateTo({
        url: `/pages/review/review?mode=review&from=merged&source=merged`,
        success: function(res) {
          console.log('跳转到合并复习页面成功');
        },
        fail: function(error) {
          console.error('跳转到合并复习页面失败:', error);
          wx.showToast({
            title: '跳转到复习页面失败',
            icon: 'none'
          });
        }
      });
    } catch (error) {
      console.error('开始复习时出错:', error);
      wx.showToast({
        title: '开始复习失败',
        icon: 'none'
      });
    }
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
      const wordbookCategory = wx.getStorageSync('selectedWordbook')?.category || 'primary';
      console.log('词书类别:', wordbookCategory);
      
      if (wordbookCategory === 'primary') {
        localWords = require('../../primary_real_words.js');
      } else if (wordbookCategory === 'junior') {
        localWords = require('../../junior_real_words.js');
      } else if (wordbookCategory === 'senior') {
        localWords = require('../../senior_real_words.js');
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
        console.warn('[ReviewMerged] 复习会话跳过越界或未到期单词:', wordId, filterResult.reason);
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
          // 短词禁用模糊匹配，避免 ms 误命中无关词条
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
      
      // 4. 处理短语的大小写：含空格且全小写的短语自动首字母大写
      if (matchedWord && matchedWord.word) {
        const displayWord = matchedWord.word;
        if (displayWord.includes(' ') && !/[A-Z]/.test(displayWord)) {
          matchedWord.word = displayWord.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }
      } else if (word && word.includes(' ') && !/[A-Z]/.test(word)) {
        word = word.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
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
      currentBatchWords: words, // 显示所有合并单词，不分页
      currentBatchIndex: 0,
      totalBatches: 1, // 只有一个批次
      currentBatchWordsCount: words.length, // 所有单词的数量
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

  // 从在线词典获取单词释义
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
      const defaultDefinition = {
        word: word.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        phonetic: '/fəˈnetɪk/',
        meaning: '单词释义'
      };
      return defaultDefinition;
      
    } catch (error) {
      console.error('获取单词释义失败:', error);
      // 异常时返回本地默认定义
      const defaultDefinition = {
        word: word.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        phonetic: '/fəˈnetɪk/',
        meaning: '单词释义'
      };
      return defaultDefinition;
    }
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
      // 重新初始化合并视图模式
      this.initMergedViewProcess();
      
      // 隐藏加载动画并显示成功提示
      wx.hideLoading();
      wx.showToast({
        title: '记录已刷新',
        icon: 'success',
        duration: 1500
      });
    }, 1000);
  },

  retryLoad: function() {
    this.initMergedViewProcess();
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

  // 返回抗遗忘复习页面
  backToReview: function() {
    console.log('返回抗遗忘复习页面');
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.redirectTo({
      url: '/pages/review/review'
    });
  },

  // 切换到普通抗遗忘复习页面
  goToNormalReview: function() {
    console.log('切换到普通抗遗忘复习页面');
    wx.redirectTo({
      url: '/pages/review/review'
    });
  },

  // 返回记录列表
  backToRecordList: function() {
    console.log('返回记录列表');
    this.setData({
      learningMode: null
    });

    // 返回后立即刷新记录，确保已完成的记录及时消失
    this.initMergedViewProcess();
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

  // 标记单词为已掌握
  markWordAsMastered: function(e) {
    console.log('标记单词为已掌握');
    const { id } = e.currentTarget.dataset;
    const studentId = wx.getStorageSync('selectedStudent')?.id;
    const wordbookId = wx.getStorageSync('selectedWordbook')?.id;
    
    if (!studentId || !wordbookId) {
      console.error('缺少学生或词书信息');
      return;
    }
    
    // 获取单词掌握记录
    let wordMastery = this.safeGetStorageSync('wordMastery', {});
    if (!wordMastery[studentId]) {
      wordMastery[studentId] = {};
    }
    if (!wordMastery[studentId][wordbookId]) {
      wordMastery[studentId][wordbookId] = {};
    }
    
    // 更新单词掌握状态
    const wordRecord = wordMastery[studentId][wordbookId][id] || {};
    const now = new Date().getTime();
    const newReviewCount = (wordRecord.reviewCount || 0) + 1;
    
    // 更新复习时间线
    const reviewTimeline = wordRecord.reviewTimeline || [];
    reviewTimeline.push({ time: now, status: 'mastered', reviewCount: newReviewCount });
    
    wordMastery[studentId][wordbookId][id] = {
      ...wordRecord,
      mastered: true,
      difficult: false,
      firstMasteryTime: wordRecord.firstMasteryTime || now,
      reviewCount: newReviewCount,
      lastReviewTime: now,
      reviewTimeline: reviewTimeline,
      antiForgettingSeed: wordRecord.antiForgettingSeed,
      nextReviewTime: this.calculateNextReviewTime(newReviewCount, now)
    };
    
    // 保存到本地存储
    wx.setStorageSync('wordMastery', wordMastery);
    console.log('标记单词为已掌握:', id);
    
    // 【V1.0.1 云同步】同步单词掌握状态到云端
    if (wordMastery[studentId] && wordMastery[studentId][wordbookId] && wordMastery[studentId][wordbookId][id]) {
      const changed = {};
      changed[id] = wordMastery[studentId][wordbookId][id];
      syncWordMasteryBatch(studentId, wordbookId, changed);
    }
    
    // 更新复习统计
    this.updateReviewStats();
  },

  // 标记单词为困难
  markWordAsDifficult: function(e) {
    console.log('标记单词为困难');
    const { id } = e.currentTarget.dataset;
    const studentId = wx.getStorageSync('selectedStudent')?.id;
    const wordbookId = wx.getStorageSync('selectedWordbook')?.id;
    
    if (!studentId || !wordbookId) {
      console.error('缺少学生或词书信息');
      return;
    }
    
    // 获取单词掌握记录
    let wordMastery = this.safeGetStorageSync('wordMastery', {});
    if (!wordMastery[studentId]) {
      wordMastery[studentId] = {};
    }
    if (!wordMastery[studentId][wordbookId]) {
      wordMastery[studentId][wordbookId] = {};
    }
    
    // 更新单词掌握状态
    const wordRecord = wordMastery[studentId][wordbookId][id] || {};
    const now = new Date().getTime();
    const newReviewCount = (wordRecord.reviewCount || 0) + 1;
    
    // 更新复习时间线
    const reviewTimeline = wordRecord.reviewTimeline || [];
    reviewTimeline.push({ time: now, status: 'difficult', reviewCount: newReviewCount });
    
    wordMastery[studentId][wordbookId][id] = {
      ...wordRecord,
      mastered: false,
      difficult: true,
      firstMasteryTime: wordRecord.firstMasteryTime || now,
      reviewCount: newReviewCount,
      lastReviewTime: now,
      reviewTimeline: reviewTimeline,
      antiForgettingSeed: wordRecord.antiForgettingSeed,
      nextReviewTime: this.calculateNextReviewTime(newReviewCount, now)
    };
    
    // 保存到本地存储
    wx.setStorageSync('wordMastery', wordMastery);
    console.log('标记单词为困难:', id);
    
    // 【V1.0.1 云同步】同步单词掌握状态到云端
    if (wordMastery[studentId] && wordMastery[studentId][wordbookId] && wordMastery[studentId][wordbookId][id]) {
      const changed = {};
      changed[id] = wordMastery[studentId][wordbookId][id];
      syncWordMasteryBatch(studentId, wordbookId, changed);
    }
    
    // 更新复习统计
    this.updateReviewStats();
  },

  // 根据抗遗忘5轮复习法计算下次复习时间（单位：毫秒）
  // reviewCount: 已完成的复习次数（0=刚学习, 1=完成第1轮, ...）
  // lastReviewTime: 可选，上次复习/学习的时间戳，默认当前时间
  // masteryLevel: 'full'|'partial'|'none'，默认 'full'
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
    const prevDays = reviewCount > 0 ? intervals[reviewCount - 1] : 0;
    const intervalDays = intervals[reviewCount] - prevDays;

    // 默认使用当前时间作为基准
    const baseTime = lastReviewTime || Date.now();
    let nextReviewTime = baseTime + intervalDays * 24 * 60 * 60 * 1000;

    // 防止计算出的时间落在过去
    const now = Date.now();
    if (nextReviewTime <= now) {
      nextReviewTime = now + intervalDays * 24 * 60 * 60 * 1000;
    }

    return nextReviewTime;
  },

  // 更新复习统计
  updateReviewStats: function() {
    console.log('更新复习统计');
    const studentId = wx.getStorageSync('selectedStudent')?.id;
    const wordbookId = wx.getStorageSync('selectedWordbook')?.id;
    
    if (!studentId || !wordbookId) {
      console.error('缺少学生或词书信息');
      return;
    }
    
    // 获取单词掌握记录
    const wordMastery = this.safeGetStorageSync('wordMastery', {});
    const wordbookMastery = wordMastery[studentId]?.[wordbookId] || {};
    
    // 统计已复习单词数和正确率
    let reviewedCount = 0;
    let correctCount = 0;
    
    for (const wordId in wordbookMastery) {
      const wordRecord = wordbookMastery[wordId];
      if (wordRecord.reviewCount > 0) {
        reviewedCount++;
        if (wordRecord.mastered) {
          correctCount++;
        }
      }
    }
    
    const totalWordsCount = this.data.totalWordsCount || 0;
    const correctRate = totalWordsCount > 0 ? Math.round((correctCount / totalWordsCount) * 100) : 0;
    const progressPercentage = totalWordsCount > 0 ? Math.round((reviewedCount / totalWordsCount) * 100) : 0;
    
    console.log('复习统计:', {
      reviewedCount,
      correctCount,
      totalWordsCount,
      correctRate,
      progressPercentage
    });
    
    // 更新页面数据
    this.setData({
      reviewedCount,
      correctRate,
      progressPercentage
    });
  },

  // 播放单词发音
  playWordPronunciation: function(wordId) {
    console.log('播放单词发音:', wordId);
    // 这里可以添加播放单词发音的逻辑
  },

  // 处理复习单词
  processReviewWords: function(wordIds) {
    console.log('处理复习单词:', wordIds);
    
    const words = [];
    const studentId = wx.getStorageSync('selectedStudent')?.id;
    const wordbookId = wx.getStorageSync('selectedWordbook')?.id;
    
    console.log('当前学生ID:', studentId);
    console.log('当前词书ID:', wordbookId);
    
    // 获取单词掌握记录
    const wordMastery = this.safeGetStorageSync('wordMastery', {});
    const wordbookMastery = studentId && wordbookId ? wordMastery[studentId]?.[wordbookId] : {};
    
    console.log('单词掌握记录:', wordMastery);
    
    // 加载本地词书数据作为备用
    let localWords = [];
    try {
      const wordbookCategory = wx.getStorageSync('selectedWordbook')?.category || 'primary';
      console.log('词书类别:', wordbookCategory);
      
      if (wordbookCategory === 'primary') {
        localWords = require('../../primary_real_words.js');
      } else if (wordbookCategory === 'junior') {
        localWords = require('../../junior_real_words.js');
      } else if (wordbookCategory === 'senior') {
        localWords = require('../../senior_real_words.js');
      }
      
      console.log('加载的本地词书数据数量:', localWords.length);
    } catch (error) {
      console.error('加载本地词书数据失败:', error);
    }
    
    // 确保wordIds是数组
    if (!Array.isArray(wordIds)) {
      console.error('wordIds不是数组:', wordIds);
      return [];
    }
    
    // 处理每个单词ID
    wordIds.forEach(wordId => {
      console.log('处理单词ID:', wordId);
      
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
          // 短词禁用模糊匹配，避免 ms 误命中无关词条
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
      
      // 4. 处理短语的大小写：含空格且全小写的短语自动首字母大写
      if (matchedWord && matchedWord.word) {
        const displayWord = matchedWord.word;
        if (displayWord.includes(' ') && !/[A-Z]/.test(displayWord)) {
          matchedWord.word = displayWord.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }
      } else if (word && word.includes(' ') && !/[A-Z]/.test(word)) {
        word = word.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
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
    
    console.log('处理的复习单词数量:', words.length);
    return words;
  },

  // 页面卸载时清理资源
  onUnload: function() {
    console.log('Merged review page unloaded');
  }
});
