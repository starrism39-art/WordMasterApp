// pages/index/index.js
const { shouldIncludeAntiForgettingWord } = require('../../utils/anti-forgetting-filter.js');
const { getWordbookMasterySummary } = require('../../utils/learning-progress.js');
const { resolveCurrentWordbook, setCurrentWordbook } = require('../../utils/learning-context.js');
const { getWordbookStats } = require('../../utils/stats-engine.js');

Page({
  data: {
    userInfo: null,
    currentStudent: null,
    learningStats: {
      totalWords: 0,
      learnedWords: 0,
      dailyLearning: 0,
      weekStreak: 0
    },
    totalUnmasteredWords: 0,
    recentRecords: [],
    recommendedWordbooks: [],
    learningWordbooks: '',
    gradeWordbooks: [],
    showWordbookModal: false,
    loading: true,
    antiForgotTime: '无抗遗忘', // 抗遗忘时间信息
    isLoggedIn: false
  },

  onLoad: function() {
    console.log('========== [首页] onLoad 开始 ==========');
    
    // 立即设置加载状态为true
    this.setData({ loading: true });
    
    const app = getApp();
    
    // 恢复登录状态和学生信息
    try {
      // 从本地存储恢复当前用户
      const savedUser = wx.getStorageSync('currentUser');
      if (savedUser) {
        app.globalData.currentUser = savedUser;
        app.globalData.isLoggedIn = true;
        this.setData({ isLoggedIn: true });
        if (typeof app.migrateLegacyStudentsForUser === 'function') {
          app.migrateLegacyStudentsForUser(savedUser);
        }
      }
      
      // 从本地存储恢复学生信息
      // 优先从currentStudent键读取上次保存的学生信息
      const savedCurrentStudent = wx.getStorageSync('currentStudent');
      if (savedCurrentStudent && savedCurrentStudent.id) {
        console.log('从本地存储恢复上次的学生信息:', savedCurrentStudent.name);
        app.globalData.currentStudent = savedCurrentStudent;
        
        // 生成头像文本
        savedCurrentStudent.avatarText = this.generateAvatarText(savedCurrentStudent.name);
        this.setData({
          currentStudent: savedCurrentStudent
        });
      } else {
        // 如果没有保存的当前学生，使用学生列表的第一个学生
        let students = wx.getStorageSync('students') || [];
        const currentUser = app.globalData.currentUser || wx.getStorageSync('currentUser') || null;
        const currentUserId = currentUser && (currentUser.id || currentUser.username);
        if (currentUserId) {
          students = students.filter(s => s && (s.ownerId || s.ownerUsername) === currentUserId);
        }
        if (students.length > 0) {
            const currentStudent = students[0];
          app.globalData.currentStudent = currentStudent;
          
          // 生成头像文本
          currentStudent.avatarText = this.generateAvatarText(currentStudent.name);
          this.setData({
            currentStudent: currentStudent
          });
        } else {
          // 没有学生数据时，不自动创建，显示空状态
          app.globalData.currentStudent = null;
          this.setData({
            currentStudent: null
          });
        }
      }
    } catch (error) {
      console.error('恢复学生信息失败:', error);
    }
    
    // 启动同步只展示最终状态，禁止先报“待同步”又紧接着报成功。
    this.consumeStartupSyncNotice(app);

    // 注册 cloudSyncComplete 事件作为兜底（静默登录可能晚于 onLoad）
    if (app && app.on && !this._syncHandler) {
      this._syncHandler = () => {
        this.refreshAfterCloudSync();

        this.consumeStartupSyncNotice(app);
      };
      app.on('cloudSyncComplete', this._syncHandler);
    }

    // 异步加载更多数据
    setTimeout(() => {
      this.loadPageData();
    }, 100);
    
    // 注册学习记录更新事件监听器
    if (app && app.on) {
      // 保存回调函数引用以便后续移除
      this.learningRecordUpdateHandler = this.handleLearningRecordUpdate.bind(this);
      this.learningRecordDeleteHandler = this.handleLearningRecordDelete.bind(this);
      // 新增：单词掌握状态更新事件监听器
      this.wordMasteryUpdateHandler = () => {
        console.log('收到单词掌握状态更新事件，重新计算抗遗忘时间');
        this.calculateAntiForgotTime();
      };
      
      app.on('learningRecordAdded', this.learningRecordUpdateHandler);
      app.on('learningRecordDeleted', this.learningRecordDeleteHandler);
      // 新增：监听单词掌握状态更新事件
      app.on('wordMasteryUpdated', this.wordMasteryUpdateHandler);
      console.log('已注册学习记录更新和删除事件监听器，以及单词掌握状态更新事件监听器');
    }
  },

  consumeStartupSyncNotice: function(app) {
    if (!app || !app.globalData) return;
    const pending = Number(app.globalData.syncFreshPendingCount) || 0;
    const failed = app.globalData.syncFreshFailed === true;
    const completed = app.globalData.syncFreshCompleted === true;

    app.globalData.syncFreshPendingCount = 0;
    app.globalData.syncFreshFailed = false;
    app.globalData.syncFreshCompleted = false;

    if (pending > 0) {
      wx.showToast({
        title: '部分数据待同步',
        icon: 'none',
        duration: 2500
      });
      return;
    }
    if (failed) {
      wx.showToast({
        title: '云端同步失败，已使用本地数据',
        icon: 'none',
        duration: 2500
      });
      return;
    }
    if (completed) {
      wx.showToast({
        title: '可以开始学习了',
        icon: 'success',
        duration: 2000
      });
    }
  },

  refreshAfterCloudSync: function() {
    // 新客户端的云拉取发生在首页 onLoad/onShow 之后时，必须重新恢复
    // 学生/词书上下文并立即重算；否则原始记录已到本地但首页仍停留在 0。
    const app = getApp();
    const syncedStudent = this.resolveCurrentStudentWithFallback();
    const syncedWordbook = syncedStudent
      ? resolveCurrentWordbook(app, syncedStudent)
      : null;

    if (!syncedStudent) {
      return { student: null, wordbook: null };
    }

    this.setData({
      currentStudent: syncedStudent,
      currentWordbook: syncedWordbook || null,
      learningWordbooks: syncedWordbook
        ? (syncedWordbook.title || syncedWordbook.name || '未知词书')
        : '未知词书'
    });
    app.globalData.currentStudent = syncedStudent;
    if (syncedWordbook) {
      app.globalData.currentWordbook = syncedWordbook;
      app.globalData.selectedWordbook = syncedWordbook;
    }

    this.loadLearningStats();
    this.updateRealTimeStats(syncedStudent.id);
    this.loadRecentRecords();
    this.loadRecommendedWordbooks();
    this.calculateAntiForgotTime();

    return {
      student: syncedStudent,
      wordbook: syncedWordbook || null
    };
  },

  onUnload: function() {
    // 页面卸载时保存当前状态，确保最后一次操作被记录
    try {
      const currentStudent = this.data.currentStudent;
      if (currentStudent && currentStudent.id) {
        console.log('页面卸载，保存最后操作状态');
        // 保存当前页面所有关键状态到本地
        const pageStateKey = `${currentStudent.id}_pageState`;
        const pageState = {
          currentWordbook: this.data.currentWordbook,
          learningStats: this.data.learningStats,
          recentRecords: this.data.recentRecords,
          recommendedWordbooks: this.data.recommendedWordbooks,
          timestamp: Date.now()
        };
        wx.setStorageSync(pageStateKey, pageState);
        console.log('最后操作状态已保存');
      }
    } catch (error) {
      console.error('保存页面卸载状态失败:', error);
    }
    
    // 移除学习记录更新和删除事件监听器，避免内存泄漏
    const app = getApp();
    if (app && app.off) {
      if (this.learningRecordUpdateHandler) {
        app.off('learningRecordAdded', this.learningRecordUpdateHandler);
      }
      if (this.learningRecordDeleteHandler) {
        app.off('learningRecordDeleted', this.learningRecordDeleteHandler);
      }
      if (this._syncHandler) {
        app.off('cloudSyncComplete', this._syncHandler);
      }
      console.log('已移除学习记录相关事件监听器');
    }
  },
  
  // 处理学习记录删除事件
  handleLearningRecordDelete: function(data) {
    console.log('收到学习记录删除通知，重新加载主页数据:', data);
    // 重新加载最近学习记录
    this.loadRecentRecords();
    // 重新加载学习统计数据
    this.loadLearningStats();
    console.log('学习记录已删除并更新主页显示');
  },
  
  // 处理学习记录更新事件 - 增强版
  handleLearningRecordUpdate: function(newRecord) {
    console.log('收到新的学习记录，立即更新统计数据:', newRecord);
    
    // 优化：如果收到了具体的学习记录，可以直接更新相关统计，而不必重新加载所有数据
    if (newRecord && newRecord.studentId && String(newRecord.studentId) === String(this.data.currentStudent?.id)) {
      // 直接更新实时统计数据，响应更快
      this.updateRealTimeStats(newRecord.studentId);
      
      // 重新加载最近学习记录以显示最新的记录
      this.loadRecentRecords();
      
      // 有真实记录数据时才弹 Toast，提示用户学习数据已更新
      wx.showToast({
        title: '学习数据已更新',
        icon: 'success',
        duration: 800
      });
    } else {
      // 没有具体记录数据（来自云端同步事件），仅重新加载数据，不弹 Toast
      this.loadLearningStats();
      this.loadRecentRecords();
    }
    
    // 更新抗遗忘时间
    this.calculateAntiForgotTime();
  },
  
  // 保存当前页面状态到本地存储
  saveCurrentPageState: function() {
    try {
      const currentStudent = this.data.currentStudent;
      if (currentStudent && currentStudent.id) {
        console.log('保存当前页面状态');
        const pageStateKey = `${currentStudent.id}_pageState`;
        const pageState = {
          currentWordbook: this.data.currentWordbook,
          learningStats: this.data.learningStats,
          recentRecords: this.data.recentRecords,
          recommendedWordbooks: this.data.recommendedWordbooks,
          timestamp: Date.now()
        };
        wx.setStorageSync(pageStateKey, pageState);
        return true;
      }
      return false;
    } catch (error) {
      console.error('保存页面状态失败:', error);
      return false;
    }
  },

  resolveCurrentStudentWithFallback: function() {
    try {
      const app = getApp();
      const globalStudent = app?.globalData?.currentStudent;

      if (globalStudent && globalStudent.id) {
        const normalizedGlobalStudent = {
          ...globalStudent,
          avatarText: this.generateAvatarText(globalStudent.name)
        };
        wx.setStorageSync('currentStudent', normalizedGlobalStudent);
        wx.setStorageSync('selectedStudent', normalizedGlobalStudent);
        app.globalData.currentStudent = normalizedGlobalStudent;
        return normalizedGlobalStudent;
      }

      const currentUser = app?.globalData?.currentUser || wx.getStorageSync('currentUser') || null;
      const currentUserId = currentUser && (currentUser.id || currentUser.username);

      const allStudents = wx.getStorageSync('students') || [];
      const normalizedAllStudents = Array.isArray(allStudents) ? allStudents.filter(item => item && item.id) : [];
      let filteredStudents = normalizedAllStudents;

      if (currentUserId) {
        filteredStudents = normalizedAllStudents.filter(student => {
          return (student.ownerId || student.ownerUsername) === currentUserId;
        });
      }

      // 关键兜底：优先用 wx.getStorageSync('currentStudent')（学习页、学生选择页刚保存的），
      // 再降级到 students 数组中的第一个，确保多学生场景下上下文不丢失
      const storedStudent = wx.getStorageSync('currentStudent') || null;
      const firstFiltered = filteredStudents[0] || null;
      const firstAll = normalizedAllStudents[0] || null;

      // 如果存储的学生在 filteredStudents 或 allStudents 中存在，优先使用
      const storedMatch = storedStudent && (filteredStudents.some(s => String(s.id) === String(storedStudent.id)) || normalizedAllStudents.some(s => String(s.id) === String(storedStudent.id)));
      const fallbackStudent = storedMatch
        ? storedStudent
        : (firstFiltered || firstAll || storedStudent || null);

      if (fallbackStudent && fallbackStudent.id) {
        const normalizedFallbackStudent = {
          ...fallbackStudent,
          avatarText: this.generateAvatarText(fallbackStudent.name)
        };
        app.globalData.currentStudent = normalizedFallbackStudent;
        wx.setStorageSync('currentStudent', normalizedFallbackStudent);
        wx.setStorageSync('selectedStudent', normalizedFallbackStudent);
        console.log('首页学生兜底生效，使用学生:', normalizedFallbackStudent.name, normalizedFallbackStudent.id);
        return normalizedFallbackStudent;
      }

      return null;
    } catch (error) {
      console.error('首页学生兜底失败:', error);
      return null;
    }
  },
  
  onShow: function() {
    if (typeof this.getTabBar === 'function') {
      const tabBar = this.getTabBar();
      if (tabBar && typeof tabBar.setSelected === 'function') {
        tabBar.setSelected(0);
      } else if (tabBar && typeof tabBar.setData === 'function') {
        tabBar.setData({ selected: 0 });
      }
    }

    // 每次页面显示时更新学生信息和所有学习数据
    const app = getApp();
    const student = this.resolveCurrentStudentWithFallback();
    
    // 获取之前的学生ID，用于比较
    const previousStudentId = this.data.currentStudent?.id;
    
    if (student && student.id) {
      
      // 确保生成头像文本
      if (!student.avatarText || student.avatarText === '') {
        student.avatarText = this.generateAvatarText(student.name);
      }
      
      // 设置学生信息和加载状态
      this.setData({
        currentStudent: student,
        loading: true // 暂时保持加载状态，直到数据恢复完成
      });
      
      // 词书选择按学生隔离；学生级设置优先于全局兼容键，避免切换学生后串书。
      const selectedWordbook = resolveCurrentWordbook(app, student);
      
      // 如果找到了用户选择的词书，设置它
      if (selectedWordbook) {
        this.setData({
          currentWordbook: selectedWordbook,
          learningWordbooks: selectedWordbook.title || selectedWordbook.name || '未知词书'
        });
        // 同时更新全局数据
        app.globalData.currentWordbook = selectedWordbook;
      } else if (app.globalData.currentWordbook) {
        // 如果没有保存的词书选择，但全局数据中有，使用全局数据
        this.setData({
          currentWordbook: app.globalData.currentWordbook,
          learningWordbooks: app.globalData.currentWordbook.title || app.globalData.currentWordbook.name || '未知词书'
        });
      }
      
      // 仅在“已有学生且发生切换”时重置，避免首次进入把已恢复词书覆盖成未知
      if (previousStudentId && previousStudentId !== student.id) {
        console.log('学生发生变化，重新加载词书和学习数据');
        // 重置所有与学生相关的状态
        this.setData({
          recommendedWordbooks: [],
          learningStats: {
            totalWords: 0,
            learnedWords: 0,
            dailyLearning: 0,
            weekStreak: 0
          },
          totalUnmasteredWords: 0,
          recentRecords: [],
          currentWordbook: selectedWordbook || null,
          learningWordbooks: selectedWordbook
            ? (selectedWordbook.title || selectedWordbook.name || '未知词书')
            : '未知词书'
        });

        if (selectedWordbook) {
          setCurrentWordbook(app, student, selectedWordbook, { emit: false });
        } else {
          app.globalData.currentWordbook = null;
          app.globalData.selectedWordbook = null;
        }
      }
      
      // 更新学习词书信息
      this.updateLearningWordbooks();
      
      // 使用异步方式加载最新数据，确保页面响应性和数据实时性
      setTimeout(() => {
        console.log('开始加载最新数据，保持已恢复的状态');
        
        // 强制重新加载所有数据，确保使用新的学生ID
        this.loadLearningStats();
        this.updateRealTimeStats(student.id);
        this.loadRecentRecords();
        this.loadRecommendedWordbooks();
        this.calculateAntiForgotTime();
        
        // 数据加载完成后设置加载状态为false
        this.setData({ loading: false });
      }, 100); // 进一步缩短延迟时间，确保数据快速更新
    } else {
      // 没有学生数据时，显示空状态
      this.setData({
        currentStudent: null,
        loading: false
      });
    }
  },
  
  // 根据学生名字生成头像文本
  generateAvatarText: function(name) {
    if (!name || typeof name !== 'string') {
      return '学';
    }
    
    // 去除可能的空格
    name = name.trim();
    
    if (name.length <= 2) {
      // 两个字或更少，显示全部
      return name;
    } else {
      // 三个字或更多，只显示最后一个字（名）
      return name.slice(-1);
    }
  },

  // 设置默认模拟数据，确保页面能立即显示内容
  // 加载页面所有数据
  loadPageData: function() {
    try {
      this.loadRecentRecords();
      this.loadRecommendedWordbooks();
      this.loadLearningStats();
      // 只使用实时数据，不使用模拟数据
      this.setData({ loading: false });
      
      // 计算抗遗忘时间
      this.calculateAntiForgotTime();
    } catch (error) {
      console.error('加载页面数据失败:', error);
      this.setData({
        loading: false,
        hasError: true,
        errorMessage: '数据加载失败'
      });
    }
  },
  
  // 跳转到学习记录页面
  goToRecords: function() {
    // 保存当前状态
    this.saveCurrentPageState();
    wx.navigateTo({ url: '/subpages/records/records' });
  },
  
  // 加载最近学习记录
  loadRecentRecords: function() {
    try {
      const app = getApp();
      const student = this.data.currentStudent;
      
      // 无论是否有学生信息，都尝试获取学习记录
      let records = [];
      
      if (student && student.id) {
        // 最近记录严格按当前学生 + 当前词书读取，避免切换词书后混入旧词书记录。
        const currentWordbook = this.data.currentWordbook || resolveCurrentWordbook(app, student);
        records = currentWordbook && currentWordbook.id
          ? app.getLearningRecords(student.id, currentWordbook.id)
          : [];
        
        // 即使没有找到该学生的记录，也不获取所有记录，保持空记录
        // 这样可以确保只显示当前学生的记录
      } else {
        // 没有学生信息时，不获取任何记录
        console.log('没有学生信息，不获取学习记录');
        records = [];
      }
      
      // 调试信息：打印原始记录
      console.log('原始学习记录:', records);
      
      // 数据去重 - 使用Set基于id去重
      const uniqueRecords = [];
      const idSet = new Set();
      
      records.forEach(record => {
        // 使用id作为唯一标识，如果没有id则使用时间戳+随机数作为临时标识
        const recordId = record.id || `${record.timestamp || Date.now()}-${record.studentId || 'unknown'}`;
        
        if (!idSet.has(recordId)) {
          idSet.add(recordId);
          uniqueRecords.push(record);
        }
      });
      
      // 调试信息：打印去重后的记录
      console.log('去重后的学习记录:', uniqueRecords);
      
      // 格式化记录，添加时间戳和格式化日期
      const formattedRecords = uniqueRecords.map(record => {
        // 确保有日期字段，与saveLearningRecord函数保持一致
        const recordDate = record.studyDate || record.learningDate || record.date || record.timestamp;
        // 只有当有有效日期时才处理，否则跳过
        if (!recordDate) {
          return null;
        }
        const date = new Date(recordDate);
        
        // 格式化时间为友好显示
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        let formattedDate;
        if (diffDays === 0) {
          // 今天
          formattedDate = '今天 ' + date.getHours().toString().padStart(2, '0') + ':' + 
                          date.getMinutes().toString().padStart(2, '0');
        } else if (diffDays === 1) {
          // 昨天
          formattedDate = '昨天 ' + date.getHours().toString().padStart(2, '0') + ':' + 
                          date.getMinutes().toString().padStart(2, '0');
        } else if (diffDays < 7) {
          // 一周内
          const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
          formattedDate = '周' + weekdays[date.getDay()] + ' ' + 
                          date.getHours().toString().padStart(2, '0') + ':' + 
                          date.getMinutes().toString().padStart(2, '0');
        } else {
          // 超过一周，显示完整年月日
          formattedDate = date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日';
        }
        
        return {
          ...record,
          id: record.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
          timestamp: recordDate,
          formattedDate: formattedDate,
          // 确保有必要的字段 - 使用与saveLearningRecord一致的字段名称
          wordCount: record.totalWords || record.wordCount || 0,
          wordbookName: record.wordbookTitle || record.wordbookName || '未知词书'
        };
      });
      
      // 调试信息：打印格式化后的记录
      console.log('格式化后的学习记录:', formattedRecords);
      
      // 过滤掉null记录，按时间倒序排列，取最近5条
      const sortedRecords = formattedRecords.filter(record => record !== null).sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
      }).slice(0, 5);
      
      // 调试信息：打印最终显示的记录
      console.log('加载到的学习记录:', sortedRecords);
      
      // 如果没有学习记录，显示空状态
      if (sortedRecords.length === 0) {
        console.log('没有学习记录，显示空状态');
        this.setData({
          recentRecords: []
        });
      } else {
        this.setData({ recentRecords: sortedRecords });
      }
    } catch (error) {
      console.error('加载学习记录失败:', error);
      // 错误情况下也显示空状态，不使用模拟数据
      this.setData({
        recentRecords: []
      });
    }
  },
  
  // 加载推荐词书
  loadRecommendedWordbooks: function() {
    try {
      const app = getApp();
      const currentStudent = this.data.currentStudent;
      let recommendedWordbooks = [];
      
      // 根据学生年级推荐词书
      if (currentStudent && currentStudent.grade) {
        // 使用与showGradeWordbooks相同的年级识别逻辑
        const studentGrade = currentStudent.grade || '';
        const gradeStr = studentGrade.toString().toLowerCase().trim();
        let targetGrade = '小学'; // 默认小学
        let specificGrade = null;
        let gradeLevel = null; // 具体年级级别（如：初一、初二、初三、高一、高二、高三）
        
        console.log('学生年级字符串:', gradeStr);
        
        // 确保年级识别的正确性，避免错误匹配
        try {
          // 改进的年级数字提取逻辑，支持更多格式
          const gradeMatch = gradeStr.match(/(\d+)/);
          if (gradeMatch && gradeMatch[1]) {
            specificGrade = parseInt(gradeMatch[1], 10);
            console.log('提取到具体年级数字:', specificGrade);
            
            // 严格的数字范围检查并确定具体级别
            if (specificGrade >= 1 && specificGrade <= 6) {
              targetGrade = '小学';
              gradeLevel = specificGrade + '年级';
            } else if (specificGrade >= 7 && specificGrade <= 9) {
              targetGrade = '初中';
              gradeLevel = specificGrade === 7 ? '初一' : 
                          (specificGrade === 8 ? '初二' : '初三');
            } else if (specificGrade >= 10 && specificGrade <= 12) {
              targetGrade = '高中';
              gradeLevel = specificGrade === 10 ? '高一' : 
                          (specificGrade === 11 ? '高二' : '高三');
            } else {
              console.log('年级数字超出范围:', specificGrade, '默认为小学');
              targetGrade = '小学';
            }
          } else {
            console.log('未提取到年级数字，将通过文字判断');
            // 通过文字判断并提取具体级别
            if (gradeStr.includes('高中') || gradeStr.includes('高一') || gradeStr.includes('高二') || gradeStr.includes('高三')) {
              targetGrade = '高中';
              if (gradeStr.includes('高一')) gradeLevel = '高一';
              else if (gradeStr.includes('高二')) gradeLevel = '高二';
              else if (gradeStr.includes('高三')) gradeLevel = '高三';
            } else if (gradeStr.includes('初中') || gradeStr.includes('初一') || gradeStr.includes('初二') || gradeStr.includes('初三')) {
              targetGrade = '初中';
              if (gradeStr.includes('初一')) gradeLevel = '初一';
              else if (gradeStr.includes('初二')) gradeLevel = '初二';
              else if (gradeStr.includes('初三')) gradeLevel = '初三';
            } else {
              // 尝试从文字中提取小学年级
              if (gradeStr.includes('一年级')) {
                targetGrade = '小学';
                gradeLevel = '1年级';
              } else if (gradeStr.includes('二年级')) {
                targetGrade = '小学';
                gradeLevel = '2年级';
              } else if (gradeStr.includes('三年级')) {
                targetGrade = '小学';
                gradeLevel = '3年级';
              } else if (gradeStr.includes('四年级')) {
                targetGrade = '小学';
                gradeLevel = '4年级';
              } else if (gradeStr.includes('五年级')) {
                targetGrade = '小学';
                gradeLevel = '5年级';
              } else if (gradeStr.includes('六年级')) {
                targetGrade = '小学';
                gradeLevel = '6年级';
              } else {
                // 所有其他情况默认为小学
                console.log('未明确识别出高中/初中/具体年级，默认为小学阶段');
                targetGrade = '小学';
              }
            }
          }
      } catch (error) {
          console.error('年级识别出错:', error);
          targetGrade = '小学'; // 出错时默认为小学，确保安全
        }
        
        // 修改后的安全验证，确保明确识别为高中阶段的学生（通过具体年级级别）能正确匹配高中词书
        if (targetGrade === '高中' && (specificGrade === null || specificGrade < 10)) {
          // 即使没有具体年级数字，只要明确识别出高中具体年级级别，就保留高中阶段
          if (gradeLevel === '高一' || gradeLevel === '高二' || gradeLevel === '高三') {
            console.log(`安全检查: 明确识别为${gradeLevel}，保留高中阶段`);
          } else {
            console.log('安全检查: 未明确识别为高中具体年级，重置为小学');
            targetGrade = '小学';
            gradeLevel = null;
          }
        }
        
        console.log(`学生${currentStudent.name}(${currentStudent.grade})被识别为${targetGrade}阶段${gradeLevel ? '，具体级别：' + gradeLevel : ''}`);
      // 针对高中学生特别是高二学生增加详细日志
      if (targetGrade === '高中') {
        console.log(`高中学生匹配调试: specificGrade=${specificGrade}, gradeLevel=${gradeLevel}`);
      }
        
        // 根据识别的年级阶段生成推荐词书
        if (targetGrade === '小学') {
          recommendedWordbooks = [
            {
              id: 'p1',
              title: gradeLevel ? `${gradeLevel}英语词汇` : '小学英语基础词汇',
              category: '英语',
              grade: '小学',
              description: gradeLevel ? `${gradeLevel}必备词汇` : '小学必备词汇，涵盖基础单词和日常用语',
              totalWords: gradeLevel ? 600 : 600,
              coverImage: '/images/avatar_default.png'
            },
            {
              id: 'p2',
              title: '小学英语核心单词',
              category: '英语',
              grade: '小学',
              description: '小学重点单词',
              totalWords: 400,
              coverImage: '/images/avatar_default.png'
            },
            {
              id: 'p3',
              title: '小学英语日常会话词汇',
              category: '英语',
              grade: '小学',
              description: '日常生活中常用的英语对话词汇',
              totalWords: 300,
              coverImage: '/images/avatar_default.png'
            }
          ];
        } else if (targetGrade === '初中') {
          recommendedWordbooks = [
            {
              id: 'j1',
              title: gradeLevel || '初中英语核心词汇',
              category: '英语',
              grade: '初中',
              description: gradeLevel ? `${gradeLevel}必备词汇` : '初中必备词汇，覆盖初中三年学习内容',
              totalWords: gradeLevel ? 1000 : 1200,
              coverImage: '/images/avatar_default.png'
            },
            {
              id: 'j2',
              title: '中考高频词汇',
              category: '英语',
              grade: '初三',
              description: '中考常考词汇，助力备考冲刺',
              totalWords: 800,
              coverImage: '/images/avatar_default.png'
            },
            {
              id: 'j3',
              title: '初中英语语法词汇',
              category: '英语',
              grade: '初中',
              description: '结合语法学习的重点词汇',
              totalWords: 600,
              coverImage: '/images/avatar_default.png'
            }
          ];
        } else if (targetGrade === '高中') {
          // 为高中不同年级提供更精确的词书推荐
          recommendedWordbooks = [
            {
              id: 's1',
              title: gradeLevel || '高中英语核心词汇',
              category: '英语',
              grade: '高中',
              description: gradeLevel ? `${gradeLevel}必备词汇` : '高中阶段必备词汇，覆盖高考要求',
              totalWords: gradeLevel ? 1800 : 2000,
              coverImage: '/images/avatar_default.png'
            }
          ];
          
          // 针对高二学生添加特定词书
          if (gradeLevel === '高二') {
            recommendedWordbooks.push(
              {
                id: 's2',
                title: '高二专题词汇突破',
                category: '英语',
                grade: '高二',
                description: '高二阶段重点词汇和词组，强化词汇应用能力',
                totalWords: 1600,
                coverImage: '/images/avatar_default.png'
              },
              {
                id: 's3',
                title: '高二阅读理解核心词汇',
                category: '英语',
                grade: '高二',
                description: '提高高二阅读理解能力的高频词汇',
                totalWords: 1200,
                coverImage: '/images/avatar_default.png'
              }
            );
          } else {
            // 其他高中年级保持原有推荐
            recommendedWordbooks.push(
              {
                id: 's2',
                title: '高考高频词汇',
                category: '英语',
                grade: '高三',
                description: '高考重点词汇，提高备考效率',
                totalWords: 1500,
                coverImage: '/images/avatar_default.png'
              },
              {
                id: 's3',
                title: '高中英语阅读词汇',
                category: '英语',
                grade: '高中',
                description: '提升阅读理解能力的重点词汇',
                totalWords: 1000,
                coverImage: '/images/avatar_default.png'
              }
            );
          }
        }
      } else {
        // 没有学生信息时，显示通用词书
        recommendedWordbooks = [
          {
            id: 'g1',
            title: '基础英语词汇',
            category: '英语',
            grade: '通用',
            description: '适合所有学习者的基础英语词汇',
            totalWords: 800,
            coverImage: '/images/avatar_default.png'
          },
          {
            id: 'g2',
            title: '日常英语会话词汇',
            category: '英语',
            grade: '通用',
            description: '日常生活中常用的英语对话词汇',
            totalWords: 500,
            coverImage: '/images/avatar_default.png'
          }
        ];
      }
      
      // 加载实时学习进度
      if (currentStudent && currentStudent.id) {
        try {
          // 词书卡片与首页核心统计使用相同的 wordMastery 优先口径。
          const learningProgress = wx.getStorageSync('learningProgress') || {};
          const wordMastery = wx.getStorageSync('wordMastery') || {};
          const studentProgress = learningProgress[currentStudent.id] || {};
          const studentWordbooksProgress = studentProgress.wordbooks || {};
          const studentMastery = wordMastery[currentStudent.id] || {};
          
          // 为每个推荐词书添加实时进度
          recommendedWordbooks = recommendedWordbooks.map(wordbook => {
            const bookProgress = studentWordbooksProgress[wordbook.id] || { completedCount: 0, totalCount: wordbook.totalWords };
            const masterySummary = getWordbookMasterySummary(wordbook.id, studentMastery[wordbook.id]);
            const override = wx.getStorageSync(`wordbook_stats_${currentStudent.id}_${wordbook.id}`) || null;
            const sharedStats = getWordbookStats(currentStudent.id, wordbook.id);
            const completedCount = masterySummary.entryCount > 0 || (override && override.isManualOverride)
              ? sharedStats.masteredCount
              : (bookProgress.completedCount || bookProgress.learnedWords || 0);
            const totalCount = bookProgress.totalCount || wordbook.totalWords;
            const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
            
            return {
              ...wordbook,
              progress: progressPercent,
              completedCount: completedCount,
              totalCount: totalCount
            };
          });
          
          console.log('推荐词书加载完成，包含实时进度数据:', recommendedWordbooks);
      } catch (error) {
          console.error('加载学习进度失败:', error);
          // 错误态保持确定性的 0，避免不同设备显示随机进度。
          recommendedWordbooks = recommendedWordbooks.map(wordbook => ({
            ...wordbook,
            progress: 0
          }));
        }
      } else {
        // 没有学生时不展示虚构进度。
        recommendedWordbooks = recommendedWordbooks.map(wordbook => ({
          ...wordbook,
          progress: 0
        }));
      }
      
      this.setData({ recommendedWordbooks: recommendedWordbooks });
    } catch (error) {
      console.error('加载推荐词书失败:', error);
      // 设置默认的推荐词书
      this.setData({ 
        recommendedWordbooks: [
          {
            id: '1',
            title: '初中英语必备词汇',
            category: '英语',
            grade: '初中',
            description: '涵盖初中阶段核心英语词汇，适合初一至初三学生使用',
            totalWords: 1200,
            coverImage: '/images/avatar_default.png',
            progress: 0
          }
        ] 
      });
    }
  },

  loadLearningStats: function() {
    try {
      const app = getApp();
      const student = this.data.currentStudent;        

      if (student && student.id) {
        // 从存储中获取学生的学习统计数据作为初始值
        const statsKey = student.id + '_stats';
        let stats = wx.getStorageSync(statsKey) || {};
        
        // 确保统计数据完整性，防止显示undefined
        stats = {
          totalWords: stats.totalWords || 0,
          learnedWords: stats.learnedWords || 0,
          dailyLearning: stats.dailyLearning || 0,
          weekStreak: stats.weekStreak || 0
        };
        
        // 立即设置数据，确保页面响应速度
        this.setData({ learningStats: stats });
        
        // 立即调用实时更新方法，确保数据最新
        this.updateRealTimeStats(student.id);
      }
    } catch (error) {
      console.error('加载学习统计失败:', error);
      // 出错时仍显示基本数据，避免空白
      this.setData({
        learningStats: {
          totalWords: 0,
          learnedWords: 0,
          dailyLearning: 0,
          weekStreak: 0
        },
        totalUnmasteredWords: 0
      });
    }
  },
  
  // 更新实时统计数据
  updateRealTimeStats: function(studentId) {
    try {
      console.log('开始更新实时统计数据:', new Date().toLocaleTimeString());
      
      // 获取最新的学习记录
      const learningRecords = wx.getStorageSync('learningRecords') || [];
      const app = getApp();
      const currentStudent = this.data.currentStudent || app.globalData.currentStudent;
      const currentWordbook = this.data.currentWordbook || resolveCurrentWordbook(app, currentStudent);

      const studentRecords = learningRecords.filter(record =>
        String(record.studentId) === String(studentId) &&
        currentWordbook &&
        String(record.wordbookId || '') === String(currentWordbook.id)
      );
      
      // 计算今日学习数据 - 更精确的时间计算
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // 使用Set来存储今日学习的所有单词ID，确保去重
      const todayLearnedWordIds = new Set();
      
      // 处理今日记录，收集所有学习的单词ID
      studentRecords.forEach(record => {
        const recordDate = new Date(record.studyDate || record.learningDate || record.timestamp || record.date);
        const recordDay = new Date(recordDate);
        recordDay.setHours(0, 0, 0, 0);
        
        // 只处理今天的记录
        if (recordDay.getTime() === today.getTime()) {
          // 优先使用learnedWordIds数组，这包含了本次学习的所有单词ID
          if (record.learnedWordIds && Array.isArray(record.learnedWordIds)) {
            record.learnedWordIds.forEach(wordId => todayLearnedWordIds.add(wordId));
          } else if (record.studyWords && Array.isArray(record.studyWords)) {
            // 兼容studyWords字段
            record.studyWords.forEach(wordId => todayLearnedWordIds.add(wordId));
          } else if (record.totalWords) {
            // 如果没有learnedWordIds，至少使用totalWords作为后备
            // 注意：这可能会导致重复计算，但比不显示好
            console.log('记录缺少learnedWordIds，使用totalWords作为参考:', record.totalWords);
          }
        }
      });
      
      // 今日学习单词数就是去重后的单词数量
      const todayWords = todayLearnedWordIds.size;
      
      console.log('今日学习单词数(去重后):', todayWords);
      console.log('今日学习记录数:', studentRecords.filter(record => {
        const recordDate = new Date(record.studyDate || record.learningDate || record.timestamp || record.date);
        const recordDay = new Date(recordDate);
        recordDay.setHours(0, 0, 0, 0);
        return recordDay.getTime() === today.getTime();
      }).length);
      
      // 获取学习进度数据
      const learningProgress = wx.getStorageSync('learningProgress') || {};

      // 获取单词掌握记录
      const wordMastery = wx.getStorageSync('wordMastery') || {};
      const studentMastery = wordMastery[studentId] || {};

      // 首页统计口径：严格按「当前学生 + 当前词书」统计；无当前词书时保持为 0。
      let totalWords = 0;
      let learnedWords = 0;
      let unmasteredWords = 0;
      let checkinDays = 0;

      if (currentWordbook && currentWordbook.id) {
        totalWords =
          currentWordbook.totalWords ||
          (currentWordbook.words ? currentWordbook.words.length : 0) ||
          0;

        // 优先从 wordMastery 中计算「当前词书」已学/未掌握单词数
        const wordbookMastery = studentMastery && studentMastery[currentWordbook.id];
        const masterySummary = getWordbookMasterySummary(currentWordbook.id, wordbookMastery);
        const override = wx.getStorageSync(`wordbook_stats_${studentId}_${currentWordbook.id}`) || null;
        const sharedStats = getWordbookStats(studentId, currentWordbook.id);
        checkinDays = sharedStats.checkinDays;
        if (masterySummary.entryCount > 0 || (override && override.isManualOverride)) {
          learnedWords = sharedStats.masteredCount;
          unmasteredWords = sharedStats.notMasteredCount;
        } else {
          // 后备：使用 learningProgress[studentId].wordbooks[wordbookId]，不做跨词书汇总
          const studentProgress = learningProgress[studentId] || {};
          const studentWordbooksProgress = studentProgress.wordbooks || {};
          const bookProgress = studentWordbooksProgress[currentWordbook.id] || {};
          learnedWords = bookProgress.completedCount || bookProgress.learnedWords || 0;
          if (totalWords === 0) {
            totalWords = bookProgress.totalCount || 0;
          }
          // 后备逻辑无法计算未掌握数，置为 0
          unmasteredWords = 0;
        }
      } else {
        // 没有当前词书：不再跨词书汇总，避免把不同词书混到首页统计里
        totalWords = 0;
        learnedWords = 0;
        unmasteredWords = 0;
        checkinDays = 0;
      }
      
      console.log('首页统计数据诊断:', JSON.stringify({
        currentWordbookId: currentWordbook ? currentWordbook.id : 'NULL',
        currentWordbookTitle: currentWordbook ? currentWordbook.title : 'NULL',
        totalWords: totalWords,
        learnedWords: learnedWords,
        unmasteredWords: unmasteredWords,
        wordMasteryStudentKeys: Object.keys(studentMastery),
        wordMasteryWordbookKeys: studentMastery ? Object.keys(studentMastery) : [],
        wordMasteryCurrentBookWordCount: studentMastery && currentWordbook && studentMastery[currentWordbook.id] 
          ? Object.keys(studentMastery[currentWordbook.id]).length : 0,
        hasWordMastery: Object.keys(studentMastery).length > 0
      }));
      
      // 合并并更新统计数据
      const updatedStats = {
        totalWords: totalWords,
        learnedWords: learnedWords,
        dailyLearning: todayWords,
        weekStreak: checkinDays
      };
      
      // 立即更新到页面数据
      this.setData({
        learningStats: updatedStats,
        totalUnmasteredWords: unmasteredWords
      }, () => {
        console.log('统计数据已更新到页面:', updatedStats);
      });
      
      // 同时更新到存储
      const statsKey = studentId + '_stats';
      wx.setStorageSync(statsKey, updatedStats);
      
      // 保存当前页面状态
      this.saveCurrentPageState();
    } catch (error) {
      console.error('更新实时统计数据失败:', error);
    }
  },

  // 更新当前学习词书信息
  updateLearningWordbooks: function() {
    try {
      const app = getApp();
      if (app.globalData) {
        let selectedWordbook = null;
        
        // 优先使用currentWordbook，如果不存在则使用selectedWordbook
        if (app.globalData.currentWordbook) {
          selectedWordbook = app.globalData.currentWordbook;
          console.log('从globalData同步词书信息:', selectedWordbook.title);
        } else if (app.globalData.selectedWordbook) {
          selectedWordbook = app.globalData.selectedWordbook;
          console.log('从globalData同步选中词书信息:', selectedWordbook.title);
          // 确保两个变量保持同步
          app.globalData.currentWordbook = selectedWordbook;
        }
        
        if (selectedWordbook) {
          // 更新当前词书和显示名称
          this.setData({
            currentWordbook: selectedWordbook,
            learningWordbooks: selectedWordbook.title || selectedWordbook.name || '未知词书'
          });
          
          // 词书改变时重新计算抗遗忘时间
          this.calculateAntiForgotTime();
          
          // 词书改变时立即更新统计数据
          if (this.data.currentStudent) {
            this.updateRealTimeStats(this.data.currentStudent.id);
          }
        }
      }
    } catch (error) {
      console.error('更新学习词书信息失败:', error);
    }
  },
  
  // 计算抗遗忘时间
  calculateAntiForgotTime: function() {
    console.log('计算抗遗忘时间');
    try {
      const app = getApp();
      const currentStudent = app.globalData.currentStudent;
      const currentWordbook = app.globalData.currentWordbook;
      
      if (!currentStudent || !currentWordbook) {
        this.setData({ antiForgotTime: '没有' });
        return;
      }
      
      const studentId = currentStudent.id;
      const wordbookId = currentWordbook.id;
      
      // 获取单词掌握记录
      let wordMastery = wx.getStorageSync('wordMastery') || {};
      
      // 不再创建测试数据，确保只在有真实学习记录时显示抗遗忘时间
      if (!wordMastery[studentId] || !wordMastery[studentId][wordbookId]) {
        console.log('首页：没有找到单词掌握记录，显示"没有"抗遗忘时间');
        this.setData({ antiForgotTime: '没有' });
        return;
      }
      
      if (wordMastery[studentId] && wordMastery[studentId][wordbookId]) {
        const masteredWords = wordMastery[studentId][wordbookId];
        console.log('首页：单词掌握记录:', masteredWords);
        const now = new Date().getTime();
        let hasTodayReview = false;
        let nearestReviewTime = null;
        const hasScopedWordIds = Object.keys(masteredWords)
          .some((wordId) => String(wordId).startsWith(`${wordbookId}_`));

        // 首页提示与抗遗忘列表使用同一来源、作用域、五轮和到期口径。
        for (const wordId in masteredWords) {
          const filterResult = shouldIncludeAntiForgettingWord(wordId, masteredWords[wordId], {
            studentId,
            wordbookId,
            now,
            hasScopedWordIds
          });
          if (filterResult.include) {
            hasTodayReview = true;
            continue;
          }
          if (
            filterResult.reason === 'not_due' &&
            filterResult.scheduledTime >= now &&
            (!nearestReviewTime || filterResult.scheduledTime < nearestReviewTime)
          ) {
            nearestReviewTime = filterResult.scheduledTime;
          }
        }
        
        // 格式化今天的日期
        const todayDate = new Date();
        const year = todayDate.getFullYear();
        const month = String(todayDate.getMonth() + 1).padStart(2, '0');
        const day = String(todayDate.getDate()).padStart(2, '0');
        const formattedToday = `${year}-${month}-${day}`;
        
        if (hasTodayReview) {
          // 当天有抗遗忘复习
          console.log('首页：当天有抗遗忘复习');
          this.setData({ antiForgotTime: `${formattedToday} 有抗遗忘` });
        } else if (nearestReviewTime) {
          // 当天无抗遗忘复习，显示下次复习时间
          const reviewDate = new Date(nearestReviewTime);
          const reviewYear = reviewDate.getFullYear();
          const reviewMonth = String(reviewDate.getMonth() + 1).padStart(2, '0');
          const reviewDay = String(reviewDate.getDate()).padStart(2, '0');
          const formattedReviewDate = `${reviewYear}-${reviewMonth}-${reviewDay}`;
          console.log('首页：当天无抗遗忘复习，下次复习时间:', formattedReviewDate);
          this.setData({ antiForgotTime: `${formattedToday} 无抗遗忘，下次复习时间：${formattedReviewDate}` });
        } else {
          // 没有复习时间
          console.log('首页：没有复习时间');
          this.setData({ antiForgotTime: `${formattedToday} 无抗遗忘` });
        }
      } else {
        // 格式化今天的日期
        const todayDate = new Date();
        const year = todayDate.getFullYear();
        const month = String(todayDate.getMonth() + 1).padStart(2, '0');
        const day = String(todayDate.getDate()).padStart(2, '0');
        const formattedToday = `${year}-${month}-${day}`;
        
        console.log('首页：没有单词掌握记录');
        this.setData({ antiForgotTime: `${formattedToday} 无抗遗忘` });
      }
    } catch (error) {
      console.error('计算抗遗忘时间失败:', error);
      // 出错时显示今天的日期和无抗遗忘
      const todayDate = new Date();
      const year = todayDate.getFullYear();
      const month = String(todayDate.getMonth() + 1).padStart(2, '0');
      const day = String(todayDate.getDate()).padStart(2, '0');
      this.setData({ antiForgotTime: `${year}-${month}-${day} 无抗遗忘` });
    }
  },

  // 显示年级词书选择模态框
  showGradeWordbooks: function() {
    console.log('切换词书按钮被点击');
    
    try {
      // 先显示一个提示，确认函数被调用
      wx.showToast({
        title: '正在加载词书...',
        icon: 'loading',
        duration: 1000
      });
      
      // 检查是否有学生数据
      if (!this.data.currentStudent) {
        setTimeout(() => {
          wx.showToast({
            title: '请先选择学生',
            icon: 'none'
          });
        }, 1000);
        return;
      }
      
      const currentStudent = this.data.currentStudent;
      let gradeWordbooks = [];
      
      // 重置之前可能存在的词书列表
      this.setData({
        gradeWordbooks: [],
        showWordbookModal: false
      });
      
      // 获取学生年级并确定阶段 - 严格按照1-6年级小学，7-9年级初中，10-12年级高中
      const studentGrade = currentStudent.grade || '';
      const gradeStr = studentGrade.toString().toLowerCase().trim();
      let targetGrade = '小学'; // 默认小学
      let specificGrade = null;
      let gradeLevel = null; // 具体年级级别（如：初一、初二、初三、高一、高二、高三）
      
      console.log('学生年级字符串:', gradeStr);
      console.log('当前学生完整信息:', currentStudent);
      
      // 确保年级识别的正确性，避免错误匹配
      // 改进的年级数字提取逻辑，支持阿拉伯数字和中文数字
      // 将中文数字转换为阿拉伯数字
      // 重要：长字符串必须放在前面，避免被短字符串匹配
      const chineseGradeMap = {
        "高一年级": 10,
        "高二年级": 11,
        "高三年级": 12,
        "十年级": 10,
        "十一年级": 11,
        "十二年级": 12,
        "十二": 12,
        "十一": 11,
        "十": 10,
        "高一": 10,
        "高二": 11,
        "高三": 12
      };
      
      let gradeMatch = gradeStr.match(/(\d+)/);
      if (gradeMatch && gradeMatch[1]) {
        specificGrade = parseInt(gradeMatch[1], 10);
        console.log('提取到具体年级数字:', specificGrade);
        
        // 严格的数字范围检查并确定具体级别
        if (specificGrade >= 1 && specificGrade <= 6) {
          targetGrade = '小学';
          gradeLevel = specificGrade + '年级';
        } else if (specificGrade >= 7 && specificGrade <= 9) {
          targetGrade = '初中';
          gradeLevel = specificGrade === 7 ? '初一' : 
                      (specificGrade === 8 ? '初二' : '初三');
        } else if (specificGrade >= 10 && specificGrade <= 12) {
          targetGrade = '高中';
          gradeLevel = specificGrade === 10 ? '高一' : 
                      (specificGrade === 11 ? '高二' : '高三');
        } else {
          console.log('年级数字超出范围:', specificGrade, '默认为小学');
          targetGrade = '小学';
        }
      } else {
        // 检查中文数字
        let chineseGrade = null;
        for (const [chinese, arabic] of Object.entries(chineseGradeMap)) {
          if (gradeStr.includes(chinese)) {
            chineseGrade = arabic;
            break;
          }
        }
        
        if (chineseGrade) {
          specificGrade = chineseGrade;
          console.log('提取到中文年级数字:', specificGrade);
          
          targetGrade = '高中';
          gradeLevel = specificGrade === 10 ? '高一' : 
                      (specificGrade === 11 ? '高二' : '高三');
        } else {
          console.log('未提取到年级数字，将通过文字判断');
          // 通过文字判断并提取具体级别
          if (gradeStr.includes('高中') || gradeStr.includes('高一') || gradeStr.includes('高二') || gradeStr.includes('高三') || gradeStr.includes('十年级') || gradeStr.includes('十一年级') || gradeStr.includes('十二年级')) {
            targetGrade = '高中';
            if (gradeStr.includes('高一') || gradeStr.includes('十年级')) gradeLevel = '高一';
            else if (gradeStr.includes('高二') || gradeStr.includes('十一年级')) gradeLevel = '高二';
            else if (gradeStr.includes('高三') || gradeStr.includes('十二年级')) gradeLevel = '高三';
          } else if (gradeStr.includes('初中') || gradeStr.includes('初一') || gradeStr.includes('初二') || gradeStr.includes('初三') || gradeStr.includes('七年级') || gradeStr.includes('八年级') || gradeStr.includes('九年级')) {
            targetGrade = '初中';
            if (gradeStr.includes('初一') || gradeStr.includes('七年级')) gradeLevel = '初一';
            else if (gradeStr.includes('初二') || gradeStr.includes('八年级')) gradeLevel = '初二';
            else if (gradeStr.includes('初三') || gradeStr.includes('九年级')) gradeLevel = '初三';
          } else {
            // 尝试从文字中提取小学年级
            if (gradeStr.includes('一年级')) {
              targetGrade = '小学';
              gradeLevel = '1年级';
            } else if (gradeStr.includes('二年级')) {
              targetGrade = '小学';
              gradeLevel = '2年级';
            } else if (gradeStr.includes('三年级')) {
              targetGrade = '小学';
              gradeLevel = '3年级';
            } else if (gradeStr.includes('四年级')) {
              targetGrade = '小学';
              gradeLevel = '4年级';
            } else if (gradeStr.includes('五年级')) {
              targetGrade = '小学';
              gradeLevel = '5年级';
            } else if (gradeStr.includes('六年级')) {
              targetGrade = '小学';
              gradeLevel = '6年级';
            } else {
              // 所有其他情况默认为小学，避免小学生看到高中词书
              console.log('未明确识别出高中/初中/具体年级，默认为小学阶段');
              targetGrade = '小学';
            }
          }
        }
      }
      
      // 简化安全验证，信任年级识别结果
      if (targetGrade === '高中') {
        console.log(`学生已识别为高中阶段，显示高中词书`);
      } else if (targetGrade === '初中') {
        console.log(`学生已识别为初中阶段，显示初中词书`);
      } else {
        console.log(`学生已识别为小学阶段，显示小学词书`);
      }
      
      console.log(`学生${currentStudent.name}(${currentStudent.grade})被识别为${targetGrade}阶段${gradeLevel ? '，具体级别：' + gradeLevel : ''}`);
      
      // 导入词书数据
      let allWordbooks = [];
      try {
        // 正确导入词书模块
        const wordbooksModule = require('../../data/wordbooks.js');
        
        // 合并小学、初中、高中词书数组
        if (wordbooksModule) {
          const { primary = [], junior = [], senior = [] } = wordbooksModule;
          allWordbooks = [...primary, ...junior, ...senior];
          console.log('成功加载词书数据，共', allWordbooks.length, '本词书');
          console.log('词书详情:', allWordbooks.map(w => ({id: w.id, title: w.title, grade: w.grade})));
        } else {
          console.error('词书数据格式不正确');
          allWordbooks = [];
        }
      } catch (dataErr) {
        console.error('加载词书数据失败:', dataErr);
        allWordbooks = [];
      }
      
      console.log(`开始筛选${targetGrade}阶段的词书，总共${allWordbooks.length}本词书`);
      
      // 使用阶段匹配的词书筛选逻辑，确保学生看到对应阶段的所有相关词书
      // 映射中文年级到英文标识，解决真实词书使用英文category的问题
      const gradeMap = {
        '小学': 'primary',
        '初中': 'junior',
        '高中': 'senior'
      };
      const englishGrade = gradeMap[targetGrade];
      const gradeKeywordsMap = {
        '小学': ['小学', 'primary', '1年级', '2年级', '3年级', '4年级', '5年级', '6年级'],
        '初中': ['初中', 'junior', '7th', '8th', '9th', '七年级', '八年级', '九年级', '初一', '初二', '初三'],
        '高中': ['高中', 'senior', '10th', '11th', '12th', '高一', '高二', '高三', '十年级', '十一年级', '十二年级']
      };
      const targetKeywords = gradeKeywordsMap[targetGrade] || [];
      gradeWordbooks = allWordbooks.filter(wordbook => {
        if (!wordbook) return false;
        
        // 使用category属性判断词书所属阶段，grade属性是具体年级
        const bookCategory = wordbook.category ? wordbook.category.toString().toLowerCase().trim() : '';
        const bookGrade = wordbook.grade ? wordbook.grade.toString().toLowerCase().trim() : '';
        const bookTitle = wordbook.title ? wordbook.title.toString().toLowerCase().trim() : '';
        const keywordMatched = targetKeywords.some((keyword) => {
          const normalizedKeyword = keyword.toLowerCase();
          return (
            bookCategory.includes(normalizedKeyword) ||
            bookGrade.includes(normalizedKeyword) ||
            bookTitle.includes(normalizedKeyword)
          );
        });
        
        const matchResult = bookCategory === englishGrade || bookGrade === englishGrade || keywordMatched;
        console.log(`词书匹配检查: ${wordbook.title || '未知'}, category: '${bookCategory}', grade: '${bookGrade}', 目标: ${englishGrade}, 关键词匹配: ${keywordMatched}, 结果: ${matchResult}`);
        return matchResult;
      });
      
      // 对筛选出的词书进行排序，优先显示精确匹配的词书
      gradeWordbooks.sort((a, b) => {
        // 首先检查是否有具体年级级别匹配
        const aHasLevel = gradeLevel && 
                         (a.grade && a.grade.toLowerCase().includes(gradeLevel.toLowerCase()) ||
                          a.title && a.title.toLowerCase().includes(gradeLevel.toLowerCase()));
        const bHasLevel = gradeLevel && 
                         (b.grade && b.grade.toLowerCase().includes(gradeLevel.toLowerCase()) ||
                          b.title && b.title.toLowerCase().includes(gradeLevel.toLowerCase()));
        
        if (aHasLevel && !bHasLevel) return -1;
        if (!aHasLevel && bHasLevel) return 1;
        
        // 然后检查是否是精确阶段匹配，使用英文grade标识比较
        const englishGrade = gradeMap[targetGrade];
        const aIsExact = a.grade && a.grade.toLowerCase() === englishGrade;
        const bIsExact = b.grade && b.grade.toLowerCase() === englishGrade;
        
        if (aIsExact && !bIsExact) return -1;
        if (!aIsExact && bIsExact) return 1;
        
        // 其他情况保持原顺序
        return 0;
      });
      
      console.log(`找到了${gradeWordbooks.length}本${targetGrade}阶段的词书`);
      
      // 直接使用筛选出的词书，不使用默认词书
      console.log(`筛选后找到${gradeWordbooks.length}本${targetGrade}阶段的词书`);
      
      // 如果没有找到词书，显示提示信息
      if (gradeWordbooks.length === 0) {
        console.log(`未找到任何${targetGrade}阶段的词书`);
        wx.showToast({
          title: `未找到${targetGrade}词书`,
          icon: 'none',
          duration: 2000
        });
      }
      
      // 仅保留弹窗展示与选择需要的轻量字段，避免 setData 传输大体量 words 导致渲染失败
      const modalWordbooks = gradeWordbooks.map((book) => {
        const totalWords = Number(book.totalWords) || (Array.isArray(book.words) ? book.words.length : 0) || 0;
        return {
          id: String(book.id || ''),
          title: book.title || book.name || '未命名词书',
          name: book.name || book.title || '未命名词书',
          category: book.category || '',
          grade: book.grade || '',
          coverImage: book.coverImage || '/images/avatar_default.png',
          totalWords,
          description: book.description || '暂无描述'
        };
      }).filter((book) => book.id);
      
      // 显示模态框
      this.setData({
        gradeWordbooks: modalWordbooks,
        showWordbookModal: true
      });
      
      console.log('词书选择模态框已显示，列表数量:', modalWordbooks.length);
    } catch (error) {
      console.error('显示年级词书失败:', error);
      wx.showToast({
        title: '加载失败: ' + error.message,
        icon: 'none'
      });
    }
  },
  
  // 关闭词书选择模态框
  closeWordbookModal: function() {
    console.log('关闭词书模态框');
    this.setData({
      showWordbookModal: false
    });
  },
  
  // 选择词书
  selectWordbook: function(e) {
    console.log('选择词书', e.currentTarget.dataset);
    
    try {
      const wordbookId = String(e.currentTarget.dataset.id || '');
      const selectedWordbook = this.data.gradeWordbooks.find(book => String(book.id) === wordbookId);
      
      if (selectedWordbook) {
        console.log('选中的词书:', selectedWordbook.title, '学生:', this.data.currentStudent?.name);

        const app = getApp();
        const persistedWordbook = setCurrentWordbook(app, this.data.currentStudent, selectedWordbook);
        if (!persistedWordbook) {
          throw new Error('无法保存当前学生的词书选择');
        }
        
        // 更新当前词书状态
        this.setData({
          learningWordbooks: persistedWordbook.title || persistedWordbook.name || '未知词书',
          currentWordbook: persistedWordbook,
          showWordbookModal: false
        });
        
        // 显示成功提示
        wx.showToast({
          title: '词书切换成功',
          icon: 'success',
          duration: 2000
        });
        
        // 更新学习统计
        try {
          this.loadLearningStats();
          // 传递正确的studentId参数
          if (this.data.currentStudent) {
            this.updateRealTimeStats(this.data.currentStudent.id);
          }
          this.loadRecentRecords();
          // 立即保存状态
          this.saveCurrentPageState();
        } catch (innerError) {
          console.error('更新统计数据失败:', innerError);
        }
        
        // 重新加载推荐词书，确保显示的推荐与当前选择匹配
        this.loadRecommendedWordbooks();
        
        console.log(`词书选择已按学生保存: ${this.data.currentStudent.id} / ${persistedWordbook.id}`);
      }
    } catch (error) {
      console.error('选择词书失败:', error);
      wx.showToast({
        title: '选择失败: ' + error.message,
        icon: 'none'
      });
    }
  },
  
  // 直接跳转到学生列表页面，并设置为选择模式
  goToStudentList: function() {
    // 在切换学生前保存当前状态
    this.saveCurrentPageState();
    
    try {
      // 获取app实例
      const app = getApp();
      // 设置全局标志，表示这是从首页来的学生选择模式
      app.globalData.studentSelectMode = true;
      app.globalData.fromPage = 'index';
      
      wx.switchTab({
        url: '/pages/students/students',
        success: function() {
          console.log('切换到学生管理tab成功');
        },
        fail: function(error) {
          console.error('切换tab失败:', error);
          wx.showToast({ title: '切换失败:' + error.errMsg, icon: 'none' });
        }
      });
    } catch (error) {
      console.error('执行切换tab时出错:', error);
      wx.showToast({ title: '操作失败，请重试', icon: 'none' });
    }
  },

  // 跳转到学习页面
  goToLearning: function() {
    if (this.data.currentStudent) {
      // 获取当前选中的词书
      const currentWordbook = this.data.currentWordbook;
      const wordbookId = currentWordbook ? currentWordbook.id : '';
      
      // 确保全局变量也被更新
      const app = getApp();
      if (currentWordbook) {
        app.globalData.currentWordbook = currentWordbook;
        app.globalData.selectedWordbook = currentWordbook;
      }
      
      // 记录学习开始时间，用于计算学习时长
      app.globalData.studyStartTime = new Date().getTime();
      
      // 跳转到学习页面并传递词书ID参数和fromStart标志
      wx.navigateTo({
        url: `/pages/learning/learning?wordbookId=${wordbookId}&fromStart=true`
      });
    } else {
      wx.showToast({
        title: '请先选择学生',
        icon: 'none'
      });
    }
  },

  // 跳转到词书管理页面
  goToWordbooks: function() {
    wx.navigateTo({
      url: '/subpages/wordbook/wordbook'
    });
  },

  // 跳转到学习统计页面
  goToStats: function() {
    const app = getApp();
    const currentStudent = this.data.currentStudent || app.globalData.currentStudent;
    
    // 确保全局数据中的当前学生信息是最新的
    if (currentStudent) {
      app.globalData.currentStudent = currentStudent;
      wx.setStorageSync('currentStudent', currentStudent);
      console.log('跳转到统计页面，携带学生信息:', currentStudent.id);
    }
    
    wx.navigateTo({
      url: '/subpages/stats/stats'
    });
  },

  // 跳转到学生选择页面
  navigateToStudentSelect: function() {
    console.log('切换学生按钮被点击');
    try {
      // 获取app实例
      const app = getApp();
      // 设置全局标志，表示这是从首页来的学生选择模式
      app.globalData.studentSelectMode = true;
      app.globalData.fromPage = 'index';
      
      wx.navigateTo({
        url: '/subpages/student-list/student-list',
        success: function() {
          console.log('成功跳转到学生列表页面');
        },
        fail: function(error) {
          console.error('跳转到学生列表页面失败:', error);
          wx.showToast({ title: '切换失败:' + error.errMsg, icon: 'none' });
        }
      });
    } catch (error) {
      console.error('执行跳转时出错:', error);
      wx.showToast({ title: '操作失败，请重试', icon: 'none' });
    }
  },

  // 跳转到学生管理页面
  goToStudents: function() {
    console.log('学生管理按钮被点击');
    try {
      wx.switchTab({
        url: '/pages/students/students',
        success: function() {
          console.log('切换到学生管理tab成功');
        },
        fail: function(error) {
          console.error('切换tab失败:', error);
          wx.showToast({ title: '切换失败:' + error.errMsg, icon: 'none' });
        }
      });
    } catch (error) {
      console.error('执行切换tab时出错:', error);
    }
  },

  // 跳转到抗遗忘复习页面
  goToReview: function() {
    console.log('抗遗忘复习按钮被点击');
    try {
      wx.navigateTo({
        url: '/pages/review/review',
        success: function() {
          console.log('跳转到抗遗忘复习页面成功');
        },
        fail: function(error) {
          console.error('跳转到抗遗忘复习页面失败:', error);
          wx.showToast({ title: '跳转失败:' + error.errMsg, icon: 'none' });
        }
      });
    } catch (error) {
      console.error('执行跳转时出错:', error);
    }
  },

  
  // 刷新页面数据
  refreshPage: function() {
    console.log('开始刷新页面数据');
    // 设置加载状态
    this.setData({ loading: true });
    
    // 显示刷新提示
    wx.showToast({
      title: '正在刷新数据...',
      icon: 'loading',
      duration: 1000
    });
    
    // 异步加载所有数据，确保页面响应性
    setTimeout(() => {
      try {
        const fallbackStudent = this.resolveCurrentStudentWithFallback();
        if (fallbackStudent && fallbackStudent.id) {
          this.setData({ currentStudent: fallbackStudent });
        }

        // 尝试恢复上次保存的页面状态
        const currentStudent = fallbackStudent || this.data.currentStudent;
        if (currentStudent && currentStudent.id) {
          const pageStateKey = `${currentStudent.id}_pageState`;
          const savedPageState = wx.getStorageSync(pageStateKey);
          
          if (savedPageState && savedPageState.timestamp) {
            console.log('成功恢复上次保存的页面状态');
            
            // 恢复词书信息
            if (savedPageState.currentWordbook) {
              this.setData({
                currentWordbook: savedPageState.currentWordbook,
                learningWordbooks: savedPageState.currentWordbook.title || savedPageState.currentWordbook.name || '未知词书'
              });
              // 同时更新全局数据
              const app = getApp();
              app.globalData.currentWordbook = savedPageState.currentWordbook;
            }
          }
        }
        
        // 强制重新加载所有数据
        this.loadLearningStats();
        if (currentStudent && currentStudent.id) {
          this.updateRealTimeStats(currentStudent.id);
        }
        this.loadRecentRecords();
        this.loadRecommendedWordbooks();
        this.calculateAntiForgotTime();
        
        // 加载完成后设置加载状态为false
        this.setData({ loading: false });
        
        // 显示刷新成功提示
        wx.showToast({
          title: '数据刷新成功',
          icon: 'success',
          duration: 1000
        });
        
        console.log('页面数据刷新完成');
      } catch (error) {
        console.error('刷新页面数据失败:', error);
        // 出错时也设置加载状态为false
        this.setData({ loading: false });
        wx.showToast({
          title: '刷新失败，请重试',
          icon: 'none',
          duration: 1500
        });
      }
    }, 500);
  },

  /** 跳转到登录页 */
  goToLogin: function () {
    wx.navigateTo({
      url: '/pages/login/login'
    });
  },


});
