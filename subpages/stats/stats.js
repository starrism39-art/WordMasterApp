// pages/stats/stats.js
const loginService = require('../../utils/login-service.js');
const cloudMigration = require('../../utils/cloud-migration.js');

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
    currentWordbookName: '',
    studyRecords: [],
    students: []
  },

  // 事件监听器引用（用于卸载时移除）
  _handlers: null,
  _refreshTimer: null,
  _lastRefreshAt: 0,
  
  onLoad: function() {
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
      this.setData({ loading: true });
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
        pullPromise = cloudMigration.syncDataFromCloud(openid).then(function(res) {
          console.log('【验证】云端拉取成功, 结果:', JSON.stringify(res));
        }).catch(function(err) {
          console.log('【验证】云端拉取失败（降级使用本地数据）:', err && err.message);
        });
      } else {
        console.log('【验证】openid 为空 → 跳过云端拉取');
      }
      pullPromise.then(function() {
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

  onHide: function() {
    // 页面隐藏不移除监听，保证返回时仍然实时；卸载时再移除
  },

  // 当页面卸载（退出）时，必须清理全局监听，防止内存泄漏！
  onUnload: function() {
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

        if (this._refreshTimer) clearTimeout(this._refreshTimer);
        this._refreshTimer = setTimeout(() => {
          this._lastRefreshAt = Date.now();
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
      const currentStudent = app.globalData.currentStudent || wx.getStorageSync('currentStudent');
      
      // 如果有当前学生，获取该学生的学习记录
      if (currentStudent && currentStudent.id) {
        realStudyRecords = app.getLearningRecords(currentStudent.id);
      } else {
        // 否则获取所有学习记录
        realStudyRecords = app.getLearningRecords();
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
      const currentStudent = app.globalData.currentStudent || wx.getStorageSync('currentStudent');

      let currentWordbook = app.globalData.currentWordbook || app.globalData.selectedWordbook || null;
      if (!currentWordbook) {
        currentWordbook = wx.getStorageSync('selectedWordbook') || null;
      }

      // 仍然没有词书时，从 wordMastery 推断数据最多的词书（跨设备首次进入）
      if ((!currentWordbook || !currentWordbook.id) && currentStudent && currentStudent.id) {
        try {
          var _sm2 = (wx.getStorageSync('wordMastery') || {})[currentStudent.id];
          if (_sm2) {
            var _bestId2 = null, _bestCnt2 = 0, _k2;
            for (_k2 in _sm2) {
              if (_sm2.hasOwnProperty && !_sm2.hasOwnProperty(_k2)) continue;
              var _c2 = Object.keys(_sm2[_k2] || {}).length;
              if (_c2 > _bestCnt2) { _bestCnt2 = _c2; _bestId2 = _k2; }
            }
            if (_bestId2) {
              var _inf2 = { id: _bestId2, title: _bestId2.replace(/_/g, ' ') };
              try { var _wb2 = require('../../data/wordbooks.js'); if (_wb2 && _wb2.getBookById) { var _full2 = _wb2.getBookById(_bestId2); if (_full2 && _full2.totalWords) { _inf2 = _full2; } } } catch(e) {}
              currentWordbook = _inf2;
              wx.setStorageSync('selectedWordbook', _inf2);
              console.log('[stats] 从 wordMastery 恢复词书:', _bestId2);
            }
          }
        } catch(e) { console.warn('[stats] 推断词书失败:', e); }
      }

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

      const normalizeBoolean = (value) => {
        if (value === true || value === false) return value;
        if (value === 1) return true;
        if (value === 0) return false;
        if (typeof value === 'string') {
          const normalized = value.trim().toLowerCase();
          if (normalized === 'true') return true;
          if (normalized === 'false') return false;
          if (normalized === '1') return true;
          if (normalized === '0') return false;
        }
        return null;
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
        if (currentWordbook && currentWordbook.id && record.wordbookId && record.wordbookId !== currentWordbook.id) {
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

        // ★ P0修复：检测当前词书是否使用前缀式wordId，用于跨词书安全隔离
        const wordbookId = currentWordbook.id;
        const hasPrefix = wordbookId && wordbookId.includes('_');
        const prefix = hasPrefix ? (wordbookId + '_') : '';

        // ★ 向后兼容：检测当前词书中是否有任何单词已完成学习（isLearned === true）
        // 如果没有任何单词有 isLearned===true（历史数据），则不过滤，统计所有单词
        const allWordIds = Object.keys(wordbookMastery).filter(wid => {
          if (prefix && !String(wid).startsWith(prefix)) return false;
          return wordbookMastery[wid] && typeof wordbookMastery[wid] === 'object';
        });
        const hasAnyLearnedFlag = allWordIds.some(wid => {
          const r = wordbookMastery[wid];
          return r && r.isLearned === true;
        });

        Object.keys(wordbookMastery).forEach(wordId => {
          const wordRecord = wordbookMastery[wordId];
          if (!wordRecord || typeof wordRecord !== 'object') return;

          // ★ 安全隔离：带前缀的词书只统计属于当前词书的单词；老词书（无前缀）全取
          if (prefix && !String(wordId).startsWith(prefix)) return;

          // ★ 向后兼容：仅当词书中存在 isLearned 标记时才过滤
          // 历史数据（无 isLearned 字段）全部参与统计
          if (hasAnyLearnedFlag && wordRecord.isLearned !== true) return;

          const masteredValue = normalizeBoolean(wordRecord.mastered);
          const difficultValue = normalizeBoolean(wordRecord.difficult);
          const isMastered = masteredValue === true;
          const isDifficult = difficultValue === true;
          // ★ P0修复：未掌握判定严格以 difficult===true 为准
          const isUnmastered = isDifficult;

          if (isMastered || isDifficult) {
            totalLearnedWords++;
          }

          if (isUnmastered) {
            totalUnmasteredWords++;
          }
        });

        learnedWords = totalLearnedWords;
        reviewWords = todayNewWords;

        // 后备：若当前词书没有 mastery 记录，尝试从 learningRecords 恢复已学/未掌握
        if (totalLearnedWords === 0) {
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
              if (!record || record.wordbookId !== currentWordbook.id) return;
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

      // 手动修正（词书级）= 手动值 + max(0, 当前计算 - base)
      if (currentStudent && currentStudent.id && currentWordbook && currentWordbook.id) {
        const overrideKey = `wordbook_stats_${currentStudent.id}_${currentWordbook.id}`;
        const override = wx.getStorageSync(overrideKey) || null;
        if (override && override.isManualOverride) {
          const manualLearned = Number(
            override.manualMasteredCount ?? override.masteredCount ?? totalLearnedWords
          );
          const manualUnmastered = Number(
            override.manualNotMasteredCount ?? override.notMasteredCount ?? totalUnmasteredWords
          );
          const baseLearned = Number(override.baseMasteredCount);
          const baseUnmastered = Number(override.baseNotMasteredCount);
          const hasBase = Number.isFinite(baseLearned) && Number.isFinite(baseUnmastered);

          if (hasBase) {
            totalLearnedWords = manualLearned + Math.max(0, totalLearnedWords - baseLearned);
            totalUnmasteredWords = manualUnmastered + Math.max(0, totalUnmasteredWords - baseUnmastered);
          } else {
            totalLearnedWords = Math.max(manualLearned, totalLearnedWords);
            totalUnmasteredWords = Math.max(manualUnmastered, totalUnmasteredWords);
          }

          learnedWords = totalLearnedWords;
          console.log('[stats] 应用词书手动修正:', {
            studentId: currentStudent.id,
            wordbookId: currentWordbook.id,
            manualLearned,
            manualUnmastered,
            baseLearned: baseLearned,
            baseUnmastered: baseUnmastered,
            finalLearned: totalLearnedWords,
            finalUnmastered: totalUnmasteredWords
          });
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
        currentWordbookName: '暂无词书',
        totalUnmasteredWords: 0,
        learningStats: {
          totalWords: 100,
          learnedWords: 20,
          reviewWords: 6,
          progressPercent: 20,
          progressBarPercent: 20,
          totalLearnedWords: 20,
          newWords: 6,
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