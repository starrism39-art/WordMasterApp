//app.js
// 引入Babel polyfill以解决编译错误
require('./utils/babel-polyfill');

// 引入词书加载器
const WordbookLoader = require('./data/wordbook-loader.js');

// 引入数据版本管理模块
const DataMigration = require('./utils/data-migration.js');

// 引入云同步模块
const { syncLearningRecord, syncLearningProgress, syncAllLocalLearningProgress, retryPendingSyncs } = require('./utils/cloud-sync.js');
const {
  reconcileLearningProgressMap,
  reconcileStudentLearningProgress
} = require('./utils/learning-progress.js');

// 引入云端词书加载器
const cloudWordbookLoader = require('./utils/cloud-wordbook-loader.js');

App({
  onLaunch: function () {
    // 初始化云开发环境
    try {
      // 【V1.0.1 云环境初始化】确保 wx.cloud 在任何页面使用前已就绪
      if (wx.cloud) {
        try {
          wx.cloud.init({
            env: 'cloudbase-4gafzdch60ad597b',
            traceUser: true
          });
          console.log('[app] wx.cloud.init() 成功');
        } catch (cloudInitError) {
          console.warn('[app] wx.cloud.init() 失败（非阻塞）:', cloudInitError);
        }
      } else {
        console.warn('[app] wx.cloud 不可用，云同步功能将不可用');
      }

      try {
        wx.setInnerAudioOption({
          obeyMuteSwitch: false
        });
        console.log('已设置全局音频选项: obeyMuteSwitch=false');
      } catch (audioOptionError) {
        console.error('设置全局音频选项失败:', audioOptionError);
      }

      // 【版本升级】首先检查数据版本，进行备份和迁移
      const versionInfo = this.initializeVersion();
      if (versionInfo.upgraded) {
        console.log('检测到版本升级，数据已自动备份和迁移');
        wx.showToast({
          title: '已备份升级前数据',
          duration: 2000
        });
      }
      
      // 初始化数据存储
      this.initData();
      // 将历史 learningProgress 扁平键迁移为嵌套结构
      this.migrateLearningProgress();
      // 清理历史遗留的模拟学生数据（小明/小红/小李）
      this.normalizeStudentsStorage();
      // 初始化事件系统
      this.initEventSystem();
      // 初始化词书加载器
      this.initWordbookLoader();
      // 启动阶段做静默检查，避免真机启动期弹窗/重任务触发 timeout
      setTimeout(() => {
        this.checkStorageRegularly(true);
      }, 3000);
      
      // 【V1.0.1 重试失败的云同步】延迟重试之前失败的同步任务
      setTimeout(() => {
        retryPendingSyncs();
      }, 5000);

      // 【V1.0.2 历史数据补推】将本地所有 learningProgress 一次性推到云端（幂等）
      setTimeout(() => {
        syncAllLocalLearningProgress();
      }, 8000);

      // 【云端词书预下载】启动后在后台预下载配置为云端的词书数据
      setTimeout(() => {
        this.preloadCloudWordbooks();
      }, 10000);
      
      // 从本地存储加载当前学生信息
      try {
        const currentStudent = wx.getStorageSync('currentStudent');
        if (currentStudent) {
          this.globalData.currentStudent = currentStudent;
          console.log('从本地存储加载当前学生信息:', currentStudent);
        }
      } catch (error) {
        console.error('加载当前学生信息失败:', error);
      }

      // 【Splash 导航】由 app 层统一控制从 splash 到首页的跳转。
      // 不在 splash 页面内做任何导航，避免真机调试冷启动阶段
      // 的框架竞态（pageId/webviewId not exists）。
      // 延迟 2s（> splash 动画 1.5s），确保框架完全就绪。
      var app = this;
      this._splashNavTimer = setTimeout(function() {
        console.log('[app] splash 导航定时器触发，准备跳转首页');
        wx.reLaunch({
          url: '/pages/index/index',
          fail: function(err) {
            console.error('[app] splash→index reLaunch 失败:', err);
            // 兜底：再延迟 500ms 后重试
            setTimeout(function() {
              wx.reLaunch({
                url: '/pages/index/index',
                fail: function(err2) {
                  console.error('[app] splash→index 重试 reLaunch 也失败:', err2);
                }
              });
            }, 500);
          }
        });
      }, 2000);

    } catch (error) {
      console.error('初始化时出错:', error);
    }
  },

  // 【新增】初始化数据版本，处理升级逻辑
  initializeVersion: function () {
    try {
      const versionResult = DataMigration.initializeDataVersion();
      console.log('数据版本初始化结果:', versionResult);
      return versionResult;
    } catch (error) {
      console.error('版本初始化失败:', error);
      return { error: true, message: error.message };
    }
  },

  // 初始化数据
  initData: function () {
    try {
      // 初始化学生列表
      if (!wx.getStorageSync('students')) {
        wx.setStorageSync('students', []);
      }
      
      // 初始化学习记录
      if (!wx.getStorageSync('learningRecords')) {
        wx.setStorageSync('learningRecords', []);
      }
      
      // 初始化学习进度数据
      if (!wx.getStorageSync('learningProgress')) {
        wx.setStorageSync('learningProgress', {});
      }
      
      // 初始化单词掌握状态
      if (!wx.getStorageSync('wordMastery')) {
        wx.setStorageSync('wordMastery', {});
      }
      
      // 初始化完成;
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

      // 第一轮：收集已有的嵌套结构与学生级数据
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
          Object.keys(value).forEach((field) => {
            if (field !== 'wordbooks') {
              studentProgress[field] = value[field];
            }
          });
          studentProgress.learnedWords = Number(value.learnedWords || 0) || 0;
          studentProgress.totalWords = Number(value.totalWords || 0) || 0;

          if (hasNestedWordbooks) {
            Object.keys(value.wordbooks).forEach((wordbookId) => {
              studentProgress.wordbooks[wordbookId] = normalizeBookProgress(value.wordbooks[wordbookId]);
            });
          }
        }
      });

      // 收集已知学生ID，帮助从历史扁平键中准确切分 studentId 与 wordbookId
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

      // 第二轮：迁移历史扁平键
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

      // 统一学生级统计字段
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

      // 进度是可重算的派生数据。原始学习记录和掌握明细保持不动，
      // 这里只根据两者纠正累计漂移，并保留旧计数到 legacy 字段。
      const reconciledProgress = reconcileLearningProgressMap(
        normalizedProgress,
        wx.getStorageSync('wordMastery') || {},
        wx.getStorageSync('learningRecords') || []
      );
      const progressReconciled = JSON.stringify(reconciledProgress) !== JSON.stringify(normalizedProgress);
      const sourceKeys = Object.keys(source);
      const normalizedKeys = Object.keys(reconciledProgress);
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

      normalizedChanged = migratedFlatCount > 0 || hasFlatKeys || sourceKeys.length !== normalizedKeys.length || progressReconciled;
      if (normalizedChanged) {
        wx.setStorageSync('learningProgress', reconciledProgress);
        console.log('learningProgress 迁移完成:', {
          migratedFlatCount,
          studentCount: normalizedKeys.length,
          progressReconciled
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

  // 学生数据安全备份（用于自动迁移/兼容修复前兜底）
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

  // 非破坏式规范化：仅识别历史模拟数据，不自动删除
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
        console.log('检测到历史模拟学生数据（未自动删除）:', legacyMocks.length);
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

      console.log('已迁移历史无归属学生数据，数量:', legacyUnownedStudents.length);
      return { migrated: legacyUnownedStudents.length, reason: 'migrated' };
    } catch (error) {
      console.error('迁移历史学生数据失败:', error);
      return { migrated: 0, reason: 'error', error: error.message };
    }
  },

  // 从最近一次安全备份恢复学生数据（手动调用）
  restoreStudentsFromSafetyBackup: function() {
    try {
      const snapshot = wx.getStorageSync('students_safety_backup_latest') || null;
      if (!snapshot || !Array.isArray(snapshot.students)) {
        return { restored: false, reason: 'no_backup' };
      }

      wx.setStorageSync('students', snapshot.students);
      console.log('已从安全备份恢复学生数据，数量:', snapshot.students.length);
      return { restored: true, count: snapshot.students.length, timestamp: snapshot.timestamp };
    } catch (error) {
      console.error('从安全备份恢复学生失败:', error);
      return { restored: false, reason: 'error', error: error.message };
    }
  },
  
  // 初始化词书加载器
  initWordbookLoader: function() {
    try {
      // 词书加载器已经在模块内部初始化
      console.log('词书加载器初始化完成');
    } catch (error) {
      console.error('初始化词书加载器时出错:', error);
    }
  },

  /** 后台预下载云端词书数据 */
  preloadCloudWordbooks: function() {
    // 遍历学习进度，找出已启用的云端词书并预下载
    try {
      const learningProgress = wx.getStorageSync('learningProgress') || {};
      const cloudBooks = cloudWordbookLoader.CLOUD_WORDBOOK_MAP;
      
      Object.keys(learningProgress).forEach((studentId) => {
        const studentProgress = learningProgress[studentId];
        if (!studentProgress || !studentProgress.wordbooks) return;
        
        Object.keys(studentProgress.wordbooks).forEach((bookId) => {
          if (cloudBooks[bookId] && !cloudWordbookLoader.getWordsSync(bookId)) {
            console.log('[app] 后台预下载云端词书:', bookId);
            cloudWordbookLoader.downloadWordsFromCloud(bookId);
          }
        });
      });
    } catch (e) {
      console.warn('[app] preloadCloudWordbooks 异常:', e);
    }
  },

  // 初始化事件系统
  initEventSystem: function() {
    // 事件监听器存储对象
    this.eventListeners = {};
    
    console.log('事件系统初始化完成');
  },
  
  // 注册事件监听器
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
  
  // 移除事件监听器
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
    isLoggedIn: false, // 初始化登录状态标志为未登录
    // 启用在线词典音频：优先有道，失败后走 dictionaryapi 兜底
    enableOnlineDictAudio: true
  },

  // 【权限基座】规范化用户权限字段，确保 userRole/memberLevel 始终有合法默认值
  ensureUserPermissions: function(user) {
    if (!user || typeof user !== 'object') {
      return { userRole: 'external', memberLevel: 'free' };
    }
    return {
      ...user,
      userRole: user.userRole || 'external',
      memberLevel: user.memberLevel || 'free'
    };
  },
  
  // 获取学习记录
  getLearningRecords: function(studentId, wordbookId) {
    try {
      console.log('getLearningRecords被调用，参数:', studentId, wordbookId);
      
      // 从本地存储读取实时数据
      const records = wx.getStorageSync('learningRecords') || [];
      console.log('从本地存储读取的学习记录:', records);
      
      // 兼容无参数调用的情况，返回所有记录
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
      
      // 有参数时进行过滤，使用 String() 转换比较避免类型不匹配
      const filteredRecords = records.filter(record =>
        (studentId === undefined || studentId === null || String(record.studentId) === String(studentId)) &&
        (wordbookId === undefined || wordbookId === null || String(record.wordbookId) === String(wordbookId))
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
  
  // 添加学习记录 - 增强版
  addLearningRecord: function(record) {
    try {
      // 确保记录包含完整的时间信息
      const now = new Date();
      const nowISO = now.toISOString();
      const nowTimestamp = now.getTime();
      
      // 创建包含完整时间信息的记录对象
      const recordWithTime = {
        ...record,
        // 确保有多个时间字段以兼容不同页面
        timestamp: nowTimestamp,           // 数字时间戳
        studyDate: nowISO,           // 学习日期
        learningDate: nowISO,        // 学习日期(别名)
        date: nowISO,                // 日期(别名)
        // 添加唯一ID如果没有
        id: record.id || `record-${now.getTime()}-${Math.random().toString(36).substr(2, 9)}`,
        // 确保有学习时长字段
        studyTime: record.studyTime || 0,
        duration: record.duration || 0
      };
      
      // 获取当前学习记录并添加新记录
      const records = wx.getStorageSync('learningRecords') || [];
      records.push(recordWithTime);
      
      // 保存到本地存储
      wx.setStorageSync('learningRecords', records);
      
      // 立即更新学习进度数据（抗遗忘复习记录不参与学习进度累计）
      const isAntiForgettingReview =
        recordWithTime.recordType === 'anti_forgetting_review' ||
        recordWithTime.isAntiForgettingReview === true;

      if (!isAntiForgettingReview && recordWithTime.studentId && (recordWithTime.totalWords || recordWithTime.wordCount || recordWithTime.wordsLearned)) {
        this.updateLearningProgress(recordWithTime);
      }
      
      // 立即触发学习记录更新事件，确保统计数据实时更新
      console.log('准备触发学习记录更新事件:', recordWithTime);
      this.emit('learningRecordAdded', recordWithTime);
      
      // 【V1.0.1 云同步】异步同步学习记录到云端
      // 修复：原 addLearningRecord 缺少云同步，导致学习记录仅存本地
      syncLearningRecord(recordWithTime);
      
      console.log('学习记录添加成功并触发更新事件:', recordWithTime);
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
      const wordMastery = wx.getStorageSync('wordMastery') || {};
      const learningRecords = wx.getStorageSync('learningRecords') || [];
      const studentId = String(record.studentId || '');
      const wordbookId = String(record.wordbookId || '');
      const now = Date.now();
      const lastStudyTime = record.studyDate || new Date(now).toISOString();
      const bookTotals = {};
      if (wordbookId && record.wordbookTotalWords) {
        bookTotals[wordbookId] = record.wordbookTotalWords;
      }

      const studentProgress = reconcileStudentLearningProgress({
        studentId,
        progressData: learningProgress[studentId],
        studentMastery: wordMastery[studentId],
        learningRecords,
        bookTotals,
        updatedBookId: wordbookId,
        lastStudyTime,
        updatedAt: now
      });
      learningProgress[studentId] = studentProgress;
      
      // 保存更新后的进度数据
      wx.setStorageSync('learningProgress', learningProgress);
      console.log('学习进度已更新:', studentId, studentProgress.learnedWords);
      
      // 云同步：学习进度同步到云端，确保与 wordMastery 数据一致
      syncLearningProgress(studentId, studentProgress).catch(function(err) {
        console.warn('[app] learningProgress 云同步失败:', err);
      });
      
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
        content: '本地存储已接近上限，请清理旧数据以继续使用',
        showCancel: false,
        confirmText: '知道了'
      });
    } else if (usageInfo.isNearLimit) {
      wx.showModal({
        title: '存储警告',
        content: `本地存储已使用${usageInfo.percent.toFixed(1)}%，建议清理旧数据`,
        showCancel: true,
        cancelText: '稍后',
        confirmText: '去清理',
        success: (res) => {
          if (res.confirm) {
            // 跳转到记录页面进行清理
            wx.navigateTo({
              url: '/subpages/records/records'
            });
          }
        }
      });
    }
  },

  // 定期检查存储使用情况
  checkStorageRegularly: function(silent = false) {
    this.checkStorageUsage().then(usageInfo => {
      if (!silent && (usageInfo.isNearLimit || usageInfo.isOverLimit)) {
        this.showStorageWarning(usageInfo);
      } else if (silent) {
        console.log('启动阶段静默存储检查:', {
          used: usageInfo.used,
          total: usageInfo.total,
          percent: usageInfo.percent
        });
      }
    }).catch(error => {
      console.error('检查存储使用情况失败:', error);
    });
  },

  // 清理旧数据
  cleanupOldData: function(options = {}) {
    try {
      const { 
        days = 30, // 默认清理30天前的数据
        types = ['learningRecords'] // 默认只清理学习记录
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
        console.log(`清理了${deletedCount}条${days}天前的学习记录`);
      }

      return {
        success: true,
        deletedCount
      };
    } catch (error) {
      console.error('清理旧数据失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
});

