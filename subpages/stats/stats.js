// pages/stats/stats.js
const loginService = require('../../utils/login-service.js');
const cloudMigration = require('../../utils/cloud-migration.js');
const { getWordbookMasterySummary } = require('../../utils/learning-progress.js');
const { resolveCurrentStudent, resolveCurrentWordbook } = require('../../utils/learning-context.js');
const { getWordbookStats } = require('../../utils/stats-engine.js');

Page({
  data: {
    currentUser: null,
    loading: true,
    hasError: false,
    errorMessage: '',
    totalUnmasteredWords: 0,
    learningStats: {
      totalWords: 0,
      learnedWords: 0,
      reviewWords: 0,
      progressPercent: 0,
      totalLearnedWords: 0,  // 词书已学：对勾+错叉的总和
      newWords: 0,           // 已学新词：当日未掌握去重
      totalUnmasteredWords: 0 // 未掌握词数：历史累计当前未掌握
    },
    currentStudentName: '',
    currentWordbookId: '',
    currentWordbookName: '',
    studyRecords: [],
    students: []
  },

  // 事件监听器引用（用于卸载时移除）
  _handlers: null,
  _refreshTimer: null,
  _lastRefreshAt: 0,
  _isStatsPageActive: false,
  _statsShowGeneration: 0,
  _hasHandledInitialShow: false,
  _refreshScheduledShowGeneration: 0,
  _refreshCompletedShowGeneration: 0,
  
  onLoad: function() {
    this._isStatsPageActive = true;
    this._statsShowGeneration = 0;
    this._hasHandledInitialShow = false;
    this._refreshScheduledShowGeneration = 0;
    this._refreshCompletedShowGeneration = 0;
    try {
      // 检查登录状态，未登录无 openid 时静默登录
      const openid = wx.getStorageSync('openid');
      if (!openid) {
        // 静默登录
        const loginService = require('../../utils/login-service.js');
        loginService.doSilentLogin().catch(function(err) {
          console.warn('[stats] 静默登录失败，以游客模式查看:', err);
        });
      }

      const app = getApp();
      
      this.setData({ loading: true });
      
      // 确保应用实例存在
      if (!app || !app.globalData) {
        console.error('应用实例不存在');
        this.setData({
          loading: false,
          hasError: true,
          errorMessage: '应用初始化失败'
        });
        return;
      }
      
      // 仅保留当前缓存数据用于页面展示，不再作为门禁条件
      this.setData({
        currentUser: app.globalData.currentUser || wx.getStorageSync('currentUser')
      });
      this.syncCurrentContext();
      
      // 注册全局事件监听，实现实时刷新
      this.registerRealtimeListeners();

      this.loadAndCalculateStats();
    } catch (error) {
      console.error('统计页面加载失败:', error);
      this.setData({
        loading: false,
        hasError: true,
        errorMessage: '页面加载失败'
      });
    }
  },
  
  onShow: function() {
    try {
      const isInitialShow = !this._hasHandledInitialShow;
      const showGeneration = this._statsShowGeneration + 1;
      this._hasHandledInitialShow = true;
      this._statsShowGeneration = showGeneration;
      if (this._refreshTimer) {
        // 已排队的事件刷新会读取执行时的当前上下文，可承担这一轮最终刷新。
        this._refreshScheduledShowGeneration = showGeneration;
      }
      if (!isInitialShow) {
        this.setData({ loading: true });
      }
      const app = getApp();

      // 检查登录状态，未登录时静默登录
      const openid = wx.getStorageSync('openid');
      if (!openid) {
        loginService.doSilentLogin().catch(function(err) {
          console.warn('[stats] 静默登录失败，以游客模式查看:', err);
        });
      }

      // 确保应用实例存在
      if (!app) {
        console.error('应用实例不存在');
        this.setData({
          loading: false,
          hasError: true,
          errorMessage: '应用初始化失败'
        });
        return;
      }
      
      // 更新当前缓存信息，仅用于展示
      this.setData({
        currentUser: app.globalData.currentUser || wx.getStorageSync('currentUser')
      });
      this.syncCurrentContext();
      
      // 重新加载学生数据
      try {
        const students = wx.getStorageSync('students') || [];
        this.setData({ students });
        
        // 不再自动创建测试学生
      } catch (e) {
        console.error('加载学生数据失败:', e);
      }
      
      // 确保注册监听（防止热重载/异常导致未注册）
      this.registerRealtimeListeners();

      // ====== 【验证】云端同步测试 ======
      var self = this;
      var pullPromise = Promise.resolve();
      console.log('========== 验证信息 ==========');
      console.log('【验证】openid 是否存在:', !!openid);
      if (openid) {
        console.log('【验证】即将调用 syncDataFromCloud...');
        pullPromise = cloudMigration.syncDataFromCloud(openid, { allowFreshness: true }).then(function(res) {
          console.log('【验证】云端拉取成功, 结果:', JSON.stringify(res));
        }).catch(function(err) {
          console.log('【验证】云端拉取失败（降级使用本地数据）:', err && err.message);
        });
      } else {
        console.log('【验证】openid 为空 → 跳过云端拉取');
      }
      pullPromise.then(function() {
        if (!self._isStatsPageActive || self._statsShowGeneration !== showGeneration) {
          return;
        }

        const eventRefreshOwnsCompletion = (
          self._refreshScheduledShowGeneration === showGeneration ||
          self._refreshCompletedShowGeneration === showGeneration
        );
        if (eventRefreshOwnsCompletion || isInitialShow) {
          console.log('========== 验证结束 ==========');
          return;
        }

        self.loadAndCalculateStats();
        console.log('========== 验证结束 ==========');
      });
    } catch (error) {
      console.error('统计页面显示时出错:', error);
      this.setData({
        loading: false,
        hasError: true,
        errorMessage: '页面加载失败'
      });
    }
  },

  syncCurrentContext: function() {
    const app = getApp();
    const currentStudent = resolveCurrentStudent(app);
    const currentWordbook = resolveCurrentWordbook(app, currentStudent);
    this.setData({
      currentStudentName: currentStudent ? (currentStudent.name || currentStudent.id || '当前学生') : '',
      currentWordbookId: currentWordbook ? String(currentWordbook.id) : '',
      currentWordbookName: currentWordbook
        ? (currentWordbook.title || currentWordbook.name || '未命名词书')
        : '暂无词书'
    });
    return { currentStudent, currentWordbook };
  },

  onHide: function() {
    // 页面隐藏不移除监听，保证返回时仍然实时；卸载时再移除
  },

  // 当页面卸载（退出）时，必须清理全局监听，防止内存泄漏！
  onUnload: function() {
    this._isStatsPageActive = false;
    this._statsShowGeneration += 1;
    this.unregisterRealtimeListeners();
    if (this._refreshTimer) {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = null;
    }
  },

  // 注册实时刷新事件
  registerRealtimeListeners: function() {
    try {
      const app = getApp();
      if (!app || !app.on) return;

      // 防止重复注册
      if (this._handlers) return;

      const scheduleRefresh = (reason) => {
        // 简单防抖：短时间内多次事件只刷新一次
        const now = Date.now();
        const minIntervalMs = 200;
        const delay = now - this._lastRefreshAt < minIntervalMs ? minIntervalMs : 0;
        const showGeneration = this._statsShowGeneration;

        if (this._refreshTimer) clearTimeout(this._refreshTimer);
        this._refreshScheduledShowGeneration = showGeneration;
        this._refreshTimer = setTimeout(() => {
          this._refreshTimer = null;
          if (!this._isStatsPageActive) return;
          this._lastRefreshAt = Date.now();
          this._refreshCompletedShowGeneration = this._statsShowGeneration;
          console.log('统计页实时刷新，原因:', reason);
          this.loadAndCalculateStats();
        }, delay);
      };

      this._handlers = {
        learningRecordAdded: () => scheduleRefresh('learningRecordAdded'),
        learningRecordDeleted: () => scheduleRefresh('learningRecordDeleted'),
        wordMasteryUpdated: () => scheduleRefresh('wordMasteryUpdated'),
        // 学生/词书切换时也刷新（如果其他页面有发这些事件）
        currentStudentChanged: () => scheduleRefresh('currentStudentChanged'),
        currentWordbookChanged: () => scheduleRefresh('currentWordbookChanged')
      };

      app.on('learningRecordAdded', this._handlers.learningRecordAdded);
      app.on('learningRecordDeleted', this._handlers.learningRecordDeleted);
      app.on('wordMasteryUpdated', this._handlers.wordMasteryUpdated);
      app.on('currentStudentChanged', this._handlers.currentStudentChanged);
      app.on('currentWordbookChanged', this._handlers.currentWordbookChanged);
    } catch (e) {
      console.error('注册统计页实时监听失败:', e);
    }
  },

  // 新增：安全卸载监听器的方法
  unregisterRealtimeListeners: function() {
    try {
      const app = getApp();
      if (!app || !app.off || !this._handlers) return;

      app.off('learningRecordAdded', this._handlers.learningRecordAdded);
      app.off('learningRecordDeleted', this._handlers.learningRecordDeleted);
      app.off('wordMasteryUpdated', this._handlers.wordMasteryUpdated);
      app.off('currentStudentChanged', this._handlers.currentStudentChanged);
      app.off('currentWordbookChanged', this._handlers.currentWordbookChanged);

      // 清空引用
      this._handlers = null;
    } catch (e) {
      console.error('卸载统计页实时监听失败:', e);
    }
  },
  
  // 统一读取并计算统计（用于onLoad/onShow/事件回调）
  loadAndCalculateStats: function() {
    try {
      this.setData({ loading: true });

      // 尝试使用app实例获取学习记录数据，与应用其他部分保持一致
      const app = getApp();
      let realStudyRecords = [];
      
      // 获取当前学生信息
      const { currentStudent, currentWordbook } = this.syncCurrentContext();
      
      // 如果有当前学生，获取该学生的学习记录
      if (currentStudent && currentStudent.id && currentWordbook && currentWordbook.id) {
        realStudyRecords = app.getLearningRecords(currentStudent.id, currentWordbook.id);
      }
      
      // 无论记录是否为空，都刷新统计（统计口径依赖wordMastery/learningProgress）
      this.setData({
        studyRecords: Array.isArray(realStudyRecords) ? realStudyRecords : [],
        loading: false,
        hasError: false,
        errorMessage: ''
      });

      this.updateLearningStats(Array.isArray(realStudyRecords) ? realStudyRecords : []);
      
    } catch (error) {
      console.error('加载学习数据失败:', error);
      
      // 发生错误时，显示空状态而不是模拟数据
      this.setData({
        studyRecords: [],
        totalUnmasteredWords: 0,
        learningStats: {
          totalWords: 0,
          learnedWords: 0,
          reviewWords: 0,
          progressPercent: 0,
          totalLearnedWords: 0,
          newWords: 0,
          totalUnmasteredWords: 0
        },
        dailyStats: [],
        chartData: null,
        loading: false,
        hasError: true,
        errorMessage: '数据加载失败'
      });
    }
  },

  // 兼容旧调用
  loadStudyData: function() {
    this.loadAndCalculateStats();
  },
  

  
  // 更新学习统计
  updateLearningStats: function(records) {
    try {
      if (!Array.isArray(records)) {
        records = [];
      }
      
      const app = getApp();
      const currentStudent = resolveCurrentStudent(app);
      const currentWordbook = resolveCurrentWordbook(app, currentStudent);

      const currentWordbookName = currentWordbook
        ? (currentWordbook.title || currentWordbook.name || '暂无词书')
        : '暂无词书';

      // 没有词书时，回退使用 stats_ 缓存
      if ((!currentWordbook || !currentWordbook.id) && currentStudent && currentStudent.id) {
        const statsCacheKey = 'stats_' + currentStudent.id;
        const cachedStats = wx.getStorageSync(statsCacheKey) || null;
        if (cachedStats && typeof cachedStats.masteredCount === 'number') {
          this.setData({
            currentWordbookName,
            totalUnmasteredWords: cachedStats.notMasteredCount || 0,
            learningStats: {
              totalWords: 0,
              learnedWords: cachedStats.masteredCount || 0,
              reviewWords: 0,
              progressPercent: 0,
              progressBarPercent: 0,
              totalLearnedWords: cachedStats.masteredCount || 0,
              newWords: 0,
              totalUnmasteredWords: cachedStats.notMasteredCount || 0
            }
          });
          console.log('[stats] 使用 stats_ 缓存:', cachedStats, '手动修正:', !!cachedStats.isManualOverride);
          return;
        }
      }

      // 统计口径：当前学生 + 当前词书（不跨词书汇总）
      let totalWords = 0;
      let learnedWords = 0;
      let totalLearnedWords = 0; // 词书已学：mastered + difficult
      let todayNewWords = 0;     // 已学新词：当日未掌握去重
      let totalUnmasteredWords = 0; // 未掌握词数：当前词书未掌握总量
      let reviewWords = 0;

      const wordMastery = wx.getStorageSync('wordMastery') || {};
      const learningProgress = wx.getStorageSync('learningProgress') || {};

      const normalizeWordIdForStats = (rawId) => {
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

      const getLocalDateKey = (value) => {
        const date = value !== undefined && value !== null ? new Date(value) : new Date();
        if (isNaN(date.getTime())) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const addWordIdsToSet = (wordIds, targetSet) => {
        if (!Array.isArray(wordIds)) return;
        wordIds.forEach((wordId) => {
          const normalizedId = normalizeWordIdForStats(wordId);
          if (normalizedId) {
            targetSet.add(normalizedId);
          }
        });
      };

      const normalizeStatusToken = (statusValue) => {
        if (statusValue === undefined || statusValue === null) return '';
        return String(statusValue).trim().toLowerCase().replace(/[^a-z]/g, '');
      };

      const isUnmasteredStatus = (statusValue) => {
        const token = normalizeStatusToken(statusValue);
        return token === 'notmastered' || token === 'unmastered' || token === 'difficult';
      };

      // 新口径：已学新词=今天在预习/学习中被标记为“未掌握/不认识”的去重单词数
      const todayKey = getLocalDateKey(Date.now());
      const todayRecords = (records || []).filter((record) => {
        if (!record || typeof record !== 'object') return false;

        // 仅统计学习记录，不统计抗遗忘复习回写记录
        const isAntiForgettingRecord =
          record.recordType === 'anti_forgetting_review' ||
          record.isAntiForgettingReview === true;
        if (isAntiForgettingRecord) return false;

        // 仅统计当前词书口径
        if (currentWordbook && currentWordbook.id && String(record.wordbookId || '') !== String(currentWordbook.id)) {
          return false;
        }

        const recordTime = record.timestamp || record.studyDate || record.learningDate || record.date;
        return getLocalDateKey(recordTime) === todayKey;
      });

      const todayNotMasteredWordIdSet = new Set();
      todayRecords.forEach((record) => {
        addWordIdsToSet(record.notMasteredWordIds, todayNotMasteredWordIdSet);
        addWordIdsToSet(record.difficultWordIds, todayNotMasteredWordIdSet);

        // 兼容业务中以详细快照记录未掌握状态的场景
        if (Array.isArray(record.studyWordsDetailed)) {
          record.studyWordsDetailed.forEach((item) => {
            if (!item || typeof item !== 'object') return;
            if (item.masteryStatus === 'notMastered' || item.masteryStatus === 'difficult') {
              const normalizedId = normalizeWordIdForStats(item);
              if (normalizedId) {
                todayNotMasteredWordIdSet.add(normalizedId);
              }
            }
          });
        }
      });
      todayNewWords = todayNotMasteredWordIdSet.size;

      if (currentStudent && currentStudent.id && currentWordbook && currentWordbook.id) {
        totalWords =
          currentWordbook.totalWords ||
          (Array.isArray(currentWordbook.words) ? currentWordbook.words.length : 0) ||
          0;

        const studentMastery = wordMastery[currentStudent.id] || {};
        const wordbookMastery = studentMastery[currentWordbook.id] || {};
        const masterySummary = getWordbookMasterySummary(currentWordbook.id, wordbookMastery);
        const override = wx.getStorageSync(`wordbook_stats_${currentStudent.id}_${currentWordbook.id}`) || null;
        const sharedStats = getWordbookStats(currentStudent.id, currentWordbook.id);
        totalLearnedWords = sharedStats.masteredCount;
        totalUnmasteredWords = sharedStats.notMasteredCount;

        learnedWords = totalLearnedWords;
        reviewWords = todayNewWords;

        // 后备：若当前词书没有 mastery 记录，尝试从 learningRecords 恢复已学/未掌握
        if (masterySummary.entryCount === 0 && !(override && override.isManualOverride)) {
          const studentProgress = learningProgress[currentStudent.id] || {};
          const studentWordbooksProgress = studentProgress.wordbooks || {};
          const bookProgress = studentWordbooksProgress[currentWordbook.id] || {};
          learnedWords = bookProgress.completedCount || bookProgress.learnedWords || 0;
          totalLearnedWords = learnedWords;
          reviewWords = bookProgress.reviewWords || 0;
          if (totalWords === 0) {
            totalWords = bookProgress.totalCount || 0;
          }

          // ★ P0修复：从学习记录中恢复未掌握词数
          if (totalUnmasteredWords === 0 && Array.isArray(records)) {
            const unmasteredSet = new Set();
            records.forEach(record => {
              if (!record || String(record.wordbookId || '') !== String(currentWordbook.id)) return;
              if (record.isAntiForgettingReview || record.recordType === 'anti_forgetting_review') return;
              if (Array.isArray(record.notMasteredWordIds)) {
                record.notMasteredWordIds.forEach(id => { if (id) unmasteredSet.add(String(id)); });
              }
              if (Array.isArray(record.studyWordsDetailed)) {
                record.studyWordsDetailed.forEach(item => {
                  if (item && (item.masteryStatus === 'notMastered' || item.masteryStatus === 'difficult')) {
                    unmasteredSet.add(String(item.id || item.sourceWordId || ''));
                  }
                });
              }
            });
            totalUnmasteredWords = unmasteredSet.size;
          }
        }
      }

      console.log('详细统计（学生+词书）:', {
        studentId: currentStudent && currentStudent.id,
        wordbookId: currentWordbook && currentWordbook.id,
        totalWords,
        totalLearnedWords,
        todayNewWords,
        totalUnmasteredWords,
        reviewWords
      });

      const rawProgressPercent = totalWords > 0 ? (totalLearnedWords / totalWords) * 100 : 0;
      const progressPercent = Number(rawProgressPercent.toFixed(2));
      const clampedProgressPercent = Math.max(0, Math.min(progressPercent, 100));
      // 进度非常小时给一条最小可见宽度，避免看起来像“没有进度”
      const progressBarPercent = clampedProgressPercent > 0 ? Math.max(clampedProgressPercent, 0.6) : 0;
      
      this.setData({
        currentStudentName: currentStudent ? (currentStudent.name || currentStudent.id || '当前学生') : '',
        currentWordbookId: currentWordbook ? String(currentWordbook.id) : '',
        currentWordbookName,
        totalUnmasteredWords,
        learningStats: {
          totalWords,
          learnedWords: totalLearnedWords,  // 统一使用词书已学的数据
          reviewWords,
          progressPercent: clampedProgressPercent,
          progressBarPercent,
          totalLearnedWords,  // 词书已学：对勾+错叉的总和
          newWords: todayNewWords, // 已学新词：当日未掌握去重
          totalUnmasteredWords
        }
      });
      
      console.log('统一后的数据:', {
        totalLearnedWords,
        totalUnmasteredWords,
        todayNewWords,
        progressPercent: clampedProgressPercent,
        progressBarPercent,
        totalWords
      });
    } catch (error) {
      console.error('更新学习统计失败:', error);
      // 使用默认值
      this.setData({
        totalUnmasteredWords: 0,
        learningStats: {
          totalWords: 0,
          learnedWords: 0,
          reviewWords: 0,
          progressPercent: 0,
          progressBarPercent: 0,
          totalLearnedWords: 0,
          newWords: 0,
          totalUnmasteredWords: 0
        }
      });
    }
  },

  
  

  

  

  
  // 格式化学习时间
  formatStudyTime: function(seconds) {
    // 添加参数验证
    seconds = Number(seconds) || 0;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟${remainingSeconds}秒`;
    } else {
      return `${remainingSeconds}秒`;
    }
  },





});
