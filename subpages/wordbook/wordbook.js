// pages/wordbook/wordbook.js
// 导入词书数据
const wordbookData = require('../../data/wordbooks.js');
// 处理词书数据格式
const wordbooks = Array.isArray(wordbookData) ? wordbookData : 
                 (wordbookData.primary || []).concat(
                     wordbookData.junior || [], 
                     wordbookData.senior || []
                 );
const generateWordsForBook = wordbookData.generateWordsForBook || function(wordbook) { return wordbook.words || []; };
const { syncLearningProgress, markPendingSync } = require('../../utils/cloud-sync.js');
const cloudWordbookLoader = require('../../utils/cloud-wordbook-loader.js');
const { resolveCurrentStudent, resolveCurrentWordbook, setCurrentWordbook } = require('../../utils/learning-context.js');
const { getWordbookMasterySummary } = require('../../utils/learning-progress.js');
const { getWordbookStats } = require('../../utils/stats-engine.js');

Page({
  data: {
    wordbooks: [], // 显示的词书列表
    allWordbooks: [], // 完整的词书列表
    currentFilter: 'all',
    userInfo: null,
    currentStudent: null,
    currentWordbookId: '',
    currentWordbookName: '未选择词书',
    selectMode: false,
    loading: true,
    hasError: false,
    errorMessage: ''
  },
  
  onLoad: function(options) {
    try {
      // 登录检查：如果未登录，自动跳转到登录页面
      const app = getApp();
      this.setData({ loading: true });
      console.log('词书页面加载，参数:', options);
      
      // 检查是否是选择模式
      const selectMode = options && options.selectMode === 'true';
      this.setData({
        selectMode: selectMode
      });
      
      // 确保应用实例存在
      if (!app || !app.globalData) {
        console.error('应用实例不存在');
        this.setData({
          loading: false,
          hasError: true,
          errorMessage: '应用初始化失败'
        });
        this.createMockWordbooks();
        return;
      }
      
      this.setData({
        userInfo: app.globalData.currentUser || { name: '测试用户' }
      });
      this.syncCurrentContext();
      this.loadWordbooks();
    } catch (error) {
      console.error('词书页面加载失败:', error);
      this.setData({
        loading: false,
        hasError: true,
        errorMessage: '页面加载失败'
      });
      this.createMockWordbooks();
    }
  },
  
  onShow: function() {
    try {
      this.setData({ loading: true });
      // 每次显示页面时重新加载数据
      const app = getApp();
      if (app && app.globalData) {
        this.setData({
          userInfo: app.globalData.currentUser || { name: '测试用户' }
        });
      }
      this.syncCurrentContext();
      this.loadWordbooks();
    } catch (error) {
      console.error('词书页面显示时出错:', error);
      this.setData({
        loading: false,
        hasError: true,
        errorMessage: '页面加载失败'
      });
      this.createMockWordbooks();
    }
  },

  syncCurrentContext: function() {
    const app = getApp();
    const currentStudent = resolveCurrentStudent(app);
    const currentWordbook = resolveCurrentWordbook(app, currentStudent);

    if (currentStudent && app && app.globalData) {
      app.globalData.currentStudent = currentStudent;
    }

    this.setData({
      currentStudent: currentStudent || null,
      currentWordbookId: currentWordbook ? String(currentWordbook.id) : '',
      currentWordbookName: currentWordbook
        ? (currentWordbook.title || currentWordbook.name || '未命名词书')
        : '未选择词书'
    });
  },
  
  // 加载词书数据
  loadWordbooks: function() {
    try {
      console.log('开始加载词书数据...');
      this.setData({ loading: true });
      
      // 从导入的词书数据中获取真实词书列表
      let bookList = [];
      
      // 尝试从wordbookData对象中获取所有级别的词书
      if (wordbookData && typeof wordbookData === 'object') {
        // 合并不同级别的词书
        const allBooks = [];
        if (Array.isArray(wordbookData.primary)) {
          allBooks.push(...wordbookData.primary);
        }
        if (Array.isArray(wordbookData.junior)) {
          allBooks.push(...wordbookData.junior);
        }
        if (Array.isArray(wordbookData.senior)) {
          allBooks.push(...wordbookData.senior);
        }
        
        if (allBooks.length > 0) {
          bookList = allBooks;
          console.log('成功加载多级词书数据，共', bookList.length, '本词书');
        } else if (Array.isArray(wordbooks)) {
          // 兼容旧格式
          bookList = wordbooks;
          console.log('成功加载词书数据（旧格式），共', bookList.length, '本词书');
        } else {
          console.error('词书数据格式错误，使用备用数据');
          // 使用备用模拟数据
          bookList = this.getFallbackWordbooks();
        }
      } else if (Array.isArray(wordbooks)) {
        // 兼容旧格式
        bookList = wordbooks;
        console.log('成功加载词书数据，共', bookList.length, '本词书');
      } else {
        console.error('词书数据格式错误，使用备用数据');
        // 使用备用模拟数据
        bookList = this.getFallbackWordbooks();
      }
      
      // 处理词书数据，添加收藏状态和学习进度
      const processedWordbooks = this.processWordbooksData(bookList);
      
      // 根据学生年级筛选词书
      let filteredWordbooks = processedWordbooks;
      const app = getApp();
      const currentStudent = app.globalData.currentStudent;
      
      console.log('=========== 词书筛选过程 ===========');
      console.log('当前学生信息:', currentStudent);
      console.log('筛选前词书总数:', processedWordbooks.length);
      console.log('各分类词书数量 - primary:', processedWordbooks.filter(wb => wb.category === 'primary').length, 'junior:', processedWordbooks.filter(wb => wb.category === 'junior').length, 'senior:', processedWordbooks.filter(wb => wb.category === 'senior').length);
      
      if (currentStudent) {
        console.log('学生存在，年级:', currentStudent.grade);
        if (currentStudent.grade) {
          const studentGrade = currentStudent.grade.toString().toLowerCase().trim();
          const gradeMatch = studentGrade.match(/(\d+)/);
          
          console.log('学生年级(小写):', studentGrade);
          console.log('年级数字匹配:', gradeMatch);
          
          if (gradeMatch && gradeMatch[1]) {
            const specificGrade = parseInt(gradeMatch[1], 10);
            console.log('提取的年级数字:', specificGrade);
            
            // 根据年级确定教育阶段
            if (specificGrade >= 1 && specificGrade <= 6) {
              // 小学阶段
              filteredWordbooks = processedWordbooks.filter(wordbook => wordbook.category === 'primary');
              console.log('筛选类型: 小学，筛选后词书数量:', filteredWordbooks.length);
            } else if (specificGrade >= 7 && specificGrade <= 9) {
              // 初中阶段
              filteredWordbooks = processedWordbooks.filter(wordbook => wordbook.category === 'junior');
              console.log('筛选类型: 初中，筛选后词书数量:', filteredWordbooks.length);
            } else if (specificGrade >= 10 && specificGrade <= 12) {
              // 高中阶段
              filteredWordbooks = processedWordbooks.filter(wordbook => wordbook.category === 'senior');
              console.log('筛选类型: 高中，筛选后词书数量:', filteredWordbooks.length);
            }
          } else {
            // 通过文字判断
            console.log('未提取到年级数字，尝试通过文字判断');
            if (studentGrade.includes('小学')) {
              filteredWordbooks = processedWordbooks.filter(wordbook => wordbook.category === 'primary');
              console.log('通过文字判断为小学，筛选后词书数量:', filteredWordbooks.length);
            } else if (studentGrade.includes('初中') || studentGrade.includes('初一') || studentGrade.includes('七年级') || studentGrade.includes('初二') || studentGrade.includes('八年级') || studentGrade.includes('初三') || studentGrade.includes('九年级')) {
              filteredWordbooks = processedWordbooks.filter(wordbook => wordbook.category === 'junior');
              console.log('通过文字判断为初中，筛选后词书数量:', filteredWordbooks.length);
            } else if (studentGrade.includes('高中') || studentGrade.includes('高一') || studentGrade.includes('高二') || studentGrade.includes('高三')) {
              filteredWordbooks = processedWordbooks.filter(wordbook => wordbook.category === 'senior');
              console.log('通过文字判断为高中，筛选后词书数量:', filteredWordbooks.length);
            } else {
              console.log('无法判断教育阶段，显示所有词书');
            }
          }
        } else {
          console.log('学生年级为空，显示所有词书');
        }
      } else {
        console.log('未找到当前学生，显示所有词书');
      }
      
      console.log('最终筛选结果数量:', filteredWordbooks.length);
      console.log('最终筛选结果的前5个词书:', filteredWordbooks.slice(0, 5).map(book => book.title));
      console.log('=====================================');
      
      // 设置数据到页面：allWordbooks 存全部（供筛选栏使用），wordbooks 存当前显示的
      this.setData({
        allWordbooks: processedWordbooks,
        wordbooks: filteredWordbooks,
        loading: false,
        hasError: false
      });
      
      // 尝试保存词书元数据到本地存储（不包含单词列表）
      try {
        // 移除可能存在的words属性，只保存元数据
        const metadataOnly = processedWordbooks.map(book => {
          const { words, ...metadata } = book;
          return metadata;
        });
        wx.setStorageSync('wordbooksMetadata', metadataOnly);
        console.log('词书元数据保存成功');
      } catch (saveError) {
        console.error('保存词书元数据失败:', saveError);
      }
      
      // 更新过滤后的词书列表
      this.updateFilteredWordbooks();
      
    } catch (error) {
      console.error('加载词书数据失败:', error);
      
      // 即使发生错误，也设置基础模拟数据
      const fallbackWordbooks = this.getFallbackWordbooks();
      const processedFallback = this.processWordbooksData(fallbackWordbooks);
      
      this.setData({
        allWordbooks: processedFallback,
        wordbooks: processedFallback,
        loading: false,
        hasError: false
      });
      
      this.updateFilteredWordbooks();
    }
  },
  
  // 获取备用词书数据
  getFallbackWordbooks: function() {
    return [
      {
        id: 'primary_textbook_real',
        title: '小学统编版英语词书',
        description: '基于真实小学英语教材的词汇表，包含567个核心单词',
        category: 'primary',
        grade: 'primary',
        region: '全国',
        version: '统编版',
        totalWords: 567,
        cover: '/images/default-cover.png',
        isHot: true
      },
      {
        id: 'junior_textbook_real',
        title: '初中统编版英语词书',
        description: '基于真实初中英语教材的词汇表，包含3297个核心单词',
        category: 'junior',
        grade: 'junior',
        region: '全国',
        version: '统编版',
        totalWords: 3297,
        cover: '/images/default-cover.png',
        isHot: true
      },
      {
        id: 'senior_textbook_real',
        title: '高中统编版英语词书',
        description: '基于真实高中英语教材的词汇表，包含4292个单词',
        category: 'senior',
        grade: 'senior',
        region: '全国',
        version: '统编版',
        totalWords: 4292,
        cover: '/images/default-cover.png',
        isHot: false
      }
    ];
  },
  
  // 创建模拟词书数据
  createMockWordbooks: function() {
    console.log('创建模拟词书数据');
    const mockWordbooks = [
      {
        id: 'primary_textbook_real',
        title: '小学统编版英语词书',
        description: '基于真实小学英语教材的词汇表，包含567个核心单词',
        category: 'primary',
        grade: 'primary',
        region: '全国',
        version: '统编版',
        totalWords: 567,
        cover: '../../images/wordbook1.png',
        isHot: true
      },
      {
        id: 'junior_textbook_real',
        title: '初中统编版英语词书',
        description: '基于真实初中英语教材的词汇表，包含3297个核心单词',
        category: 'junior',
        grade: 'junior',
        region: '全国',
        version: '统编版',
        totalWords: 3297,
        cover: '../../images/wordbook2.png',
        isHot: true
      },
      {
        id: 'senior_textbook_real',
        title: '高中统编版英语词书',
        description: '基于真实高中英语教材的词汇表，包含4292个单词',
        category: 'senior',
        grade: 'senior',
        region: '全国',
        version: '统编版',
        totalWords: 4292,
        cover: '../../images/wordbook3.png',
        isHot: false
      }
    ];
    
    const processedWordbooks = mockWordbooks.map(wordbook => ({
      ...wordbook,
      learnedWords: Math.floor(Math.random() * 50) + 10,
      progressPercent: Math.floor(Math.random() * 50) + 10,
      isInProgress: Math.random() > 0.3
    }));
    
    this.setData({
      allWordbooks: processedWordbooks,
      wordbooks: processedWordbooks,
      loading: false
    });
    this.updateFilteredWordbooks();
  },
  
  // 处理词书数据，添加收藏状态和学习进度信息
  processWordbooksData: function(wordbooks) {
    try {
      const { userInfo } = this.data;
      const currentStudent = this.data.currentStudent || getApp().globalData.currentStudent;
      const studentId = currentStudent?.id || '';
      const currentWordbookId = String(this.data.currentWordbookId || '');
      
      // 使用与app.js一致的存储键
      let learningProgress = {};
      let wordMastery = {};
      
      try {
        learningProgress = wx.getStorageSync('learningProgress') || {};
        wordMastery = wx.getStorageSync('wordMastery') || {};
      } catch (e) {
        console.error('获取存储数据失败:', e);
      }
      
      return wordbooks.map(wordbook => {
        // 统一读取嵌套结构 learningProgress[studentId].wordbooks[wordbookId]
        const studentProgress = studentId ? (learningProgress[studentId] || {}) : {};
        const studentWordbooksProgress = studentProgress.wordbooks || {};
        const bookProgress = studentWordbooksProgress[wordbook.id] || {};
        const wordbookMastery = studentId && wordMastery[studentId]
          ? wordMastery[studentId][wordbook.id]
          : null;
        const masterySummary = getWordbookMasterySummary(wordbook.id, wordbookMastery);
        const override = studentId
          ? (wx.getStorageSync(`wordbook_stats_${studentId}_${wordbook.id}`) || null)
          : null;
        const sharedStats = studentId ? getWordbookStats(studentId, wordbook.id) : null;
        const completedCount = masterySummary.entryCount > 0 || (override && override.isManualOverride)
          ? sharedStats.masteredCount
          : (bookProgress.completedCount || bookProgress.learnedWords || 0);
        const totalCount = bookProgress.totalCount || wordbook.totalWords || 0;
        const progressPercent = totalCount > 0 ? (completedCount / totalCount * 100) : 0;
        const isInProgress = completedCount > 0;
        
        // 重要：移除words属性，实现懒加载
        const { words, ...metadata } = wordbook;
        
        return {
          ...metadata,
          learnedWords: completedCount,
          progressPercent,
          isInProgress,
          isCurrent: String(wordbook.id || '') === currentWordbookId
        };
      });
    } catch (error) {
      console.error('处理词书数据失败:', error);
      // 错误态不生成随机进度，保证手机和电脑显示一致。
      return wordbooks.map(wordbook => {
        const { words, ...metadata } = wordbook;
        return {
          ...metadata,
          learnedWords: 0,
          progressPercent: 0,
          isInProgress: false
        };
      });
    }
  },
  
  // 切换筛选条件
  changeFilter: function(e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({ currentFilter: filter });
    // 更新显示的词书列表
    this.updateFilteredWordbooks();
  },
  
  // 更新筛选后的词书列表显示
  updateFilteredWordbooks: function() {
    const filteredWordbooks = this.getFilteredWordbooks();
    console.log('更新筛选后的词书列表，数量:', filteredWordbooks.length);
    this.setData({ wordbooks: filteredWordbooks });
  },
  
  // 年级到教育阶段的映射
  gradeToStage: function(grade) {
    if (!grade || typeof grade !== 'string') return null;
    
    // 转换为小写以便匹配
    const lowerGrade = grade.toLowerCase();
    
    // 小学阶段
    if (lowerGrade.includes('一') || lowerGrade.includes('二') || lowerGrade.includes('三') || 
        lowerGrade.includes('四') || lowerGrade.includes('五') || lowerGrade.includes('六') ||
        lowerGrade.includes('1') || lowerGrade.includes('2') || lowerGrade.includes('3') ||
        lowerGrade.includes('4') || lowerGrade.includes('5') || lowerGrade.includes('6') ||
        lowerGrade.includes('primary')) {
      return '小学';
    }
    // 初中阶段
    else if (lowerGrade.includes('七') || lowerGrade.includes('八') || lowerGrade.includes('九') ||
             lowerGrade.includes('7') || lowerGrade.includes('8') || lowerGrade.includes('9') ||
             lowerGrade.includes('junior')) {
      return '初中';
    }
    // 高中阶段
    else if (lowerGrade.includes('高一') || lowerGrade.includes('高二') || lowerGrade.includes('高三') ||
             lowerGrade.includes('10') || lowerGrade.includes('11') || lowerGrade.includes('12') ||
             lowerGrade.includes('senior')) {
      return '高中';
    }
    
    return null;
  },

  // 获取筛选后的词书列表
  getFilteredWordbooks: function() {
    const { allWordbooks, currentFilter } = this.data;
    const currentStudent = getApp().globalData.currentStudent;
    
    console.log('筛选词书，当前筛选条件:', currentFilter);
    
    if (currentFilter === 'all') {
      // 真正显示所有词书，不再根据学生年级筛选
      console.log('显示所有词书，总数:', allWordbooks.length);
      return allWordbooks;
    } else if (currentFilter === 'inProgress') {
      // 获取正在学习的词书
      if (!currentStudent) {
        console.log('未选择学生，无法筛选学习中词书');
        wx.showToast({
          title: '请先选择学生',
          icon: 'none'
        });
        return allWordbooks;
      }
      
      const filtered = allWordbooks.filter(wordbook => wordbook.isInProgress === true);
      console.log('筛选后学习中词书数量:', filtered.length);
      return filtered;
    } else {
      // 根据筛选条件筛选词书
      // 支持根据年级或教育阶段筛选
      const filterLower = currentFilter.toLowerCase();
      // 映射中文阶段到英文标识，确保所有对应词书都能被筛选出来
      const gradeMap = {
        '小学': 'primary',
        '初中': 'junior',
        '高中': 'senior'
      };
      const englishGrade = gradeMap[currentFilter];
      
      return allWordbooks.filter(wordbook => {
        const bookGrade = (wordbook.grade || '').toString().toLowerCase();
        const bookCategory = (wordbook.category || '').toString().toLowerCase();
        
        return bookGrade === currentFilter || 
               bookCategory === currentFilter ||
               bookGrade.includes(filterLower) ||
               bookCategory.includes(filterLower) ||
               // 同时匹配对应的英文标识，确保真实词书能被正确筛选
               (englishGrade && (bookGrade === englishGrade || bookCategory === englishGrade));
      });
    }
  },
  
  // 查看词书详情和单词信息
  viewWordbook: function(e) {
    try {
      const wordbookId = e.currentTarget.dataset.id;
      console.log('查看词书，词书ID:', wordbookId);
      
      // 跳转到学习页面，传递词书ID，并设置为预览模式
      wx.navigateTo({
        url: `/pages/learning/learning?wordbookId=${wordbookId}&mode=preview`,
        success: function(res) {
          console.log('成功跳转到词书预览页面');
        },
        fail: function(err) {
          console.error('跳转到词书预览页面失败:', err);
          wx.showToast({
            title: '跳转到词书预览页面失败',
            icon: 'none'
          });
        }
      });
    } catch (error) {
      console.error('查看词书过程中发生错误:', error);
      wx.showToast({
        title: '查看词书失败，请重试',
        icon: 'none'
      });
    }
  },
  
  // 开始学习或选择词书（实现单词懒加载）
  startLearning: function(e) {
    try {
      const wordbookId = e.currentTarget.dataset.id;
      console.log('选择词书，词书ID:', wordbookId);

      // 【云端词书】非阻塞触发云端词书预下载
      if (cloudWordbookLoader.isCloudWordbook(wordbookId)) {
        cloudWordbookLoader.downloadWordsFromCloud(wordbookId).then((words) => {
          if (words) {
            console.log('[cloud-wordbook] 预下载完成:', wordbookId);
          }
        });
      }
      
      const app = getApp();
      const currentStudent = this.data.currentStudent || app.globalData.currentStudent;
      
      // 检查学生账号（在选择模式下也需要检查，因为需要保存学习进度）
      if (!currentStudent) {
        console.log('未选择学生账号');
        wx.showToast({
          title: '请先选择学生账号',
          icon: 'none'
        });
        // 跳转到学生选择页面
        wx.navigateTo({
          url: '/pages/students/students?selectMode=true'
        });
        return;
      }
      
      // 设置当前学习的词书
      let selectedWordbook = this.data.wordbooks.find(wb => wb.id === wordbookId);
      
      // 如果在当前列表中找不到，则尝试从全部词书列表中查找
      if (!selectedWordbook) {
        console.log('在当前词书列表中未找到，尝试从全部词书列表中查找');
        selectedWordbook = this.data.allWordbooks.find(wb => wb.id === wordbookId);
      }
      
      // 如果仍然找不到，则尝试直接从词书模块加载
      if (!selectedWordbook) {
        console.log('在内存中未找到词书，尝试从词书模块直接加载');
        try {
          const wordbooksModule = require('../../data/wordbooks.js');
          const wordbooks = Array.isArray(wordbooksModule) ? wordbooksModule : 
                           (wordbooksModule.wordbooks || []);
          selectedWordbook = wordbooks.find(wb => wb.id === wordbookId);
        } catch (error) {
          console.error('从词书模块加载词书失败:', error);
        }
      }
      
      if (!selectedWordbook) {
        console.error('词书信息不存在，ID:', wordbookId);
        wx.showToast({
          title: '词书信息不存在',
          icon: 'none'
        });
        return;
      }

      const persistedWordbook = setCurrentWordbook(app, currentStudent, selectedWordbook);
      if (!persistedWordbook) {
        throw new Error('保存当前词书失败');
      }

      this.setData({
        currentWordbookId: persistedWordbook.id,
        currentWordbookName: persistedWordbook.title,
        allWordbooks: this.data.allWordbooks.map(book => ({
          ...book,
          isCurrent: String(book.id) === persistedWordbook.id
        })),
        wordbooks: this.data.wordbooks.map(book => ({
          ...book,
          isCurrent: String(book.id) === persistedWordbook.id
        }))
      });
      
      // 保存到本地存储（统一写入嵌套结构）
      let learningProgress = wx.getStorageSync('learningProgress') || {};
      if (!learningProgress[currentStudent.id] || typeof learningProgress[currentStudent.id] !== 'object' || Array.isArray(learningProgress[currentStudent.id])) {
        learningProgress[currentStudent.id] = {
          learnedWords: 0,
          totalWords: 0,
          wordbooks: {}
        };
      }

      if (!learningProgress[currentStudent.id].wordbooks || typeof learningProgress[currentStudent.id].wordbooks !== 'object' || Array.isArray(learningProgress[currentStudent.id].wordbooks)) {
        learningProgress[currentStudent.id].wordbooks = {};
      }

      if (!learningProgress[currentStudent.id].wordbooks[wordbookId]) {
        // 初始化词书学习进度
        const nowIso = new Date().toISOString();
        const nowTs = Date.now();
        learningProgress[currentStudent.id].wordbooks[wordbookId] = {
          completedCount: 0,
          learnedWords: 0,
          totalCount: selectedWordbook.totalWords || 0,
          lastStudyTime: nowIso,
          lastStudied: nowIso,
          updatedAt: nowTs
        };
        learningProgress[currentStudent.id].updatedAt = nowTs;
      }

      wx.setStorageSync('learningProgress', learningProgress);
      try {
        const studentProgress = learningProgress[currentStudent.id];
        if (studentProgress) {
          syncLearningProgress(currentStudent.id, studentProgress).catch(() => {
            markPendingSync();
          });
        }
      } catch (syncError) {
        markPendingSync();
      }
      
      if (this.data.selectMode) {
        // 选择模式：返回上一页
        wx.showToast({
          title: '已选择词书: ' + selectedWordbook.title,
          icon: 'success',
          duration: 1000
        });
        
        console.log('已设置selectedWordbook:', selectedWordbook.title);
        
        // 延迟返回，确保用户看到提示
        setTimeout(() => {
          // 获取页面栈，直接返回上一页
          const pages = getCurrentPages();
          if (pages.length > 1) {
            wx.navigateBack({
              delta: 1
            });
          } else {
            // 如果没有上一页，则跳转到学习页面
            wx.navigateTo({
              url: '/pages/learning/learning'
            });
          }
        }, 500);
      } else {
        // 正常模式：实现单词懒加载
        wx.showLoading({ title: '加载词书内容...' });
        
        try {
          // 懒加载单词列表 - 参数顺序: category, wordbookId
          const words = generateWordsForBook(selectedWordbook.category || 'general', wordbookId);
          
          // 设置全局词书数据（包含加载的单词）
          const wordbookWithWords = {
            ...selectedWordbook,
            words: words
          };
          
          app.globalData.selectedWordbook = wordbookWithWords;
          app.globalData.currentWordbook = wordbookWithWords; // 同时设置currentWordbook以便持久化
          
          console.log('已加载词书:', selectedWordbook.title, '包含', words.length, '个单词');
          
          // 跳转到学习页面
          wx.hideLoading();
          wx.navigateTo({
            url: '/pages/learning/learning?wordbookId=' + wordbookId,
            success: function(res) {
              console.log('成功跳转到学习页面');
            },
            fail: function(err) {
              console.error('跳转到学习页面失败:', err);
              wx.showToast({
                title: '跳转到学习页面失败',
                icon: 'none'
              });
            }
          });
        } catch (error) {
          wx.hideLoading();
          console.error('加载词书内容失败:', error);
          wx.showToast({
            title: '加载失败，请重试',
            icon: 'none'
          });
        }
      }
    } catch (error) {
      console.error('操作过程中发生错误:', error);
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
    }
  }
});
