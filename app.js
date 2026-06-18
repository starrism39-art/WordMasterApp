//app.js
// 引入Babel polyfill以解决编译错�?
require('./utils/babel-polyfill');

// 引入词书加载�?
const WordbookLoader = require('./data/wordbook-loader.js');

// 引入数据版本管理模块
const DataMigration = require('./utils/data-migration.js');

App({
  onLaunch: function () {
    try {
      // --- 云环境初始化（仅初始化，不自动调用云函数，由登录页手动触发） ---
      if (wx.cloud) {
        try {
          wx.cloud.init({
            env: 'cloudbase-4gafzdch60ad597b',
            traceUser: true
          });
          console.log('wx.cloud 已初始化 (traceUser: true)');
        } catch (e) {
          console.error('wx.cloud.init failed:', e);
        }
      } else {
        console.warn('当前基础库不支持 wx.cloud，请使用 2.2.3 或更高基库');
      }
      // --- 结束：云环境初始�?---
    } catch (initErr) {
      console.error("云环境初始化失败:", initErr);
    }

    // 初始化云开发环�?
    try {
      try {
        wx.setInnerAudioOption({
          obeyMuteSwitch: false
        });
        console.log('已设置全局音频选项: obeyMuteSwitch=false');
      } catch (audioOptionError) {
        console.error('设置全局音频选项失败:', audioOptionError);
      }

      // 【版本升级】首先检查数据版本，进行备份和迁�?
      const versionInfo = this.initializeVersion();
      if (versionInfo.upgraded) {
        console.log('version upgraded, data backed up and migrated');
        wx.showToast({
          title: '已备份升级前数据',
          duration: 2000
        });
      }
      
      // 初始化数据存�?
      this.initData();
      // 将历�?learningProgress 扁平键迁移为嵌套结构
      this.migrateLearningProgress();
      // 一次性洗刷历史新词统计缓存（按新口径重算�?
      const newWordsMigrationResult = this.migrateHistoricalNewWordsData();
      if (newWordsMigrationResult && newWordsMigrationResult.migrated) {
        console.log('历史新词统计迁移完成:', newWordsMigrationResult);
      }
      // 历史未掌握单词召回（补齐�?wordMastery，避免统计偏少）
      const historicalRecoverResult = this.recoverHistoricalUnmasteredWords({ force: true });
      if (historicalRecoverResult && historicalRecoverResult.migrated) {
        console.log('历史未掌握单词召回完�?', historicalRecoverResult);
      }
      // 清理历史遗留的模拟学生数据（小明/小红/小李�?
      this.normalizeStudentsStorage();
      // 初始化事件系�?
      this.initEventSystem();
      // 初始化词书加载器
      this.initWordbookLoader();
      // 启动阶段做静默检查，避免真机启动期弹�?重任务触�?timeout
      setTimeout(() => {
        this.checkStorageRegularly(true);
      }, 3000);
      
      // 从本地存储加载当前学生信�?
      try {
        const currentStudent = wx.getStorageSync('currentStudent');
        if (currentStudent) {
          this.globalData.currentStudent = currentStudent;
          console.log('从本地存储加载当前学生信�?', currentStudent);
        }
      } catch (error) {
        console.error('加载当前学生信息失败:', error);
      }
    } catch (error) {
      const errInfo = (error && typeof error === 'object')
        ? (error.message || error.errMsg || JSON.stringify(error))
        : String(error || 'unknown');
      console.error('初始化时出错:', errInfo);
      try {
        wx.showModal({ title: '启动失败', content: errInfo.slice(0, 200), showCancel: false });
      } catch (e) { /* ignore */ }
    }
  },

  onError: function (message) {
    const errMsg = (message && typeof message === 'object')
      ? (message.message || message.errMsg || JSON.stringify(message))
      : String(message || '');
    console.error('App onError:', errMsg);
    wx.showToast({ title: '启动异常: ' + errMsg.slice(0, 30), icon: 'none', duration: 3000 });
  },

  onUnhandledRejection: function (res) {
    const reason = res && res.reason ? res.reason : res;
    const msg = (reason && typeof reason === 'object')
      ? (reason.message || reason.errMsg || JSON.stringify(reason))
      : String(reason || '');
    console.error('App onUnhandledRejection:', msg);
    // 不弹窗，仅日志，避免打断用户体验
  },

  // 【新增】初始化数据版本，处理升级逻辑
  initializeVersion: function () {
    try {
      const versionResult = DataMigration.initializeDataVersion();
      console.log('数据版本初始化结�?', versionResult);
      return versionResult;
    } catch (error) {
      console.error('版本初始化失�?', error);
      return { error: true, message: error.message };
    }
  },

  // 初始化数�?
  initData: function () {
    try {
      // 初始化学生列�?
      if (!wx.getStorageSync('students')) {
        wx.setStorageSync('students', []);
      }
      
      // 初始化学习记�?
      if (!wx.getStorageSync('learningRecords')) {
        wx.setStorageSync('learningRecords', []);
      }
      
      // 初始化学习进度数�?
      if (!wx.getStorageSync('learningProgress')) {
        wx.setStorageSync('learningProgress', {});
      }
      
      // 初始化单词掌握状�?
      if (!wx.getStorageSync('wordMastery')) {
        wx.setStorageSync('wordMastery', {});
      }
      
      // 初始化完�?
    } catch (error) {
      console.error('初始化数据存储时出错:', error);
    }
  },

  // 迁移学习进度：扁平键 -> 嵌套结构 learningProgress[studentId].wordbooks[wordbookId]
  migrateLearningProgress: function() {
    try {
      const source = wx.getStorageSync('learningProgress') || {};
      if (!source || typeof source !== 'object' || Array.isArray(source)) {
        wx.setStorageSync('learningProgress', {});
        return { migrated: 0, normalized: true, reason: 'invalid_source' };
      }

      const normalizedProgress = {};
      const studentLevelKeys = new Set();
      let migratedFlatCount = 0;
      let normalizedChanged = false;

      const normalizeBookProgress = (bookProgress) => {
        const sourceBook = (bookProgress && typeof bookProgress === 'object' && !Array.isArray(bookProgress)) ? bookProgress : {};
        const completedCount = Number(sourceBook.completedCount || sourceBook.learnedWords || 0) || 0;
        const totalCount = Number(sourceBook.totalCount || 0) || 0;
        const lastStudyTime = sourceBook.lastStudyTime || sourceBook.lastStudied || '';

        return {
          ...sourceBook,
          completedCount,
          learnedWords: completedCount,
          totalCount,
          lastStudyTime,
          lastStudied: lastStudyTime
        };
      };

      const ensureStudentProgress = (studentId) => {
        if (!studentId) {
          return null;
        }

        if (!normalizedProgress[studentId] || typeof normalizedProgress[studentId] !== 'object' || Array.isArray(normalizedProgress[studentId])) {
          normalizedProgress[studentId] = {
            learnedWords: 0,
            totalWords: 0,
            wordbooks: {}
          };
        }

        if (!normalizedProgress[studentId].wordbooks || typeof normalizedProgress[studentId].wordbooks !== 'object' || Array.isArray(normalizedProgress[studentId].wordbooks)) {
          normalizedProgress[studentId].wordbooks = {};
        }

        normalizedProgress[studentId].learnedWords = Number(normalizedProgress[studentId].learnedWords || 0) || 0;
        normalizedProgress[studentId].totalWords = Number(normalizedProgress[studentId].totalWords || 0) || 0;
        return normalizedProgress[studentId];
      };

      // 第一轮：收集已有的嵌套结构与学生级数�?
      Object.keys(source).forEach((key) => {
        const value = source[key];
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          return;
        }

        const hasNestedWordbooks = value.wordbooks && typeof value.wordbooks === 'object' && !Array.isArray(value.wordbooks);
        const looksLikeFlatProgress =
          value.studentId !== undefined ||
          value.wordbookId !== undefined ||
          value.completedCount !== undefined ||
          value.totalCount !== undefined ||
          value.lastStudyTime !== undefined ||
          value.lastStudied !== undefined;

        if (hasNestedWordbooks || (!looksLikeFlatProgress && (value.learnedWords !== undefined || value.totalWords !== undefined))) {
          const studentId = String(key);
          const studentProgress = ensureStudentProgress(studentId);
          if (!studentProgress) {
            return;
          }

          studentLevelKeys.add(key);
          studentProgress.learnedWords = Number(value.learnedWords || 0) || 0;
          studentProgress.totalWords = Number(value.totalWords || 0) || 0;

          if (hasNestedWordbooks) {
            Object.keys(value.wordbooks).forEach((wordbookId) => {
              studentProgress.wordbooks[wordbookId] = normalizeBookProgress(value.wordbooks[wordbookId]);
            });
          }
        }
      });

      // 收集已知学生ID，帮助从历史扁平键中准确切分 studentId �?wordbookId
      const knownStudentIds = new Set(Object.keys(normalizedProgress));
      const students = wx.getStorageSync('students') || [];
      if (Array.isArray(students)) {
        students.forEach((student) => {
          if (student && student.id !== undefined && student.id !== null) {
            knownStudentIds.add(String(student.id));
          }
        });
      }
      const currentStudent = wx.getStorageSync('currentStudent') || this.globalData.currentStudent;
      if (currentStudent && currentStudent.id !== undefined && currentStudent.id !== null) {
        knownStudentIds.add(String(currentStudent.id));
      }
      const sortedKnownStudentIds = Array.from(knownStudentIds).sort((a, b) => b.length - a.length);

      // 第二轮：迁移历史扁平�?
      Object.keys(source).forEach((key) => {
        const value = source[key];
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          return;
        }

        if (studentLevelKeys.has(key)) {
          return;
        }

        const hasNestedWordbooks = value.wordbooks && typeof value.wordbooks === 'object' && !Array.isArray(value.wordbooks);
        if (hasNestedWordbooks) {
          return;
        }

        let studentId = value.studentId ? String(value.studentId) : '';
        let wordbookId = value.wordbookId ? String(value.wordbookId) : '';

        if ((!studentId || !wordbookId) && key.includes('_')) {
          const matchedStudentId = sortedKnownStudentIds.find((id) => key.startsWith(`${id}_`));
          if (matchedStudentId) {
            studentId = matchedStudentId;
            wordbookId = key.slice(matchedStudentId.length + 1);
          }
        }

        // 最后兜底：按首个下划线切分
        if ((!studentId || !wordbookId) && key.includes('_')) {
          const separatorIndex = key.indexOf('_');
          if (separatorIndex > 0 && separatorIndex < key.length - 1) {
            studentId = key.slice(0, separatorIndex);
            wordbookId = key.slice(separatorIndex + 1);
          }
        }

        if (!studentId || !wordbookId) {
          return;
        }

        const studentProgress = ensureStudentProgress(studentId);
        if (!studentProgress) {
          return;
        }

        const incomingBook = normalizeBookProgress(value);
        const existingBook = studentProgress.wordbooks[wordbookId] || {};
        const mergedCompletedCount = Math.max(
          Number(existingBook.completedCount || existingBook.learnedWords || 0) || 0,
          Number(incomingBook.completedCount || incomingBook.learnedWords || 0) || 0
        );
        const mergedTotalCount = Math.max(
          Number(existingBook.totalCount || 0) || 0,
          Number(incomingBook.totalCount || 0) || 0
        );
        const mergedLastStudyTime =
          incomingBook.lastStudyTime ||
          incomingBook.lastStudied ||
          existingBook.lastStudyTime ||
          existingBook.lastStudied ||
          '';

        studentProgress.wordbooks[wordbookId] = {
          ...existingBook,
          ...incomingBook,
          completedCount: mergedCompletedCount,
          learnedWords: mergedCompletedCount,
          totalCount: mergedTotalCount,
          lastStudyTime: mergedLastStudyTime,
          lastStudied: mergedLastStudyTime
        };

        migratedFlatCount += 1;
      });

      // 统一学生级统计字�?
      Object.keys(normalizedProgress).forEach((studentId) => {
        const studentProgress = ensureStudentProgress(studentId);
        if (!studentProgress) {
          return;
        }

        let summedLearnedWords = 0;
        let summedTotalWords = 0;

        Object.keys(studentProgress.wordbooks).forEach((wordbookId) => {
          const normalizedBook = normalizeBookProgress(studentProgress.wordbooks[wordbookId]);
          studentProgress.wordbooks[wordbookId] = normalizedBook;
          summedLearnedWords += Number(normalizedBook.learnedWords || normalizedBook.completedCount || 0) || 0;
          summedTotalWords += Number(normalizedBook.totalCount || 0) || 0;
        });

        studentProgress.learnedWords = summedLearnedWords;
        studentProgress.totalWords = Math.max(Number(studentProgress.totalWords || 0) || 0, summedTotalWords);
      });

      const sourceKeys = Object.keys(source);
      const normalizedKeys = Object.keys(normalizedProgress);
      const hasFlatKeys = sourceKeys.some((key) => {
        if (studentLevelKeys.has(key)) {
          return false;
        }
        const value = source[key];
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          return false;
        }
        return !(value.wordbooks && typeof value.wordbooks === 'object' && !Array.isArray(value.wordbooks));
      });

      normalizedChanged = migratedFlatCount > 0 || hasFlatKeys || sourceKeys.length !== normalizedKeys.length;
      if (normalizedChanged) {
        wx.setStorageSync('learningProgress', normalizedProgress);
        console.log('learningProgress 迁移完成:', {
          migratedFlatCount,
          studentCount: normalizedKeys.length
        });
      }

      return {
        migrated: migratedFlatCount,
        normalized: normalizedChanged,
        studentCount: normalizedKeys.length
      };
    } catch (error) {
      console.error('迁移 learningProgress 失败:', error);
      return { migrated: 0, normalized: false, reason: 'error', error: error.message };
    }
  },

  // 一次性迁移历史“已学新词”缓存：�?learningRecords 重算每天 newWords
  migrateHistoricalNewWordsData: function(options) {
    try {
      const opts = options || {};
      const force = !!opts.force;
      const migrationVersion = 'historical_new_words_v1';
      const migrationFlagKey = 'migration_historical_new_words_v1_done';
      const migrationBackupKey = 'migration_historical_new_words_v1_backup';

      if (!force) {
        const doneInfo = wx.getStorageSync(migrationFlagKey);
        if (doneInfo && doneInfo.version === migrationVersion) {
          return {
            migrated: false,
            skipped: true,
            reason: 'already_done',
            version: migrationVersion,
            doneAt: doneInfo.timestamp || ''
          };
        }
      }

      const learningRecords = wx.getStorageSync('learningRecords') || [];
      if (!Array.isArray(learningRecords)) {
        wx.setStorageSync(migrationFlagKey, {
          version: migrationVersion,
          timestamp: new Date().toISOString(),
          scannedRecords: 0,
          migratedGroups: 0
        });
        return {
          migrated: true,
          skipped: false,
          version: migrationVersion,
          scannedRecords: 0,
          migratedGroups: 0,
          note: 'learningRecords_not_array'
        };
      }

      const normalizeWordIdForStats = function(rawId) {
        if (rawId === undefined || rawId === null) {
          return '';
        }

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

      const getLocalDateKey = function(value) {
        const date = (value !== undefined && value !== null) ? new Date(value) : new Date();
        if (isNaN(date.getTime())) {
          return '';
        }
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const appendWordIds = function(wordIds, targetSet) {
        if (!Array.isArray(wordIds)) {
          return;
        }
        wordIds.forEach(function(wordId) {
          const normalizedId = normalizeWordIdForStats(wordId);
          if (normalizedId) {
            targetSet.add(normalizedId);
          }
        });
      };

      const groupedByStudentBookDate = {};
      let scannedRecords = 0;

      learningRecords.forEach(function(record) {
        if (!record || typeof record !== 'object') {
          return;
        }

        // 仅统计预�?学习记录，不统计抗遗忘复习回写记�?
        const isAntiForgettingRecord =
          record.recordType === 'anti_forgetting_review' ||
          record.isAntiForgettingReview === true;
        if (isAntiForgettingRecord) {
          return;
        }

        const studentId = String(record.studentId || '').trim();
        const wordbookId = String(record.wordbookId || '').trim();
        if (!studentId || !wordbookId) {
          return;
        }

        const dateKey = getLocalDateKey(record.timestamp || record.studyDate || record.learningDate || record.date);
        if (!dateKey) {
          return;
        }

        scannedRecords += 1;

        const groupKey = `${dateKey}__${studentId}__${wordbookId}`;
        if (!groupedByStudentBookDate[groupKey]) {
          groupedByStudentBookDate[groupKey] = {
            date: dateKey,
            studentId: studentId,
            wordbookId: wordbookId,
            wordbookTitle: record.wordbookTitle || '',
            recordCount: 0,
            newWordIdSet: new Set()
          };
        }

        const group = groupedByStudentBookDate[groupKey];
        group.recordCount += 1;
        if (!group.wordbookTitle && record.wordbookTitle) {
          group.wordbookTitle = record.wordbookTitle;
        }

        // 新口径来�?：未掌握�?
        appendWordIds(record.notMasteredWordIds, group.newWordIdSet);
        // 新口径来�?：困难词�?
        appendWordIds(record.difficultWordIds, group.newWordIdSet);

        // 新口径来�?：详细学习记录中的未掌握�?
        if (Array.isArray(record.studyWordsDetailed)) {
          record.studyWordsDetailed.forEach(function(item) {
            if (!item || typeof item !== 'object') {
              return;
            }

            if (item.masteryStatus === 'notMastered' || item.masteryStatus === 'difficult') {
              const normalizedId = normalizeWordIdForStats(item);
              if (normalizedId) {
                group.newWordIdSet.add(normalizedId);
              }
            }
          });
        }
      });

      const migratedAtIso = new Date().toISOString();
      const nextDailyStats = {};
      const nextDailyStatsFlat = [];

      Object.keys(groupedByStudentBookDate).forEach(function(groupKey) {
        const group = groupedByStudentBookDate[groupKey];
        const newWordIds = Array.from(group.newWordIdSet);
        const entry = {
          date: group.date,
          studentId: group.studentId,
          wordbookId: group.wordbookId,
          wordbookTitle: group.wordbookTitle || '',
          newWords: newWordIds.length,
          newWordIds: newWordIds,
          recordCount: group.recordCount,
          migratedBy: migrationVersion,
          migratedAt: migratedAtIso
        };

        if (!nextDailyStats[group.studentId]) {
          nextDailyStats[group.studentId] = {};
        }
        if (!nextDailyStats[group.studentId][group.wordbookId]) {
          nextDailyStats[group.studentId][group.wordbookId] = {};
        }
        nextDailyStats[group.studentId][group.wordbookId][group.date] = entry;
        nextDailyStatsFlat.push(entry);
      });

      nextDailyStatsFlat.sort(function(a, b) {
        if (a.date === b.date) {
          if (a.studentId === b.studentId) {
            return String(a.wordbookId).localeCompare(String(b.wordbookId));
          }
          return String(a.studentId).localeCompare(String(b.studentId));
        }
        return String(a.date).localeCompare(String(b.date));
      });

      // 首次迁移自动备份旧缓存，便于必要时回�?
      const oldBackup = wx.getStorageSync(migrationBackupKey);
      if (!oldBackup || force) {
        wx.setStorageSync(migrationBackupKey, {
          version: migrationVersion,
          timestamp: migratedAtIso,
          dailyStats: wx.getStorageSync('dailyStats') || null,
          dailyStatsFlat: wx.getStorageSync('dailyStatsFlat') || null,
          learningProgress: wx.getStorageSync('learningProgress') || {}
        });
      }

      // 覆盖历史统计缓存�?
      wx.setStorageSync('dailyStats', nextDailyStats);
      wx.setStorageSync('dailyStatsFlat', nextDailyStatsFlat);

      // 同步回填 learningProgress 下的按天统计，兼容历史读取路�?
      let learningProgress = wx.getStorageSync('learningProgress') || {};
      if (!learningProgress || typeof learningProgress !== 'object' || Array.isArray(learningProgress)) {
        learningProgress = {};
      }

      Object.keys(nextDailyStats).forEach(function(studentId) {
        if (!learningProgress[studentId] || typeof learningProgress[studentId] !== 'object' || Array.isArray(learningProgress[studentId])) {
          learningProgress[studentId] = {
            learnedWords: 0,
            totalWords: 0,
            wordbooks: {}
          };
        }

        const studentProgress = learningProgress[studentId];
        if (!studentProgress.wordbooks || typeof studentProgress.wordbooks !== 'object' || Array.isArray(studentProgress.wordbooks)) {
          studentProgress.wordbooks = {};
        }

        const studentBookStats = nextDailyStats[studentId] || {};
        Object.keys(studentBookStats).forEach(function(wordbookId) {
          if (!studentProgress.wordbooks[wordbookId] || typeof studentProgress.wordbooks[wordbookId] !== 'object' || Array.isArray(studentProgress.wordbooks[wordbookId])) {
            studentProgress.wordbooks[wordbookId] = {
              completedCount: 0,
              learnedWords: 0,
              totalCount: 0,
              lastStudyTime: '',
              lastStudied: ''
            };
          }

          const bookProgress = studentProgress.wordbooks[wordbookId];
          const dailyStatsMap = studentBookStats[wordbookId] || {};

          bookProgress.dailyStats = dailyStatsMap;
          bookProgress.dailyNewWordsTotal = Object.keys(dailyStatsMap).reduce(function(sum, dayKey) {
            const dayEntry = dailyStatsMap[dayKey] || {};
            return sum + (Number(dayEntry.newWords || 0) || 0);
          }, 0);
        });
      });

      wx.setStorageSync('learningProgress', learningProgress);

      const migrationResult = {
        migrated: true,
        skipped: false,
        version: migrationVersion,
        scannedRecords: scannedRecords,
        migratedGroups: nextDailyStatsFlat.length,
        updatedKeys: ['dailyStats', 'dailyStatsFlat', 'learningProgress']
      };

      wx.setStorageSync(migrationFlagKey, {
        version: migrationVersion,
        timestamp: migratedAtIso,
        scannedRecords: scannedRecords,
        migratedGroups: nextDailyStatsFlat.length
      });

      return migrationResult;
    } catch (error) {
      console.error('迁移历史新词统计失败:', error);
      return {
        migrated: false,
        skipped: false,
        reason: 'error',
        error: error.message
      };
    }
  },

  // 历史未掌握单词召回：�?learningRecords 回填 wordMastery
  recoverHistoricalUnmasteredWords: function(options) {
    try {
      const recallVersion = 'v1';
      const force = !!(options && options.force === true);
      const recallFlagKey = `recoverHistoricalUnmasteredWords_${recallVersion}`;

      const previousRecall = wx.getStorageSync(recallFlagKey);
      if (previousRecall && !force) {
        return {
          migrated: false,
          skipped: true,
          reason: 'already_done',
          version: recallVersion
        };
      }

      const learningRecords = wx.getStorageSync('learningRecords') || [];
      if (!Array.isArray(learningRecords) || learningRecords.length === 0) {
        return {
          migrated: false,
          skipped: true,
          reason: 'no_records',
          version: recallVersion
        };
      }

      const getRecordTime = function(record) {
        const raw = record && (record.timestamp || record.studyDate || record.learningDate || record.date);
        const timestamp = raw !== undefined && raw !== null ? new Date(raw).getTime() : 0;
        return isNaN(timestamp) ? 0 : timestamp;
      };

      const normalizeWordId = function(rawId) {
        if (rawId === undefined || rawId === null) {
          return '';
        }

        let candidate = rawId;
        if (typeof rawId === 'object') {
          candidate = rawId.sourceWordId || rawId.id || rawId.word || '';
        }

        return String(candidate).trim();
      };

      const normalizeStatusToken = function(statusValue) {
        if (statusValue === undefined || statusValue === null) {
          return '';
        }

        return String(statusValue).trim().toLowerCase().replace(/[^a-z]/g, '');
      };

      const isUnmasteredStatus = function(statusValue) {
        const token = normalizeStatusToken(statusValue);
        return token === 'notmastered' || token === 'unmastered' || token === 'difficult';
      };

      const normalizeBoolean = function(value) {
        if (value === true || value === false) {
          return value;
        }

        if (value === 1) {
          return true;
        }
        if (value === 0) {
          return false;
        }

        if (typeof value === 'string') {
          const token = value.trim().toLowerCase();
          if (token === 'true' || token === '1') {
            return true;
          }
          if (token === 'false' || token === '0') {
            return false;
          }
        }

        return null;
      };

      const isMasteredRecord = function(record) {
        if (!record || typeof record !== 'object') {
          return false;
        }

        const masteredValue = normalizeBoolean(record.mastered);
        if (masteredValue === true) {
          return true;
        }

        const statusToken = normalizeStatusToken(record.status || record.masteryStatus);
        return statusToken === 'mastered';
      };

      const historicalUnmasteredMap = {};
      let scannedRecords = 0;
      let collectedWordCount = 0;

      const markHistoricalWord = function(studentId, wordbookId, wordId) {
        if (!historicalUnmasteredMap[studentId]) {
          historicalUnmasteredMap[studentId] = {};
        }
        if (!historicalUnmasteredMap[studentId][wordbookId]) {
          historicalUnmasteredMap[studentId][wordbookId] = {};
        }

        if (!historicalUnmasteredMap[studentId][wordbookId][wordId]) {
          collectedWordCount += 1;
        }
        historicalUnmasteredMap[studentId][wordbookId][wordId] = true;
      };

      const sortedRecords = learningRecords.slice().sort(function(a, b) {
        return getRecordTime(a) - getRecordTime(b);
      });

      sortedRecords.forEach(function(record) {
        if (!record || typeof record !== 'object') {
          return;
        }

        const isAntiForgettingRecord =
          record.recordType === 'anti_forgetting_review' ||
          record.isAntiForgettingReview === true;
        if (isAntiForgettingRecord) {
          return;
        }

        const studentId = String(record.studentId || '').trim();
        const wordbookId = String(record.wordbookId || '').trim();
        if (!studentId || !wordbookId) {
          return;
        }

        scannedRecords += 1;

        const markByRawWordId = function(rawWordId) {
          const normalizedId = normalizeWordId(rawWordId);
          if (!normalizedId) {
            return;
          }
          markHistoricalWord(studentId, wordbookId, normalizedId);
        };

        if (Array.isArray(record.notMasteredWordIds)) {
          record.notMasteredWordIds.forEach(markByRawWordId);
        }

        if (Array.isArray(record.difficultWordIds)) {
          record.difficultWordIds.forEach(markByRawWordId);
        }

        if (Array.isArray(record.studyWordsDetailed)) {
          record.studyWordsDetailed.forEach(function(item) {
            if (!item || typeof item !== 'object') {
              return;
            }

            const statusToken = item.masteryStatus || item.status;
            if (!isUnmasteredStatus(statusToken)) {
              return;
            }

            markByRawWordId(item);
          });
        }
      });

      let wordMastery = wx.getStorageSync('wordMastery') || {};
      if (!wordMastery || typeof wordMastery !== 'object' || Array.isArray(wordMastery)) {
        wordMastery = {};
      }

      let updatedWords = 0;
      let skippedMastered = 0;

      Object.keys(historicalUnmasteredMap).forEach(function(studentId) {
        if (!wordMastery[studentId] || typeof wordMastery[studentId] !== 'object' || Array.isArray(wordMastery[studentId])) {
          wordMastery[studentId] = {};
        }

        const studentWordbookMap = historicalUnmasteredMap[studentId] || {};
        Object.keys(studentWordbookMap).forEach(function(wordbookId) {
          let wordbookMastery = wordMastery[studentId][wordbookId];

          if (Array.isArray(wordbookMastery)) {
            const converted = {};
            wordbookMastery.forEach(function(storedId) {
              const key = String(storedId || '').trim();
              if (key) {
                converted[key] = {
                  mastered: true,
                  difficult: false,
                  status: 'mastered',
                  masteryStatus: 'mastered'
                };
              }
            });
            wordbookMastery = converted;
            wordMastery[studentId][wordbookId] = wordbookMastery;
          } else if (!wordbookMastery || typeof wordbookMastery !== 'object') {
            wordbookMastery = {};
            wordMastery[studentId][wordbookId] = wordbookMastery;
          }

          const wordIdMap = studentWordbookMap[wordbookId] || {};
          Object.keys(wordIdMap).forEach(function(wordId) {
            const currentRecord = wordbookMastery[wordId];
            if (isMasteredRecord(currentRecord)) {
              skippedMastered += 1;
              return;
            }

            wordbookMastery[wordId] = {
              ...(currentRecord && typeof currentRecord === 'object' ? currentRecord : {}),
              mastered: false,
              difficult: true,
              status: 'notMastered',
              masteryStatus: 'notMastered'
            };

            updatedWords += 1;
          });

          wordMastery[studentId][wordbookId] = wordbookMastery;
        });
      });

      wx.setStorageSync('wordMastery', wordMastery);

      const result = {
        migrated: true,
        skipped: false,
        version: recallVersion,
        scannedRecords: scannedRecords,
        collectedWordCount: collectedWordCount,
        updatedWords: updatedWords,
        skippedMastered: skippedMastered
      };

      wx.setStorageSync(recallFlagKey, {
        version: recallVersion,
        timestamp: Date.now(),
        scannedRecords: scannedRecords,
        collectedWordCount: collectedWordCount,
        updatedWords: updatedWords,
        skippedMastered: skippedMastered
      });

      return result;
    } catch (error) {
      console.error('召回历史未掌握单词失�?', error);
      return {
        migrated: false,
        skipped: false,
        reason: 'error',
        error: error.message
      };
    }
  },

  // 一次性补全：将历史学习记录中的未掌握词同步到 wordMastery
  syncHistoricalUnmasteredToWordMastery: function(options) {
    try {
      const syncVersion = 'v1';
      const force = !!(options && options.force === true);
      const syncFlagKey = `syncHistoricalUnmasteredToWordMastery_${syncVersion}`;
      const syncBackupKey = `wordMastery_backup_${syncFlagKey}`;

      const previousSync = wx.getStorageSync(syncFlagKey);
      if (previousSync && !force) {
        return { migrated: false, skipped: true, reason: 'already_done', version: syncVersion };
      }

      const learningRecords = wx.getStorageSync('learningRecords') || [];
      if (!Array.isArray(learningRecords) || learningRecords.length === 0) {
        return { migrated: false, skipped: true, reason: 'no_records', version: syncVersion };
      }

      const getRecordTime = (record) => {
        const raw = record && (record.timestamp || record.studyDate || record.learningDate || record.date);
        const ts = raw !== undefined && raw !== null ? new Date(raw).getTime() : 0;
        return isNaN(ts) ? 0 : ts;
      };

      const normalizeWordId = (rawId) => {
        if (rawId === undefined || rawId === null) return '';
        let candidate = rawId;
        if (typeof rawId === 'object') {
          candidate = rawId.sourceWordId || rawId.id || rawId.word || '';
        }
        return String(candidate).trim();
      };

      const normalizeBoolean = (value) => {
        if (value === true || value === false) return value;
        if (value === 1) return true;
        if (value === 0) return false;
        if (typeof value === 'string') {
          const normalized = value.trim().toLowerCase();
          if (normalized === 'true' || normalized === '1') return true;
          if (normalized === 'false' || normalized === '0') return false;
        }
        return null;
      };

      const isMasteredRecord = (record) => {
        if (!record || typeof record !== 'object') return false;
        const masteredValue = normalizeBoolean(record.mastered);
        if (masteredValue === true) return true;
        const status = record.status || record.masteryStatus;
        if (typeof status === 'string' && status.trim().toLowerCase() === 'mastered') {
          return true;
        }
        return false;
      };

      const normalizedRecords = learningRecords.slice().sort((a, b) => getRecordTime(a) - getRecordTime(b));
      const latestStatusMap = {};
      let scannedRecords = 0;

      const ensureStatusMap = (studentId, wordbookId) => {
        if (!latestStatusMap[studentId]) {
          latestStatusMap[studentId] = {};
        }
        if (!latestStatusMap[studentId][wordbookId]) {
          latestStatusMap[studentId][wordbookId] = {};
        }
        return latestStatusMap[studentId][wordbookId];
      };

      const applyStatusList = (recordMap, wordIds, status) => {
        if (!Array.isArray(wordIds)) return;
        wordIds.forEach((wordId) => {
          const normalizedId = normalizeWordId(wordId);
          if (!normalizedId) return;
          recordMap[normalizedId] = status;
        });
      };

      normalizedRecords.forEach((record) => {
        if (!record || typeof record !== 'object') {
          return;
        }

        const isAntiForgettingRecord =
          record.recordType === 'anti_forgetting_review' ||
          record.isAntiForgettingReview === true;
        if (isAntiForgettingRecord) {
          return;
        }

        const studentId = String(record.studentId || '').trim();
        const wordbookId = String(record.wordbookId || '').trim();
        if (!studentId || !wordbookId) {
          return;
        }

        scannedRecords += 1;
        const recordMap = ensureStatusMap(studentId, wordbookId);

        applyStatusList(recordMap, record.masteredWordIds, 'mastered');
        applyStatusList(recordMap, record.notMasteredWordIds, 'notMastered');
        applyStatusList(recordMap, record.difficultWordIds, 'notMastered');

        if (Array.isArray(record.studyWordsDetailed)) {
          record.studyWordsDetailed.forEach((item) => {
            if (!item || typeof item !== 'object') return;
            const status = item.masteryStatus;
            const normalizedId = normalizeWordId(item);
            if (!normalizedId) return;
            if (status === 'mastered') {
              recordMap[normalizedId] = 'mastered';
            } else if (status === 'notMastered' || status === 'difficult') {
              recordMap[normalizedId] = 'notMastered';
            }
          });
        }
      });

      let wordMastery = wx.getStorageSync('wordMastery') || {};
      if (!wordMastery || typeof wordMastery !== 'object' || Array.isArray(wordMastery)) {
        wordMastery = {};
      }

      const existingBackup = wx.getStorageSync(syncBackupKey);
      if (!existingBackup || force) {
        wx.setStorageSync(syncBackupKey, {
          version: syncVersion,
          timestamp: Date.now(),
          wordMastery: wordMastery
        });
      }

      let updatedWords = 0;
      let skippedMastered = 0;

      Object.keys(latestStatusMap).forEach((studentId) => {
        if (!wordMastery[studentId] || typeof wordMastery[studentId] !== 'object' || Array.isArray(wordMastery[studentId])) {
          wordMastery[studentId] = {};
        }

        const studentMap = latestStatusMap[studentId] || {};
        Object.keys(studentMap).forEach((wordbookId) => {
          let wordbookMastery = wordMastery[studentId][wordbookId];
          if (Array.isArray(wordbookMastery)) {
            const converted = {};
            wordbookMastery.forEach((storedId) => {
              const key = String(storedId || '').trim();
              if (key) {
                converted[key] = { mastered: true, difficult: false };
              }
            });
            wordbookMastery = converted;
            wordMastery[studentId][wordbookId] = wordbookMastery;
          } else if (!wordbookMastery || typeof wordbookMastery !== 'object') {
            wordbookMastery = {};
            wordMastery[studentId][wordbookId] = wordbookMastery;
          }

          const statusMap = studentMap[wordbookId] || {};
          Object.keys(statusMap).forEach((wordId) => {
            if (statusMap[wordId] !== 'notMastered') {
              return;
            }

            const currentRecord = wordbookMastery[wordId];
            if (currentRecord && isMasteredRecord(currentRecord)) {
              skippedMastered += 1;
              return;
            }

            const nextRecord = {
              ...(currentRecord && typeof currentRecord === 'object' ? currentRecord : {}),
              mastered: false,
              difficult: true,
              status: 'notMastered',
              masteryStatus: 'notMastered'
            };

            wordbookMastery[wordId] = nextRecord;
            updatedWords += 1;
          });
        });
      });

      wx.setStorageSync('wordMastery', wordMastery);

      const result = {
        migrated: true,
        skipped: false,
        version: syncVersion,
        scannedRecords: scannedRecords,
        updatedWords: updatedWords,
        skippedMastered: skippedMastered
      };

      wx.setStorageSync(syncFlagKey, {
        version: syncVersion,
        timestamp: Date.now(),
        scannedRecords: scannedRecords,
        updatedWords: updatedWords,
        skippedMastered: skippedMastered
      });

      return result;
    } catch (error) {
      console.error('补全历史未掌握词失败:', error);
      return { migrated: false, skipped: false, reason: 'error', error: error.message };
    }
  },

  // 学生数据安全备份（用于自动迁�?兼容修复前兜底）
  backupStudentsSafetySnapshot: function(scene) {
    try {
      const students = wx.getStorageSync('students') || [];
      if (!Array.isArray(students) || students.length === 0) {
        return { backedUp: false, reason: 'empty_students' };
      }

      const snapshot = {
        scene: scene || 'unknown',
        timestamp: Date.now(),
        count: students.length,
        students: students
      };

      wx.setStorageSync('students_safety_backup_latest', snapshot);
      return { backedUp: true, count: students.length };
    } catch (error) {
      console.error('学生数据安全备份失败:', error);
      return { backedUp: false, reason: 'error', error: error.message };
    }
  },

  // 非破坏式规范化：仅识别历史模拟数据，不自动删�?
  normalizeStudentsStorage: function() {
    try {
      const students = wx.getStorageSync('students') || [];
      if (!Array.isArray(students) || students.length === 0) {
        return;
      }

      const legacyMockIds = new Set(['20001', '20002', '20003', 'student_1']);

      const legacyMocks = students.filter((s) => {
        if (!s) return false;
        const id = String(s.id || '');
        return legacyMockIds.has(id);
      });

      if (legacyMocks.length > 0) {
        console.log('检测到历史模拟学生数据（未自动删除�?', legacyMocks.length);
      }
    } catch (error) {
      console.error('清理学生存储失败:', error);
    }
  },

  // 兼容历史数据：将无归属学生迁移到当前账号
  migrateLegacyStudentsForUser: function(user) {
    try {
      const currentUser = user || wx.getStorageSync('currentUser') || this.globalData.currentUser;
      const currentUserId = currentUser && (currentUser.id || currentUser.username);
      if (!currentUserId) {
        return { migrated: 0, reason: 'no_user' };
      }

      const students = wx.getStorageSync('students') || [];
      if (!Array.isArray(students) || students.length === 0) {
        return { migrated: 0, reason: 'no_students' };
      }

      const ownedStudents = students.filter(s => s && (s.ownerId || s.ownerUsername) === currentUserId);
      if (ownedStudents.length > 0) {
        return { migrated: 0, reason: 'already_owned' };
      }

      const legacyUnownedStudents = students.filter(s => s && !s.ownerId && !s.ownerUsername);
      if (legacyUnownedStudents.length === 0) {
        return { migrated: 0, reason: 'no_legacy_unowned' };
      }

      this.backupStudentsSafetySnapshot('migrateLegacyStudentsForUser');

      const migratedStudents = students.map((s) => {
        if (!s) return s;
        if (s.ownerId || s.ownerUsername) return s;
        return {
          ...s,
          ownerId: currentUserId,
          ownerUsername: (currentUser && currentUser.username) || ''
        };
      });

      wx.setStorageSync('students', migratedStudents);

      const currentStudent = wx.getStorageSync('currentStudent') || null;
      if (currentStudent && !currentStudent.ownerId && !currentStudent.ownerUsername) {
        const migratedCurrentStudent = {
          ...currentStudent,
          ownerId: currentUserId,
          ownerUsername: (currentUser && currentUser.username) || ''
        };
        wx.setStorageSync('currentStudent', migratedCurrentStudent);
        this.globalData.currentStudent = migratedCurrentStudent;
      }

      console.log('已迁移历史无归属学生数据，数�?', legacyUnownedStudents.length);
      return { migrated: legacyUnownedStudents.length, reason: 'migrated' };
    } catch (error) {
      console.error('迁移历史学生数据失败:', error);
      return { migrated: 0, reason: 'error', error: error.message };
    }
  },

  // 从最近一次安全备份恢复学生数据（手动调用�?
  restoreStudentsFromSafetyBackup: function() {
    try {
      const snapshot = wx.getStorageSync('students_safety_backup_latest') || null;
      if (!snapshot || !Array.isArray(snapshot.students)) {
        return { restored: false, reason: 'no_backup' };
      }

      wx.setStorageSync('students', snapshot.students);
      console.log('已从安全备份恢复学生数据，数�?', snapshot.students.length);
      return { restored: true, count: snapshot.students.length, timestamp: snapshot.timestamp };
    } catch (error) {
      console.error('从安全备份恢复学生失�?', error);
      return { restored: false, reason: 'error', error: error.message };
    }
  },
  
  // 初始化词书加载器
  initWordbookLoader: function() {
    try {
      // 词书加载器已经在模块内部初始�?
      console.log('词书加载器初始化完成');
    } catch (error) {
      console.error('初始化词书加载器时出�?', error);
    }
  },
  
  // 初始化事件系�?
  initEventSystem: function() {
    // 事件监听器存储对�?
    this.eventListeners = {};
    
    console.log('event system initialized');
  },
  
  // 注册事件监听�?
  on: function(eventName, callback) {
    if (!this.eventListeners[eventName]) {
      this.eventListeners[eventName] = [];
    }
    this.eventListeners[eventName].push(callback);
  },
  
  // 触发事件
  emit: function(eventName, data) {
    if (this.eventListeners[eventName]) {
      this.eventListeners[eventName].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`事件${eventName}处理失败:`, error);
        }
      });
    }
  },
  
  // 移除事件监听�?
  off: function(eventName, callback) {
    if (this.eventListeners[eventName]) {
      if (callback) {
        this.eventListeners[eventName] = this.eventListeners[eventName].filter(cb => cb !== callback);
      } else {
        // 如果没有指定回调，则移除所有该事件的监听器
        delete this.eventListeners[eventName];
      }
    }
  },

    globalData: {
    userInfo: null,
    currentUser: null,
    currentStudent: null,
    currentWordbook: null,
    selectedWordbook: null,
    isLoggedIn: false, // 初始化登录状态标志为未登�?
    // 启用在线词典音频：优先有道，失败后走 dictionaryapi 兜底
    enableOnlineDictAudio: true
  },
  
  // 获取学习记录
  getLearningRecords: function(studentId, wordbookId) {
    try {
      console.log('getLearningRecords被调用，参数:', studentId, wordbookId);
      
      // 从本地存储读取实时数�?
      const records = wx.getStorageSync('learningRecords') || [];
      console.log('从本地存储读取的学习记录:', records);
      
      // 兼容无参数调用的情况，返回所有记�?
      if (studentId === undefined && wordbookId === undefined) {
        // 确保所有记录都包含必要字段
        const processedRecords = records.map(record => ({
          ...record,
          studyTime: record.studyTime || 0,
          duration: record.duration || 0,
          timestamp: record.timestamp || (record.studyDate ? new Date(record.studyDate).getTime() : (record.learningDate ? new Date(record.learningDate).getTime() : Date.now()))
        }));
        
        console.log('处理后返回的学习记录:', processedRecords);
        return processedRecords;
      }
      
      // 有参数时进行过滤，确保只有在参数有有效值时才进行过�?
      const filteredRecords = records.filter(record =>
        (studentId === undefined || studentId === null || record.studentId === studentId) &&
        (wordbookId === undefined || wordbookId === null || record.wordbookId === wordbookId)
      );
      
      // 确保所有记录都包含必要字段
      const processedFilteredRecords = filteredRecords.map(record => ({
        ...record,
        studyTime: record.studyTime || 0,
        duration: record.duration || 0,
        timestamp: record.timestamp || (record.studyDate ? new Date(record.studyDate).getTime() : (record.learningDate ? new Date(record.learningDate).getTime() : Date.now()))
      }));
      
      console.log('过滤后返回的学习记录:', processedFilteredRecords);
      return processedFilteredRecords;
    } catch (error) {
      console.error('获取学习记录失败:', error);
      return []; // 确保错误情况下也返回空数组而不是undefined
    }
  },
  
  // 添加学习记录 - 增强�?
  addLearningRecord: function(record) {
    try {
      // 确保记录包含完整的时间信�?
      const now = new Date();
      const nowISO = now.toISOString();
      const nowTimestamp = now.getTime();
      
      // 创建包含完整时间信息的记录对�?
      const recordWithTime = {
        ...record,
        // 确保有多个时间字段以兼容不同页面
        timestamp: nowTimestamp,           // 数字时间�?
        studyDate: nowISO,           // 学习日期
        learningDate: nowISO,        // 学习日期(别名)
        date: nowISO,                // 日期(别名)
        // 添加唯一ID如果没有
        id: record.id || `record-${now.getTime()}-${Math.random().toString(36).substr(2, 9)}`,
        // 确保有学习时长字�?
        studyTime: record.studyTime || 0,
        duration: record.duration || 0
      };
      
      // 获取当前学习记录并添加新记录
      const records = wx.getStorageSync('learningRecords') || [];
      records.push(recordWithTime);
      
      // 保存到本地存�?
      wx.setStorageSync('learningRecords', records);
      
      // 立即更新学习进度数据（抗遗忘复习记录不参与学习进度累计）
      const isAntiForgettingReview =
        recordWithTime.recordType === 'anti_forgetting_review' ||
        recordWithTime.isAntiForgettingReview === true;

      if (!isAntiForgettingReview && recordWithTime.studentId && (recordWithTime.totalWords || recordWithTime.wordCount || recordWithTime.wordsLearned)) {
        this.updateLearningProgress(recordWithTime);
      }
      
      // 立即触发学习记录更新事件，确保统计数据实时更�?
      console.log('准备触发学习记录更新事件:', recordWithTime);
      this.emit('learningRecordAdded', recordWithTime);
      
      console.log('学习记录添加成功并触发更新事�?', recordWithTime);
      return true;
    } catch (error) {
      console.error('添加学习记录失败:', error);
      return false;
    }
  },
  
  // 更新学习进度数据
  updateLearningProgress: function(record) {
    try {
      const learningProgress = wx.getStorageSync('learningProgress') || {};
      const studentId = record.studentId;
      
      // 确保学生进度对象存在
      if (!learningProgress[studentId] || typeof learningProgress[studentId] !== 'object' || Array.isArray(learningProgress[studentId])) {
        learningProgress[studentId] = {
          learnedWords: 0,
          totalWords: 0,
          wordbooks: {}
        };
      }
      
      const studentProgress = learningProgress[studentId];
      if (!studentProgress.wordbooks || typeof studentProgress.wordbooks !== 'object' || Array.isArray(studentProgress.wordbooks)) {
        studentProgress.wordbooks = {};
      }
      const wordsLearned = record.totalWords || record.wordCount || record.wordsLearned || 0;
      
      // 更新全局学习单词�?
      studentProgress.learnedWords = (studentProgress.learnedWords || 0) + wordsLearned;
      
      // 如果提供了词书ID，更新特定词书的进度
      if (record.wordbookId) {
        const wordbookId = String(record.wordbookId);
        const currentWordbookProgress = studentProgress.wordbooks[wordbookId] || {};
        const currentCompletedCount = Number(currentWordbookProgress.completedCount || currentWordbookProgress.learnedWords || 0) || 0;
        const nextCompletedCount = currentCompletedCount + wordsLearned;
        const currentTotalCount = Number(currentWordbookProgress.totalCount || 0) || 0;
        const recordTotalCount = Number(record.wordbookTotalWords || 0) || 0;
        const nextTotalCount = Math.max(currentTotalCount, recordTotalCount);
        const lastStudyTime = record.studyDate || new Date().toISOString();

        studentProgress.wordbooks[wordbookId] = {
          ...currentWordbookProgress,
          completedCount: nextCompletedCount,
          learnedWords: nextCompletedCount,
          totalCount: nextTotalCount,
          lastStudyTime: lastStudyTime,
          lastStudied: lastStudyTime
        };
      }
      
      // 保存更新后的进度数据
      wx.setStorageSync('learningProgress', learningProgress);
      console.log('学习进度已更�?', studentId, studentProgress.learnedWords);
      
      return true;
    } catch (error) {
      console.error('更新学习进度失败:', error);
      return false;
    }
  },

  // 获取学生列表
  getStudents: function() {
    try {
      return wx.getStorageSync('students') || [];      
    } catch (error) {
      console.error('获取学生列表失败:', error);
      return [];
    }
  },

  // 添加学生
  addStudent: function(studentInfo) {
    try {
      const students = wx.getStorageSync('students') || [];
      students.push(studentInfo);
      wx.setStorageSync('students', students);
      return true;
    } catch (error) {
      console.error('添加学生失败:', error);     
      return false;
    }
  },

  // 存储监控功能
  checkStorageUsage: function() {
    return new Promise((resolve, reject) => {
      wx.getStorageInfo({
        success: (res) => {
          const used = res.currentSize;
          const total = res.limitSize;
          const usagePercent = (used / total) * 100;
          
          console.log('存储使用情况:', {
            used: used,
            total: total,
            percent: usagePercent.toFixed(2) + '%'
          });
          
          resolve({
            used,
            total,
            percent: usagePercent,
            isNearLimit: usagePercent > 80, // 80%以上视为接近上限
            isOverLimit: usagePercent >= 95 // 95%以上视为超过上限
          });
        },
        fail: (error) => {
          console.error('获取存储信息失败:', error);
          reject(error);
        }
      });
    });
  },

  // 显示存储警告
  showStorageWarning: function(usageInfo) {
    if (usageInfo.isOverLimit) {
      wx.showModal({
        title: '存储已满',
        content: 'storage nearly full. Clean up old data to continue',
        showCancel: false,
        confirmText: 'got it'
      });
    } else if (usageInfo.isNearLimit) {
      wx.showModal({
        title: '存储警告',
        content: `本地存储已使�?{usageInfo.percent.toFixed(1)}%，建议清理旧数据`,
        showCancel: true,
        cancelText: '稍后',
        confirmText: 'clean up',
        success: (res) => {
          if (res.confirm) {
            // 跳转到记录页面进行清�?
            wx.navigateTo({
              url: '/subpages/records/records'
            });
          }
        }
      });
    }
  },

  // 定期检查存储使用情�?
  checkStorageRegularly: function(silent = false) {
    this.checkStorageUsage().then(usageInfo => {
      if (!silent && (usageInfo.isNearLimit || usageInfo.isOverLimit)) {
        this.showStorageWarning(usageInfo);
      } else if (silent) {
        console.log('启动阶段静默存储检�?', {
          used: usageInfo.used,
          total: usageInfo.total,
          percent: usageInfo.percent
        });
      }
    }).catch(error => {
      console.error('检查存储使用情况失�?', error);
    });
  },

  // 清理旧数�?
  cleanupOldData: function(options = {}) {
    try {
      const { 
        days = 30, // 默认清理30天前的数�?
        types = ['learningRecords'] // 默认只清理学习记�?
      } = options;

      const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
      let deletedCount = 0;

      // 清理学习记录
      if (types.includes('learningRecords')) {
        const records = wx.getStorageSync('learningRecords') || [];
        const filteredRecords = records.filter(record => {
          const timestamp = record.timestamp || (record.studyDate ? new Date(record.studyDate).getTime() : 0);
          return timestamp >= cutoffTime;
        });
        deletedCount = records.length - filteredRecords.length;
        wx.setStorageSync('learningRecords', filteredRecords);
        console.log(`清理�?{deletedCount}�?{days}天前的学习记录`);
      }

      return {
        success: true,
        deletedCount
      };
    } catch (error) {
      console.error('清理旧数据失�?', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
});

