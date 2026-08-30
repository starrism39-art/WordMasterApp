// 学习记录页面 - 全面优化版
const { mergeWordbooks, createWordMap, findWord, lookUpPhrase } = require('../../data/wordbook-utils.js');
const { refreshStudentStats } = require('../../utils/stats-engine.js');
const { createWordbookOptions, getWordbookTone, prepareRecordForDisplay } = require('../../utils/record-display.js');
const { isCloudReadOnlyMode } = require('../../utils/cloud-mode.js');
const {
  createLearningContextKey,
  resolveCurrentStudent,
  resolveCurrentWordbook
} = require('../../utils/learning-context.js');
const { extractDisplayWordFromReviewId } = require('../../utils/review-word-resolver.js');
const {
  buildMergedRecordExportChoice,
  buildOriginalRecordChoices,
  EXPORT_FORMATS,
  EXPORT_SCOPES
} = require('../../utils/local-record-export.js');
const { generateAndOpenRecordExport } = require('./export/export-service.js');

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
    currentStudent: null,
    currentWordbook: null,
    studyRecords: [], // 全部记录
    filteredRecords: [], // 过滤后的记录
    displayedRecords: [], // 当前显示的记录（分页）
    wordbooks: {},
    timeFilter: 'all', // all, week, month, year
    recordTypeFilter: 'all', // all: 全部, word: 学习记录, anti: 复习记录
    wordbookFilter: 'all',
    wordbookOptions: [],
    visibleLearningCount: 0,
    visibleReviewCount: 0,
    isLoadingMore: false,
    currentPage: 0,
    hasMoreData: true,
    isLoading: false,
    // 新增统计数据
    totalRecords: 0,
    currentDisplayCount: 0,
    movedX: {}, // 用于存储每个记录项的滑动位置
    // 新增性能优化参数
    pageSize: 10, // 每页显示记录数
    enablePullRefresh: true, // 是否启用下拉刷新
    lastRefreshTime: 0, // 上次刷新时间，用于防抖
    exportDialogVisible: false,
    exportDialogStep: '',
    exportRecordChoices: [],
    exportMergedChoice: null,
    exportRecordKind: '',
    selectedExportRecordId: '',
    selectedExportRecordIds: [],
    selectedExportScope: EXPORT_SCOPES.ALL,
    isExporting: false
  },
  
  // 记录当前打开的滑动项ID
  _openedItemId: null,
  
  // 缓存管理
  _cache: {
    processedRecords: null,
    filteredRecords: null,
    lastUpdateTime: 0
  },
  _loadDataTimer: null,
  _onShowLogTimer: null,
  _isRecordsPageActive: false,

  
  onLoad: function() {
    this._isRecordsPageActive = true;
    this._loadDataTimer = null;
    this._onShowLogTimer = null;
    
    // 快速设置学生信息
    this.setData({ isLoading: true });
    
    // 初始化缓存
    this._initCache();
    
    // 确保有学生信息
    this.ensureStudentInfo();
    this.syncCurrentContext();
  },
  
  // 页面显示时同步学生信息并刷新数据
  onShow: function() {
    this._isRecordsPageActive = true;

    // 重新加载合并词书数据
    reloadWordMap();
    
    // 确保学生信息与首页保持同步
    this.ensureStudentInfo();
    this.syncCurrentContext();
    
    // 强制重新加载数据，确保显示最新的排序结果
    console.log('页面显示，强制重新加载学习记录');
    this.loadData(true);
    
    // 立即检查displayedRecords
    const that = this;
    if (this._onShowLogTimer) clearTimeout(this._onShowLogTimer);
    this._onShowLogTimer = setTimeout(() => {
      this._onShowLogTimer = null;
      if (!this._isRecordsPageActive) return;
      console.log('onShow - 当前displayedRecords:', that.data.displayedRecords);
      console.log('onShow - 当前filteredRecords:', that.data.filteredRecords);
    }, 500);
  },

  syncCurrentContext: function() {
    const app = getApp();
    const currentStudent = resolveCurrentStudent(app);
    const currentWordbook = resolveCurrentWordbook(app, currentStudent);
    const nextContextKey = createLearningContextKey(currentStudent, currentWordbook);
    const contextChanged = this._contextKey !== nextContextKey;
    const patch = {
      currentStudent: currentStudent || null,
      currentWordbook: currentWordbook || null
    };

    if (contextChanged) {
      patch.wordbookFilter = currentWordbook ? String(currentWordbook.id) : 'all';
      this._contextKey = nextContextKey;
      this._cache.filteredRecords = null;
    }

    this.setData(patch);
  },
  
  // 确保有学生信息
  ensureStudentInfo: function() {
    const app = getApp();
    const currentUser = wx.getStorageSync('currentUser') || (app.globalData || {}).currentUser || null;
    const currentUserId = currentUser && (currentUser.id || currentUser.username);
    
    // 检查是否有学生信息
    if (!app.globalData.currentStudent) {
      console.log('记录页面：从本地存储获取学生信息');
      
      // 尝试从本地存储获取学生信息
      const students = wx.getStorageSync('students') || [];
      const myStudents = currentUserId
        ? students.filter(s => s && (s.ownerId || s.ownerUsername) === currentUserId)
        : [];

      if (myStudents.length > 0) {
        app.globalData.currentStudent = myStudents[0];
        console.log('记录页面：使用当前账号学生信息:', myStudents[0]);
      } else {
        app.globalData.currentStudent = null;
        console.log('记录页面：当前账号暂无学生信息');
      }
      
      // 更新页面数据
      this.setData({
        currentStudent: app.globalData.currentStudent
      });
    } else {
      console.log('记录页面：使用首页的学生信息:', app.globalData.currentStudent);
      
      // 确保页面数据与全局数据同步
      this.setData({
        currentStudent: app.globalData.currentStudent
      });
    }
  },
  
  // 初始化缓存
  _initCache: function() {
    this._cache = {
      processedRecords: null,
      filteredRecords: null,
      lastUpdateTime: 0
    };
  },
  
  // 优化的数据加载函数 - 全面性能优化
  loadData: function(forceRefresh = false) {
    // 立即设置加载状态，确保UI正确显示
    this.setData({ isLoading: true });
    
    console.log('loadData开始执行，forceRefresh:', forceRefresh);
    
    const that = this; // 保存this引用

    if (this._loadDataTimer) {
      clearTimeout(this._loadDataTimer);
      this._loadDataTimer = null;
    }
    
    // 使用setTimeout确保UI响应流畅
    const loadDataTimer = setTimeout(() => {
      if (that._loadDataTimer === loadDataTimer) {
        that._loadDataTimer = null;
      }
      if (!that._isRecordsPageActive) return;

      const { currentStudent } = that.data;
      const app = getApp();
      
      console.log('loadData - 获取app实例:', !!app);
      console.log('loadData - 当前学生:', currentStudent);
      
      try {
        if (!currentStudent || currentStudent.id === undefined || currentStudent.id === null) {
          that._cache.processedRecords = [];
          that.setData({
            studyRecords: [],
            filteredRecords: [],
            displayedRecords: [],
            wordbookOptions: [],
            totalRecords: 0,
            isLoading: false
          });
          return;
        }

        // 获取记录：保留所有学习记录，不因单词ID可解析性或快照缺失做记录级过滤
        let allRecords = [];
        // 只获取当前学生的学习记录，确保数据隔离
        allRecords = app.getLearningRecords(currentStudent.id) || [];
        
        console.log('原始学习记录数量:', allRecords.length);
        console.log('原始学习记录详细信息:', allRecords);
        
        // 高效去重算法 - 使用Map替代Set+Array组合
        const recordMap = new Map();
        // 这里仅跳过非对象脏数据，绝不依据单词ID可解析性过滤记录。
        const recordsToProcess = Array.isArray(allRecords) ? allRecords : [];
        const nonObjectRecordCount = recordsToProcess.filter(record => !record || typeof record !== 'object').length;

        console.log('学习记录保留策略：不按单词ID过滤，记录总数:', recordsToProcess.length, '非对象脏数据数:', nonObjectRecordCount);

        let legacyRecordIndex = 0;
        for (const record of recordsToProcess) {
          if (!record || typeof record !== 'object') {
            continue;
          }

          // 导出身份只能来自原始稳定 ID；无 ID 的旧脏记录仅保留确定性的页面展示 ID，禁止伪装成可导出 recordId。
          const originalRecordId = String(record.id || record.recordId || record._id || '').trim();
          const legacyToken = String(record.timestamp || record.studyDate || record.learningDate || 'unknown')
            .replace(/[^a-zA-Z0-9_-]/g, '_');
          const recordId = originalRecordId || `legacy_unstable_${record.studentId || 'unknown'}_${legacyToken}_${legacyRecordIndex}`;
          legacyRecordIndex += 1;
          
          if (!recordMap.has(recordId)) {
            // 保留 Stage2A/B 历史快照与版本字段；页面展示字段只在副本上补充，不修改原记录。
            recordMap.set(recordId, {
              ...record,
              id: recordId,
              originalRecordId,
              hasStableRecordId: !!originalRecordId,
              studentId: record.studentId,
              wordbookId: record.wordbookId,
              wordbookTitle: record.wordbookTitle || record.wordbookName || '未知词书',
              recordType: record.recordType || 'learning',
              isAntiForgettingReview: !!record.isAntiForgettingReview,
              totalWords: that.getRecordWordCount(record),
              duration: record.duration || 0,
              timestamp: record.timestamp || (record.studyDate ? that.getTimestampFromDate(record.studyDate) : Date.now()),
              studyDate: record.studyDate,
              formattedDate: that.formatDate(record.studyDate || record.timestamp || Date.now()),
              // 添加单词信息字段，确保查看单词功能正常
              learnedWordIds: record.learnedWordIds,
              studyWords: record.studyWords,
              studyWordsDetailed: record.studyWordsDetailed,
              learnedWordTexts: record.learnedWordTexts,
              masteredWordIds: record.masteredWordIds,
              notMasteredWordIds: record.notMasteredWordIds,
              masteredWordTexts: record.masteredWordTexts,
              notMasteredWordTexts: record.notMasteredWordTexts,
              masteredWords: record.masteredWords,
              masteredCount: that.getMasteredCountFromRecord(record),
              notMasteredCount: that.getNotMasteredCountFromRecord(record)
            });
          }
        }
        
        // 转换为数组并排序
        const uniqueRecords = Array.from(recordMap.values());
        
        console.log('去重后学习记录数量:', uniqueRecords.length);
        console.log('学习记录详细信息:', uniqueRecords);
        
        // 按天合并记录
        const mergedByDayRecords = this.mergeRecordsByDay(uniqueRecords).map(prepareRecordForDisplay);
        
        console.log('按天合并后学习记录数量:', mergedByDayRecords.length);
        console.log('合并后学习记录详细信息:', mergedByDayRecords);
        
        // 优化排序性能
        mergedByDayRecords.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        
        console.log('排序后学习记录:', mergedByDayRecords);
        
        // 缓存处理后的记录，避免重复计算
        this._cache.processedRecords = mergedByDayRecords;
        this._cache.lastUpdateTime = Date.now();

        const wordbookOptions = createWordbookOptions(mergedByDayRecords);
        const currentWordbook = this.data.currentWordbook;
        if (currentWordbook && !wordbookOptions.some(option => option.id === String(currentWordbook.id))) {
          const title = currentWordbook.title || currentWordbook.name || '未命名词书';
          wordbookOptions.splice(1, 0, {
            id: String(currentWordbook.id),
            title,
            shortTitle: title.replace(/英语词书$/, '').replace(/英语阅读高频词汇$/, '阅读高频词汇'),
            tone: getWordbookTone(currentWordbook.id, title),
            recordCount: 0
          });
        }
        const activeWordbookExists = wordbookOptions.some(option => option.id === this.data.wordbookFilter);
        const wordbookFilter = activeWordbookExists ? this.data.wordbookFilter : 'all';
        
        // 高效处理词书数据
        const wordbooks = wx.getStorageSync('wordbooks') || [];
        const wordbooksMap = {};
        
        // 只处理有ID的词书
        for (const book of wordbooks) {
          if (book && book.id) {
            wordbooksMap[book.id] = { title: book.title || book.name || '未命名词书' };
          }
        }
        
        // 批量更新状态
        this.setData({
          studyRecords: uniqueRecords,
          wordbooks: wordbooksMap,
          totalRecords: uniqueRecords.length,
          wordbookOptions,
          wordbookFilter
        }, () => {
          console.log('学习记录数据更新完成，studyRecords:', this.data.studyRecords);
          
          // 调用过滤函数
          this.filterRecords();
          
          // 过滤完成后设置加载状态为false
          this.setData({ isLoading: false });
          console.log('加载状态已设置为false');
        });
      } catch (error) {
        console.error('加载数据失败:', error);
        // 确保在错误情况下也能更新加载状态
        this.setData({ isLoading: false });
        // 错误情况下重置加载状态为false
        // 显示错误提示
        wx.showToast({
          title: '数据加载失败',
          icon: 'none',
          duration: 1500
        });
      }
    }, 100);
    this._loadDataTimer = loadDataTimer;
  },
  
  // 优化的加载更多数据函数 - 性能提升版
  loadMore: function() {
    // 防止重复加载和无效加载
    if (this.data.isLoadingMore || !this.data.hasMoreData) return;
    
    this.setData({ isLoadingMore: true });
    
    // 减少延迟时间，提升响应速度
    const that = this;
    setTimeout(() => {
      try {
        // 使用缓存的过滤结果，避免重复过滤
        const filteredRecords = that._cache.filteredRecords || that.data.filteredRecords;
        
        // 优化分页计算
        const { pageSize, currentPage } = that.data;
        const nextPage = currentPage + 1;
        const startIndex = nextPage * pageSize;
        const endIndex = startIndex + pageSize;
        
        // 使用slice获取下一页数据，这是高效的数组操作
        const nextPageRecords = filteredRecords.slice(startIndex, endIndex);
        
        if (nextPageRecords.length > 0) {
          // 使用concat替代push.apply或展开运算符，减少内存消耗
          const updatedRecords = this.data.displayedRecords.concat(nextPageRecords);
          
          // 批量更新UI状态
          this.setData({
            displayedRecords: updatedRecords,
            currentDisplayCount: updatedRecords.length,
            currentPage: nextPage,
            hasMoreData: endIndex < filteredRecords.length,
            isLoadingMore: false
          }, () => {
            console.log('加载更多完成，检查updatedRecords:', updatedRecords);
          });
          
          console.log('加载更多完成，当前显示记录数:', updatedRecords.length);
        } else {
          // 没有更多数据
          this.setData({
            hasMoreData: false,
            isLoadingMore: false
          });
          console.log('已加载全部数据');
        }
      } catch (error) {
        console.error('加载更多数据失败:', error);
        this.setData({ isLoadingMore: false });
      }
    }, 150); // 进一步减少延迟，提升响应速度
  },
  
  // 优化的记录过滤函数 - 全面性能优化版
  filterRecords: function() {
    // 开始过滤记录
    try {
      // 使用缓存的处理记录，避免重复处理
      const studyRecords = this._cache.processedRecords || this.data.studyRecords || [];
      // 过滤前记录总数检查
      console.log('过滤前学习记录数量:', studyRecords.length);
      
      const now = Date.now();
      
      // 预计算时间范围边界，避免在过滤时重复计算
      const timeRangeMap = {
        week: now - 7 * 24 * 60 * 60 * 1000,
        month: now - 30 * 24 * 60 * 60 * 1000,
        year: now - 365 * 24 * 60 * 60 * 1000
      };
      
      // 高效过滤算法 - 根据时间范围过滤
      let filteredRecords = studyRecords;
      const filterType = this.data.timeFilter;
      const recordTypeFilter = this.data.recordTypeFilter;
      const wordbookFilter = this.data.wordbookFilter;
      
      console.log('当前时间过滤类型:', filterType);
      
      // 只有在需要过滤时才执行过滤操作
      if (filterType !== 'all' && timeRangeMap[filterType]) {
        const minTimestamp = timeRangeMap[filterType];
        console.log('时间过滤最小值:', minTimestamp);
        
        // 使用Array.filter保持排序顺序
        filteredRecords = studyRecords.filter(record => {
          // 正确处理不同类型的时间戳
          let timestamp = 0;
          if (record.timestamp) {
            if (typeof record.timestamp === 'string') {
              // 处理ISO字符串格式的时间戳
              timestamp = new Date(record.timestamp).getTime();
            } else if (typeof record.timestamp === 'number') {
              // 处理数字格式的时间戳
              timestamp = record.timestamp;
            }
          }
          
          const isValid = !isNaN(timestamp);
          const isInRange = timestamp >= minTimestamp;
          
          // 对于无效时间戳，默认包含在结果中
          return isValid ? isInRange : true;
        });
        // 时间过滤完成
      }

      if (wordbookFilter !== 'all') {
        filteredRecords = filteredRecords.filter(record => String(record.wordbookId || '') === String(wordbookFilter));
      }

      const visibleLearningCount = filteredRecords.filter(record => !this.isAntiForgettingRecord(record)).length;
      const visibleReviewCount = filteredRecords.filter(record => this.isAntiForgettingRecord(record)).length;

      // 按记录类型筛选
      if (recordTypeFilter === 'anti') {
        filteredRecords = filteredRecords.filter(record => this.isAntiForgettingRecord(record));
      } else if (recordTypeFilter === 'word') {
        filteredRecords = filteredRecords.filter(record => !this.isAntiForgettingRecord(record));
      }
      
      console.log('过滤后学习记录数量:', filteredRecords.length);
      
      // 缓存过滤结果
      this._cache.filteredRecords = filteredRecords;
      
      // 使用配置的分页大小
      const { pageSize } = this.data;
      const firstPageRecords = filteredRecords.slice(0, pageSize);
      // 准备更新UI
      
      console.log('第一页显示记录数量:', firstPageRecords.length);
        console.log('第一页记录详细信息:', firstPageRecords);
        
        this.setData({
          filteredRecords: filteredRecords,
          displayedRecords: firstPageRecords,
          currentDisplayCount: firstPageRecords.length,
          currentPage: 0,
          hasMoreData: filteredRecords.length > pageSize,
          visibleLearningCount,
          visibleReviewCount
        }, () => {
          console.log('数据更新完成，检查displayedRecords:', this.data.displayedRecords);
        });
      // UI数据更新完成
    } catch (error) {
      console.error('【调试】过滤记录失败:', error);
      // 错误情况下确保UI更新
      this.setData({
        filteredRecords: this._cache.processedRecords || this.data.studyRecords || [],
        displayedRecords: (this._cache.processedRecords || this.data.studyRecords || []).slice(0, this.data.pageSize),
        currentDisplayCount: Math.min(this.data.pageSize, (this._cache.processedRecords || this.data.studyRecords || []).length),
        hasMoreData: (this._cache.processedRecords || this.data.studyRecords || []).length > this.data.pageSize,
        isLoading: false // 确保在过滤错误时也关闭加载状态
      });
      console.log('【调试】错误情况下重置UI状态');
      
      // 显示错误提示
      wx.showToast({
        title: '数据过滤失败，显示所有记录',
        icon: 'none',
        duration: 1500
      });
    }
  },
  
  // 优化的时间筛选切换函数
  changeTimeFilter: function(e) {
    const filter = e.currentTarget.dataset.filter;
    
    // 防止重复点击相同的筛选条件
    if (filter === this.data.timeFilter) return;
    
    // 关闭所有滑动项
    this.closeAllSliders();
    
    // 立即更新筛选状态，给用户即时反馈
    this.setData({ 
      timeFilter: filter,
      isLoading: true // 显示加载状态
    });
    
    try {
      // 同步执行过滤，提高响应速度
      this.filterRecords();
      // 过滤完成后隐藏加载状态
      this.setData({ isLoading: false });
    } catch (error) {
      console.error('切换时间筛选失败:', error);
      // 确保在错误情况下也能更新加载状态
      this.setData({ isLoading: false });
      
      // 显示错误提示
      wx.showToast({
        title: '筛选切换失败',
        icon: 'none',
        duration: 1500
      });
    }
  },

  // 记录类型筛选切换
  changeRecordTypeFilter: function(e) {
    const filter = e.currentTarget.dataset.filter;

    if (filter === this.data.recordTypeFilter) return;

    this.closeAllSliders();

    this.setData({
      recordTypeFilter: filter,
      isLoading: true
    });

    try {
      this.filterRecords();
      this.setData({ isLoading: false });
    } catch (error) {
      console.error('切换记录类型筛选失败:', error);
      this.setData({ isLoading: false });
      wx.showToast({
        title: '筛选切换失败',
        icon: 'none',
        duration: 1500
      });
    }
  },

  changeWordbookFilter: function(e) {
    const filter = e.currentTarget.dataset.wordbookId;
    if (!filter || filter === this.data.wordbookFilter) return;

    this.closeAllSliders();
    this.setData({ wordbookFilter: filter, isLoading: true });

    try {
      this.filterRecords();
    } catch (error) {
      console.error('切换词书筛选失败:', error);
      wx.showToast({ title: '词书筛选失败', icon: 'none', duration: 1500 });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  // 判断是否为抗遗忘复习记录
  isAntiForgettingRecord: function(record) {
    if (!record) return false;

    if (record.recordCategory) {
      return record.recordCategory === 'anti';
    }

    const checkSingle = (item) => {
      if (!item) return false;
      const title = item.wordbookTitle || item.wordbookName || '';
      return item.recordType === 'anti_forgetting_review' ||
        item.isAntiForgettingReview === true ||
        title.includes('抗遗忘复习');
    };

    if (record.isMerged && Array.isArray(record.originalRecords)) {
      return record.originalRecords.some(checkSingle);
    }

    return checkSingle(record);
  },

  normalizeWordKey: function(wordLike) {
    if (wordLike === undefined || wordLike === null) return '';
    const text = String(wordLike).trim().toLowerCase();
    if (!text) return '';
    return text.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  },

  isNumericWordId: function(wordIdLike) {
    if (wordIdLike === undefined || wordIdLike === null) return false;
    if (typeof wordIdLike === 'number') {
      return Number.isFinite(wordIdLike);
    }

    const text = String(wordIdLike).trim();
    if (!text) return false;
    return /^\d+$/.test(text);
  },

  appendLegacyRecordPlaceholderWord: function(record, words, wordSet) {
    const placeholderWord = '旧版记录暂无法查看明细';
    if (wordSet.has(placeholderWord)) {
      return;
    }

    const recordHint = String((record && (record.id || record.timestamp)) || Date.now()).replace(/[^a-zA-Z0-9_]/g, '_');
    const placeholderMeaning = '该记录来自旧版本，单词ID无法完整还原，学习统计已保留。';

    wordSet.add(placeholderWord);
    words.push({
      id: `legacy_placeholder_${recordHint}`,
      sourceWordId: 'legacy_unavailable',
      word: placeholderWord,
      phonetic: '',
      meaning: placeholderMeaning
    });
  },

  getMasteredCountFromRecord: function(record) {
    if (!record || typeof record !== 'object') return 0;
    if (Array.isArray(record.masteredWordIds)) return record.masteredWordIds.length;
    if (typeof record.masteredCount === 'number') return Math.max(0, record.masteredCount);
    if (typeof record.masteredWords === 'number') return Math.max(0, record.masteredWords);
    return 0;
  },

  getNotMasteredCountFromRecord: function(record) {
    if (!record || typeof record !== 'object') return 0;
    if (Array.isArray(record.notMasteredWordIds)) return record.notMasteredWordIds.length;
    if (typeof record.notMasteredCount === 'number') return Math.max(0, record.notMasteredCount);

    const masteredCount = this.getMasteredCountFromRecord(record);
    const totalWords = Number(record.totalWords || record.wordCount || 0);
    if (totalWords > 0) {
      return Math.max(0, totalWords - masteredCount);
    }
    return 0;
  },

  getRecordWordIds: function(record) {
    if (!record || typeof record !== 'object') return [];

    const sourceList =
      (Array.isArray(record.studyWordsDetailed) && record.studyWordsDetailed) ||
      (Array.isArray(record.learnedWordIds) && record.learnedWordIds) ||
      (Array.isArray(record.studyWords) && record.studyWords) ||
      (Array.isArray(record.wordIds) && record.wordIds) ||
      [];

    return sourceList
      .map(item => {
        if (item && typeof item === 'object') {
          return String(item.id || item.word || '').trim();
        }
        return String(item || '').trim();
      })
      .filter(Boolean);
  },

  getRecordWordCount: function(record) {
    const ids = this.getRecordWordIds(record);
    if (ids.length > 0) {
      return new Set(ids.map(id => String(id))).size;
    }

    const totalWords = Number(record.totalWords || record.wordCount || 0);
    return totalWords > 0 ? totalWords : 0;
  },

  collectRecordWordStatusMap: function(record) {
    const statusMap = {};
    const setStatus = (list, status, wordbookId) => {
      if (!Array.isArray(list)) return;
      list.forEach(item => {
        const key = this.normalizeWordKey(item);
        if (key) statusMap[key] = status;

        const extracted = this.parseWordFromRecordId(item, wordbookId);
        const extractedKey = this.normalizeWordKey(extracted);
        if (extractedKey) statusMap[extractedKey] = status;
      });
    };

    const collectSingle = (singleRecord) => {
      if (!singleRecord || typeof singleRecord !== 'object') return;
      setStatus(singleRecord.masteredWordIds, 'mastered', singleRecord.wordbookId);
      setStatus(singleRecord.notMasteredWordIds, 'notMastered', singleRecord.wordbookId);
    };

    if (record && record.isMerged && Array.isArray(record.originalRecords)) {
      record.originalRecords.forEach(collectSingle);
    } else {
      collectSingle(record);
    }

    return statusMap;
  },

  getRecordMasteryStats: function(record) {
    if (!record) {
      return { total: 0, mastered: 0, notMastered: 0 };
    }

    if (record.isMerged && Array.isArray(record.originalRecords)) {
      return record.originalRecords.reduce((acc, item) => {
        acc.mastered += this.getMasteredCountFromRecord(item);
        acc.notMastered += this.getNotMasteredCountFromRecord(item);
        return acc;
      }, { total: 0, mastered: 0, notMastered: 0 });
    }

    return {
      total: Number(record.totalWords || record.wordCount || 0),
      mastered: this.getMasteredCountFromRecord(record),
      notMastered: this.getNotMasteredCountFromRecord(record)
    };
  },

  applyMasteryStatusToWords: function(words, record) {
    const statusMap = this.collectRecordWordStatusMap(record);

    const enhanced = (words || []).map(word => {
      const keyByWord = this.normalizeWordKey(word.word);
      const keyById = this.normalizeWordKey(word.id);
      const keyBySourceId = this.normalizeWordKey(word.sourceWordId);
      const masteryStatus = statusMap[keyBySourceId] || statusMap[keyByWord] || statusMap[keyById] || 'unknown';
      return {
        ...word,
        masteryStatus: masteryStatus
      };
    });

    return enhanced;
  },

  getMasteryStatsFromWords: function(words) {
    const stats = {
      total: 0,
      mastered: 0,
      notMastered: 0
    };

    (words || []).forEach(word => {
      stats.total += 1;
      if (word.masteryStatus === 'mastered') {
        stats.mastered += 1;
      } else if (word.masteryStatus === 'notMastered') {
        stats.notMastered += 1;
      }
    });

    return stats;
  },
  
  // 处理滑动变化事件
  onMoveChange: function(e) {
    const { id } = e.currentTarget.dataset;
    const { x } = e.detail;
    
    // 限制只能向左滑动，且最大滑动距离为180rpx
    if (x > 0) return;
    const maxDistance = -180;
    if (x < maxDistance) return;
    
    // 关闭其他已打开的滑动项
    if (this._openedItemId && this._openedItemId !== id) {
      this.closeAllSliders();
    }
    
    // 更新滑动位置
    const currentMovedX = { ...this.data.movedX };
    currentMovedX[id] = x;
    this.setData({
      movedX: currentMovedX
    });
    
    // 记录打开的项
    if (x <= maxDistance + 20) { // 允许一定的容差
      this._openedItemId = id;
    } else if (x >= -10) { // 接近关闭位置
      this._openedItemId = null;
    }
  },
  
  // 关闭所有滑动项
  closeAllSliders: function() {
    // 重置所有滑动项
    const movedX = {};
    this.data.displayedRecords.forEach(item => {
      movedX[item.id] = 0;
    });
    this.setData({ movedX });
    this._openedItemId = null;
  },
  
  // 点击记录项关闭滑动或查看单词
  onRecordTap: function(e) {
    const { id } = e.currentTarget.dataset;
    
    // 如果当前项已打开，则关闭
    if (this.data.movedX[id] && this.data.movedX[id] < 0) {
      const currentMovedX = { ...this.data.movedX };
      currentMovedX[id] = 0;
      this.setData({
        movedX: currentMovedX
      });
      this._openedItemId = null;
    } else {
      // 查看记录中的单词
      this.viewRecordWords(id);
    }
  },

  findDisplayedRecord: function(recordId) {
    const sources = [
      this.data.displayedRecords,
      this.data.filteredRecords,
      this.data.studyRecords,
      this._cache && this._cache.processedRecords
    ];
    for (const source of sources) {
      const match = (Array.isArray(source) ? source : []).find((record) => record && record.id === recordId);
      if (match) return match;
    }
    return null;
  },

  onExportTap: function(e) {
    if (this._isExporting || this.data.isExporting) return;
    const displayRecord = this.findDisplayedRecord(e.currentTarget.dataset.id);
    if (!displayRecord) {
      wx.showToast({ title: '未找到该条原始记录', icon: 'none' });
      return;
    }

    const choices = buildOriginalRecordChoices(displayRecord);
    if (choices.length === 0 || choices.some((choice) => !choice.stable)) {
      wx.showToast({ title: '该历史记录缺少稳定 recordId，无法导出', icon: 'none', duration: 2500 });
      return;
    }

    const isAnti = this.isAntiForgettingRecord(displayRecord);
    const mergedChoice = choices.length > 1
      ? buildMergedRecordExportChoice(displayRecord)
      : null;
    this.setData({
      exportDialogVisible: true,
      exportDialogStep: choices.length > 1 ? 'record' : (isAnti ? 'format' : 'scope'),
      exportRecordChoices: choices,
      exportMergedChoice: mergedChoice,
      exportRecordKind: isAnti ? 'anti_forgetting_review' : 'learning',
      selectedExportRecordId: choices.length === 1 ? choices[0].recordId : '',
      selectedExportRecordIds: [],
      selectedExportScope: EXPORT_SCOPES.ALL
    });
  },

  onChooseMergedRecords: function() {
    const choice = this.data.exportMergedChoice;
    if (!choice || !choice.available) {
      wx.showToast({
        title: (choice && choice.userMessage) || '该合并历史记录无法整体导出',
        icon: 'none',
        duration: 3000
      });
      return;
    }
    this.setData({
      selectedExportRecordId: '',
      selectedExportRecordIds: choice.recordIds.slice(),
      selectedExportScope: EXPORT_SCOPES.ALL,
      exportDialogStep: this.data.exportRecordKind === 'anti_forgetting_review' ? 'format' : 'scope'
    });
  },

  onChooseOriginalRecord: function(e) {
    const recordId = String(e.currentTarget.dataset.recordId || '');
    if (!recordId) return;
    this.setData({
      selectedExportRecordId: recordId,
      selectedExportRecordIds: [],
      exportDialogStep: this.data.exportRecordKind === 'anti_forgetting_review' ? 'format' : 'scope'
    });
  },

  onChooseExportScope: function(e) {
    const scope = e.currentTarget.dataset.scope;
    if (![EXPORT_SCOPES.ALL, EXPORT_SCOPES.MASTERED, EXPORT_SCOPES.NOT_MASTERED].includes(scope)) return;
    this.setData({ selectedExportScope: scope, exportDialogStep: 'format' });
  },

  onChooseExportFormat: function(e) {
    const format = e.currentTarget.dataset.format;
    if (![EXPORT_FORMATS.PDF, EXPORT_FORMATS.XLSX].includes(format)) return;
    const recordId = this.data.selectedExportRecordId;
    const recordIds = Array.isArray(this.data.selectedExportRecordIds)
      ? this.data.selectedExportRecordIds.slice()
      : [];
    const scope = this.data.exportRecordKind === 'anti_forgetting_review'
      ? EXPORT_SCOPES.ALL
      : this.data.selectedExportScope;
    this.closeExportDialog();
    this.executeRecordExport(recordIds.length > 1
      ? { recordIds, scope, format }
      : { recordId, scope, format });
  },

  closeExportDialog: function() {
    this.setData({
      exportDialogVisible: false,
      exportDialogStep: '',
      exportRecordChoices: [],
      exportMergedChoice: null,
      selectedExportRecordId: '',
      selectedExportRecordIds: []
    });
  },

  stopDialogTap: function() {},

  executeRecordExport: async function(options, allowPartial = false) {
    if (this._isExporting || this.data.isExporting) return null;
    this._isExporting = true;
    this.setData({ isExporting: true });
    wx.showLoading({ title: '正在生成文件', mask: true });

    try {
      const result = await generateAndOpenRecordExport({
        ...options,
        records: this.data.studyRecords,
        currentStudent: this.data.currentStudent,
        allowPartial
      });
      return result;
    } catch (error) {
      if (error && error.code === 'PARTIAL_EXPORT_CONFIRMATION_REQUIRED' && !allowPartial) {
        wx.hideLoading();
        this._isExporting = false;
        this.setData({ isExporting: false });
        wx.showModal({
          title: '历史兼容记录',
          content: error.userMessage
            || '该记录属于历史兼容记录，部分历史字段不可保证。导出只包含能够证明的历史字段，是否继续？',
          confirmText: '继续导出',
          success: (res) => {
            if (res.confirm) this.executeRecordExport(options, true);
          }
        });
        return null;
      }

      const message = error && error.userMessage
        ? error.userMessage
        : ((error && String(error.errMsg || '').includes('openDocument')) ? '文件打开失败，请重试' : '导出失败，请重试');
      wx.showToast({ title: message, icon: 'none', duration: 2500 });
      return null;
    } finally {
      if (this._isExporting) {
        wx.hideLoading();
        this._isExporting = false;
        this.setData({ isExporting: false });
      }
    }
  },

  // 查看记录中的单词
  viewRecordWords: function(recordId) {
    try {
      console.log('查看记录中的单词，记录ID:', recordId);
      
      // 查找记录 - 优先在displayedRecords中查找，如果找不到再在其他数据集中查找
      let record = this.data.displayedRecords.find(r => r.id === recordId);
      
      // 如果在displayedRecords中找不到，尝试在filteredRecords中查找
      if (!record) {
        console.log('在displayedRecords中未找到记录，尝试在filteredRecords中查找');
        record = this.data.filteredRecords.find(r => r.id === recordId);
      }
      
      // 如果在filteredRecords中也找不到，尝试在studyRecords中查找
      if (!record) {
        console.log('在filteredRecords中未找到记录，尝试在studyRecords中查找');
        record = this.data.studyRecords.find(r => r.id === recordId);
      }
      
      // 如果在所有数据集中都找不到，尝试在缓存中查找
      if (!record && this._cache.processedRecords) {
        console.log('在studyRecords中未找到记录，尝试在缓存中查找');
        record = this._cache.processedRecords.find(r => r.id === recordId);
      }
      
      if (!record) {
        console.warn('未找到记录:', recordId);
        return;
      }
      
      console.log('找到记录:', record);
      const isAntiRecord = this.isAntiForgettingRecord(record);

      // 优先获取实际学习的单词（用户要求：学了什么单词就显示什么单词）
      console.log('优先获取实际学习的单词');
      const actualWords = this.getActualLearnedWords(record);
      
      console.log('提取的实际单词数量:', actualWords.length);
      console.log('提取的实际单词:', actualWords);
      
      if (actualWords.length > 0) {
        // 如果有实际单词，显示实际单词
        console.log('显示实际学习的单词');
        const wordsWithStatus = this.applyMasteryStatusToWords(actualWords, record);
        const masteryStats = this.getMasteryStatsFromWords(wordsWithStatus);
        const wordsPayload = isAntiRecord ? actualWords : wordsWithStatus;
        const extraParams = isAntiRecord ? '' : `&fromRecord=1&masteryStats=${encodeURIComponent(JSON.stringify(masteryStats))}`;
        // 跳转到单词查看页面
        wx.navigateTo({
          url: `/subpages/word-view/word-view?words=${encodeURIComponent(JSON.stringify(wordsPayload))}&title=${encodeURIComponent(`学习记录 - ${record.formattedDate}`)}${extraParams}`
        });
      } else {
        // 如果没有实际单词，从合并单词数据中选择
        console.log('没有实际单词信息，从合并数据中选择');
        const wordsFromMerge = this.getWordsFromMergedData(record);
        
        console.log('从合并数据中选择的单词:', wordsFromMerge);
        
        if (wordsFromMerge.length === 0) {
          wx.showToast({
            title: '未找到该记录的详细单词数据',
            icon: 'none',
            duration: 1800
          });
          return;
        } else {
          const wordsWithStatus = this.applyMasteryStatusToWords(wordsFromMerge, record);
          const masteryStats = this.getMasteryStatsFromWords(wordsWithStatus);
          const wordsPayload = isAntiRecord ? wordsFromMerge : wordsWithStatus;
          const extraParams = isAntiRecord ? '' : `&fromRecord=1&masteryStats=${encodeURIComponent(JSON.stringify(masteryStats))}`;
          // 跳转到单词查看页面
          wx.navigateTo({
            url: `/subpages/word-view/word-view?words=${encodeURIComponent(JSON.stringify(wordsPayload))}&title=${encodeURIComponent(`学习记录 - ${record.formattedDate}`)}${extraParams}`
          });
        }
      }
    } catch (error) {
      console.error('查看记录单词失败:', error);
      wx.showToast({
        title: '查看单词失败，请重试',
        icon: 'none',
        duration: 1500
      });
    }
  },

  // 获取记录中实际学习的单词
  getActualLearnedWords: function(record) {
    try {
      console.log('获取实际学习的单词:', record);
      
      const words = [];
      const wordSet = new Set();
      
      // 处理合并记录
      if (record.isMerged && record.originalRecords) {
        console.log('处理合并记录，原始记录数:', record.originalRecords.length);
        
        record.originalRecords.forEach(originalRecord => {
          this.extractWordsFromOriginalRecord(originalRecord, words, wordSet);
        });
      } else {
        // 处理单个记录
        this.extractWordsFromOriginalRecord(record, words, wordSet);
      }
      
      console.log('最终提取的实际单词:', words);
      return words;
    } catch (error) {
      console.error('获取实际学习的单词失败:', error);
      return [];
    }
  },

  // 从原始记录中提取单词
  extractWordsFromOriginalRecord: function(record, words, wordSet) {
    try {
      console.log('从原始记录中提取单词:', record);

      // 新链路优先：直接使用学习时保存的完整单词快照，避免ID反解析造成错位。
      const detailedWords =
        (Array.isArray(record.studyWordsDetailed) && record.studyWordsDetailed) ||
        (Array.isArray(record.learnedWordsDetailed) && record.learnedWordsDetailed) ||
        [];

      if (detailedWords.length > 0) {
        const beforeCount = words.length;
        let detailedWordAdded = false;
        const detailedSeen = new Set();
        detailedWords.forEach((item, index) => {
          if (!item || typeof item !== 'object') {
            return;
          }

          const sourceWordId = String(item.sourceWordId || item.id || item.word || '').trim();
          const displayWord = String(item.word || '').replace(/\s+/g, ' ').trim();
          if (!displayWord) {
            return;
          }

          const dedupeKey = sourceWordId || displayWord.toLowerCase();
          if (!dedupeKey || detailedSeen.has(dedupeKey)) {
            return;
          }
          detailedSeen.add(dedupeKey);

          const wordObj = {
            id: sourceWordId || `${displayWord.toLowerCase().replace(/\s+/g, '_')}_${index}`,
            sourceWordId: sourceWordId,
            word: displayWord,
            phonetic: String(item.phonetic || '').trim(),
            meaning: String(item.meaning || item.translation || '未知释义').trim() || '未知释义'
          };

          const normalizedWord = String(displayWord).toLowerCase();
          const mappedWord = wordMap[normalizedWord] || (normalizedWord.length >= 3 ? findWord(displayWord, wordMap) : null);
          if (mappedWord) {
            wordObj.word = mappedWord.word || wordObj.word;
            wordObj.phonetic = mappedWord.phonetic || wordObj.phonetic;
            wordObj.meaning = mappedWord.meaning || mappedWord.translation || wordObj.meaning;
          }

          const finalKey = String(wordObj.word || '').toLowerCase().replace(/\s+/g, ' ').trim();
          if (!finalKey || wordSet.has(finalKey)) {
            return;
          }

          wordSet.add(finalKey);
          words.push(wordObj);
          detailedWordAdded = true;
        });

        if (detailedWordAdded) {
          console.log('使用studyWordsDetailed提取单词成功，新增数量:', words.length - beforeCount);
          return;
        }
      }
      
      // 优先使用掌握/未掌握快照（通常比历史learnedWordIds更准确）
      let wordIds = [];
      const beforeExtractCount = words.length;
      let unresolvedIdCount = 0;
      let numericOnlyIdCount = 0;

      const snapshotWordIds = [];
      if (Array.isArray(record.masteredWordIds)) {
        snapshotWordIds.push(...record.masteredWordIds);
      }
      if (Array.isArray(record.notMasteredWordIds)) {
        snapshotWordIds.push(...record.notMasteredWordIds);
      }

      if (snapshotWordIds.length > 0) {
        const seen = new Set();
        wordIds = snapshotWordIds.filter((id) => {
          const key = String(id || '').trim();
          if (!key || seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        });
        console.log('使用masteredWordIds/notMasteredWordIds:', wordIds);
      }
      
      if (wordIds.length === 0 && record.learnedWordIds && Array.isArray(record.learnedWordIds)) {
        console.log('使用learnedWordIds:', record.learnedWordIds);
        wordIds = record.learnedWordIds;
      } else if (wordIds.length === 0 && record.studyWords && Array.isArray(record.studyWords)) {
        console.log('使用studyWords:', record.studyWords);
        wordIds = record.studyWords;
      } else if (wordIds.length === 0 && record.words && Array.isArray(record.words)) {
        console.log('使用words:', record.words);
        wordIds = record.words;
      } else if (wordIds.length === 0 && record.wordIds && Array.isArray(record.wordIds)) {
        console.log('使用wordIds:', record.wordIds);
        wordIds = record.wordIds;
      }
      
      console.log('提取的单词ID:', wordIds);
      
      // 处理每个单词ID
      const normalizedFinalWordSet = new Set();
      wordIds.forEach((wordId, index) => {
        try {
          const sourceWordId = typeof wordId === 'object' && wordId !== null ? (wordId.id || wordId.word || JSON.stringify(wordId)) : String(wordId);
          const sourceWordIdText = String(sourceWordId || '').trim();

          // 旧版纯数字ID无法可靠反解析，留给后续词书兜底/默认提示处理。
          if (this.isNumericWordId(sourceWordIdText)) {
            numericOnlyIdCount += 1;
            unresolvedIdCount += 1;
            return;
          }

          let processedWord = this.parseWordFromRecordId(wordId, record.wordbookId);

          // 历史数据纠偏：若解析结果过短，尝试从原始ID反向恢复真实单词
          if (typeof processedWord === 'string' && processedWord.length <= 2) {
            const sourceText = String(sourceWordId || '');
            const tokenCandidates = (sourceText.match(/[a-zA-Z][a-zA-Z'\-]*/g) || []).reverse();
            const genericTokens = new Set([
              'real', 'word', 'words', 'book', 'wordbook', 'grade',
              'first', 'second', 'third', 'fourth', 'fifth', 'sixth',
              'seventh', 'eighth', 'ninth', 'new', 'standard', 'complete'
            ]);

            for (let i = 0; i < tokenCandidates.length; i++) {
              const token = String(tokenCandidates[i]).trim();
              if (token.length < 3 || genericTokens.has(token.toLowerCase())) {
                continue;
              }

              const directMatch = wordMap[token.toLowerCase()];
              const fuzzyMatch = directMatch || findWord(token, wordMap);
              if (fuzzyMatch && fuzzyMatch.word) {
                processedWord = String(fuzzyMatch.word).trim();
                break;
              }

              // 即使词典未命中，也优先保留更合理的英文候选
              processedWord = token;
              break;
            }
          }
          
          // 如果是字符串，处理可能的wordbookId_word格式
          if (typeof processedWord === 'string' && processedWord) {
            processedWord = processedWord.replace(/\s+/g, ' ').trim();

            // 过滤明显异常的超长ID残留词；真实短语（词典可查到）保留完整
            const tokenCount = processedWord.split(/\s+/).filter(Boolean).length;
            const isValidPhrase = tokenCount >= 4 && wordMap[processedWord.toLowerCase()];
            if (processedWord.length > 24 || (tokenCount >= 4 && !isValidPhrase)) {
              const sourceTokens = String(sourceWordId || '').match(/[a-zA-Z][a-zA-Z'\-]*/g) || [];
              if (sourceTokens.length > 0) {
                processedWord = String(sourceTokens[sourceTokens.length - 1] || '').trim();
              }
            }

            if (!processedWord) {
              unresolvedIdCount += 1;
              return;
            }

            // ★ 短语词典查词：单字原样，短语查 wordMap 获取标准文本
            processedWord = lookUpPhrase(processedWord, wordMap);
            
            // 去重
            if (!wordSet.has(processedWord) && processedWord) {
              wordSet.add(processedWord);
              
              // 创建单词对象
              const wordObj = {
                id: `${processedWord.toLowerCase().replace(/\s+/g, '_')}_${index}`,
                sourceWordId: sourceWordId,
                word: processedWord,
                phonetic: '',
                meaning: '未知释义'
              };
              
              // 尝试从单词映射表中获取详细信息
              const normalizedWord = String(processedWord).toLowerCase();
              let mappedWord = wordMap[normalizedWord];

              // 历史兼容：部分旧记录将 Miss 记成 ms，优先纠偏回 miss
              if (!mappedWord && normalizedWord === 'ms' && wordMap['miss']) {
                mappedWord = wordMap['miss'];
              }

              // 短词禁用模糊匹配，避免将 ms 误匹配到“情况”等无关释义
              if (!mappedWord && normalizedWord.length >= 3) {
                mappedWord = findWord(processedWord, wordMap);
              }

              if (mappedWord) {
                wordObj.word = mappedWord.word || processedWord;
                wordObj.phonetic = mappedWord.phonetic || '';
                wordObj.meaning = mappedWord.meaning || mappedWord.translation || '未知释义';
              }

              const finalKey = String(wordObj.word || '').toLowerCase().replace(/\s+/g, ' ').trim();
              if (!finalKey || normalizedFinalWordSet.has(finalKey)) {
                return;
              }
              normalizedFinalWordSet.add(finalKey);
              
              words.push(wordObj);
              console.log('添加单词:', wordObj);
            }
          }
        } catch (wordError) {
          console.error('处理单个单词失败:', wordError);
          unresolvedIdCount += 1;
        }
      });

      const extractedCount = words.length - beforeExtractCount;
      const hasWordIds = Array.isArray(wordIds) && wordIds.length > 0;
      const allIdsUnresolved = hasWordIds && unresolvedIdCount >= wordIds.length;
      const allNumericOnlyIds = hasWordIds && numericOnlyIdCount >= wordIds.length;

      // 旧版记录兜底：无法恢复明细时，优先词书生成占位词，其次给默认提示词，绝不抛错或丢弃记录。
      if (!hasWordIds || extractedCount === 0 || allIdsUnresolved || allNumericOnlyIds) {
        const fallbackCount = Math.max(Number(record.totalWords || 0), hasWordIds ? wordIds.length : 0, 1);

        if (record.wordbookId) {
          console.log('明细解析不足，回退到词书占位生成，词书ID:', record.wordbookId, '数量:', fallbackCount);
          this.generateWordsFromWordbook({
            ...record,
            totalWords: fallbackCount
          }, words, wordSet);
        }

        if (words.length === beforeExtractCount) {
          console.log('词书占位生成失败，写入默认提示词');
          this.appendLegacyRecordPlaceholderWord(record, words, wordSet);
        }
      }
    } catch (error) {
      console.error('从原始记录提取单词失败:', error);
    }
  },

  // 从记录中的单词ID解析实际单词，优先使用词书ID去前缀，避免短语被误截断
  parseWordFromRecordIdLegacyUnused: function(wordId, wordbookId) {
    try {
      if (wordId === undefined || wordId === null) {
        return '';
      }

      if (typeof wordId === 'object') {
        if (wordId.word) {
          return String(wordId.word).trim();
        }
        if (wordId.id) {
          wordId = String(wordId.id);
        } else {
          return '';
        }
      }

      if (typeof wordId !== 'string') {
        return '';
      }

      const rawId = wordId.trim();
      if (!rawId) {
        return '';
      }

      let candidate = rawId;

      // 纯英文/短语直接返回，避免被后续兜底逻辑误改
      if (/^[a-zA-Z][a-zA-Z\s'\-]*$/.test(candidate)) {
        return candidate.replace(/\s+/g, ' ').trim();
      }

      // 更稳健地去掉词书前缀（兼容大小写/连接符差异）
      const tryStripPrefix = (text, prefix) => {
        if (!prefix) return text;
        const rawPrefix = String(prefix).trim();
        if (!rawPrefix) return text;

        const prefixVariants = [
          rawPrefix,
          rawPrefix.replace(/-/g, '_'),
          rawPrefix.replace(/\s+/g, '_')
        ];

        const lowerText = text.toLowerCase();
        for (let i = 0; i < prefixVariants.length; i++) {
          const variant = prefixVariants[i];
          const withUnderscore = `${variant}_`;
          if (lowerText.startsWith(withUnderscore.toLowerCase())) {
            return text.slice(withUnderscore.length);
          }
        }

        return text;
      };

      candidate = tryStripPrefix(candidate, wordbookId);

      // 清理常见 real 标记
      if (candidate.startsWith('real_')) {
        candidate = candidate.slice(5);
      }
      candidate = candidate.replace(/_real_/g, '_');

      // 先按下划线还原短语
      const phrase = candidate.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

      // 处理包含特殊符号的短语（如 p.m./pm, P.M. /PM），避免掉入词书ID兜底误匹配。
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

        const isValidPhrase = phraseTokens.length >= 4 && wordMap[phrase.toLowerCase()];
        const looksLikeStructuredNoise =
          phrase.length > 24 ||
          (phraseTokens.length >= 4 && !isValidPhrase) ||
          phraseTokens.some(token => idLikeGenericTokens.has(String(token).toLowerCase()));

        // 结构化ID还原出的多词短语，词典命中则保留完整短语，否则取最后一个有意义token
        if (candidate.includes('_') && phraseTokens.length > 1 && looksLikeStructuredNoise && !isValidPhrase) {
          for (let i = phraseTokens.length - 1; i >= 0; i--) {
            const token = String(phraseTokens[i]).trim();
            const lower = token.toLowerCase();
            const isShortExactWord = token.length === 2 && !!wordMap[lower];
            if ((token.length >= 3 || isShortExactWord) && !idLikeGenericTokens.has(lower)) {
              return token;
            }
          }
        }

        return phrase;
      }

      // 兜底1：从后往前提取最后一个有效英文片段（可跳过末尾序号）
      const genericTokens = new Set([
        'real', 'word', 'words', 'book', 'wordbook', 'grade',
        'first', 'second', 'third', 'fourth', 'fifth', 'sixth',
        'seventh', 'eighth', 'ninth', 'new', 'standard', 'complete'
      ]);
      const tailParts = candidate.split('_').filter(Boolean);
      for (let i = tailParts.length - 1; i >= 0; i--) {
        const cleaned = String(tailParts[i]).replace(/[^a-zA-Z'\-]/g, '').trim();
        const lower = cleaned.toLowerCase();
        const isShortExactWord = cleaned.length === 2 && !!wordMap[lower];
        if ((cleaned.length >= 3 || isShortExactWord) && !genericTokens.has(lower)) {
          return cleaned;
        }
      }

      // 兜底2：按出现顺序提取最后一个有效英文 token（而非最长 token）
      const alphaTokens = candidate.match(/[a-zA-Z][a-zA-Z'\-]*/g);
      if (alphaTokens && alphaTokens.length > 0) {
        for (let i = alphaTokens.length - 1; i >= 0; i--) {
          const token = String(alphaTokens[i]).trim();
          const lower = token.toLowerCase();
          const isShortExactWord = token.length === 2 && !!wordMap[lower];
          if ((token.length >= 3 || isShortExactWord) && !genericTokens.has(lower)) {
            return token;
          }
        }
      }

      // 回退到原有提取逻辑，并对异常短词做一次保护
      const extracted = this.extractWordFromId(candidate) || this.extractWordFromId(rawId) || '';
      const extractedLower = String(extracted).toLowerCase();
      const isShortExactWord = extracted && extracted.length === 2 && !!wordMap[extractedLower];
      const isSingleRawWord = extracted && extracted.length === 1 && /^[a-zA-Z]$/.test(rawId) && rawId.toLowerCase() === extractedLower;
      if (extracted && (extracted.length >= 3 || isShortExactWord || isSingleRawWord)) {
        return extracted;
      }

      const rawAlphaTokens = rawId.match(/[a-zA-Z][a-zA-Z'\-]*/g);
      if (rawAlphaTokens && rawAlphaTokens.length > 0) {
        for (let i = rawAlphaTokens.length - 1; i >= 0; i--) {
          const token = String(rawAlphaTokens[i]).trim();
          if (token.length >= 3 && !genericTokens.has(token.toLowerCase())) {
            return token;
          }
        }
      }

      // 不再返回异常短词，避免 life 等单词被误还原成 i/ms 等噪音
      return '';
    } catch (error) {
      console.error('解析记录单词ID失败:', error, wordId, wordbookId);
      return '';
    }
  },
  
  parseWordFromRecordId: function(wordId, wordbookId) {
    try {
      if (wordId === undefined || wordId === null) return '';
      if (typeof wordId === 'object') {
        if (wordId.word) return String(wordId.word).trim();
        wordId = wordId.sourceWordId || wordId.id || '';
      }

      const sourceId = String(wordId || '').trim();
      if (!sourceId) return '';
      if (/^[a-zA-Z][a-zA-Z\s'\-.,/]*$/.test(sourceId)) return sourceId;
      return extractDisplayWordFromReviewId(sourceId, wordbookId);
    } catch (error) {
      console.error('[records] 完整词条 ID 解析失败:', error, wordId, wordbookId);
      return '';
    }
  },

  // 从词书ID和单词数量中生成单词
  generateWordsFromWordbook: function(record, words, wordSet) {
    try {
      console.log('从词书生成单词:', record);
      
      const { wordbookId, totalWords } = record;
      const count = Math.min(totalWords, 10); // 最多生成10个单词
      
      // 从单词映射表中选择单词
      const allWords = Object.values(wordMap);
      if (allWords.length === 0) {
        console.log('单词映射表为空');
        return;
      }
      
      // 使用记录的时间戳作为种子，确保每次生成相同的单词
      const seed = record.timestamp || Date.now();
      
      for (let i = 0; i < count; i++) {
        // 生成稳定的索引
        const index = Math.abs((seed + i * 13) % allWords.length);
        const wordInfo = allWords[index];
        
        if (wordInfo && wordInfo.word) {
          const wordText = wordInfo.word.trim();
          
          // 去重
          if (!wordSet.has(wordText) && wordText) {
            wordSet.add(wordText);
            
            // 创建单词对象
            const wordObj = {
              id: `${wordText.toLowerCase().replace(/\s+/g, '_')}_gen_${i}`,
              word: wordText,
              phonetic: wordInfo.phonetic || '',
              meaning: wordInfo.meaning || '未知释义'
            };
            
            words.push(wordObj);
            console.log('从词书生成的单词:', wordObj);
          }
        }
      }
    } catch (error) {
      console.error('从词书生成单词失败:', error);
    }
  },

  // 从记录中提取单词
  extractWordsFromRecord: function(record) {
    try {
      console.log('从记录中提取单词:', record);
      
      // 存储所有学习过的单词
      const learnedWords = new Set();
      
      // 处理合并记录
      if (record.isMerged && record.originalRecords) {
        console.log('处理合并记录，原始记录数:', record.originalRecords.length);
        
        record.originalRecords.forEach(originalRecord => {
          this.extractWordsFromSingleRecord(originalRecord, learnedWords);
        });
      } else {
        // 处理单个记录
        this.extractWordsFromSingleRecord(record, learnedWords);
      }
      
      console.log('提取的去重单词数:', learnedWords.size);
      
      // 转换为数组并添加完整的单词信息
      const wordsArray = Array.from(learnedWords);
      const wordsWithInfo = wordsArray.map(word => this.getWordInfo(word));
      
      return wordsWithInfo.filter(word => word !== null);
    } catch (error) {
      console.error('提取单词失败:', error);
      return [];
    }
  },

  // 从单个记录中提取单词
  extractWordsFromSingleRecord: function(record, learnedWords) {
    try {
      console.log('从单个记录中提取单词:', record);
      
      // 尝试从learnedWordIds或studyWords字段获取单词ID
      if (record.learnedWordIds && Array.isArray(record.learnedWordIds)) {
        console.log('从learnedWordIds提取单词:', record.learnedWordIds);
        record.learnedWordIds.forEach(wordId => {
          // 提取单词内容
          const word = this.parseWordFromRecordId(wordId, record.wordbookId);
          if (word) {
            learnedWords.add(word);
          }
        });
      } else if (record.studyWords && Array.isArray(record.studyWords)) {
        console.log('从studyWords提取单词:', record.studyWords);
        record.studyWords.forEach(wordId => {
          const word = this.parseWordFromRecordId(wordId, record.wordbookId);
          if (word) {
            learnedWords.add(word);
          }
        });
      } else if (record.wordbookId && (record.totalWords > 0)) {
        // 核心修改：从词书中获取单词
        console.log('从词书获取单词，词书ID:', record.wordbookId, '数量:', record.totalWords);
        this.getWordsFromWordbook(record.wordbookId, record.totalWords, learnedWords);
      } else {
        console.log('记录中没有单词信息');
      }
    } catch (error) {
      console.error('从单个记录提取单词失败:', error);
    }
  },

  // 从词书中获取单词
  getWordsFromWordbook: function(wordbookId, count, learnedWords) {
    try {
      console.log('从词书中获取单词，词书ID:', wordbookId, '数量:', count);
      
      // 从单词映射表中随机获取指定数量的单词
      const allWords = Object.values(wordMap);
      console.log('单词映射表大小:', allWords.length);
      
      if (allWords.length > 0) {
        // 随机选择单词
        const shuffled = allWords.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, Math.min(count, allWords.length));
        
        selected.forEach(wordInfo => {
          if (wordInfo && wordInfo.word) {
            learnedWords.add(wordInfo.word);
          }
        });
        
        console.log('从词书获取的单词:', Array.from(learnedWords));
      }
    } catch (error) {
      console.error('从词书获取单词失败:', error);
    }
  },

  // 从单词ID中提取单词内容
  extractWordFromId: function(wordId) {
    try {
      console.log('从单词ID提取单词:', wordId);

      if (typeof wordId === 'string') {
        const normalizedId = wordId.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
        const normalizedPad = ` ${normalizedId} `;
        // 优先从词典映射中匹配最长词条（按单词边界匹配），避免命中单字母噪音
        const candidates = Object.keys(wordMap || {}).sort((a, b) => b.length - a.length);
        for (const key of candidates) {
          if (!key) continue;
          const normalizedKey = String(key).toLowerCase().trim();
          if (!normalizedKey) continue;
          if (normalizedPad.includes(` ${normalizedKey} `)) {
            return key;
          }
        }
      }
      
      // 简单处理：如果是纯单词ID，直接返回
      if (typeof wordId === 'string' && /^[a-zA-Z\s]+$/.test(wordId)) {
        return wordId;
      }
      
      // 从ID中提取单词部分
      if (typeof wordId === 'string') {
        // 处理wordbookId_word格式的ID，提取实际单词
        // 常见格式：wordbookId_word 或 wordbookId_real_word
        if (wordId.includes('_')) {
          // 分割ID
          const parts = wordId.split('_');
          
          // 尝试多种格式提取单词
          // 格式1: wordbookId_word
          if (parts.length === 2) {
            const word = parts[1].trim();
            if (word && /^[a-zA-Z]+$/.test(word)) {
              console.log('从格式1提取的单词:', word);
              return word;
            }
          }
          // 格式2: wordbookId_real_word
          else if (parts.length === 3 && parts[1] === 'real') {
            const word = parts[2].trim();
            if (word && /^[a-zA-Z]+$/.test(word)) {
              console.log('从格式2提取的单词:', word);
              return word;
            }
          }
          // 格式3: 其他包含下划线的格式，尝试提取最后一部分
          else {
            // 尝试提取最后一部分作为单词
            const lastPart = parts[parts.length - 1].trim();
            if (lastPart && /^[a-zA-Z]+$/.test(lastPart)) {
              console.log('从格式3提取的单词:', lastPart);
              return lastPart;
            }
            
            // 尝试提取所有字母部分
            const wordMatch = wordId.match(/[a-zA-Z]+/g);
            if (wordMatch && wordMatch.length > 0) {
              // 尝试使用最后一个匹配的字母序列作为单词
              const word = wordMatch[wordMatch.length - 1].trim();
              console.log('从格式4提取的单词:', word);
              return word;
            }
          }
        }
        
        // 尝试使用正则表达式提取所有字母部分
        const wordMatch = wordId.match(/[a-zA-Z]+/g);
        if (wordMatch && wordMatch.length > 0) {
          // 尝试使用最后一个匹配的字母序列作为单词
          const word = wordMatch[wordMatch.length - 1].trim();
          console.log('从正则表达式提取的单词:', word);
          return word;
        }
      }
      
      return null;
    } catch (error) {
      console.error('从单词ID提取单词失败:', error);
      return null;
    }
  },

  // 获取单词完整信息
  getWordInfo: function(word) {
    try {
      console.log('获取单词完整信息:', word);
      
      // 从单词映射表中查找
      let matchedWord = wordMap[word.toLowerCase()];
      if (!matchedWord) {
        matchedWord = findWord(word, wordMap);
      }
      
      if (matchedWord) {
        console.log('从单词映射表找到单词:', matchedWord);
        return {
          id: `${word.toLowerCase().replace(/\s+/g, '_')}`,
          word: matchedWord.word,
          phonetic: matchedWord.phonetic,
          meaning: matchedWord.meaning || matchedWord.translation || '未知释义'
        };
      }
      
      // 如果没找到，创建基本信息
      console.log('未找到单词信息，创建基本信息');
      return {
        id: `${word.toLowerCase().replace(/\s+/g, '_')}`,
        word: word,
        phonetic: '',
        meaning: '未知释义'
      };
    } catch (error) {
      console.error('获取单词信息失败:', error);
      return {
        id: `${word.toLowerCase().replace(/\s+/g, '_')}`,
        word: word,
        phonetic: '',
        meaning: '未知释义'
      };
    }
  },
  
  // 格式化日期为年月日时分格式
  formatDate: function(dateStr) {
    // 添加参数验证和类型转换
    if (!dateStr) {
      const now = new Date();
      const year = now.getFullYear();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    }
    
    // 处理时间戳或日期字符串
    const date = typeof dateStr === 'string' ? new Date(dateStr) : new Date(Number(dateStr));
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      const now = new Date();
      const year = now.getFullYear();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    }
    
    // 格式化日期为 YYYY-MM-DD HH:MM 格式
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  },
  
  // 获取日期的时间戳，确保按年-月-日正确排序
  getTimestampFromDate: function(dateStr) {
    if (!dateStr) return Date.now();
    
    try {
      // 处理不同格式的日期
      if (typeof dateStr === 'string') {
        // 尝试直接解析
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date.getTime();
        }
        
        // 处理其他格式
        return Date.now();
      } else if (typeof dateStr === 'number') {
        return dateStr;
      }
    } catch (error) {
      console.error('解析日期失败:', error);
    }
    
    return Date.now();
  },
  
  // 优化的删除记录函数（V1.0.2 云端双向斩首）
  deleteRecord: function(e) {
    const recordId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条学习记录吗？此操作不可恢复。',
      showCancel: true,
      cancelText: '取消',
      confirmText: '确定',
      success: async (res) => {
        if (!res.confirm) return;
        
        // 显示加载中
        wx.showLoading({ title: '删除中...', mask: true });
        
        try {
          // ★ V1.0.2 第一步：尝试云端删除
          let cloudRemoved = 0;
          const hasCloud = !!(
            wx.cloud &&
            wx.getStorageSync('openid') &&
            !isCloudReadOnlyMode()
          );
          if (wx.cloud && wx.getStorageSync('openid') && !hasCloud) {
            console.warn('[cloud-read-only] skip learning record cloud delete:', recordId);
          }
          
          if (hasCloud) {
            try {
              wx.cloud.init({ env: 'cloudbase-4gafzdch60ad597b', traceUser: true });
              const db = wx.cloud.database({ env: 'cloudbase-4gafzdch60ad597b' });
              
              // 按 id 字段匹配删除（本地 id 可能等于云 _id，也可能等于云文档的 id 字段）
              const cloudRes = await db.collection('learning_records')
                .where({ id: recordId })
                .remove();
              
              cloudRemoved = (cloudRes && cloudRes.stats && cloudRes.stats.removed) || 0;
              console.log('[deleteRecord] 云端删除结果: removed=' + cloudRemoved + ', recordId=' + recordId);
              
              if (cloudRemoved === 0) {
                // 备选方案：直接用 doc(recordId) 尝试（某些记录 id 就是 _id）
                try {
                  const docRes = await db.collection('learning_records').doc(recordId).remove();
                  cloudRemoved = (docRes && docRes.stats && docRes.stats.removed) || 0;
                  console.log('[deleteRecord] 备选 doc() 删除结果: removed=' + cloudRemoved);
                } catch (docErr) {
                  // doc() 失败通常是 ID 不存在，属于正常情况
                  console.log('[deleteRecord] doc() 删除未命中（记录可能未同步到云端）:', docErr.errCode || docErr.message);
                }
              }
            } catch (cloudErr) {
              console.warn('[deleteRecord] 云端删除异常（非阻塞，将继续本地清理）:', cloudErr.errCode || cloudErr.message);
            }
          }
          
          // ★ V1.0.2 第二步：无论云端结果如何，执行本地彻底清理
          // （若 cloudRemoved===0，说明记录从未同步到云端或已不存在，本地清理即可）
          
          // 关闭滑动状态
          const currentMovedX = { ...this.data.movedX };
          delete currentMovedX[recordId];
          this.setData({ movedX: currentMovedX });
          this._openedItemId = null;
          
          // 更新页面 UI
          const updatedRecords = this.data.studyRecords.filter(record => record.id !== recordId);
          
          // 更新缓存
          if (this._cache.processedRecords) {
            this._cache.processedRecords = this._cache.processedRecords.filter(
              record => record.id !== recordId
            );
          }
          if (this._cache.filteredRecords) {
            this._cache.filteredRecords = this._cache.filteredRecords.filter(
              record => record.id !== recordId
            );
          }
          
          // ★ V1.0.2 同步清理本地持久化缓存（同时匹配 _id 和 id）
          const allRecords = wx.getStorageSync('learningRecords') || [];
          const deletedRecord = allRecords.find(record => record._id === recordId || record.id === recordId);
          const affectedStudentId = deletedRecord ? deletedRecord.studentId : (this.data.currentStudent?.id || null);
          const updatedAllRecords = allRecords.filter(record => record._id !== recordId && record.id !== recordId);
          wx.setStorageSync('learningRecords', updatedAllRecords);
          
          console.log('[deleteRecord] 本地缓存已清理 | 删除前: ' + allRecords.length + ' → 删除后: ' + updatedAllRecords.length);
          
          // 批量更新 UI
          this.setData({
            studyRecords: updatedRecords,
            totalRecords: Math.max(0, this.data.totalRecords - 1)
          });
          
          // 重新过滤数据
          this.filterRecords();
          
          // 事件通知
          const app = getApp();
          if (app && app.emit) {
            app.emit('learningRecordDeleted', { recordId });
          }

          // ★ V1.0.2 删除后刷新核心统计
          if (affectedStudentId) {
            refreshStudentStats(affectedStudentId).then((stats) => {
              console.log('[Records] 删除后核心统计已刷新:', stats);
            }).catch((e) => {
              console.warn('[Records] 统计刷新失败（非阻塞）:', e);
            });
          }
          
          wx.hideLoading();
          
          // 根据云端删除结果给出不同提示
          const toastTitle = cloudRemoved > 0 ? '云端+本地已删除' : '本地已删除（未同步云端）';
          wx.showToast({
            title: toastTitle,
            icon: 'success',
            duration: 1500
          });
          
        } catch (error) {
          wx.hideLoading();
          console.error('[deleteRecord] 删除失败:', error);
          wx.showToast({
            title: '删除失败，请重试',
            icon: 'none',
            duration: 2000
          });
        }
      }
    });
  },
  
  // 页面卸载时清理缓存，避免内存泄漏
  onUnload: function() {
    this._isRecordsPageActive = false;
    if (this._loadDataTimer) {
      clearTimeout(this._loadDataTimer);
      this._loadDataTimer = null;
    }
    if (this._onShowLogTimer) {
      clearTimeout(this._onShowLogTimer);
      this._onShowLogTimer = null;
    }

    // 清理所有缓存数据
    this._cache = {
      processedRecords: null,
      filteredRecords: null,
      lastUpdateTime: 0
    };
    this._openedItemId = null;
    
    // 清理数据引用
    this.setData({
      studyRecords: [],
      filteredRecords: [],
      displayedRecords: [],
      wordbooks: {},
      movedX: {}
    });
    this._isExporting = false;
  },
  
  // 添加下拉刷新支持
  onPullDownRefresh: function() {
    // 重置所有缓存
    this._cache = {
      processedRecords: null,
      filteredRecords: null,
      lastUpdateTime: 0
    };
    this._openedItemId = null;
    
    // 重置滑动状态
    this.setData({ movedX: {} });
    
    try {
      // 重新加载数据
      this.loadData(true);
    } finally {
      // 确保下拉刷新动画一定会停止
      setTimeout(() => {
        wx.stopPullDownRefresh();
      }, 500);
    }
  },  
  
  // 页面上拉触底事件处理函数
  onReachBottom: function() {
    this.loadMore();
  },

  // 显示数据管理菜单
  showDataManagement: function() {
    wx.showActionSheet({
      itemList: ['清理30天前数据', '清理60天前数据', '清理90天前数据', '查看存储使用情况'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0:
            this.cleanupOldRecords(30);
            break;
          case 1:
            this.cleanupOldRecords(60);
            break;
          case 2:
            this.cleanupOldRecords(90);
            break;
          case 3:
            this.checkStorageUsage();
            break;
        }
      }
    });
  },

  // 清理旧记录
  cleanupOldRecords: function(days) {
    wx.showModal({
      title: '确认清理',
      content: `确定要清理${days}天前的学习记录吗？`,
      showCancel: true,
      cancelText: '取消',
      confirmText: '确定',
      success: (res) => {
        if (res.confirm) {
          const app = getApp();
          const result = app.cleanupOldData({
            days: days,
            types: ['learningRecords']
          });

          if (result.success) {
            wx.showToast({
              title: `成功清理${result.deletedCount}条记录`,
              icon: 'success',
              duration: 1500
            });
            // 重新加载数据
            this.loadData(true);
          } else {
            wx.showToast({
              title: '清理失败',
              icon: 'none',
              duration: 1500
            });
          }
        }
      }
    });
  },

  // 检查存储使用情况
  checkStorageUsage: function() {
    const app = getApp();
    app.checkStorageUsage().then(usageInfo => {
      wx.showModal({
        title: '存储使用情况',
        content: `当前使用: ${usageInfo.used}KB\n总容量: ${usageInfo.total}KB\n使用率: ${usageInfo.percent.toFixed(1)}%`,
        showCancel: false,
        confirmText: '知道了'
      });
    }).catch(error => {
      wx.showToast({
        title: '获取存储信息失败',
        icon: 'none',
        duration: 1500
      });
    });
  },

  // 按天合并学习记录
  mergeRecordsByDay: function(records) {
    try {
      console.log('开始按天合并学习记录，原始记录数:', records.length);
      
      // 按日期分组
      const recordsByDay = {};

      const getRecordTimestamp = (record) => {
        const raw = record && (record.timestamp || record.studyDate || record.learningDate || record.date);
        const ts = raw !== undefined && raw !== null ? new Date(raw).getTime() : 0;
        return isNaN(ts) ? Date.now() : ts;
      };

      const normalizeRecordWordId = (rawId) => {
        if (rawId === undefined || rawId === null) return '';

        let candidate = rawId;
        if (typeof rawId === 'object') {
          candidate = rawId.sourceWordId || rawId.id || rawId.word || '';
        }

        return String(candidate)
          .trim()
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .replace(/(_\d+)$/, '');
      };

      const addWordIdsFromList = (wordIds, wordIdSet, statusMap, statusValue) => {
        if (!Array.isArray(wordIds)) return;
        wordIds.forEach((wordId) => {
          const normalizedId = normalizeRecordWordId(wordId);
          if (!normalizedId) return;
          wordIdSet.add(normalizedId);
          if (statusValue) {
            statusMap[normalizedId] = statusValue;
          }
        });
      };

      const applyRecordWordStatus = (record, wordIdSet, statusMap) => {
        if (!record || typeof record !== 'object') return;

        addWordIdsFromList(this.getRecordWordIds(record), wordIdSet, statusMap, '');
        addWordIdsFromList(record.masteredWordIds, wordIdSet, statusMap, 'mastered');
        addWordIdsFromList(record.notMasteredWordIds, wordIdSet, statusMap, 'notMastered');
        addWordIdsFromList(record.difficultWordIds, wordIdSet, statusMap, 'notMastered');

        if (Array.isArray(record.studyWordsDetailed)) {
          record.studyWordsDetailed.forEach((item) => {
            if (!item || typeof item !== 'object') return;
            const normalizedId = normalizeRecordWordId(item);
            if (!normalizedId) return;

            wordIdSet.add(normalizedId);

            if (item.masteryStatus === 'mastered') {
              statusMap[normalizedId] = 'mastered';
            } else if (item.masteryStatus === 'notMastered' || item.masteryStatus === 'difficult') {
              statusMap[normalizedId] = 'notMastered';
            }
          });
        }
      };
      
      records.forEach(record => {
        // 获取日期字符串（YYYY-MM-DD格式）
        const dateStr = this.getDateString(record.timestamp || record.studyDate || Date.now());

        // 合并维度：同一天 + 同词书 + 同记录类型（单词记录/抗遗忘记录）
        const recordCategory = this.isAntiForgettingRecord(record) ? 'anti' : 'word';
        const wordbookKey = record.wordbookId || record.wordbookTitle || 'unknown_wordbook';
        const groupKey = `${dateStr}__${wordbookKey}__${recordCategory}`;

        if (!recordsByDay[groupKey]) {
          recordsByDay[groupKey] = {
            records: [],
            dateStr: dateStr,
            recordCategory: recordCategory,
            wordbookId: record.wordbookId,
            totalWords: 0,
            masteredCount: 0,
            notMasteredCount: 0,
            wordbooks: new Set(),
            earliestTimestamp: Infinity,
            latestTimestamp: 0
          };
        }
        
        // 添加到分组
        recordsByDay[groupKey].records.push(record);
        recordsByDay[groupKey].totalWords += Number(record.totalWords || record.wordCount || 0) || 0;
        recordsByDay[groupKey].wordbooks.add(record.wordbookTitle || '未知词书');

        // 更新时间戳范围
        const recordTimestamp = getRecordTimestamp(record);
        recordsByDay[groupKey].earliestTimestamp = Math.min(recordsByDay[groupKey].earliestTimestamp, recordTimestamp);
        recordsByDay[groupKey].latestTimestamp = Math.max(recordsByDay[groupKey].latestTimestamp, recordTimestamp);
      });
      
      console.log('按天分组结果:', recordsByDay);
      
      // 转换为合并记录
      const mergedRecords = [];
      
      for (const [groupKey, group] of Object.entries(recordsByDay)) {
        const sortedRecords = group.records.slice().sort((a, b) => getRecordTimestamp(a) - getRecordTimestamp(b));
        const mergedWordIdSet = new Set();
        const mergedStatusMap = {};

        sortedRecords.forEach((record) => {
          applyRecordWordStatus(record, mergedWordIdSet, mergedStatusMap);
        });

        let masteredCount = 0;
        let notMasteredCount = 0;
        Object.keys(mergedStatusMap).forEach((wordId) => {
          if (mergedStatusMap[wordId] === 'mastered') {
            masteredCount += 1;
          } else if (mergedStatusMap[wordId] === 'notMastered') {
            notMasteredCount += 1;
          }
        });

        const statusTotal = masteredCount + notMasteredCount;
        const computedTotalWords = mergedWordIdSet.size > 0
          ? mergedWordIdSet.size
          : (statusTotal > 0 ? statusTotal : group.totalWords);

        // 创建合并记录
        const mergedRecord = {
          id: `merged_${group.dateStr}_${group.wordbookId || 'wb'}_${group.recordCategory}_${Date.now()}`,
          studentId: sortedRecords[0] ? sortedRecords[0].studentId : undefined,
          wordbookId: group.wordbookId,
          wordbookTitle: Array.from(group.wordbooks).join('、'),
          recordCategory: group.recordCategory,
          recordType: group.recordCategory === 'anti' ? 'anti_forgetting_review' : 'learning',
          isAntiForgettingReview: group.recordCategory === 'anti',
          totalWords: computedTotalWords,
          masteredCount: masteredCount,
          notMasteredCount: notMasteredCount,
          timestamp: group.latestTimestamp,
          studyDate: new Date(group.latestTimestamp).toISOString(),
          formattedDate: this.formatDate(group.latestTimestamp),
          originalRecords: sortedRecords,
          isMerged: true,
          mergeDate: group.dateStr,
          recordCount: group.records.length
        };
        
        mergedRecords.push(mergedRecord);
      }
      
      console.log('合并后的记录数:', mergedRecords.length);
      return mergedRecords;
    } catch (error) {
      console.error('按天合并学习记录失败:', error);
      return records; // 失败时返回原始记录
    }
  },

  // 获取日期字符串（YYYY-MM-DD格式）
  getDateString: function(timestamp) {
    try {
      const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(Number(timestamp));
      if (isNaN(date.getTime())) {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      }
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    } catch (error) {
      console.error('获取日期字符串失败:', error);
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
  },

  // 从合并单词数据中选择单词
  getWordsFromMergedData: function(record) {
    try {
      console.log('从合并单词数据中选择单词:', record);
      
      const words = [];
      const wordSet = new Set();
      const count = record.totalWords || 3;
      
      // 获取合并单词数据
      const allWords = Object.values(wordMap);
      console.log('合并单词数据大小:', allWords.length);
      
      if (allWords.length === 0) {
        console.log('合并单词数据为空');
        return [];
      }
      
      // 使用记录的时间戳作为种子，确保每次选择相同的单词
      const seed = record.timestamp || record.studyDate || Date.now();
      console.log('使用的种子:', seed);
      
      // 基于种子生成稳定的索引序列
      for (let i = 0; i < count; i++) {
        // 生成稳定的索引
        const index = Math.abs((seed + i * 13) % allWords.length);
        const wordInfo = allWords[index];
        
        if (wordInfo && wordInfo.word) {
          const wordText = wordInfo.word.trim();
          
          // 去重
          if (!wordSet.has(wordText) && wordText) {
            wordSet.add(wordText);
            
            // 创建单词对象
            const wordObj = {
              id: `${wordText.toLowerCase().replace(/\s+/g, '_')}_${i}`,
              word: wordText,
              phonetic: wordInfo.phonetic || '',
              meaning: wordInfo.meaning || wordInfo.translation || '未知释义'
            };
            
            words.push(wordObj);
            console.log('添加合并数据中的单词:', wordObj);
          } else {
            console.log('单词重复或无效:', wordText);
          }
        }
      }
      
      console.log('从合并数据中选择的单词总数:', words.length);
      return words;
    } catch (error) {
      console.error('从合并数据中选择单词失败:', error);
      return [];
    }
  }
});
