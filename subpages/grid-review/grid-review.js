// pages/grid-review/grid-review.js
const { generateWordsForBook } = require('../../data/wordbook-loader.js');
const { syncWordMasteryBatch } = require('../../utils/cloud-sync.js');
const { loadReviewWordbookWords } = require('../../utils/review-word-resolver.js');

Page({
  data: {
    pageTitle: '九宫格复习',
    loading: false,
    hasError: false,
    errorMessage: '',
    currentStudent: null,
    currentWordbook: null,
    currentBatchWords: [],
    currentBatchIndex: 0,
    totalBatches: 0,
    currentBatchWordsCount: 0,
    showMeaning: {},
    clickCounts: {},
    showPhonetic: {},
    previewMastery: {},
    allWords: [],
    hasMoreWords: true,
    gridSize: 9, // 九宫格大小
    selectedWord: null, // 当前选中的单词
    matchedWords: [] // 已匹配的单词对
  },
  
  // 检查单词是否已匹配
  isMatched(wordId) {
    return this.data.matchedWords.includes(wordId);
  },

  onLoad: function(options) {
    console.log('九宫格复习页面加载，参数:', options);
    this.syncFromGlobalData();
  },

  onShow: function() {
    console.log('九宫格复习页面显示');
    this.syncFromGlobalData();
    this.checkSelectedStudentAndWordbook();
  },

  syncFromGlobalData: function() {
    console.log('从全局数据同步');
    try {
      const app = getApp();
      
      // 从全局数据获取学生和词书信息
      const currentStudent = app.globalData.currentStudent || null;
      const currentWordbook = app.globalData.currentWordbook || null;
      
      console.log('同步数据 - 学生:', currentStudent ? currentStudent.name : '无', '词书:', currentWordbook ? currentWordbook.title : '无');
      
      this.setData({
        currentStudent: currentStudent,
        currentWordbook: currentWordbook,
        learningWordbooks: currentWordbook ? currentWordbook.title : ''
      });
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

  initReviewProcess: async function() {
    console.log('初始化九宫格复习过程');
    this.setData({
      loading: true,
      hasError: false
    });

    // 显示加载动画
    wx.showLoading({
      title: '准备复习材料...',
    });

    try {
      await this.initializeGridReviewMode();
    } catch (error) {
      console.error('初始化九宫格复习过程失败:', error);
      this.setData({
        loading: false,
        hasError: true,
        errorMessage: '初始化复习失败，请重试'
      });
      wx.hideLoading();
    }
  },

  initializeGridReviewMode: async function() {
    console.log('初始化九宫格复习模式');
    
    try {
      // 确保有学生和词书信息
      if (!this.data.currentStudent || !this.data.currentWordbook) {
        throw new Error('缺少学生或词书信息');
      }
      
      const studentId = this.data.currentStudent.id;
      const wordbookId = this.data.currentWordbook.id;
      
      // 获取当前词书的类别
      const wordbookCategory = this.data.currentWordbook.category || 'primary';
      
      // 使用真实词书数据
      const batchSize = 15;
      const isTeacherCustom = this.data.currentWordbook.sourceType === 'teacher_custom';
      const teacherLoadResult = isTeacherCustom
        ? await loadReviewWordbookWords(this.data.currentWordbook)
        : null;
      if (isTeacherCustom && (!teacherLoadResult || teacherLoadResult.loadError)) {
        throw new Error(teacherLoadResult && teacherLoadResult.loadError
          ? teacherLoadResult.loadError
          : 'teacher_wordbook_unavailable');
      }
      const firstBatch = isTeacherCustom
        ? teacherLoadResult.words
        : generateWordsForBook(wordbookCategory, wordbookId, 0, batchSize);
      const totalCount = isTeacherCustom
        ? firstBatch.length
        : (firstBatch._totalCount || 100);
      let totalBatches = Math.ceil(totalCount / batchSize);
      
      // 获取更多单词来填充allWords数组
      let allWords = [];
      const maxWordsToLoad = totalCount; // 使用词书总单词数
      
      for (let i = 0; i < maxWordsToLoad; i += batchSize) {
        const batch = isTeacherCustom
          ? firstBatch.slice(i, i + batchSize)
          : generateWordsForBook(wordbookCategory, wordbookId, i, batchSize);
        allWords.push(...batch);
      }
      
      console.log('初始加载单词数量:', allWords.length);
      
      // 获取已掌握单词和需要复习的单词
      const { masteredWordIdArray, reviewWordIdArray } = this.getReviewWords(studentId, wordbookId);
      
      // 筛选出需要复习的单词
      const filteredWords = allWords.filter(word => {
        const needsReview = reviewWordIdArray.some(id => String(id) === String(word.id));
        if (needsReview) {
          console.log('添加到九宫格复习列表的单词:', word.id, word.word);
        }
        return needsReview;
      });
      
      console.log('筛选后需要复习的单词数:', filteredWords.length);
      
      // 检查是否有需要复习的单词
      if (filteredWords.length === 0) {
        this.setData({
          hasError: true,
          errorMessage: '没有需要复习的单词',
          loading: false
        });
        wx.hideLoading();
        wx.showToast({
          title: '没有需要复习的单词',
          icon: 'success',
          duration: 2000
        });
        return;
      }
      
      // 更新allWords为筛选后的结果
      allWords = filteredWords;
      
      // 根据最终的单词数量重新计算totalBatches
      totalBatches = Math.ceil(allWords.length / batchSize);
      console.log('最终单词数量:', allWords.length, '批次数量:', totalBatches);
      
      // 获取保存的预习掌握状态
      const savedPreviewMastery = this.getSavedPreviewMastery(studentId, wordbookId);
      
      // 为九宫格准备单词（需要偶数个单词以形成配对）
      const gridWords = this.prepareGridWords(allWords.slice(0, batchSize));
      
      this.setData({
        allWords: allWords,
        currentBatchWords: gridWords,
        currentBatchIndex: 0,
        totalBatches: totalBatches,
        currentBatchWordsCount: gridWords.length,
        previewMastery: savedPreviewMastery || {},
        hasMoreWords: totalBatches > 1,
        selectedWord: null,
        matchedWords: [],
        loading: false
      });
      
      console.log('九宫格复习模式初始化完成');
      
    } catch (error) {
      console.error('初始化九宫格复习模式失败:', error);
      this.setData({
        loading: false,
        hasError: true,
        errorMessage: '初始化九宫格复习模式失败，请重试'
      });
    } finally {
      wx.hideLoading();
    }
  },

  prepareGridWords: function(words) {
    console.log('准备九宫格单词');
    
    // 确保单词数量是偶数，用于配对
    let gridWords = [];
    
    // 复制单词数组，以便每个单词有一个词形和一个意思
    words.forEach(word => {
      gridWords.push({
        ...word,
        type: 'word',
        display: word.word
      });
      
      gridWords.push({
        ...word,
        type: 'meaning',
        display: word.meaning
      });
    });
    
    // 随机打乱单词顺序
    this.shuffleArray(gridWords);
    
    // 只保留前gridSize个单词
    return gridWords.slice(0, this.data.gridSize);
  },

  shuffleArray: function(array) {
    console.log('打乱数组顺序');
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  },

  getReviewWords: function(studentId, wordbookId) {
    console.log('获取需要复习的单词');
    let masteredWordIdArray = [];
    let reviewWordIdArray = [];
    
    try {
      // 尝试获取单词掌握记录
      const wordMastery = wx.getStorageSync('wordMastery') || {};
      
      // 安全地检查和获取已掌握单词
      if (wordMastery[studentId] && wordMastery[studentId][wordbookId]) {
        console.log('使用单词掌握记录过滤已学习单词');
        
        const masteredWords = wordMastery[studentId][wordbookId];
        
        if (Array.isArray(masteredWords)) {
          // 兼容旧的数组格式
          masteredWordIdArray = masteredWords;
        } else {
          // 新的对象格式
          const now = new Date().getTime();
          for (const wordId in masteredWords) {
            if (!masteredWords[wordId] || typeof masteredWords[wordId] !== 'object') continue;
            const wordRecord = masteredWords[wordId];

            // ★ P0修复：只将标记为困难的单词纳入复习（与review.js对齐）
            if (!wordRecord.difficult) continue;

            if (wordRecord.mastered) {
              masteredWordIdArray.push(wordId);
            }

            // ★ P0修复：与review.js一致的四规则复习判定
            const nextReviewTime = wordRecord.nextReviewTime;
            const reviewCount = wordRecord.reviewCount || 0;
            let isDueForReview = false;
            if (typeof nextReviewTime !== 'number') {
              isDueForReview = true;
            } else if (nextReviewTime <= now) {
              isDueForReview = true;
            } else if (reviewCount === 0) {
              isDueForReview = true;
            }

            const isMasteredStatus = wordRecord.mastered === true;
            if (isDueForReview && !isMasteredStatus) {
              reviewWordIdArray.push(wordId);
            }
          }
        }
        
        console.log('已掌握单词数量:', masteredWordIdArray.length);
        console.log('需要复习单词数量:', reviewWordIdArray.length);
      } else {
        console.log('没有找到已掌握单词记录');
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
    console.log('获取保存的预习掌握状态');
    try {
      // 优先读新key，兼容旧key老数据
      let savedPreviewMastery = wx.getStorageSync(`gridMastery_${studentId}_${wordbookId}`);
      if (!savedPreviewMastery || Object.keys(savedPreviewMastery).length === 0) {
        savedPreviewMastery = wx.getStorageSync(`previewMastery_${studentId}_${wordbookId}`) || {};
      }
      return savedPreviewMastery;
    } catch (error) {
      console.error('获取保存的预习掌握状态失败:', error);
      return {};
    }
  },

  toggleWordMeaning: function(e) {
    console.log('切换单词意思显示');
    const wordId = e.currentTarget.dataset.id;
    // 初始化数据
    const showMeaning = {}; // 重置为新对象，自动收起所有其他单词的释义
    const showPhonetic = this.data.showPhonetic || {};
    // 初始化点击计数器
    const clickCounts = this.data.clickCounts || {};
    clickCounts[wordId] = (clickCounts[wordId] || 0) + 1;
    
    // 奇数次点击是发音，偶数次点击是发音+显示中文
    if (clickCounts[wordId] % 2 === 1) {
      // 奇数次点击 - 只播放读音
      this.playWordPronunciation(wordId);
      
      // 隐藏音标和释义
      showPhonetic[wordId] = false;
      showMeaning[wordId] = false;
      
      // 实时更新UI
      this.setData({
        showPhonetic: showPhonetic,
        showMeaning: showMeaning,
        clickCounts: clickCounts
      });
    } else {
      // 偶数次点击 - 播放读音并显示中文释义
      this.playWordPronunciation(wordId);
      
      // 显示当前单词的释义，其他单词的释义自动隐藏
      showMeaning[wordId] = true;
      
      // 隐藏音标
      showPhonetic[wordId] = false;
      
      // 实时更新UI
      this.setData({
        showMeaning: showMeaning,
        showPhonetic: showPhonetic,
        clickCounts: clickCounts
      });
      
      console.log(`单词释义显示切换: 单词ID=${wordId}, 显示状态=${showMeaning[wordId]}, 音标已隐藏`);
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
    console.log('播放单词发音');
    // 检查是否是事件对象
    if (typeof wordId === 'object' && wordId.currentTarget) {
      wordId = wordId.currentTarget.dataset.id;
    }
    const word = this.data.currentBatchWords.find(w => w.id === wordId);
    
    if (word) {
      // 这里可以实现单词发音功能
      console.log('播放发音:', word.word);
      // 实际项目中应该调用语音API
    }
  },

  updatePreviewMastery: function(e) {
    console.log('更新预习掌握状态');
    const wordId = e.currentTarget.dataset.id;
    const status = e.currentTarget.dataset.status;
    
    console.log('更新单词掌握状态 - ID:', wordId, '状态:', status);
    
    const previewMastery = this.data.previewMastery;
    previewMastery[wordId] = status;
    
    this.setData({
      previewMastery: previewMastery
    });
    
    // 保存预习掌握状态到本地存储
    this.savePreviewMastery();
  },

  savePreviewMastery: function() {
    console.log('保存九宫格掌握状态');
    try {
      const studentId = this.data.currentStudent.id;
      const wordbookId = this.data.currentWordbook.id;
      
      wx.setStorageSync(`gridMastery_${studentId}_${wordbookId}`, this.data.previewMastery);
      console.log('九宫格掌握状态保存成功');
    } catch (error) {
      console.error('保存九宫格掌握状态失败:', error);
    }
  },

  // 点击九宫格中的单词
  onGridWordTap: function(e) {
    console.log('点击九宫格单词');
    const index = e.currentTarget.dataset.index;
    const word = this.data.currentBatchWords[index];
    
    // 如果单词已匹配，忽略点击
    if (this.data.matchedWords.includes(word.id)) {
      return;
    }
    
    // 如果已经选中了一个单词，检查是否匹配
    if (this.data.selectedWord) {
      const selectedWord = this.data.selectedWord;
      
      // 检查是否匹配（不同类型且相同id）
      if (selectedWord.type !== word.type && selectedWord.id === word.id) {
        console.log('单词匹配成功:', selectedWord.display, '->', word.display);
        
        // 添加到已匹配列表
        const matchedWords = this.data.matchedWords;
        matchedWords.push(selectedWord.id);
        
        this.setData({
          selectedWord: null,
          matchedWords: matchedWords
        });
        
        // 检查是否所有单词都已匹配
        if (matchedWords.length === this.data.currentBatchWords.length / 2) {
          console.log('所有单词匹配完成');
          wx.showToast({
            title: '恭喜！所有单词匹配完成',
            icon: 'success',
            duration: 2000
          });
          
          // 更新单词掌握状态
          this.updateWordMasteryStatus(matchedWords);
        }
      } else {
        console.log('单词匹配失败');
        
        // 显示错误提示
        wx.showToast({
          title: '匹配错误',
          icon: 'none',
          duration: 1000
        });
        
        // 重置选择
        this.setData({
          selectedWord: word
        });
      }
    } else {
      // 选择第一个单词
      console.log('选择第一个单词:', word.display);
      this.setData({
        selectedWord: word
      });
    }
  },

  prevBatch: function() {
    console.log('上一批单词');
    if (this.data.currentBatchIndex > 0) {
      const nextBatchIndex = this.data.currentBatchIndex - 1;
      const batchSize = 15;
      const startIndex = nextBatchIndex * batchSize;
      const endIndex = startIndex + batchSize;
      
      // 为九宫格准备下一批单词
      const gridWords = this.prepareGridWords(this.data.allWords.slice(startIndex, endIndex));
      
      this.setData({
        currentBatchWords: gridWords,
        currentBatchIndex: nextBatchIndex,
        currentBatchWordsCount: gridWords.length,
        hasMoreWords: endIndex < this.data.allWords.length,
        selectedWord: null,
        matchedWords: []
      });
    }
  },

  nextBatch: function() {
    console.log('下一批单词');
    const nextBatchIndex = this.data.currentBatchIndex + 1;
    const batchSize = 15;
    const startIndex = nextBatchIndex * batchSize;
    const endIndex = startIndex + batchSize;
    
    if (startIndex < this.data.allWords.length) {
      // 为九宫格准备下一批单词
      const gridWords = this.prepareGridWords(this.data.allWords.slice(startIndex, endIndex));
      
      this.setData({
        currentBatchWords: gridWords,
        currentBatchIndex: nextBatchIndex,
        currentBatchWordsCount: gridWords.length,
        hasMoreWords: endIndex < this.data.allWords.length,
        selectedWord: null,
        matchedWords: []
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

  retryLoad: function() {
    console.log('重试加载');
    this.setData({
      hasError: false,
      errorMessage: ''
    });
    this.initReviewProcess();
  },

  // 根据21天复习法计算下次复习时间（单位：毫秒）
  calculateNextReviewTime: function(reviewCount, lastReviewTime) {
    // 用户指定的抗遗忘复习间隔（单位：天）
    // 复习间隔：1天、2天、3天、5天、7天、9天、12天、14天、17天、21天
    const fixedIntervals = [1, 2, 3, 5, 7, 9, 12, 14, 17, 21];

    // 根据复习次数选择对应的间隔，超过最大间隔后使用最大间隔
    const index = Math.min(reviewCount - 1, fixedIntervals.length - 1);
    const intervalDays = fixedIntervals[index];

    // 转换为毫秒并计算下次复习时间（1天 = 24小时 * 60分钟 * 60秒 * 1000毫秒）
    return lastReviewTime + intervalDays * 24 * 60 * 60 * 1000;
  },

  updateWordMasteryStatus: function(wordIds) {
    console.log('更新单词掌握状态');
    try {
      const studentId = this.data.currentStudent.id;
      const wordbookId = this.data.currentWordbook.id;
      
      // 获取当前单词掌握记录
      const wordMastery = wx.getStorageSync('wordMastery') || {};
      
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
      wordIds.forEach(wordId => {
        if (wordbookMastery[wordId] && wordbookMastery[wordId].mastered) {
          // 已存在的掌握记录，增加复习次数
          const reviewCount = (wordbookMastery[wordId].reviewCount || 1) + 1;
          wordbookMastery[wordId] = {
            ...wordbookMastery[wordId],
            reviewCount: reviewCount,
            lastReviewTime: now,
            nextReviewTime: this.calculateNextReviewTime(reviewCount, now)
          };
        } else {
          // 新的掌握记录
          wordbookMastery[wordId] = {
            mastered: true,
            reviewCount: 1,
            firstMasteryTime: now,
            lastReviewTime: now,
            nextReviewTime: this.calculateNextReviewTime(1, now)
          };
        }
      });
      
      // 保存更新后的单词掌握记录
      wx.setStorageSync('wordMastery', wordMastery);
      console.log('单词掌握状态已更新，掌握单词数量:', Object.keys(wordbookMastery).length);
      
      // 触发全局事件，通知其他页面数据已更新
      const app = getApp();
      if (app && app.emit) {
        app.emit('wordMasteryUpdated');
      }
      
      // 【V1.0.1 云同步】收集变更记录，异步批量同步到云端
      const changedRecords = {};
      wordIds.forEach((rawId) => {
        const wid = String(rawId);
        if (wordbookMastery[wid]) {
          changedRecords[wid] = wordbookMastery[wid];
        }
      });
      if (Object.keys(changedRecords).length > 0) {
        syncWordMasteryBatch(studentId, wordbookId, changedRecords);
        console.log('[cloud-sync] 九宫格复习 wordMastery 已提交云同步, 数量:', Object.keys(changedRecords).length);
      }
      
      return { success: true };
    } catch (error) {
      console.error('更新单词掌握状态失败:', error);
      return { success: false, error: error.message || 'storage_write_failed' };
    }
  },

  checkSelectedStudentAndWordbook: function() {
    console.log('检查选择的学生和词书');
    if (!this.data.currentStudent || !this.data.currentWordbook) {
      // 尝试从本地存储获取默认数据
      this.loadDefaultData();
    } else {
      // 如果已经有学生和词书信息，初始化复习过程
      this.initReviewProcess();
    }
  },

  // 刷新当前批次
  refreshBatch: function() {
    console.log('刷新当前批次');
    const batchSize = 15;
    const startIndex = this.data.currentBatchIndex * batchSize;
    const endIndex = startIndex + batchSize;
    
    // 重新准备九宫格单词
    const gridWords = this.prepareGridWords(this.data.allWords.slice(startIndex, endIndex));
    
    this.setData({
      currentBatchWords: gridWords,
      selectedWord: null,
      matchedWords: []
    });
  }
});
