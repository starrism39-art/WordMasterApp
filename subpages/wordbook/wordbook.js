// pages/wordbook/wordbook.js
// 导入词书数据
const wordbookData = require('../../data/wordbooks.js');
// 处理词书数据格式
const wordbooks = Array.isArray(wordbookData) ? wordbookData : 
                 (wordbookData.primary || []).concat(
                     wordbookData.junior || [], 
                     wordbookData.senior || []
                 );
const { resolveCurrentStudent, resolveCurrentWordbook, setCurrentWordbook } = require('../../utils/learning-context.js');
const {
  getWordbookMasterySummary,
  resolveCurrentWordbookTotal,
  refreshStudentLearningProgressTotals
} = require('../../utils/learning-progress.js');
const { getWordbookStats } = require('../../utils/stats-engine.js');
const WordbookRepository = require('../../utils/wordbook-repository.js');
const { getCategoryForStage, resolveGradeStage } = require('../../utils/grade-stage.js');

Page({
  data: {
    wordbooks: [], // 显示的词书列表
    allWordbooks: [], // 完整的词书列表
    teacherWordbooks: [], // 当前教师可切换的 active 自定义词书
    managedInactiveTeacherWordbooks: [], // 管理态可见，但绝不进入学习切换列表
    currentFilter: 'all',
    userInfo: null,
    currentStudent: null,
    currentWordbookId: '',
    currentWordbookName: '未选择词书',
    selectMode: false,
    disablingWordbookId: '',
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
      this._filterInitialized = false;
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

    const nextData = {
      currentStudent: currentStudent || null,
      currentWordbookId: currentWordbook ? String(currentWordbook.id) : '',
      currentWordbookName: currentWordbook
        ? (currentWordbook.title || currentWordbook.name || '未命名词书')
        : '未选择词书'
    };

    if (!this._filterInitialized) {
      nextData.currentFilter = resolveGradeStage(currentStudent && currentStudent.grade) || 'all';
      this._filterInitialized = true;
    }

    this.setData(nextData);
  },

  goToCreateTeacherWordbook: function() {
    wx.navigateTo({
      url: '/subpages/wordbook-create/wordbook-create',
      fail: (error) => {
        console.error('打开创建教师词书页面失败:', error);
        wx.showToast({
          title: '暂时无法打开创建页面',
          icon: 'none'
        });
      }
    });
  },

  goToUpdateTeacherWordbook: function(event) {
    const wordbookId = String(
      event && event.currentTarget && event.currentTarget.dataset.id || ''
    ).trim();
    const wordbook = this.data.teacherWordbooks.find((item) => (
      String(item.wordbookId || item.id) === wordbookId
    ));

    if (!wordbook
      || wordbook.sourceType !== 'teacher_custom'
      || wordbook.status !== 'active') {
      wx.showToast({
        title: '当前词书不可更新',
        icon: 'none'
      });
      return;
    }

    const query = [
      'mode=update',
      `wordbookId=${encodeURIComponent(wordbookId)}`,
      `title=${encodeURIComponent(wordbook.title || '')}`,
      `version=${encodeURIComponent(String(wordbook.version || 0))}`,
      `totalWords=${encodeURIComponent(String(wordbook.totalWords || 0))}`
    ].join('&');

    wx.navigateTo({
      url: `/subpages/wordbook-create/wordbook-create?${query}`,
      fail: (error) => {
        console.error('打开教师词书更新页面失败:', error);
        wx.showToast({
          title: '暂时无法打开更新页面',
          icon: 'none'
        });
      }
    });
  },

  performDisableTeacherWordbook: async function(wordbookId) {
    this.setData({ disablingWordbookId: wordbookId });
    try {
      await WordbookRepository.disableTeacherWordbook(wordbookId);
      wx.showToast({
        title: '词书已停用',
        icon: 'success'
      });
      await this.loadWordbooks();
    } catch (error) {
      console.error('停用教师词书失败:', error);
      wx.showToast({
        title: '停用失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ disablingWordbookId: '' });
    }
  },

  disableTeacherWordbook: function(event) {
    const wordbookId = String(
      event && event.currentTarget && event.currentTarget.dataset.id || ''
    ).trim();
    const wordbook = this.data.teacherWordbooks.find((item) => (
      String(item.wordbookId || item.id) === wordbookId
    ));

    if (!wordbook
      || wordbook.sourceType !== WordbookRepository.SOURCE_TYPES.TEACHER_CUSTOM
      || wordbook.status !== 'active'
      || this.data.disablingWordbookId) {
      wx.showToast({
        title: '当前词书不可停用',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认停用词书？',
      content: '停用后学生不可继续从当前词书目录选择，但历史版本和学习数据不会删除。',
      confirmText: '确认停用',
      confirmColor: '#b34b4b',
      success: (result) => {
        if (!result.confirm) return;
        this.performDisableTeacherWordbook(wordbookId);
      }
    });
  },
  
  // 加载词书数据
  loadWordbooks: async function() {
    try {
      console.log('开始加载词书数据...');
      this.setData({ loading: true });
      
      const catalogWordbooks = await WordbookRepository.listWordbooks({
        teacherScope: this.data.selectMode ? 'active' : 'manage',
        onTeacherError: (error) => {
          console.warn('教师词书目录读取失败，继续显示官方词书:', error);
        }
      });
      const catalogGroups = WordbookRepository.groupWordbooks(catalogWordbooks);
      let bookList = catalogGroups.officialWordbooks;
      const activeTeacherBooks = catalogGroups.teacherWordbooks.filter((book) => (
        book && book.status === 'active'
      ));
      const inactiveTeacherBooks = this.data.selectMode
        ? []
        : catalogGroups.teacherWordbooks.filter((book) => (
          book && book.status !== 'active'
        ));
      this.refreshCatalogProgressTotals(bookList.concat(activeTeacherBooks));
      const teacherWordbooks = this.processWordbooksData(activeTeacherBooks);
      const managedInactiveTeacherWordbooks = this.processWordbooksData(inactiveTeacherBooks);

      if (bookList.length === 0) {
        console.error('官方词书数据格式错误，使用备用数据');
        bookList = this.getFallbackWordbooks().map(
          WordbookRepository.adaptOfficialWordbook
        );
      }

      console.log(
        '统一目录加载完成，官方',
        bookList.length,
        '本，教师自定义',
        teacherWordbooks.length,
        '本'
      );
      
      // 处理词书数据，添加学习进度；官方目录与教师目录保持独立。
      const processedWordbooks = this.processWordbooksData(bookList);

      // allWordbooks 始终保留完整 46 本 official；实际展示只由 currentFilter 决定。
      this.setData({
        allWordbooks: processedWordbooks,
        wordbooks: processedWordbooks,
        teacherWordbooks,
        managedInactiveTeacherWordbooks,
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
        teacherWordbooks: [],
        managedInactiveTeacherWordbooks: [],
        loading: false,
        hasError: false
      });
      
      this.updateFilteredWordbooks();
    }
  },

  refreshCatalogProgressTotals: function(catalogWordbooks) {
    const currentStudent = this.data.currentStudent || getApp().globalData.currentStudent;
    const studentId = currentStudent && currentStudent.id ? String(currentStudent.id) : '';
    if (!studentId) return false;

    const learningProgress = wx.getStorageSync('learningProgress') || {};
    const currentProgress = learningProgress[studentId];
    if (!currentProgress || typeof currentProgress !== 'object') return false;

    const bookTotals = {};
    (Array.isArray(catalogWordbooks) ? catalogWordbooks : []).forEach((book) => {
      const bookId = String(book && (book.wordbookId || book.id) || '').trim();
      const totalWords = Number(book && book.totalWords);
      if (bookId && Number.isFinite(totalWords) && totalWords > 0) {
        bookTotals[bookId] = Math.floor(totalWords);
      }
    });

    const refreshedProgress = refreshStudentLearningProgressTotals({
      progressData: currentProgress,
      bookTotals
    });
    if (refreshedProgress === currentProgress) return false;

    learningProgress[studentId] = refreshedProgress;
    wx.setStorageSync('learningProgress', learningProgress);
    return true;
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
      teacherWordbooks: [],
      managedInactiveTeacherWordbooks: [],
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
        const totalCount = resolveCurrentWordbookTotal(
          wordbook.totalWords,
          bookProgress.totalCount
        );
        const progressPercent = totalCount > 0
          ? Math.min(100, completedCount / totalCount * 100)
          : 0;
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
    return resolveGradeStage(grade);
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
      // 使用统一学段映射；“大学”当前没有 official，因此结果应为空而不是误落到小学。
      const englishGrade = getCategoryForStage(currentFilter);
      
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
  
  returnToHomepage: function() {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    const previousPage = pages.length > 1 ? pages[pages.length - 2] : null;
    if (previousPage && previousPage.route === 'pages/index/index') {
      wx.navigateBack({
        delta: 1,
        fail: () => wx.switchTab({ url: '/pages/index/index' })
      });
      return;
    }
    wx.switchTab({ url: '/pages/index/index' });
  },

  // 这里只切换当前学生的词书；真正开始学习仍由首页学习入口负责。
  switchWordbook: function(e) {
    try {
      const wordbookId = String(e && e.currentTarget && e.currentTarget.dataset.id || '').trim();
      const app = getApp();
      const currentStudent = this.data.currentStudent || app.globalData.currentStudent;

      if (!currentStudent) {
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

      const selectedWordbook = this.data.allWordbooks.find((book) => String(book.id) === wordbookId)
        || this.data.teacherWordbooks.find((book) => String(book.id) === wordbookId);
      
      if (!selectedWordbook) {
        wx.showToast({
          title: '词书信息不存在',
          icon: 'none'
        });
        return;
      }

      if (selectedWordbook.sourceType === WordbookRepository.SOURCE_TYPES.TEACHER_CUSTOM
        && selectedWordbook.status !== 'active') {
        wx.showToast({
          title: selectedWordbook.status === 'disabled' ? '该词书已停用' : '请先发布教师词书',
          icon: 'none'
        });
        return;
      }

      const persistedWordbook = setCurrentWordbook(app, currentStudent, selectedWordbook);
      if (!persistedWordbook) {
        throw new Error('保存当前词书失败');
      }

      // 切换本身不创建、不清空也不同步 learningProgress；首页 onShow 会按正式数据源重读。
      wx.showToast({
        title: '切换成功',
        icon: 'success',
        duration: 1000
      });
      setTimeout(() => this.returnToHomepage(), 500);
    } catch (error) {
      console.error('切换词书失败:', error);
      wx.showToast({
        title: '切换失败，请重试',
        icon: 'none'
      });
    }
  },

  // 兼容已有页面测试或旧调用；语义已统一为“只切换，不开始学习”。
  startLearning: function(e) {
    return this.switchWordbook(e);
  }
});
