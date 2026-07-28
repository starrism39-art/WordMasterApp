// pages/learning/learning.js
// 导入词书数据生成函数
const wordbooksModule = require('../../data/wordbooks.js');
const { generateWordsForBook } = wordbooksModule;
const { resolveDictionaryApiAudioUrl, buildYoudaoAudioUrl } = require('../../utils/audio-fallback.js');
const { syncPreviewState, loadPreviewStateFromCloud, syncWordMasteryBatch } = require('../../utils/cloud-sync.js');
const cloudWordbookLoader = require('../../utils/cloud-wordbook-loader.js');
const {
  createLearningContextKey,
  resolveCurrentStudent,
  resolveCurrentWordbook,
  setCurrentWordbook
} = require('../../utils/learning-context.js');
const { resolveAntiForgettingSourceForUpdate } = require('../../utils/anti-forgetting-filter.js');

const ENABLE_VERBOSE_LOG = false;
const debugLog = (...args) => {
  if (ENABLE_VERBOSE_LOG) {
    console.log(...args);
  }
};

// ===== 种子随机与词书分类工具函数 =====
// 字符串哈希函数，用于生成种子
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash >>> 0;
}

// Mulberry32 种子随机数生成器
function mulberry32(seed) {
  let state = seed | 0;
  return function() {
    state = state + 0x6D2B79F5 | 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// 判断词书是否为课本类（官方教材同步，保持录入顺序）
function isTextbookWordbook(bookId) {
  const NON_TEXTBOOK_IDS = new Set([
    'junior_exam_words',
    'new_curriculum_senior',
    'gaokao_reading_words',
    'primary_textbook_real',
    'senior_textbook_real',
  ]);
  return !NON_TEXTBOOK_IDS.has(bookId);
}

Page({
  data: {
    pageTitle: '单词学习',
    showLoadingModal: false,
    loadingMessage: '',
    loading: false,
    hasError: false,
    errorMessage: '',
    learningMode: '', // 'preview', 'newLearning', 'finalTest'
    currentStudent: null,
    currentWordbook: null,
    learningWordbooks: '', // 显示当前学习词书的标题
    currentBatchWords: [],
    currentBatchIndex: 0,
    totalBatches: 0,
    currentBatchWordsCount: 0,
    masteredWordsCount: 0,
    notMasteredWordsCount: 0, // 不会单词的数量
    showMeaning: {},
    clickCounts: {},
    showPhonetic: {},
    wordDisplayState: {},
    activeWordId: '',
    phoneticModeEnabled: false,
    previewMastery: {},
    allWords: [],
    testWords: [],
    testProgress: 0,
    hasMoreWords: true,
    currentPage: 0,
    totalPages: 0,
    currentGroupIndex: 0,
    totalGroups: 0,
    studentId: '',
    wordbookId: '',
    // 自定义混组相关
    showCustomMixPanel: false,
    learnedGroups: [],
    groupMixCount: [],
    groupSelected: [], // 使用数组存储每个组的选择状态
    selectedGroups: [], // 使用数组存储选中的组索引
    selectAll: false,
    // 实时统计数据
    currentBatchMasteredCount: 0,
    progressPercentage: 0,
    // 课后检测快照（用于记录完整的已掌握/未掌握单词）
    finalTestSourceWordIds: [],
    finalTestSourceMasteredWordIds: [],
    finalTestSourceNotMasteredWordIds: [],
    finalTestSourceWordsDetailed: [],
    startLearningSourceWordIds: [],
    startLearningSourceMasteredWordIds: [],
    startLearningSourceNotMasteredWordIds: [],
    startLearningSourceWordsDetailed: [],
    // 学习时长统计
    studyStartTime: null,
    studyDuration: 0
  },

  onLoad: function(options) {
    this._isPageUnloaded = false;
    console.log('Learning page loaded with options:', options);

    // 读取全局音标显示模式（默认关闭，兼容历史预习键）
    this.loadPhoneticModePreference();
    
    // 检查是否有传入的学生、词书ID和学习模式
    if (options.studentId) {
      this.setData({ studentId: options.studentId });
    }
    if (options.wordbookId) {
      this.setData({ wordbookId: options.wordbookId });
    }
    if (options.mode) {
      this.setData({ learningMode: options.mode });
    }

    // 路由显式指定词书时，以路由为准并同步为当前词书，不能沿用旧的全局词书。
    if (options.wordbookId) {
      const app = getApp();
      const currentStudent = resolveCurrentStudent(app);
      const routeWordbook = typeof wordbooksModule.getBookById === 'function'
        ? wordbooksModule.getBookById(options.wordbookId)
        : null;
      if (currentStudent && routeWordbook) {
        setCurrentWordbook(app, currentStudent, routeWordbook, { emit: false });
      }
    }
    
    // 为测试目的，强制设置学习模式
    if (options.mode === 'review') {
      console.log('强制设置为复习模式');
      this.setData({ learningMode: 'review' });
    }
    
    // 立即从globalData同步数据
    const initialContext = this.syncFromGlobalData();
    this._activeContextKey = createLearningContextKey(
      initialContext && initialContext.currentStudent,
      initialContext && initialContext.currentWordbook
    );
    
    // 为测试目的，直接设置测试学生和词书
    if (options.studentId === 'test_student' && options.wordbookId === 'test_wordbook') {
      console.log('使用测试学生和词书');
      this.setData({
        currentStudent: { id: 'test_student', name: '测试学生' },
        currentWordbook: { id: 'test_wordbook', title: '测试词书', category: 'primary' }
      });
    }
    
    // 初始化学习过程
    console.log('页面加载时的学习模式:', this.data.learningMode);
    this.initStudyProcess();
  },

  onShow: function() {
    console.log('Learning page shown');
    
    // 每次页面显示时，优先从globalData同步最新数据
    const context = this.syncFromGlobalData();
    const nextContextKey = createLearningContextKey(
      context && context.currentStudent,
      context && context.currentWordbook
    );
    const contextChanged = !!(
      this._activeContextKey &&
      nextContextKey &&
      this._activeContextKey !== nextContextKey
    );

    if (contextChanged) {
      console.log('学习上下文已切换，重新加载词书数据:', this._activeContextKey, '→', nextContextKey);
      this.resetForLearningContextChange();
    }
    this._activeContextKey = nextContextKey;
    
    // 然后检查本地存储中的选择
    this.checkSelectedStudentAndWordbook();

    // 【云端词书】非阻塞预下载
    this._preloadCloudWordbook();
    
    // 如果已经有学生和词书信息，确保学习过程已初始化
    if (contextChanged) {
      this.initStudyProcess();
    } else if (this.data.currentStudent && this.data.currentWordbook && !this.data.learningMode && this.data.currentBatchWords.length === 0) {
      this.initStudyProcess();
    }
  },

  onHide: function() {
    console.log('Learning page hidden');
    // 页面隐藏时停止学习时长统计
    this.stopStudyTimer();
    this._destroyCurrentAudioContext();
  },

  onUnload: function() {
    this._isPageUnloaded = true;
    console.log('Learning page unloaded');
    // 页面卸载时停止学习时长统计
    this.stopStudyTimer();
    this._destroyCurrentAudioContext();
  },

  // 加载全局音标模式偏好（默认关闭，兼容旧键）
  loadPhoneticModePreference: function() {
    try {
      const globalSaved = wx.getStorageSync('global_phonetic_mode_enabled');
      let savedEnabled = false;

      if (globalSaved === true || globalSaved === false) {
        savedEnabled = globalSaved;
      } else {
        const legacySaved = wx.getStorageSync('preview_phonetic_mode_enabled');
        if (legacySaved === true || legacySaved === false) {
          savedEnabled = legacySaved;
          // 迁移一次到全局键，保证后续所有模式共用配置
          wx.setStorageSync('global_phonetic_mode_enabled', legacySaved);
        }
      }

      this.setData({
        phoneticModeEnabled: savedEnabled === true
      });
    } catch (error) {
      console.error('读取音标模式偏好失败:', error);
      this.setData({ phoneticModeEnabled: false });
    }
  },

  // 切换全局音标模式
  togglePhoneticMode: function(e) {
    const enabled = e.currentTarget.dataset.enabled === true || e.currentTarget.dataset.enabled === 'true';

    this.setData({
      phoneticModeEnabled: enabled,
      showMeaning: {},
      showPhonetic: {},
      wordDisplayState: {},
      activeWordId: '',
      clickCounts: {}
    });

    try {
      wx.setStorageSync('global_phonetic_mode_enabled', enabled);
      // 兼容旧版本读取逻辑
      wx.setStorageSync('preview_phonetic_mode_enabled', enabled);
    } catch (error) {
      console.error('保存音标模式偏好失败:', error);
    }
  },

  // 从globalData同步学生和词书信息
  syncFromGlobalData: function() {
    try {
      const app = getApp();
      const currentStudent = resolveCurrentStudent(app);
      const currentWordbook = resolveCurrentWordbook(app, currentStudent);

      const studentChanged =
        currentStudent &&
        (!this.data.currentStudent || String(this.data.currentStudent.id || '') !== String(currentStudent.id || ''));

      const wordbookChanged =
        currentWordbook &&
        (!this.data.currentWordbook || String(this.data.currentWordbook.id || '') !== String(currentWordbook.id || ''));

      const patch = {};
      
      // 同步学生信息
      if (studentChanged) {
        debugLog('从globalData同步学生信息:', currentStudent.name);
        patch.currentStudent = currentStudent;
        // 同时保存到本地存储和 globalData，确保返回首页时学生上下文一致
        wx.setStorageSync('selectedStudent', currentStudent);
        wx.setStorageSync('currentStudent', currentStudent);
        app.globalData.currentStudent = currentStudent;
      }
      
      // 同步词书信息
      if (currentWordbook && wordbookChanged) {
        debugLog('从globalData同步词书信息:', currentWordbook.title);
        patch.currentWordbook = currentWordbook;
        patch.learningWordbooks = currentWordbook.title || '未知词书';
        setCurrentWordbook(app, currentStudent, currentWordbook, { emit: false });
      }

      if (Object.keys(patch).length > 0) {
        this.setData(patch);
      }

      return { currentStudent, currentWordbook, studentChanged, wordbookChanged };
    } catch (error) {
      console.error('从globalData同步数据失败:', error);
      return { currentStudent: null, currentWordbook: null, studentChanged: false, wordbookChanged: false };
    }
  },

  resetForLearningContextChange: function() {
    const previousMode = this.data.learningMode;
    const preservedModes = ['preview', 'review', 'gridReview'];
    const nextMode = previousMode
      ? (preservedModes.includes(previousMode) ? previousMode : 'preview')
      : '';

    this._studyInitializationPromise = null;
    this.stopStudyTimer();
    this._destroyCurrentAudioContext();
    this.setData({
      learningMode: nextMode,
      currentBatchWords: [],
      allWords: [],
      testWords: [],
      currentBatchIndex: 0,
      currentPage: 0,
      totalBatches: 0,
      totalPages: 0,
      previewMastery: {},
      showMeaning: {},
      showPhonetic: {},
      wordDisplayState: {},
      activeWordId: '',
      masteredWordsCount: 0,
      notMasteredWordsCount: 0,
      showGroupCompletePage: false,
      showCustomMixPanel: false,
      hasError: false,
      errorMessage: '',
      loading: false,
      showLoadingModal: false
    });
  },

  // 检查是否已选择学生和词书
  checkSelectedStudentAndWordbook: function() {
    try {
      // 从本地存储获取选中的学生和词书
      const app = getApp();
      const savedStudent = resolveCurrentStudent(app);
      const savedWordbook = resolveCurrentWordbook(app, savedStudent);
      
      // 如果本地存储有数据但当前页面没有，则更新
      if (savedStudent && !this.data.currentStudent) {
        console.log('从本地存储恢复学生信息');
        this.setData({ currentStudent: savedStudent });
        // 同步回globalData
        app.globalData.currentStudent = savedStudent;
        wx.setStorageSync('selectedStudent', savedStudent);
        wx.setStorageSync('currentStudent', savedStudent);
      }
      
      if (savedWordbook && !this.data.currentWordbook) {
        console.log('从本地存储恢复词书信息:', savedWordbook.title);
        this.setData({
          currentWordbook: savedWordbook,
          learningWordbooks: savedWordbook.title || '未知词书'
        });
        // 同步回globalData
        setCurrentWordbook(app, savedStudent, savedWordbook, { emit: false });
      }
    } catch (error) {
      console.error('检查选中的学生和词书失败:', error);
    }
  },

  /** 云端词书预下载（非阻塞） */
  _preloadCloudWordbook: function() {
    const wb = this.data.currentWordbook;
    if (!wb || !wb.id) return;
    if (cloudWordbookLoader.isCloudWordbook(wb.id)) {
      cloudWordbookLoader.downloadWordsFromCloud(wb.id).then((words) => {
        if (words) {
          console.log('[cloud-wordbook] 学习页预下载完成:', wb.id);
        }
      });
    }
  },

  // 选择学生
  chooseStudent: function() {
    wx.navigateTo({
      url: '/pages/students/students?selectMode=true'
    });
  },

  // 选择词书
  chooseWordbook: function() {
    if (!this.data.currentStudent) {
      wx.showToast({
        title: '请先选择学生',
        icon: 'none'
      });
      return;
    }
    
    wx.navigateTo({
      url: '/subpages/wordbook/wordbook?selectMode=true'
    });
  },

  // 初始化学习过程
  initStudyProcess: function() {
    if (this._studyInitializationPromise) {
      return this._studyInitializationPromise;
    }

    const initializationPromise = this._initializeStudyProcess().catch((error) => {
      console.error('初始化学习过程失败:', error);
      if (!this._isPageUnloaded) {
        this.setData({
          showLoadingModal: false,
          loading: false,
          hasError: true,
          errorMessage: '学习材料加载失败，请稍后重试'
        });
      }
      return null;
    });

    this._studyInitializationPromise = initializationPromise;
    const clearInitialization = () => {
      if (this._studyInitializationPromise === initializationPromise) {
        this._studyInitializationPromise = null;
      }
    };
    initializationPromise.then(clearInitialization, clearInitialization);
    return initializationPromise;
  },

  _initializeStudyProcess: async function() {
    // 显示自定义加载弹窗
    this.setData({
      showLoadingModal: true,
      loadingMessage: '准备学习材料…'
    });

    // 确保数据已经从globalData同步
    this.syncFromGlobalData();

    // 如果仍然没有学生或词书信息，尝试获取默认数据
    if (!this.data.currentStudent || !this.data.currentWordbook) {
      try {
        const app = getApp();
        
        // 尝试从本地存储获取学生信息
        if (!this.data.currentStudent) {
          const students = wx.getStorageSync('students') || [];
          if (students.length > 0) {
            console.log('从本地存储获取默认学生信息');
            this.setData({ currentStudent: students[0] });
            // 同步回globalData
            app.globalData.currentStudent = students[0];
            wx.setStorageSync('selectedStudent', students[0]);
          }
        }
        
        // 尝试从本地存储获取词书信息
        if (!this.data.currentWordbook) {
          const wordbooks = wx.getStorageSync('wordbooks') || [];
          if (wordbooks.length > 0) {
            console.log('从本地存储获取默认词书信息');
            this.setData({
              currentWordbook: wordbooks[0],
              learningWordbooks: wordbooks[0].title || '未知词书'
            });
            // 同步回globalData
            app.globalData.currentWordbook = wordbooks[0];
            app.globalData.selectedWordbook = wordbooks[0];
            wx.setStorageSync('selectedWordbook', wordbooks[0]);
          }
        }
        
        // 如果通过ID参数传入，尝试精确匹配
        if (this.data.studentId && !this.data.currentStudent) {
          const students = wx.getStorageSync('students') || [];
          const student = students.find(s => s.id === this.data.studentId);
          if (student) {
            this.setData({ currentStudent: student });
            app.globalData.currentStudent = student;
            wx.setStorageSync('selectedStudent', student);
          }
        }
        
        if (this.data.wordbookId && !this.data.currentWordbook) {
          const wordbooks = wx.getStorageSync('wordbooks') || [];
          const wordbook = wordbooks.find(w => w.id === this.data.wordbookId);
          if (wordbook) {
            this.setData({
              currentWordbook: wordbook,
              learningWordbooks: wordbook.title || '未知词书'
            });
            app.globalData.currentWordbook = wordbook;
            app.globalData.selectedWordbook = wordbook;
            wx.setStorageSync('selectedWordbook', wordbook);
          }
        }
      } catch (error) {
        console.error('获取默认数据失败:', error);
      }
    }
    
    // 检查是否成功获取到学生和词书信息
    if (this.data.currentStudent && this.data.currentWordbook) {
      console.log('成功获取学生和词书信息，开始初始化学习模式:', this.data.learningMode);
      this.setData({
        loading: true,
        hasError: false
      });

      // 根据不同的学习模式初始化
      if (this.data.learningMode === 'review' || this.data.learningMode === 'gridReview' || !this.data.learningMode) {
        const requestedWordbookId = String(this.data.currentWordbook.id || '');
        if (cloudWordbookLoader.isCloudWordbook(requestedWordbookId)) {
          this.setData({ loadingMessage: '正在下载完整词书…' });
          const loadedWords = await cloudWordbookLoader.ensureWordsLoaded(requestedWordbookId);

          if (this._isPageUnloaded) {
            return;
          }

          const currentWordbookId = String((this.data.currentWordbook && this.data.currentWordbook.id) || '');
          if (currentWordbookId !== requestedWordbookId) {
            return this._initializeStudyProcess();
          }

          if (!cloudWordbookLoader.isCompleteWordList(requestedWordbookId, loadedWords)) {
            this.setData({
              showLoadingModal: false,
              loading: false,
              hasError: true,
              errorMessage: '完整词书下载失败，请检查网络后重试'
            });
            wx.showToast({
              title: '完整词书下载失败，请重试',
              icon: 'none'
            });
            return;
          }
        }

        // 只有在复习模式、网格复习模式或未设置学习模式时，才初始化预习模式
        this.initializePreviewMode();
      } else {
        // 其他模式（如newLearning、finalTest）保持当前状态，不重新初始化
        console.log('保持当前学习模式:', this.data.learningMode);
        this.setData({ showLoadingModal: false });
      }
    } else {
      // 否则显示错误信息
      this.setData({ showLoadingModal: false });
      wx.showToast({
        title: '请先选择学生和词书',
        icon: 'none'
      });
      this.setData({
        loading: false,
        hasError: true,
        errorMessage: '无法获取学生或词书信息，请先选择学生和词书'
      });
    }
  },

  // 初始化预习模式
  initializePreviewMode: function() {
    console.log('Initializing preview mode...');
    
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
      console.log('开始生成单词数据，词书类别:', wordbookCategory, '词书ID:', this.data.currentWordbook.id);
      
      // 一次性加载全部单词（generateWordsForBook 内部会 require 完整词书再切片；
      // 此前用 batchSize=15 循环调用导致上百次重复 require 和 sanitize，
      // 大词书下极其缓慢。改为一次加载 + 进度提示。）
      this.setData({
        loadingMessage: '正在加载词书数据…'
      });
      const loadStartTime = Date.now();
      const allWordsRaw = generateWordsForBook(wordbookCategory, this.data.currentWordbook.id, 0, 99999);
      const totalCount = allWordsRaw._totalCount || allWordsRaw.length || 100;
      console.log('词书总单词数:', totalCount);
      
      // 分批组装 + 进度提示：虽然数据已全部返回，但 setData 刷新视图需要分段进行
      let allWords = [];
      const CHUNK_SIZE = 200;
      for (let i = 0; i < totalCount; i += CHUNK_SIZE) {
        allWords.push(...allWordsRaw.slice(i, i + CHUNK_SIZE));
        const loaded = Math.min(i + CHUNK_SIZE, totalCount);
        const progress = Math.min(100, Math.round(loaded / totalCount * 100));
        this.setData({
          loadingMessage: `正在加载词书数据… ${loaded}/${totalCount}（${progress}%）`
        });
      }
      const loadElapsed = Date.now() - loadStartTime;
      console.log('加载完成，总单词数:', allWords.length, '耗时:', loadElapsed, 'ms');
      
      // 初始计算totalBatches（后面会根据过滤结果重新计算）
      let totalBatches = Math.ceil(totalCount / batchSize);

      // 为每个单词添加id属性，确保唯一标识
      allWords = allWords.map((word, index) => {
        // 使用word内容和wordbookId的组合作为ID，确保与新词学习模式生成的ID一致
        const baseId = word.word ? `${wordbookId}_${word.word.toLowerCase().replace(/\s+/g, '_')}` : `${wordbookId}_unknown`;
        return {
          ...word,
          phonetic: this.normalizePhoneticDisplay(word.phonetic),
          id: baseId
        };
      });

      // ===== 预习顺序策略 =====
      // 课本类：保持数据文件的录入顺序（不随机）
      // 非课本类：基于 studentId 的确定性随机（跨客户端顺序一致）
      const isTextbook = isTextbookWordbook(wordbookId);
      if (isTextbook) {
        console.log('课本类词书，保持录入顺序');
        // 不做任何打乱，保持数据文件原始顺序
      } else {
        console.log('非课本类词书，使用种子随机（studentId:', studentId, '）');
        const seed = hashString(String(studentId));
        const rng = mulberry32(seed);
        for (let i = allWords.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [allWords[i], allWords[j]] = [allWords[j], allWords[i]];
        }
      }
      
      // 加载本地保存的预习状态，确保下次进入可延续筛选结果
      let savedPreviewMastery = {};
      const storageKey = 'previewMastery_' + studentId + '_' + wordbookId;
      const previewExcludedStorageKey = `previewExcludedWordIds_${studentId}_${wordbookId}`;
      let savedPreviewExcludedWordIds = [];
      try {
        savedPreviewMastery = wx.getStorageSync(storageKey) || {};
        const excludedIds = wx.getStorageSync(previewExcludedStorageKey) || [];
        savedPreviewExcludedWordIds = Array.isArray(excludedIds) ? excludedIds : [];
      } catch (storageError) {
        console.error('读取预习状态失败:', storageError);
        savedPreviewMastery = {};
        savedPreviewExcludedWordIds = [];
      }
      console.log('加载预习状态，条目数:', Object.keys(savedPreviewMastery).length);

      // 预习中已标记（对勾/错叉）的单词：下次预习统一不再展示
      const handledPreviewWordIdSet = new Set();
      Object.keys(savedPreviewMastery).forEach(previewWordId => {
        const previewStatus = savedPreviewMastery[previewWordId];
        const isHandled =
          previewStatus === true ||
          previewStatus === 'mastered' ||
          previewStatus === false ||
          previewStatus === 'difficult';

        // 兼容旧数据，避免混入其他词书ID
        const isCurrentWordbookWord = String(previewWordId).startsWith(`${wordbookId}_`);
        if (isHandled && isCurrentWordbookWord) {
          handledPreviewWordIdSet.add(String(previewWordId));
        }
      });

      savedPreviewExcludedWordIds.forEach((excludedWordId) => {
        if (String(excludedWordId).startsWith(`${wordbookId}_`)) {
          handledPreviewWordIdSet.add(String(excludedWordId));
        }
      });

      const handledPreviewWordIds = Array.from(handledPreviewWordIdSet);

// 初始化已处理单词ID列表（对勾/错叉都在下次预习中过滤）
  let masteredWordIdArray = [];
     let reviewWordIdArray = [];

     try {
       // 尝试获取单词掌握记录
       let wordMastery = wx.getStorageSync('wordMastery') || {};
       
      debugLog('获取到的单词掌握记录:', wordMastery);
      debugLog('当前学生ID:', studentId);
      debugLog('当前词书ID:', wordbookId);
       
       // 不再创建测试数据，确保只在有真实学习记录时显示抗遗忘复习
       if (!wordMastery[studentId] || !wordMastery[studentId][wordbookId]) {
         console.log('没有找到单词掌握记录，不创建测试数据');
         // 如果是抗遗忘复习模式，直接显示"没有需要复习的单词"
         if (this.data.learningMode === 'review') {
           console.log('抗遗忘复习模式：没有找到单词掌握记录');
           wx.showToast({
             title: '没有需要复习的单词',
             icon: 'success',
             duration: 2000
           });
           // 直接返回，不显示任何单词
           return;
         }
       }
       
       // 安全地检查和获取已掌握单词
       if (wordMastery[studentId] && wordMastery[studentId][wordbookId]) {
         console.log('使用单词掌握记录过滤已学习单词');
         
         const masteredWords = wordMastery[studentId][wordbookId];
         debugLog('单词掌握记录:', masteredWords);
         
         if (Array.isArray(masteredWords)) {
          // 兼容旧的数组格式
          // 确保只包含当前词书的单词
          masteredWordIdArray = masteredWords.filter(id => id.includes(wordbookId));
          debugLog('兼容旧格式，过滤后已掌握单词数量:', masteredWordIdArray.length);
        } else {
          // 新的对象格式
        const now = new Date().getTime();
        // 定义今天判断函数
        const isToday = (date) => {
          const today = new Date();
          const targetDate = new Date(date);
          return today.getDate() === targetDate.getDate() &&
                 today.getMonth() === targetDate.getMonth() &&
                 today.getFullYear() === targetDate.getFullYear();
        };
        for (const wordId in masteredWords) {
          const word = masteredWords[wordId];
          debugLog('处理单词:', wordId, word);
          // 确保只处理当前词书的单词
          if (wordId.includes(wordbookId)) {
            // ★ 修复：所有在wordMastery中的单词（无论掌握与否）都应加入过滤列表
            // 预习模式仅针对全新未学单词，已处理过的单词通过复习/抗遗忘模式处理
            // 之前只过滤 mastered=true 的词，导致 marked=false 的词反复出现在预习中
            masteredWordIdArray.push(wordId);
            // 抗遗忘复习只收集：复习到期 + 未掌握（difficult）单词
            const isTodayReview = word.nextReviewTime && isToday(word.nextReviewTime);
            const isDueForReview = word.nextReviewTime && (word.nextReviewTime <= now || isTodayReview);
            const isNotMasteredForReview = word.mastered !== true;
            if (isDueForReview && isNotMasteredForReview) {
              reviewWordIdArray.push(wordId);
            }
          }
        }
         }
         
         debugLog('已掌握单词数量:', masteredWordIdArray.length);
         debugLog('需要复习单词数量:', reviewWordIdArray.length);
         debugLog('需要复习的单词ID:', reviewWordIdArray);
       } else {
         console.log('没有找到已掌握单词记录，将显示所有单词');
       }
     } catch (err) {
       console.error('读取单词掌握记录时出错:', err);
       // 出错时使用空数组，确保继续运行
       masteredWordIdArray = [];
       reviewWordIdArray = [];
     }

     // 无论wordMastery是否存在，都把预习中已标记的单词加入过滤列表
     if (handledPreviewWordIds.length > 0) {
       handledPreviewWordIds.forEach(previewWordId => {
         if (!masteredWordIdArray.includes(previewWordId)) {
           masteredWordIdArray.push(previewWordId);
         }
       });
      debugLog('已合并预习历史标记到过滤列表，数量:', handledPreviewWordIds.length);
     }
     
     // Calculate initial mastered and not mastered counts from saved data
     let initialMasteredCount = 0;
     let initialNotMasteredCount = 0;
     
     // 计算已掌握单词数量
     for (const id in savedPreviewMastery) {
       const status = savedPreviewMastery[id];
       if (status === true || status === 'mastered') {
         initialMasteredCount++;
       }
     }
     
     // 计算不会单词数量
     // 如果有明确标记为不会的单词，则使用这些数量
     for (const id in savedPreviewMastery) {
       const status = savedPreviewMastery[id];
       if (status === false || status === 'difficult') {
         initialNotMasteredCount++;
       }
     }
     
      // 使用简单的数组方法进行过滤，避免Set的复杂操作
      let filteredWords = [];
      
      // 根据学习模式进行不同的过滤逻辑
      if (this.data.learningMode === 'review') {
        // 抗遗忘复习模式：只显示需要复习的单词
        debugLog('开始筛选需要复习的单词，总单词数:', allWords.length, '需要复习的单词ID数量:', reviewWordIdArray.length);
        debugLog('需要复习的单词ID列表:', reviewWordIdArray);
        
        filteredWords = [];
        allWords.forEach(word => {
          const needsReview = reviewWordIdArray.some(id => {
            // 尝试多种匹配方式
            const match1 = String(id) === String(word.id);
            const match2 = String(id) === `${wordbookId}_${word.word}`;
            const match3 = id.includes(word.word);
            // 新增：检查处理后的匹配方式（小写+空格处理）
            const processedWord = word.word.toLowerCase().replace(/\s+/g, '_');
            const match4 = String(id) === `${wordbookId}_${processedWord}`;
            const match5 = id.includes(processedWord);
            // 新增：检查反向匹配，处理wordMastery中的键格式可能与word.id不同的情况
            const match6 = word.id.includes(word.word);
            return match1 || match2 || match3 || match4 || match5 || match6;
          });
          // 确保只有当单词在wordMastery中有对应的掌握记录时，才显示在抗遗忘复习列表中
          // 这样可以避免显示词书默认的单词列表（模拟数据）
          // 过滤非英语单词的内容
          const nonWordList = ['objectspread', 'undefined', 'null', 'NaN'];
          if (needsReview && !nonWordList.includes(word.word.toLowerCase())) {
            debugLog('添加到复习列表的单词:', word.id, word.word);
            filteredWords.push(word);
          }
        });
        
        debugLog('筛选后需要复习的单词数:', filteredWords.length);
          
          // 检查是否有需要复习的单词
          if (filteredWords.length === 0) {
            // 如果没有需要复习的单词，显示提示
            console.log('没有需要复习的单词');
            wx.showToast({
              title: '没有需要复习的单词',
              icon: 'success',
              duration: 2000
            });
            // 不创建任何模拟单词，直接返回
            return;
          }
          
          debugLog('最终复习单词数:', filteredWords.length);
          debugLog('最终复习单词:', filteredWords);
      } else {
        // 其他模式：过滤掉已掌握的单词
        if (masteredWordIdArray.length > 0) {
          debugLog('开始过滤已掌握单词，总单词数:', allWords.length, '已掌握单词ID数量:', masteredWordIdArray.length);
          debugLog('已掌握单词ID:', masteredWordIdArray);
          
          // 首先进行过滤，得到未掌握的单词
          filteredWords = allWords.filter(word => {
            // 使用严格的匹配方式，只匹配完整的ID，避免误过滤
            const isMastered = masteredWordIdArray.some(id => {
              return String(id) === String(word.id);
            });
            return !isMastered;
          });
          
          debugLog('过滤后未掌握单词数量:', filteredWords.length);
          
        } else {
          // 没有已掌握单词，显示所有单词
          filteredWords = allWords;
          debugLog('没有已掌握单词，显示所有单词，数量:', filteredWords.length);
        }
        
        // 注意：不再自动添加已掌握单词，确保已掌握的单词不会显示在预习模式中
        // 除非用户明确需要，否则已掌握的单词应该完全被过滤掉
        
        if (filteredWords.length === 0) {
          debugLog('所有单词都已掌握，显示提示信息');
        }
        
        // 使用最终的过滤结果更新allWords
        allWords = filteredWords;
        
        // 根据最终的单词数量重新计算totalBatches
        totalBatches = Math.ceil(allWords.length / batchSize);
        debugLog('最终单词数量:', allWords.length, '批次数量:', totalBatches);
        
        // 如果所有单词都已掌握，显示提示信息
        if (allWords.length === 0) {
          this.setData({
            hasError: true,
            errorMessage: '恭喜您！所有单词都已掌握，没有需要预习的新单词了。'
          });
          return; // 提前返回，避免后续处理
        }
      } // 闭合第347行开始的if (masteredWordIdArray.length > 0) 块
      
      // 过滤后重新计算未掌握单词数量
      if (initialNotMasteredCount === 0 && this.data.learningMode === 'review') {
        // 仅复习模式下回退为当前单词数量
        initialNotMasteredCount = allWords.length;
      }
      
      // 仅在复习模式下兜底重载，预习模式需保持“已掌握不再显示”
      if (allWords.length === 0 && this.data.learningMode === 'review') {
        console.log('过滤后无单词，重新加载更多单词');
        allWords = [];
        const largerBatchSize = 30;
        const largerMaxLoad = 200;
        for (let i = 0; i < largerMaxLoad; i += largerBatchSize) {
          const batch = generateWordsForBook(wordbookCategory, this.data.currentWordbook.id, i, largerBatchSize);
          allWords.push(...batch);
        }
        
        // 再次尝试过滤（如果有掌握记录）
        if (masteredWordIdArray.length > 0) {
          const tempFiltered = [];
          for (let i = 0; i < allWords.length; i++) {
            const word = allWords[i];
            let isMastered = false;
            for (let j = 0; j < masteredWordIdArray.length; j++) {
              if (String(masteredWordIdArray[j]) === String(word.id)) {
                isMastered = true;
                break;
              }
            }
            if (!isMastered) {
              tempFiltered.push(word);
            }
          }
          allWords = tempFiltered;
          console.log('重新加载后过滤的单词数:', allWords.length);
        }
      }
      
      // 确保有单词显示
      let finalWords = allWords;
      if (finalWords.length === 0 && this.data.learningMode === 'review') {
        console.log('最终检查：没有单词，创建默认单词');
        finalWords = [
          { id: 'default_1', word: 'hello', meaning: '你好', phonetic: '/həˈləʊ/' },
          { id: 'default_2', word: 'world', meaning: '世界', phonetic: '/wɜːld/' },
          { id: 'default_3', word: 'apple', meaning: '苹果', phonetic: '/ˈæpl/' },
          { id: 'default_4', word: 'banana', meaning: '香蕉', phonetic: '/bəˈnɑːnə/' },
          { id: 'default_5', word: 'cat', meaning: '猫', phonetic: '/kæt/' }
        ];
        totalBatches = 1;
      }
      
      debugLog('最终单词数据:', finalWords);
      debugLog('最终学习模式:', this.data.learningMode);
      
      // 根据学习模式设置导航栏标题
      const pageTitle = this.data.learningMode === 'review' ? '单词复习' : '单词预习';
      wx.setNavigationBarTitle({
        title: pageTitle
      });
      
      // 根据学习模式设置不同的数据
      if (this.data.learningMode === 'review') {
        // 复习模式：显示所有需要复习的单词
        this.setData({
          learningMode: 'review',
          pageTitle: '单词复习',
          allWords: finalWords,
          // 使用所有需要复习的单词
          currentBatchWords: finalWords,
          currentBatchIndex: 0,
          totalBatches: 1,
          // 使用所有单词的长度
          currentBatchWordsCount: finalWords.length,
          masteredWordsCount: initialMasteredCount,
          notMasteredWordsCount: initialNotMasteredCount,
          showMeaning: {},
          clickCounts: {},
          showPhonetic: {},
          wordDisplayState: {},
          activeWordId: '',
          previewMastery: savedPreviewMastery || {},
          hasMoreWords: false, // 复习模式下不显示加载更多
          currentPage: 0,
          totalPages: 1,
          loading: false,
          showLoadingModal: false,
          // 开始学习时长统计
          studyStartTime: new Date().getTime(),
          studyDuration: 0
        });
      } else {
        // 预习模式：分页显示
        this.setData({
          learningMode: 'preview',
          pageTitle: '单词预习',
          allWords: finalWords,
          // 使用过滤后的allWords的前15个单词作为当前批次
          currentBatchWords: finalWords.slice(0, 15),
          currentBatchIndex: 0,
          totalBatches: totalBatches,
          // 使用过滤后的当前批次长度
          currentBatchWordsCount: Math.min(15, finalWords.length),
          masteredWordsCount: initialMasteredCount,
          notMasteredWordsCount: initialNotMasteredCount,
          showMeaning: {},
          clickCounts: {},
          showPhonetic: {},
          wordDisplayState: {},
          activeWordId: '',
          previewMastery: savedPreviewMastery || {},
          hasMoreWords: totalBatches > 1,
          currentPage: 0,
          totalPages: totalBatches,
          loading: false,
          showLoadingModal: false,
          // 开始学习时长统计
          studyStartTime: new Date().getTime(),
          studyDuration: 0
        });
      }
      
      // 开始学习时长统计
      this.startStudyTimer();
      
      // 更新初始统计数据
      this.updateBatchMasteryStats();
      
      debugLog('预习模式初始化完成');
      
      // 异步从云端加载预习状态，与本地的合并后更新界面
      // 这样换设备后预习标记也能恢复，不丢失
      loadPreviewStateFromCloud(studentId, wordbookId).then(cloudPreview => {
        if (!cloudPreview || !cloudPreview.mastery) return;
        const cloudMasteryKeys = Object.keys(cloudPreview.mastery);
        if (cloudMasteryKeys.length === 0) return;
        
        // 合并云端数据到本地（云端优先级高，覆盖本地旧数据）
        const merged = { ...savedPreviewMastery };
        let hasNewData = false;
        cloudMasteryKeys.forEach(key => {
          const cv = cloudPreview.mastery[key];
          const lv = merged[key];
          // 云端有且本地没有，或云端标记状态不同时以云端为准
          if (cv !== undefined && cv !== null && (lv === undefined || lv === null || cv !== lv)) {
            merged[key] = cv;
            hasNewData = true;
          }
        });
        
        if (hasNewData) {
          // 写回本地存储
          wx.setStorageSync(storageKey, merged);
          // 更新当前界面的 previewMastery 数据
          this.setData({ previewMastery: merged });
          console.log('已合并云端预习状态，新增', cloudMasteryKeys.length, '条记录');
        }
      }).catch(err => {
        console.warn('加载云端预习状态失败:', err);
      });
      
    } catch (error) {
      console.error('初始化预习模式失败:', error);
      this.setData({
        loading: false,
        showLoadingModal: false,
        hasError: true,
        errorMessage: '初始化预习模式失败，请重试'
      });
    } finally {
      // 确保自定义加载弹窗关闭
      this.setData({ showLoadingModal: false });
    }
  },

  // 加载更多单词批次
  loadMoreWordsBatch: function() {
    try {
      const nextBatchIndex = this.data.currentBatchIndex + 1;
      const batchSize = 15; // 与初始化时的batchSize保持一致
      const startIndex = nextBatchIndex * batchSize;
      const endIndex = startIndex + batchSize;
      
      const nextBatch = this.data.allWords.slice(startIndex, endIndex);
      
      if (nextBatch.length > 0) {
        this.setData({
      currentBatchWords: nextBatch,
      currentBatchIndex: nextBatchIndex,
      currentBatchWordsCount: nextBatch.length,
      hasMoreWords: endIndex < this.data.allWords.length,
      currentPage: nextBatchIndex,
      showMeaning: {},
      clickCounts: {},
        showPhonetic: {},
        wordDisplayState: {},
        activeWordId: ''
    });
        
        // 更新当前批次的掌握统计
        this.updateBatchMasteryStats();
        
        console.log('加载下一批单词成功，批次索引:', nextBatchIndex);
      } else {
        console.log('没有更多单词批次');
        this.setData({ hasMoreWords: false });
      }
    } catch (error) {
      console.error('加载更多单词批次失败:', error);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    }
  },

  // 使用真实词书数据，已替换generateMockWords函数
  // 获取更多单词用于学习过程
  loadMoreWordsForAllWords: function(wordbookCategory, wordbookId, startIndex, count) {
    return generateWordsForBook(wordbookCategory, wordbookId, startIndex, count);
  },

  // 音标展示规范化：仅保留第一个读音，并统一为 /xxxx/ 形式
  normalizePhoneticDisplay: function(phonetic) {
    if (!phonetic && phonetic !== 0) {
      return '';
    }

    const source = String(phonetic).trim();
    if (!source) {
      return '';
    }

    const firstVariant = source.split(/[,，;；]/)[0].trim();
    if (!firstVariant) {
      return '';
    }

    const core = firstVariant
      .replace(/^\/+|\/+$/g, '')
      .replace(/^\[|\]$/g, '')
      .trim();

    return core ? `/${core}/` : '';
  },

  // 切换单词释义显示
  toggleWordMeaning: function(e) {
    // 添加调试日志
    console.log('toggleWordMeaning called:', {
      event: e,
      currentTarget: e.currentTarget,
      dataset: e.currentTarget ? e.currentTarget.dataset : null,
      timestamp: new Date().getTime()
    });
    
    const { id } = e.currentTarget ? e.currentTarget.dataset : {};
    if (!id) {
      console.error('No id found in event dataset');
      return;
    }
    
    const phoneticModeEnabled = !!this.data.phoneticModeEnabled;
    const activeWordId = this.data.activeWordId || '';
    const isSameWord = activeWordId === id;
    const previousState = isSameWord
      ? ((this.data.wordDisplayState && this.data.wordDisplayState[id]) || 'collapsed')
      : 'collapsed';

    let nextState = 'collapsed';

    if (phoneticModeEnabled) {
      // 音标模式: collapsed -> phonetic -> meaning -> collapsed 循环
      if (!isSameWord || previousState === 'collapsed') {
        nextState = 'phonetic';
      } else if (previousState === 'phonetic') {
        nextState = 'meaning';
      } else {
        nextState = 'collapsed';
      }
    } else {
      // 默认模式: 第1次发音(不展示), 第2次释义, 第3次回到发音态
      if (!isSameWord) {
        nextState = 'collapsed';
      } else if (previousState === 'meaning') {
        nextState = 'collapsed';
      } else {
        nextState = 'meaning';
      }
    }

    const showMeaning = {};
    const showPhonetic = {};
    const wordDisplayState = {};

    if (nextState === 'phonetic') {
      showPhonetic[id] = true;
      showMeaning[id] = false;
      wordDisplayState[id] = 'phonetic';
    } else if (nextState === 'meaning') {
      showMeaning[id] = true;
      showPhonetic[id] = phoneticModeEnabled;
      wordDisplayState[id] = 'meaning';
    } else {
      showMeaning[id] = false;
      showPhonetic[id] = false;
      wordDisplayState[id] = 'collapsed';
    }

    this.playWordPronunciation(id);

    this.setData({
      showMeaning,
      showPhonetic,
      wordDisplayState,
      activeWordId: id,
      clickCounts: {
        [id]: nextState === 'collapsed' ? 1 : 2
      }
    });
  },

  _destroyCurrentAudioContext: function() {
    if (this._currentAudioContext) {
      try {
        this._currentAudioContext.stop();
      } catch (stopError) {
        console.error('停止旧音频失败:', stopError);
      }
      try {
        this._currentAudioContext.destroy();
      } catch (destroyError) {
        console.error('销毁旧音频失败:', destroyError);
      }
      this._currentAudioContext = null;
    }
  },
  
  // 播放单词读音
  playWordPronunciation: function(wordId) {
    try {
      // 查找单词
      if (!this.data.currentBatchWords) {
        console.warn('currentBatchWords 未定义，无法查找单词:', wordId);
        return;
      }
      
      const word = this.data.currentBatchWords.find(w => w.id === wordId);
      if (!word) {
        console.warn('未找到单词:', wordId);
        return;
      }
      
      // 检查单词是否有效
      if (!word.word || word.word.trim() === '') {
        console.warn('无效的单词:', word);
        return;
      }
      
      console.log(`播放单词读音: ${word.word} ${word.phonetic || ''}`);
      
      // 这里使用微信的语音播放API
      const audioUrl = this.getWordAudioUrl(word.word);
      if (audioUrl) {
        // 防重入：每次播放前先停止并销毁上一次音频
        this._destroyCurrentAudioContext();

        const innerAudioContext = wx.createInnerAudioContext();
        this._currentAudioContext = innerAudioContext;
        let hasRetriedWithFallback = false;
        
        // 监听播放完成事件
        innerAudioContext.onEnded(() => {
          console.log('音频播放完成');
          innerAudioContext.destroy();
          if (this._currentAudioContext === innerAudioContext) {
            this._currentAudioContext = null;
          }
        });
        
        // 监听播放错误事件
        innerAudioContext.onError((res) => {
          const errMsg = (res && res.errMsg) ? res.errMsg : 'unknown';
          console.error('音频播放失败:', errMsg);

          if (hasRetriedWithFallback) {
            try {
              innerAudioContext.destroy();
            } catch (destroyError) {
              console.error('销毁音频上下文失败:', destroyError);
            }
            if (this._currentAudioContext === innerAudioContext) {
              this._currentAudioContext = null;
            }
            return;
          }

          hasRetriedWithFallback = true;
          resolveDictionaryApiAudioUrl(word.word).then((fallbackUrl) => {
            try {
              innerAudioContext.destroy();
            } catch (destroyError) {
              console.error('销毁主音频上下文失败:', destroyError);
            }
            if (this._currentAudioContext === innerAudioContext) {
              this._currentAudioContext = null;
            }

            if (!fallbackUrl) {
              return;
            }

            const fallbackAudioContext = wx.createInnerAudioContext();
            this._currentAudioContext = fallbackAudioContext;
            fallbackAudioContext.onEnded(() => {
              try {
                fallbackAudioContext.destroy();
              } catch (destroyError) {
                console.error('销毁兜底音频上下文失败:', destroyError);
              }
              if (this._currentAudioContext === fallbackAudioContext) {
                this._currentAudioContext = null;
              }
            });
            fallbackAudioContext.onError((fallbackRes) => {
              const fallbackErrMsg = (fallbackRes && fallbackRes.errMsg) ? fallbackRes.errMsg : 'unknown';
              console.error('兜底音频播放失败:', fallbackErrMsg);
              try {
                fallbackAudioContext.destroy();
              } catch (destroyError) {
                console.error('销毁兜底音频上下文失败:', destroyError);
              }
              if (this._currentAudioContext === fallbackAudioContext) {
                this._currentAudioContext = null;
              }
            });

            try {
              fallbackAudioContext.src = fallbackUrl;
              fallbackAudioContext.play();
            } catch (retryError) {
              console.error('兜底音频重试失败:', retryError);
              try {
                fallbackAudioContext.destroy();
              } catch (destroyError) {
                console.error('销毁兜底音频上下文失败:', destroyError);
              }
              if (this._currentAudioContext === fallbackAudioContext) {
                this._currentAudioContext = null;
              }
            }
          }).catch((fallbackError) => {
            console.error('解析兜底音频失败:', fallbackError);
            if (this._currentAudioContext === innerAudioContext) {
              this._currentAudioContext = null;
            }
          });
        });
        
        try {
          innerAudioContext.src = audioUrl;
          innerAudioContext.play();
        } catch (audioError) {
          console.error('设置音频源失败:', audioError);
          // 确保即使设置失败也能销毁上下文
          try {
            innerAudioContext.destroy();
          } catch (destroyError) {
            console.error('销毁音频上下文失败:', destroyError);
          }
          if (this._currentAudioContext === innerAudioContext) {
            this._currentAudioContext = null;
          }
        }
      }
    } catch (error) {
      console.error('播放单词读音失败:', error);
    }
  },
  
  // 获取单词音频URL
  getWordAudioUrl: function(word) {
    try {
      const app = getApp();
      if (!app || !app.globalData || app.globalData.enableOnlineDictAudio !== true) {
        return null;
      }

      // 检查单词是否有效
      if (!word || word.trim() === '') {
        console.warn('无效的单词，无法获取音频URL');
        return null;
      }
      
      // 过滤掉可能导致API错误的特殊单词
      const specialWords = ['Hubli-Dharwad', 'undefined', 'null', 'NaN', 'Lungfish', 'table tennis table'];
      if (specialWords.includes(word.trim())) {
        console.warn('特殊单词，不获取音频URL:', word);
        return null;
      }
      
      // 过滤包含多个空格或特殊格式的短语，避免API错误
      if (word.trim().split(/\s+/).length > 3) {
        console.warn('过长短语，不获取音频URL:', word);
        return null;
      }
      
      // 使用有道词典音频，先归一化查询词，避免如 penny(pl.pence) 这类词形说明影响发音
      return buildYoudaoAudioUrl(word);
    } catch (error) {
      console.error('获取单词音频URL失败:', error);
      return null;
    }
  },

  // 更新单词掌握状态
  updateWordMastery: function(e) {
    const { id, mastered } = e.currentTarget.dataset;
    const previewMastery = this.data.previewMastery;
    
    // 确保mastered是布尔值
    const isMastered = mastered === 'true' || mastered === true;
    
    // 更新掌握状态
    previewMastery[id] = isMastered;
    
    // 计算已掌握和未掌握的单词数量
    let masteredCount = 0;
    let notMasteredCount = 0;
    for (const wordId in previewMastery) {
      if (previewMastery[wordId]) {
        masteredCount++;
      } else if (previewMastery[wordId] === false) {
        notMasteredCount++;
      }
    }
    
    // 计算当前批次的统计信息
    const currentBatchMasteredCount = Object.keys(previewMastery).filter(wordId => {
      return previewMastery[wordId] && this.data.currentBatchWords.some(word => word.id === wordId);
    }).length;
    
    // 计算总体进度百分比和正确率
    const totalWords = this.data.testWords.length || this.data.allWords.length;
    
    // 在课后检测模式下，使用测试单词的数量作为已处理单词数
    let totalProcessedWords = Object.keys(previewMastery).length;
    let correctRate = 0;
    
    if (this.data.learningMode === 'finalTest') {
      // 课后检测模式：使用测试单词的数量作为已处理单词数
      totalProcessedWords = this.data.testWords.length;
      // 只有当所有测试单词都被标记时，才计算正确率
      if (totalProcessedWords > 0) {
        correctRate = Math.round((masteredCount / totalProcessedWords) * 100);
      }
    } else {
      // 其他模式：使用传统计算方式
      totalProcessedWords = Object.keys(previewMastery).length;
      correctRate = totalProcessedWords > 0 ? Math.round((masteredCount / totalProcessedWords) * 100) : 0;
    }
    
    const progressPercentage = totalWords > 0 ? Math.round((totalProcessedWords / totalWords) * 100) : 0;
    
    // 根据学习模式设置不同的进度
    const updateData = {
      previewMastery: previewMastery,
      masteredWordsCount: masteredCount,
      notMasteredWordsCount: notMasteredCount,
      currentBatchMasteredCount: currentBatchMasteredCount
    };
    
    // 在课后检测模式下更新正确率，其他模式保持进度百分比
    if (this.data.learningMode === 'finalTest') {
      updateData.testProgress = correctRate;
    } else {
      updateData.progressPercentage = progressPercentage;
    }
    
    this.setData(updateData);
    
    // 实时日志记录当前状态
    console.log(`预览标记更新: 单词ID=${id}, 标记状态=${mastered}, 当前批次已掌握=${currentBatchMasteredCount}/${this.data.currentBatchWords.length}, 总体掌握=${masteredCount}/${totalWords}, 进度=${progressPercentage}%`);
  },

  // 更新预习掌握状态
  // 辅助函数：解析按钮状态
  _parseButtonStatus: function(status) {
    if (status === 'true' || status === true) return true;
    if (status === 'false' || status === false) return false;
    return status; // 保留原始状态（如'mastered'或'difficult'）
  },

  // 辅助函数：计算单词掌握统计信息
  _calculateMasteryStats: function(previewMastery, currentBatchWords, allWords, testWords) {
    let masteredCount = 0;
    let notMasteredCount = 0;

    const allWordIds = new Set((allWords || []).map(word => String(word.id || '')));
    
    // 计算总体掌握情况
    for (const wordId in previewMastery) {
      if (!allWordIds.has(String(wordId))) {
        continue;
      }
      const status = previewMastery[wordId];
      if (status === true || status === 'mastered') {
        masteredCount++;
      } else if (status === false || status === 'difficult') {
        notMasteredCount++;
      }
    }
    
    // 计算当前批次掌握情况（仅在有当前批次单词时计算）
    let currentBatchMasteredCount = 0;
    if (currentBatchWords && currentBatchWords.length > 0) {
      currentBatchMasteredCount = currentBatchWords.filter(word => {
        const status = previewMastery[word.id];
        return status === true || status === 'mastered';
      }).length;
    }
    
    // 计算进度和正确率
    const totalProcessedWords = Object.keys(previewMastery || {}).length;
    const testWordCount = Array.isArray(testWords) ? testWords.length : 0;
    const allWordCount = Array.isArray(allWords) ? allWords.length : 0;
    const totalWords = testWordCount > 0 ? testWordCount : allWordCount;
    const progressPercentage = totalWords > 0 ? Math.round((totalProcessedWords / totalWords) * 100) : 0;
    const correctRate = totalProcessedWords > 0 ? Math.round((masteredCount / totalProcessedWords) * 100) : 0;
    
    return {
      masteredCount,
      notMasteredCount,
      currentBatchMasteredCount,
      progressPercentage,
      correctRate
    };
  },

  // 辅助函数：保存预习状态到本地存储（含云同步）
  _savePreviewState: function(studentId, wordbookId, previewMastery, wordId, status) {
    // 保存预习状态到本地存储，确保startNewLearning函数能获取到用户标记的单词状态
    const storageKey = `previewMastery_${studentId}_${wordbookId}`;
    wx.setStorageSync(storageKey, previewMastery);
    console.log('预习状态已保存到本地存储:', storageKey, '单词ID:', wordId, '状态:', status);
    
    // 同步到云端，换设备后预习状态不丢失
    const excludedStorageKey = `previewExcludedWordIds_${studentId}_${wordbookId}`;
    const excludedIds = wx.getStorageSync(excludedStorageKey) || [];
    const previewOrderKey = `previewWordOrder_${studentId}_${wordbookId}`;
    const orderIds = wx.getStorageSync(previewOrderKey) || [];

    syncPreviewState(studentId, wordbookId, {
      mastery: previewMastery,
      order: Array.isArray(orderIds) ? orderIds : [],
      excluded: Array.isArray(excludedIds) ? excludedIds : []
    }).then(result => {
      if (result && result.ok) {
        console.log('预习状态云同步成功:', wordId);
      }
    }).catch(err => {
      console.warn('预习状态云同步失败:', err);
    });
    
    // 移除：不再在标记单词时更新抗遗忘列表，只在完成测试时统一更新
    // 这样可以避免复习次数被多次增加
  },

  // 辅助函数：保存“预习已处理”单词，确保下次预习不再展示（掌握/未掌握都过滤）
  _savePreviewExcludedWord: function(studentId, wordbookId, wordId) {
    try {
      const storageKey = `previewExcludedWordIds_${studentId}_${wordbookId}`;
      const currentExcludedIds = wx.getStorageSync(storageKey) || [];
      const excludedIds = Array.isArray(currentExcludedIds) ? currentExcludedIds : [];
      const normalizedWordId = String(wordId);
      if (!excludedIds.includes(normalizedWordId)) {
        excludedIds.push(normalizedWordId);
        wx.setStorageSync(storageKey, excludedIds);
      }
    } catch (error) {
      console.error('保存预习过滤单词失败:', error);
    }
  },

  // 优化后的按钮点击处理函数
  updatePreviewMastery: function(e) {
    try {
      // 获取并解析按钮数据
      const { id, status, wordId } = e.currentTarget.dataset;
      const actualId = wordId || id;
      
      if (!actualId || status === undefined) {
        // 回退到原来的updateWordMastery处理
        this.updateWordMastery(e);
        return;
      }
      
      // 解析目标状态
      const targetStatus = this._parseButtonStatus(status);
      const currentStatus = this.data.previewMastery[actualId];
      
      // 如果状态未改变，不执行任何操作（优化性能）
      if (currentStatus === targetStatus) {
        return;
      }
      
      // 创建新的状态对象（避免直接修改原对象）
      const newPreviewMastery = { ...this.data.previewMastery };
      newPreviewMastery[actualId] = targetStatus;

      // 预习模式下：对勾/错叉后都立即从预习列表移除
      let effectiveAllWords = this.data.allWords;
      let effectiveCurrentBatchWords = this.data.currentBatchWords;
      let effectiveCurrentBatchIndex = this.data.currentBatchIndex || 0;

      const isHandledInPreview = (
        targetStatus === true ||
        targetStatus === 'mastered' ||
        targetStatus === false ||
        targetStatus === 'difficult'
      );

      if (this.data.learningMode === 'preview' && isHandledInPreview) {
        effectiveAllWords = (this.data.allWords || []).filter(word => word.id !== actualId);

        const batchSize = 15;
        const totalBatchesAfter = Math.max(1, Math.ceil(effectiveAllWords.length / batchSize));
        if (effectiveCurrentBatchIndex >= totalBatchesAfter) {
          effectiveCurrentBatchIndex = totalBatchesAfter - 1;
        }

        const startIndex = effectiveCurrentBatchIndex * batchSize;
        const endIndex = startIndex + batchSize;
        effectiveCurrentBatchWords = effectiveAllWords.slice(startIndex, endIndex);
      }
      
      // 计算统计信息
      const { 
        masteredCount, 
        notMasteredCount, 
        currentBatchMasteredCount,
        progressPercentage,
        correctRate
      } = this._calculateMasteryStats(
        newPreviewMastery, 
        effectiveCurrentBatchWords, 
        effectiveAllWords, 
        this.data.testWords
      );
      
      // 准备更新数据
      const updateData = {
        previewMastery: newPreviewMastery,
        masteredWordsCount: masteredCount,
        notMasteredWordsCount: notMasteredCount,
        currentBatchMasteredCount: currentBatchMasteredCount
      };

      if (this.data.learningMode === 'preview') {
        // 预习模式下：按钮数量仅统计明确标记为未掌握的单词
        const wordbookId = this.data.currentWordbook?.id;
        let previewNotMasteredCount = 0;
        for (const wordId in newPreviewMastery) {
          if (wordbookId && !String(wordId).startsWith(`${wordbookId}_`)) {
            continue;
          }
          const status = newPreviewMastery[wordId];
          if (status === false || status === 'difficult') {
            previewNotMasteredCount++;
          }
        }
        updateData.notMasteredWordsCount = previewNotMasteredCount;
      }
      
      // 根据学习模式设置不同的进度指标
      updateData[this.data.learningMode === 'finalTest' ? 'testProgress' : 'progressPercentage'] = 
        this.data.learningMode === 'finalTest' ? correctRate : progressPercentage;
      
      // 如果是混组检测模式，更新混组检测统计
      if (this.data.learningMode === 'mixReview') {
        let masteredWords = 0;
        let difficultWords = 0;
        
        for (const wordId in newPreviewMastery) {
          const status = newPreviewMastery[wordId];
          if (status === true || status === 'mastered') {
            masteredWords++;
          } else if (status === false || status === 'difficult') {
            difficultWords++;
          }
        }

        const currentMixReviewStats = this.data.mixReviewStats || { totalWords: effectiveCurrentBatchWords.length || 0 };
        updateData.mixReviewStats = {
          ...currentMixReviewStats,
          masteredWords,
          difficultWords
        };
      }
      
      // 立即更新数据，确保UI实时响应
      this.setData(updateData);
      
      // 添加视觉反馈效果（比振动更直观）
      this._showButtonFeedback(actualId, targetStatus);
      
      // 振动反馈保持不变
      wx.vibrateShort({ type: 'light' });
      
      // 异步保存数据到本地（避免阻塞UI）
      if (this.data.learningMode === 'preview' && this.data.currentStudent && this.data.currentWordbook) {
        const that = this;
        setTimeout(() => {
          that._savePreviewState(
            that.data.currentStudent.id,
            that.data.currentWordbook.id,
            newPreviewMastery,
            actualId,
            targetStatus
          );

          if (isHandledInPreview) {
            that._savePreviewExcludedWord(
              that.data.currentStudent.id,
              that.data.currentWordbook.id,
              actualId
            );
          }
        }, 0);
      }
    } catch (error) {
      console.error('更新预览掌握状态失败:', error);
      // 可以添加用户友好的错误提示
      wx.showToast({
        title: '操作失败',
        icon: 'none',
        duration: 1500
      });
    }
  },

  // 辅助函数：显示按钮点击反馈效果
  _showButtonFeedback: function(wordId, status) {
    // 添加按钮点击的视觉反馈效果
    const feedbackData = {};
    const feedbackKey = `buttonFeedback.${wordId}`;
    feedbackData[feedbackKey] = true;
    
    this.setData(feedbackData);
    
    const that = this;
    // 100ms后移除反馈效果
    setTimeout(() => {
      const resetData = {};
      resetData[feedbackKey] = false;
      that.setData(resetData);
    }, 100);
  },

  // 上一批
  prevBatch: function() {
    if (this.data.currentBatchIndex > 0) {
      const prevBatchIndex = this.data.currentBatchIndex - 1;
      const batchSize = 15; // 与初始化时的batchSize保持一致
      const startIndex = prevBatchIndex * batchSize;
      const endIndex = startIndex + batchSize;
      
      const prevBatch = this.data.allWords.slice(startIndex, endIndex);
      
      this.setData({
        currentBatchWords: prevBatch,
        currentBatchIndex: prevBatchIndex,
        currentPage: prevBatchIndex,
        hasMoreWords: true,
        showMeaning: {},
        clickCounts: {},
        showPhonetic: {},
        wordDisplayState: {},
        activeWordId: ''
      });
      
      // 更新统计信息
      this.updateBatchMasteryStats();
    } else {
      wx.showToast({
        title: '已经是第一组',
        icon: 'none'
      });
    }
  },

  // 下一批
  nextBatch: function() {
    if (this.data.hasMoreWords) {
      this.loadMoreWordsBatch();
    } else {
      wx.showToast({
        title: '已经是最后一组',
        icon: 'none'
      });
    }
  },
  
  // 计算当前批次的掌握情况
  updateBatchMasteryStats: function() {
    const { currentBatchWords, previewMastery, masteredWordsCount, allWords } = this.data;
    const allWordIds = new Set((allWords || []).map(word => String(word.id || '')));
    
    // 计算当前批次的掌握数量
    const currentBatchMasteredCount = currentBatchWords.filter(word => {
      return previewMastery[word.id] === true || previewMastery[word.id] === 'mastered';
    }).length;
    
    // 计算总体进度百分比
    const totalProcessedWords = Object.keys(previewMastery).length;
    const progressPercentage = allWords.length > 0 ? Math.round((totalProcessedWords / allWords.length) * 100) : 0;
    
    // 重新计算不会单词数量，确保在切换批次时统计准确
    let notMasteredCount = 0;
    for (const wordId in previewMastery) {
      if (!allWordIds.has(String(wordId))) {
        continue;
      }
      if (previewMastery[wordId] === false || previewMastery[wordId] === 'difficult') {
        notMasteredCount++;
      }
    }
    
    this.setData({
      currentBatchMasteredCount,
      progressPercentage,
      notMasteredWordsCount: notMasteredCount
    });
    
    console.log(`批次统计更新: 当前批次掌握=${currentBatchMasteredCount}/${currentBatchWords.length}, 总体掌握=${masteredWordsCount}/${allWords.length}, 进度=${progressPercentage}%`);
  },

  // 加载更多单词
  loadMoreWords: function() {
    if (!this.data.hasMoreWords || this.data.loading) {
      console.log('没有更多单词或正在加载中');
      return;
    }
    
    this.setData({ loading: true });
    
    // 模拟加载延迟（保持用户体验）
    setTimeout(() => {
      try {
        const nextBatchIndex = this.data.currentBatchIndex + 1;
        const batchSize = 15; // 与初始化时的batchSize保持一致
    const startIndex = nextBatchIndex * batchSize;
        
        // 从真实词书数据中获取下一批单词
        const wordbookCategory = this.data.currentWordbook.category || 'primary';
        const nextBatch = generateWordsForBook(wordbookCategory, this.data.currentWordbook.id, startIndex, batchSize);
        const normalizedNextBatch = nextBatch.map(word => ({
          ...word,
          phonetic: this.normalizePhoneticDisplay(word.phonetic)
        }));
        
        if (normalizedNextBatch.length > 0) {
          // 检查是否达到词书总单词数
          const firstBatch = generateWordsForBook(wordbookCategory, this.data.currentWordbook.id, 0, 15);
          // 直接使用firstBatch._totalCount获取总单词数，确保能加载所有单词
          const totalCount = firstBatch._totalCount || 1000;
          const isMoreWordsAvailable = nextBatchIndex * 15 < totalCount;
          console.log(`词书总单词数: ${totalCount}, 当前批次索引: ${nextBatchIndex}, 是否有更多单词: ${isMoreWordsAvailable}`);
          
          this.setData({
            currentBatchWords: normalizedNextBatch,
            currentBatchIndex: nextBatchIndex,
            currentBatchWordsCount: normalizedNextBatch.length,
            hasMoreWords: isMoreWordsAvailable,
            currentPage: nextBatchIndex,
            showMeaning: {},
            clickCounts: {},
            showPhonetic: {},
            wordDisplayState: {},
            activeWordId: '',
            loading: false
          });
          
          // 更新当前批次的掌握统计
          this.updateBatchMasteryStats();
          
          console.log('加载下一批单词成功，批次索引:', nextBatchIndex);
        } else {
          console.log('没有更多单词批次');
          this.setData({ 
            hasMoreWords: false,
            loading: false 
          });
        }
      } catch (error) {
        console.error('加载更多单词批次失败:', error);
        wx.showToast({
          title: '加载失败，请重试',
          icon: 'none'
        });
        this.setData({ loading: false });
      }
    }, 300);
  },

  // 开始学习
  startNewLearning: function() {
    try {
      this.syncFromGlobalData();
      this.checkSelectedStudentAndWordbook();

      if (!this.data.currentStudent || !this.data.currentWordbook) {
        wx.showToast({
          title: '请先选择学生和词书',
          icon: 'none'
        });
        return;
      }

      // 获取当前词书的类别
      const wordbookCategory = this.data.currentWordbook.category || 'primary';
      const studentId = this.data.currentStudent.id;
      const wordbookId = this.data.currentWordbook.id;
      
      // 加载本地保存的预习状态
      const storageKey = 'previewMastery_' + studentId + '_' + wordbookId;
      const previewMastery = wx.getStorageSync(storageKey) || this.data.previewMastery || {};
      console.log('加载的预习状态:', previewMastery);

      // 冻结“点击开始学习”当刻的预习标记快照，作为学习记录详情单词来源
      const startLearningSourceWordIds = [];
      const startLearningSourceMasteredWordIds = [];
      const startLearningSourceNotMasteredWordIds = [];
      const startLearningSourceWordsDetailed = [];
      const startLearningDetailedWordIdSet = new Set();
      const startLearningSourceWordMap = {};

      (this.data.allWords || []).forEach((word) => {
        if (!word || word.id === undefined || word.id === null) {
          return;
        }

        const normalizedId = String(word.id);
        if (startLearningSourceWordMap[normalizedId]) {
          return;
        }

        const meaning = word.meaning || word.translation || '未知释义';
        startLearningSourceWordMap[normalizedId] = {
          id: normalizedId,
          sourceWordId: normalizedId,
          word: String(word.word || '').replace(/\s+/g, ' ').trim(),
          phonetic: this.normalizePhoneticDisplay(word.phonetic),
          meaning: meaning,
          translation: word.translation || word.meaning || meaning
        };
      });

      Object.keys(previewMastery).forEach(wordId => {
        // 仅采集当前词书的单词，避免跨词书旧数据干扰
        if (!String(wordId).startsWith(`${wordbookId}_`)) {
          return;
        }

        const status = previewMastery[wordId];
        if (status === true || status === 'mastered' || status === false || status === 'difficult') {
          const normalizedId = String(wordId);
          startLearningSourceWordIds.push(normalizedId);
          if (status === true || status === 'mastered') {
            startLearningSourceMasteredWordIds.push(normalizedId);
          } else {
            startLearningSourceNotMasteredWordIds.push(normalizedId);
          }

          const sourceWord = startLearningSourceWordMap[normalizedId];
          if (sourceWord && sourceWord.word && !startLearningDetailedWordIdSet.has(normalizedId)) {
            startLearningSourceWordsDetailed.push({ ...sourceWord });
            startLearningDetailedWordIdSet.add(normalizedId);
          }
        }
      });

      this.setData({
        startLearningSourceWordIds,
        startLearningSourceMasteredWordIds,
        startLearningSourceNotMasteredWordIds,
        startLearningSourceWordsDetailed
      });

      // 预习界面决定正式掌握状态：进入学习前先将预习标记写入wordMastery
      const previewMarkedWordIds = Object.keys(previewMastery).filter(wordId => {
        const status = previewMastery[wordId];
        return status === true || status === false || status === 'mastered' || status === 'difficult';
      });
      if (previewMarkedWordIds.length > 0) {
        this.updateWordMasteryStatus(previewMarkedWordIds, 'mastered', previewMastery, { markAntiForgettingSeed: true });
        console.log('已按预习标记更新正式掌握状态，数量:', previewMarkedWordIds.length);
      }
      
      // 清除本地存储的预习记录，确保每次开始学习都是新的状态
      const previewMasteryKey = `previewMastery_${studentId}_${wordbookId}`;
      const previewExcludedKey = `previewExcludedWordIds_${studentId}_${wordbookId}`;
      wx.removeStorageSync(previewMasteryKey);
      wx.removeStorageSync(previewExcludedKey);
      
      // ★ 修复：同步清除云端 preview_state 中的 mastery 数据
      // 防止下次进入预习时 cloud load 把旧 master 数据恢复回来
      syncPreviewState(studentId, wordbookId, {
        mastery: {},
        order: [],
        excluded: []
      }).catch(err => {
        console.warn('[startNewLearning] 清除云端预习状态失败:', err);
      });
      
      // 获取单词掌握状态存储，确保过滤掉已掌握的单词
      let masteredWordIdArray = [];
      try {
        const wordMastery = wx.getStorageSync('wordMastery') || {};
        if (wordMastery[studentId] && wordMastery[studentId][wordbookId] && Array.isArray(wordMastery[studentId][wordbookId])) {
          masteredWordIdArray = wordMastery[studentId][wordbookId];
          console.log('过滤已掌握单词，数量:', masteredWordIdArray.length);
        }
      } catch (err) {
        console.error('读取单词掌握记录时出错:', err);
      }
      
      // 过滤出未掌握的单词进行新词学习：
      // 1. 课前预习中明确标记为不会的单词
      // 2. 不在已掌握单词列表中
      // 3. 防止重复添加相同ID的单词
      const notMasteredWords = [];
      const addedWordIds = new Set();
      
      // 第一步：先遍历预览状态中的所有单词，找出所有明确标记为不会的单词ID
      const explicitlyNotMasteredWordIds = [];
      const currentWordIdSet = new Set((this.data.allWords || []).map(word => String(word.id || '')));
      for (const wordId in previewMastery) {
        if (!String(wordId).startsWith(`${wordbookId}_`)) {
          continue;
        }
        if (!currentWordIdSet.has(String(wordId))) {
          continue;
        }
        const wordStatus = previewMastery[wordId];
        if (wordStatus === false || wordStatus === 'difficult') {
          explicitlyNotMasteredWordIds.push(wordId);
        }
      }
      
      const explicitlyNotMasteredCount = explicitlyNotMasteredWordIds.length;
      console.log('明确标记为不会的单词ID:', explicitlyNotMasteredWordIds, '数量:', explicitlyNotMasteredCount);
      
      // 直接复用预习页已加载并过滤后的单词，避免再次全量加载导致卡顿
      const wordsWithId = (this.data.allWords || []).map((word) => ({
        ...word,
        phonetic: this.normalizePhoneticDisplay(word.phonetic),
        id: word.id || (word.word ? `${wordbookId}_${word.word.toLowerCase().replace(/\s+/g, '_')}` : `${wordbookId}_${Math.random().toString(36).substr(2, 9)}`)
      }));
      
      
      
      // 第二步：根据是否有明确标记为不会的单词来过滤学习单词
      if (explicitlyNotMasteredCount > 0) {
        // 如果有明确标记为不会的单词，则只学习这些单词
        for (const word of wordsWithId) {
          if (word && word.id) {
            // 匹配逻辑：考虑预习模式中ID包含索引的情况
            const isExplicitlyNotMastered = explicitlyNotMasteredWordIds.some(previewId => {
              // 1. 直接匹配
              if (previewId === String(word.id)) {
                return true;
              }
              // 2. 预览ID包含索引，尝试去除索引后匹配
              const basePreviewId = previewId.replace(/(_\d+)$/, '');
              const baseWordId = word.id.replace(/(_\d+)$/, '');
              return basePreviewId === baseWordId;
            });
            if (isExplicitlyNotMastered && !addedWordIds.has(word.id)) {
              notMasteredWords.push(word);
              addedWordIds.add(word.id);
            }
          }
        }
      } else {
        // 如果没有明确标记为未掌握的单词，显示弹框提示用户
        wx.showModal({
          title: '提示',
          content: '您没有选择任何未掌握的单词，是否继续学习所有未掌握的单词？',
          success: (res) => {
            if (res.confirm) {
              // 用户确认继续学习，学习所有不在已掌握列表中的单词
              for (const word of wordsWithId) {
                if (word && word.id && !addedWordIds.has(word.id)) {
                  // 检查单词是否不在已掌握列表中 - 转换为字符串比较以确保类型匹配
                  const isNotInMasteredList = !masteredWordIdArray.some(id => String(id) === String(word.id));
                  if (isNotInMasteredList) {
                    notMasteredWords.push(word);
                    addedWordIds.add(word.id);
                  }
                }
              }
              
              console.log('生成的学习单词列表数量:', notMasteredWords.length);
              
              // 继续执行开始学习的逻辑
              this._continueStartLearning(notMasteredWords);
            } else if (res.cancel) {
              // 用户取消，不开始学习
              console.log('用户取消学习');
            }
          }
        });
        // 提前返回，等待用户确认
        return;
      }
      
      console.log('生成的学习单词列表数量:', notMasteredWords.length);
      
      // 如果没有明确标记为不会的单词，并且没有未掌握的单词，仍然允许开始学习
      if (explicitlyNotMasteredCount === 0 && notMasteredWords.length === 0) {
        wx.showToast({
          title: '所有单词都已经掌握了，是否继续学习？',
          icon: 'none',
          duration: 2000
        });
      }
      
      // 继续执行开始学习的逻辑
      this._continueStartLearning(notMasteredWords);
    } catch (error) {
      console.error('开始学习失败:', error);
      wx.showToast({
        title: '开始学习失败，请重试',
        icon: 'none'
      });
    }
  },

  // 打乱预览单词顺序（预览/复习模式）
  shufflePreviewWords: function() {
    try {
      const currentWords = [...this.data.currentBatchWords];
      
      // Fisher-Yates 洗牌算法
      for (let i = currentWords.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [currentWords[i], currentWords[j]] = [currentWords[j], currentWords[i]];
      }
      
      this.setData({
        currentBatchWords: currentWords,
        showMeaning: {},
        clickCounts: {},
        showPhonetic: {},
        wordDisplayState: {},
        activeWordId: ''
      });
      
      wx.showToast({
        title: '顺序已打乱',
        icon: 'success'
      });
    } catch (error) {
      console.error('打乱预览单词顺序失败:', error);
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
    }
  },

  // 打乱当前单词顺序
  shuffleCurrentWords: function() {
    try {
      const currentWords = [...this.data.currentBatchWords];
      
      // Fisher-Yates 洗牌算法
      for (let i = currentWords.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [currentWords[i], currentWords[j]] = [currentWords[j], currentWords[i]];
      }
      
      this.setData({
      currentBatchWords: currentWords,
      showMeaning: {},
      clickCounts: {},
      showPhonetic: {},
      wordDisplayState: {},
      activeWordId: ''
    });
      
      wx.showToast({
        title: '顺序已打乱',
        icon: 'success'
      });
    } catch (error) {
      console.error('打乱单词顺序失败:', error);
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
    }
  },

  // 完成当前组学习
  completeCurrentGroup: function() {
    try {
      const nextGroupIndex = this.data.currentGroupIndex + 1;
      const groupSize = 5; // 与startNewLearning中的groupSize保持一致
      const startIndex = nextGroupIndex * groupSize;
      
      // 每学完一组都显示操作页面，包括最后一组
      this.setData({
        showGroupCompletePage: true,
        currentGroupIndex: nextGroupIndex - 1 // 保持当前组索引不变
      });
    } catch (error) {
      console.error('完成当前组学习失败:', error);
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
    }
  },

  // 继续到下一组
  continueToNextGroup: function() {
    try {
      const nextGroupIndex = this.data.currentGroupIndex + 1;
      const groupSize = 5;
      const startIndex = nextGroupIndex * groupSize;
      const endIndex = startIndex + groupSize;
      
      // 继续学习下一组
      this.setData({
        showGroupCompletePage: false,
        currentBatchWords: this.data.allWords.slice(startIndex, endIndex),
        currentGroupIndex: nextGroupIndex,
        currentBatchWordsCount: Math.min(groupSize, this.data.allWords.length - startIndex),
        showMeaning: {},
        clickCounts: {},
        showPhonetic: {},
        wordDisplayState: {},
        activeWordId: ''
      });
    } catch (error) {
      console.error('继续到下一组失败:', error);
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
    }
  },

  // 显示自定义混组面板
  showCustomMixPanel: function() {
    try {
      // 生成已学习的组信息
      const learnedGroups = [];
      const groupMixCount = [];
      const groupSelected = [];
      
      // 生成已学习的组（当前进度之前的所有组）
      for (let i = 0; i <= this.data.currentGroupIndex; i++) {
        learnedGroups.push({
          index: i,
          name: `第${i + 1}组`
        });
        groupMixCount.push(0); // 初始混组次数为0
        groupSelected.push(false); // 初始选择状态为false
      }
      
      // 强制清空selectedGroups数组，确保没有默认选中的组
      const selectedGroups = [];
      
      this.setData({
        showCustomMixPanel: true,
        learnedGroups: learnedGroups,
        groupMixCount: groupMixCount,
        groupSelected: groupSelected,
        selectedGroups: selectedGroups,
        selectAll: false
      });
      
      // 添加调试日志，确认初始化状态
      console.log('自定义混组面板初始化:', {
        learnedGroups: learnedGroups,
        groupSelected: groupSelected,
        selectedGroups: selectedGroups,
        selectAll: false
      });
    } catch (error) {
      console.error('显示自定义混组面板失败:', error);
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
    }
  },

  // 关闭自定义混组面板
  closeCustomMixPanel: function() {
    this.setData({
      showCustomMixPanel: false
    });
  },

  // 切换全选
  toggleSelectAll: function() {
    const selectAll = !this.data.selectAll;
    const groupSelected = [];
    const selectedGroups = [];
    
    // 更新groupSelected数组和selectedGroups数组
    for (let i = 0; i < this.data.learnedGroups.length; i++) {
      groupSelected.push(selectAll);
      if (selectAll) {
        selectedGroups.push(i);
      }
    }
    
    this.setData({
      selectAll: selectAll,
      groupSelected: groupSelected,
      selectedGroups: selectedGroups
    });
    
    // 添加调试日志
    console.log('Toggle select all:', {
      selectAll: selectAll,
      groupSelected: groupSelected,
      selectedGroups: selectedGroups
    });
  },

  // 切换组选择
  toggleGroupSelection: function(e) {
    // 获取index值
    const index = parseInt(e.currentTarget.dataset.index);
    const groupSelected = [...this.data.groupSelected];
    const selectedGroups = [...this.data.selectedGroups];
    
    // 切换选择状态
    const newSelectedState = !groupSelected[index];
    groupSelected[index] = newSelectedState;
    
    // 更新selectedGroups数组
    let updatedSelectedGroups;
    if (newSelectedState) {
      // 添加到选中数组
      updatedSelectedGroups = [...selectedGroups, index];
      wx.showToast({
        title: `已选择第${index + 1}组`,
        icon: 'none',
        duration: 1000
      });
    } else {
      // 从选中数组中移除
      updatedSelectedGroups = selectedGroups.filter(i => i !== index);
      wx.showToast({
        title: `已取消选择第${index + 1}组`,
        icon: 'none',
        duration: 1000
      });
    }
    
    // 计算是否全选
    const isAllSelected = updatedSelectedGroups.length === this.data.learnedGroups.length;
    
    // 更新数据
    this.setData({
      groupSelected: groupSelected,
      selectedGroups: updatedSelectedGroups,
      selectAll: isAllSelected
    });
    
    // 添加调试日志
    console.log('Toggle group selection:', {
      index: index,
      newSelectedState: newSelectedState,
      groupSelected: groupSelected,
      selectedGroups: updatedSelectedGroups,
      isAllSelected: isAllSelected
    });
  },

  // 开始自定义混组复习
  startCustomMixReview: function() {
    try {
      const selectedGroups = this.data.selectedGroups;
      
      if (selectedGroups.length === 0) {
        wx.showToast({
          title: '请选择至少一组',
          icon: 'none'
        });
        return;
      }
      
      // 收集选中组的单词
      const groupSize = 5;
      const selectedWords = [];
      
      selectedGroups.forEach(groupIndex => {
        const startIndex = groupIndex * groupSize;
        const endIndex = startIndex + groupSize;
        const groupWords = this.data.allWords.slice(startIndex, endIndex);
        selectedWords.push(...groupWords);
      });
      
      // 检查是否有单词
      if (selectedWords.length === 0) {
        wx.showToast({
          title: '所选组中没有单词',
          icon: 'none'
        });
        return;
      }
      
      // 打乱单词顺序
      for (let i = selectedWords.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [selectedWords[i], selectedWords[j]] = [selectedWords[j], selectedWords[i]];
      }
      
      // 显示开始混组检测的提示
      wx.showToast({
        title: `开始混组检测（${selectedWords.length}个单词）`,
        icon: 'success',
        duration: 1500
      });
      
      // 开始混组检测
      this.setData({
        showCustomMixPanel: false,
        learningMode: 'mixReview',
        pageTitle: '混组检测',
        currentBatchWords: selectedWords,
        currentBatchWordsCount: selectedWords.length,
        showMeaning: {},
        clickCounts: {},
        showPhonetic: {},
        wordDisplayState: {},
        activeWordId: '',
        previewMastery: {},
        // 添加混组检测相关数据
        mixReviewStats: {
          totalWords: selectedWords.length,
          masteredWords: 0,
          difficultWords: 0,
          startTime: new Date().getTime()
        }
      });
      
      // 更新混组次数
      const groupMixCount = [...this.data.groupMixCount];
      selectedGroups.forEach(groupIndex => {
        groupMixCount[groupIndex] = (groupMixCount[groupIndex] || 0) + 1;
      });
      
      this.setData({ groupMixCount: groupMixCount });
      
      // 设置导航栏标题
      wx.setNavigationBarTitle({
        title: '混组检测'
      });
      
    } catch (error) {
      console.error('开始自定义混组复习失败:', error);
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
    }
  },

  // 完成混组检测
  completeMixReview: function() {
    try {
      // 统计混组检测结果
      const previewMastery = this.data.previewMastery;
      const mixReviewStats = this.data.mixReviewStats || { totalWords: 0 };
      const allWords = this.data.currentBatchWords || [];
      
      let masteredWords = 0;
      let difficultWords = 0;
      const difficultWordsList = [];
      
      for (const wordId in previewMastery) {
        const status = previewMastery[wordId];
        if (status === true || status === 'mastered') {
          masteredWords++;
        } else if (status === false || status === 'difficult') {
          difficultWords++;
          // 找到对应的单词对象
          const word = allWords.find(w => w.id === wordId);
          if (word) {
            difficultWordsList.push(word);
          }
        }
      }
      
      // 检查是否有未掌握的单词
      if (difficultWords > 0) {
        // 有未掌握的单词，直接重新显示这些单词进行学习
        this.setData({
          currentBatchWords: difficultWordsList,
          currentBatchWordsCount: difficultWordsList.length,
          showMeaning: {},
          clickCounts: {},
          showPhonetic: {},
          wordDisplayState: {},
          activeWordId: '',
          previewMastery: {},
          // 更新混组检测统计
          mixReviewStats: {
            ...mixReviewStats,
            totalWords: difficultWordsList.length,
            startTime: new Date().getTime()
          }
        });
        return; // 终止当前操作，继续学习
      }
      
      // 所有单词都已掌握，直接返回到完成组操作页面
      this.setData({
        learningMode: 'newLearning',
        pageTitle: '新词学习',
        showGroupCompletePage: true
      });
      
      // 设置导航栏标题
      wx.setNavigationBarTitle({
        title: '新词学习'
      });
      
    } catch (error) {
      console.error('完成混组检测失败:', error);
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
      
      // 即使出错也返回到完成组操作页面
      this.setData({
        learningMode: 'newLearning',
        pageTitle: '新词学习',
        showGroupCompletePage: true
      });
      
      wx.setNavigationBarTitle({
        title: '新词学习'
      });
    }
  },

  // 提前结束学习
  endStudyEarly: function() {
    try {
      wx.showModal({
        title: '确认结束',
        content: '确定要提前结束学习吗？',
        success: (res) => {
          if (res.confirm) {
            // 进入课后检测
            this.startFinalTest();
          }
        }
      });
    } catch (error) {
      console.error('提前结束学习失败:', error);
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
    }
  },

  // 开始课后检测
  startFinalTest: function() {
    try {
      // 获取单词掌握状态存储，确保过滤掉已掌握的单词
      let masteredWordIdArray = [];
      const studentId = this.data.currentStudent.id;
      const wordbookId = this.data.currentWordbook.id;
      
      try {
        const wordMastery = wx.getStorageSync('wordMastery') || {};
        if (wordMastery[studentId] && wordMastery[studentId][wordbookId] && Array.isArray(wordMastery[studentId][wordbookId])) {
          masteredWordIdArray = wordMastery[studentId][wordbookId];
          console.log('课后检测过滤已掌握单词，数量:', masteredWordIdArray.length);
        }
      } catch (err) {
        console.error('读取单词掌握记录时出错:', err);
      }
      
      // 获取用户在预习模式中标记为"不会"的单词，且不在已掌握列表中
      const previewMastery = this.data.previewMastery;
      let testWords = [];
      
      // 根据当前学习模式选择测试单词
      if (this.data.learningMode === 'newLearning') {
        // 从newLearning模式进入，测试用户实际学习的所有单词
        testWords = this.data.allWords;
        console.log('从newLearning模式进入，测试所有学习过的单词，数量:', testWords.length);
      } else {
        // 从preview模式进入，测试用户标记为不会的单词
        const notMasteredWords = [];
        
        // 统计明确标记为不会的单词数量
        let explicitlyNotMasteredCount = 0;
        
        // 从allWords中找出标记为false（不会）或difficult（困难）且不在已掌握列表中的单词
        for (const word of this.data.allWords) {
          const isExplicitlyNotMastered = (previewMastery[word.id] === false || previewMastery[word.id] === 'difficult');
          
          if (isExplicitlyNotMastered) {
            explicitlyNotMasteredCount++;
          }
          
          // 如果有明确标记为不会的单词，则只选择这些单词
          // 如果没有明确标记为不会的单词，则选择所有不在已掌握列表中的单词
          if ((explicitlyNotMasteredCount > 0 && isExplicitlyNotMastered) || 
              (explicitlyNotMasteredCount === 0 && !masteredWordIdArray.includes(word.id))) {
            notMasteredWords.push(word);
          }
        }
        
        // 如果没有标记不会的单词，提示用户
        if (notMasteredWords.length === 0) {
          wx.showToast({
            title: '所有单词都已经掌握了',
            icon: 'success',
            duration: 2000
          });
          return;
        }
        
        // 限制测试单词数量为用户标记的数量，但不超过20个
        testWords = [...notMasteredWords].slice(0, 20);
      }
      
      // 打乱顺序
      for (let i = testWords.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [testWords[i], testWords[j]] = [testWords[j], testWords[i]];
      }
      
      // 设置导航栏标题为课后检测
      wx.setNavigationBarTitle({
        title: '课后检测'
      });

      // 保存进入课后检测前的完整标记快照
      const finalTestSourceWordIds = (this.data.allWords || []).map(word => String(word.id));
      const finalTestSourceMasteredWordIds = [];
      const finalTestSourceNotMasteredWordIds = [];
      const finalTestSourceWordsDetailed = (this.data.allWords || []).map((word) => {
        if (!word || word.id === undefined || word.id === null) {
          return null;
        }
        const meaning = word.meaning || word.translation || '未知释义';
        return {
          id: String(word.id),
          sourceWordId: String(word.id),
          word: String(word.word || '').replace(/\s+/g, ' ').trim(),
          phonetic: this.normalizePhoneticDisplay(word.phonetic),
          meaning: meaning,
          translation: word.translation || word.meaning || meaning
        };
      }).filter(item => item && item.id && item.word);

      (this.data.allWords || []).forEach(word => {
        const status = previewMastery[word.id];
        if (status === true || status === 'mastered') {
          finalTestSourceMasteredWordIds.push(String(word.id));
        } else if (status === false || status === 'difficult') {
          finalTestSourceNotMasteredWordIds.push(String(word.id));
        }
      });

      // 预习模式中未显式标记的单词，按“已掌握”处理，保证统计口径一致
      const notMasteredSet = new Set(finalTestSourceNotMasteredWordIds);
      const masteredSet = new Set(finalTestSourceMasteredWordIds);
      finalTestSourceWordIds.forEach(wordId => {
        if (!notMasteredSet.has(wordId) && !masteredSet.has(wordId)) {
          masteredSet.add(wordId);
        }
      });
      const normalizedMasteredWordIds = Array.from(masteredSet);
      
      this.setData({
        learningMode: 'finalTest',
        pageTitle: '课后检测',
        testWords: testWords,
        originalTestWordsCount: testWords.length, // 保存原始的总单词数
        finalTestSourceWordIds: finalTestSourceWordIds,
        finalTestSourceMasteredWordIds: normalizedMasteredWordIds,
        finalTestSourceNotMasteredWordIds: finalTestSourceNotMasteredWordIds,
        finalTestSourceWordsDetailed: finalTestSourceWordsDetailed,
        currentBatchWords: testWords.slice(0, testWords.length), // 使用所有标记的单词
        testProgress: 0,
        // 保留previewMastery以便跟踪检测结果
        clickCounts: {},
        masteredWordsCount: 0
      });
      
      // 重新开始学习时长统计
      this.startStudyTimer();
      
      console.log('开始课后检测，总检测单词数:', testWords.length, '（仅包含用户标记不会的单词）');
    } catch (error) {
      console.error('开始课后检测失败:', error);
      wx.showToast({
        title: '开始检测失败，请重试',
        icon: 'none'
      });
    }
  },

  // 继续开始学习的逻辑
  _continueStartLearning: function(notMasteredWords) {
    try {
      // 分组学习，每组5个单词
      const groupSize = 5;
      const totalGroups = Math.ceil(notMasteredWords.length / groupSize);
      
      // 设置导航栏标题为新词学习
      wx.setNavigationBarTitle({
        title: '新词学习'
      });
      
      this.setData({
        learningMode: 'newLearning',
        pageTitle: '新词学习',
        allWords: notMasteredWords,
        currentBatchWords: notMasteredWords.slice(0, groupSize),
        currentGroupIndex: 0,
        totalGroups: totalGroups,
        currentBatchWordsCount: Math.min(groupSize, notMasteredWords.length),
        showMeaning: {},
        clickCounts: {},
        masteredWordsCount: 0,
        showGroupCompletePage: false
      });
      
      // 重新开始学习时长统计
      this.startStudyTimer();
      
      console.log('开始新词学习，总单词数:', notMasteredWords.length);
    } catch (error) {
      console.error('继续开始学习失败:', error);
      wx.showToast({
        title: '开始学习失败，请重试',
        icon: 'none'
      });
    }
  },

  // 完成检测
  completeTest: function() {
    try {
      // 精确计算检测结果，与课后检测页面保持一致
      // 使用测试单词总数作为分母，确保准确率计算正确
      let actualMasteredWords = 0;
      const totalWords = this.data.originalTestWordsCount || this.data.testWords.length;
      
      if (totalWords > 0) {
        // 遍历当前的 testWords（可能只是剩下的未掌握单词）
        for (let i = 0; i < this.data.testWords.length; i++) {
          const word = this.data.testWords[i];
          if (word && typeof word === 'object') {
            const wordId = word.id;
            // 检查单词是否被标记为掌握（true或'mastered'值都视为已掌握）
            if (this.data.previewMastery && (this.data.previewMastery[wordId] === true || this.data.previewMastery[wordId] === 'mastered')) {
              actualMasteredWords++;
            }
          }
        }
      }
      
      // 检查是否所有单词都已掌握
      // 当用户完成当前所有未掌握的单词时，就认为所有单词都已掌握
      const allMastered = actualMasteredWords === this.data.testWords.length;
      
      if (allMastered) {
        // 所有单词都已掌握，使用精确计算，与课后检测页面保持一致的计算方法
        // 当用户完成最后一个未掌握的单词时，actualMasteredWords 应该等于原始的 totalWords
        const masteredCount = totalWords; // 用户已经掌握了所有单词
        const exactCorrectRate = totalWords > 0 ? (masteredCount / totalWords * 100) : 0;
        const displayedCorrectRate = exactCorrectRate.toFixed(1);
        
        this.setData({
          learningMode: 'completed',
          pageTitle: '学习完成',
          testProgress: 100,
          currentBatchWords: [],
          correctRate: displayedCorrectRate,
          // 保存精确的正确率，便于内部使用
          accuracyRate: exactCorrectRate,
          totalTestWords: totalWords,
          masteredTestWords: masteredCount
        });
        
        // 收集本次学习中所有学习过的单词ID（包括掌握和困难的单词）
        const learnedWordIds = [];
        if (totalWords > 0) {
          // 找出所有被标记的单词（包括掌握和困难的）
          for (let i = 0; i < totalWords; i++) {
            const word = this.data.testWords[i];
            if (word && typeof word === 'object') {
              const wordId = word.id;
              // 检查单词是否被标记（无论是掌握还是困难）
              if (this.data.previewMastery && (this.data.previewMastery[wordId] === true || this.data.previewMastery[wordId] === 'mastered' || this.data.previewMastery[wordId] === false || this.data.previewMastery[wordId] === 'difficult')) {
                learnedWordIds.push(wordId);
                console.log('标记的单词ID:', wordId, '状态:', this.data.previewMastery[wordId]);
              }
            }
          }
        }
        
        // 收集本次学习中掌握的单词ID（用于计算掌握率）
        const masteredWordIds = [];
        if (totalWords > 0) {
          // 找出所有被标记为掌握的单词
          for (let i = 0; i < totalWords; i++) {
            const word = this.data.testWords[i];
            if (word && typeof word === 'object') {
              const wordId = word.id;
              // 检查单词是否被标记为掌握（true或'mastered'值都视为已掌握）
              if (this.data.previewMastery && (this.data.previewMastery[wordId] === true || this.data.previewMastery[wordId] === 'mastered')) {
                masteredWordIds.push(wordId);
                console.log('标记为已掌握的单词ID:', wordId);
              }
            }
          }
        }
        
        // 正式掌握状态已由预习界面决定，这里不再覆盖wordMastery
        console.log('跳过课后检测对wordMastery的覆盖更新（预习优先）');
        
        // 保存学习记录，使用精确的正确率值
        this.saveLearningRecord(this.data.accuracyRate.toFixed(1), totalWords, masteredCount);
        
        // 清除本地存储的预习记录
        const { studentId, wordbookId } = this.data;
        const previewMasteryKey = `previewMastery_${studentId}_${wordbookId}`;
        const previewExcludedKey = `previewExcludedWordIds_${studentId}_${wordbookId}`;
        wx.removeStorageSync(previewMasteryKey);
        wx.removeStorageSync(previewExcludedKey);
        
        // ★ 修复：同步清除云端 preview_state，防止下次预习时旧数据被恢复
        syncPreviewState(studentId, wordbookId, {
          mastery: {},
          order: [],
          excluded: []
        }).catch(err => {
          console.warn('[completeTest] 清除云端预习状态失败:', err);
        });
        
        // 显示测试结果
        this.showTestResult(this.data.accuracyRate.toFixed(1), totalWords, masteredCount);
      } else {
        // 还有未掌握的单词，自动继续检测这些单词
        const notMasteredWords = [];
        if (totalWords > 0) {
          for (let i = 0; i < totalWords; i++) {
            const word = this.data.testWords[i];
            if (word && typeof word === 'object') {
              const wordId = word.id;
              if (!(this.data.previewMastery && (this.data.previewMastery[wordId] === true || this.data.previewMastery[wordId] === 'mastered'))) {
                notMasteredWords.push(word);
              }
            }
          }
        }
        
        // 重新检测未掌握的单词
        this.setData({
          testWords: notMasteredWords,
          currentBatchWords: notMasteredWords,
          previewMastery: {}, // 重置掌握状态，让用户重新标记
          testProgress: 0
        });
        
        // 显示提示
        wx.showToast({
          title: `还有 ${notMasteredWords.length} 个单词未掌握，继续检测`,
          icon: 'none',
          duration: 2000
        });
      }
    } catch (error) {
      console.error('完成检测失败:', error);
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
    }
  },

  // 显示测试结果
  showTestResult: function(correctRate, totalWords, masteredWords) {
    try {
      wx.showModal({
        title: '学习完成',
        content: `恭喜！\n\n本次学习共${totalWords}个单词\n掌握了${masteredWords}个单词\n正确率：${correctRate}%`,
        showCancel: false,
        confirmText: '返回首页',
        success: (res) => {
          if (res.confirm) {
            wx.navigateBack();
          }
        }
      });
    } catch (error) {
      console.error('显示测试结果失败:', error);
    }
  },

  // 保存学习记录
  saveLearningRecord: function(correctRate, totalWords, masteredWords) {
    try {
      // 停止学习时长统计并更新最终时长
      this.stopStudyTimer();
      
      // 收集本次学习中涉及的单词ID
      const learnedWordIds = [];
      
      // 从测试单词或所有单词中收集
      if (this.data.testWords && this.data.testWords.length > 0) {
        learnedWordIds.push(...this.data.testWords.map(word => word.id));
      } else if (this.data.allWords && this.data.allWords.length > 0) {
        learnedWordIds.push(...this.data.allWords.map(word => word.id));
      }

      // 基于本次学习状态拆分已掌握/未掌握单词
      const previewMastery = this.data.previewMastery || {};
      const startSnapshotWordIds = (this.data.startLearningSourceWordIds || []).map(id => String(id));
      const startSnapshotMasteredWordIds = (this.data.startLearningSourceMasteredWordIds || []).map(id => String(id));
      const startSnapshotNotMasteredWordIds = (this.data.startLearningSourceNotMasteredWordIds || []).map(id => String(id));
      const startSnapshotWordsDetailed = Array.isArray(this.data.startLearningSourceWordsDetailed) ? this.data.startLearningSourceWordsDetailed : [];
      const snapshotWordIds = (this.data.finalTestSourceWordIds || []).map(id => String(id));
      const snapshotMasteredWordIds = (this.data.finalTestSourceMasteredWordIds || []).map(id => String(id));
      const snapshotNotMasteredWordIds = (this.data.finalTestSourceNotMasteredWordIds || []).map(id => String(id));
      const snapshotWordsDetailed = Array.isArray(this.data.finalTestSourceWordsDetailed) ? this.data.finalTestSourceWordsDetailed : [];

      const dedupeWordIdList = (ids) => {
        const seen = new Set();
        const result = [];

        (ids || []).forEach((id) => {
          const normalized = String(id || '').trim();
          if (!normalized || seen.has(normalized)) {
            return;
          }
          seen.add(normalized);
          result.push(normalized);
        });

        return result;
      };

      // 从结构化wordId中提取实际单词（例：senior_bkk_1_ren_jiao_male → male）
      const extractWordFromStructuredId = (structuredId) => {
        if (!structuredId || typeof structuredId !== 'string') return '';
        const text = structuredId.trim();
        // 纯英文直接返回
        if (/^[a-zA-Z][a-zA-Z\s'\-]*$/.test(text)) return text;
        // 按下划线分割，从后往前找第一个"真正的英文单词"（跳过数字、词书标记等）
        const parts = text.split('_').filter(Boolean);
        const noiseTokens = new Set([
          'real', 'word', 'words', 'book', 'wordbook', 'grade',
          'first', 'second', 'third', 'fourth', 'fifth', 'sixth',
          'seventh', 'eighth', 'ninth', 'new', 'standard', 'complete',
          'junior', 'senior', 'curriculum', 'ren', 'jiao', 'yi', 'lin', 'ji',
          'bkk', 'v1', 'v2', 'v3'
        ]);
        for (let i = parts.length - 1; i >= 0; i--) {
          const part = parts[i].replace(/[^a-zA-Z'\-]/g, '').trim();
          const lower = part.toLowerCase();
          if (part.length >= 2 && !noiseTokens.has(lower) && !/^\d+$/.test(lower)) {
            return part;
          }
        }
        return '';
      };

      const buildDetailedWord = (rawWord, fallbackId = '') => {
        const sourceId = String((rawWord && (rawWord.sourceWordId || rawWord.id)) || fallbackId || '').trim();
        const displayWord = String((rawWord && rawWord.word) || '').replace(/\s+/g, ' ').trim();
        if (!sourceId && !displayWord) {
          return null;
        }

        const finalId = sourceId || displayWord.toLowerCase().replace(/\s+/g, '_');
        const meaning = (rawWord && (rawWord.meaning || rawWord.translation)) || '未知释义';

        // 当 rawWord 为 null 且 displayWord 为空时，从 fallbackId 中提取真实单词
        const resolvedWord = displayWord || extractWordFromStructuredId(finalId) || finalId;

        return {
          id: finalId,
          sourceWordId: sourceId || finalId,
          word: resolvedWord,
          phonetic: this.normalizePhoneticDisplay(rawWord && rawWord.phonetic),
          meaning: meaning,
          translation: (rawWord && (rawWord.translation || rawWord.meaning)) || meaning
        };
      };

      const runtimeWordMap = {};
      const collectWordPool = (pool) => {
        if (!Array.isArray(pool)) {
          return;
        }

        pool.forEach((item) => {
          const detailed = buildDetailedWord(item);
          if (!detailed || !detailed.id || !detailed.word) {
            return;
          }

          if (!runtimeWordMap[detailed.id]) {
            runtimeWordMap[detailed.id] = detailed;
          }
        });
      };

      collectWordPool(startSnapshotWordsDetailed);
      collectWordPool(snapshotWordsDetailed);
      collectWordPool(this.data.testWords);
      collectWordPool(this.data.allWords);
      collectWordPool(this.data.currentBatchWords);

      let masteredWordIds = [];
      let notMasteredWordIds = [];

      if (startSnapshotWordIds.length > 0) {
        learnedWordIds.length = 0;
        learnedWordIds.push(...startSnapshotWordIds);
        masteredWordIds = [...startSnapshotMasteredWordIds];
        notMasteredWordIds = [...startSnapshotNotMasteredWordIds];
      } else if (snapshotWordIds.length > 0) {
        learnedWordIds.length = 0;
        learnedWordIds.push(...snapshotWordIds);

        // 记录保存时优先采用“最新标记状态”，避免进入课后检测后的改动被快照覆盖。
        const snapshotMasteredSet = new Set(snapshotMasteredWordIds);
        const snapshotNotMasteredSet = new Set(snapshotNotMasteredWordIds);

        snapshotWordIds.forEach(wordId => {
          const latestStatus = previewMastery[wordId];
          if (latestStatus === true || latestStatus === 'mastered') {
            masteredWordIds.push(wordId);
          } else if (latestStatus === false || latestStatus === 'difficult') {
            notMasteredWordIds.push(wordId);
          } else if (snapshotNotMasteredSet.has(wordId)) {
            notMasteredWordIds.push(wordId);
          } else if (snapshotMasteredSet.has(wordId)) {
            masteredWordIds.push(wordId);
          } else {
            // 未显式标注的历史兼容口径：按已掌握处理。
            masteredWordIds.push(wordId);
          }
        });
      } else {
        const learnedIdSet = new Set(learnedWordIds.map(id => String(id)));
        Object.keys(previewMastery).forEach(wordId => {
          const normalizedId = String(wordId);
          if (!learnedIdSet.has(normalizedId)) {
            return;
          }

          const status = previewMastery[wordId];
          if (status === true || status === 'mastered') {
            masteredWordIds.push(normalizedId);
          } else if (status === false || status === 'difficult') {
            notMasteredWordIds.push(normalizedId);
          }
        });
      }

      const normalizedLearnedWordIds = dedupeWordIdList(learnedWordIds);
      const normalizedMasteredWordIdsList = dedupeWordIdList(masteredWordIds);
      const normalizedNotMasteredWordIdsList = dedupeWordIdList(notMasteredWordIds);

      learnedWordIds.length = 0;
      learnedWordIds.push(...normalizedLearnedWordIds);
      masteredWordIds = normalizedMasteredWordIdsList;
      notMasteredWordIds = normalizedNotMasteredWordIdsList;

      const masteredWordIdSet = new Set(masteredWordIds);
      const notMasteredWordIdSet = new Set(notMasteredWordIds);
      const learnedWordsDetailed = learnedWordIds.map((wordId) => {
        const key = String(wordId);
        const baseWord = runtimeWordMap[key] || buildDetailedWord(null, key);
        if (!baseWord) {
          return null;
        }

        const fallbackWordText = extractWordFromStructuredId(key) || (key.includes('_')
          ? key.slice(key.lastIndexOf('_') + 1).trim()
          : key.replace(/_/g, ' ').trim());

        return {
          ...baseWord,
          id: key,
          sourceWordId: key,
          word: (baseWord.word && String(baseWord.word).trim()) || fallbackWordText || key,
          masteryStatus: masteredWordIdSet.has(key) ? 'mastered' : (notMasteredWordIdSet.has(key) ? 'notMastered' : 'unknown')
        };
      }).filter(Boolean);

      const masteredWordsDetailed = learnedWordsDetailed.filter(word => word.masteryStatus === 'mastered');
      const notMasteredWordsDetailed = learnedWordsDetailed.filter(word => word.masteryStatus === 'notMastered');
      const learnedWordTexts = Array.from(new Set(learnedWordsDetailed.map(word => String(word.word || '').trim()).filter(Boolean)));
      const masteredWordTexts = Array.from(new Set(masteredWordsDetailed.map(word => String(word.word || '').trim()).filter(Boolean)));
      const notMasteredWordTexts = Array.from(new Set(notMasteredWordsDetailed.map(word => String(word.word || '').trim()).filter(Boolean)));

      const recordTotalWords = learnedWordIds.length > 0 ? learnedWordIds.length : totalWords;
      
      // 精确计算正确率（与学校检测页面保持一致）
      const calculatedCorrectRate = (masteredWords / totalWords * 100);
      
      // 计算学习时长（秒）
      const studyDuration = this.data.studyDuration;
      
      const record = {
        id: Date.now().toString(),
        studentId: this.data.currentStudent.id,
        userId: this.data.currentStudent.id, // 添加userId字段以兼容records页面
        studentName: this.data.currentStudent.name,
        wordbookId: this.data.currentWordbook.id,
        wordbookTitle: this.data.currentWordbook.title,
        wordbookTotalWords: Number(this.data.currentWordbook.totalWords || 0) || 0,
        totalWords: recordTotalWords,
        masteredWords: masteredWordIds.length,
        correctRate: parseFloat(correctRate),
        // 添加精确的正确率字段，便于其他页面使用
        accuracyRate: calculatedCorrectRate,
        // 保存studyWords字段，与学校检测页面兼容
        studyWords: learnedWordIds,
        studyWordsDetailed: learnedWordsDetailed,
        learningDate: new Date().toLocaleDateString(),
        learningTime: new Date().toLocaleTimeString(),
        studyDate: new Date().toISOString(), // 添加studyDate字段以兼容records页面
        learnedWordIds: learnedWordIds, // 记录本次学习的单词ID列表
        learnedWordTexts: learnedWordTexts,
        masteredWordIds: masteredWordIds,
        notMasteredWordIds: notMasteredWordIds,
        masteredWordTexts: masteredWordTexts,
        notMasteredWordTexts: notMasteredWordTexts,
        masteredCount: masteredWordIds.length,
        notMasteredCount: notMasteredWordIds.length,
        // 添加学习时长字段（秒）
        studyTime: studyDuration,
        duration: studyDuration / 60 // 添加duration字段（分钟）以兼容其他页面
      };
      
      // 学习完成后兜底同步 wordMastery，避免仅写学习记录导致抗遗忘列表为空。
      // 优先使用当前 previewMastery；若缺失则回落到本次统计出的掌握/困难结果。
      if (learnedWordIds.length > 0) {
        const masterySnapshot = {};
        const antiForgettingSeedSnapshot = {};
        const masteredIdSet = new Set(masteredWordIds.map(id => String(id)));
        const notMasteredIdSet = new Set(notMasteredWordIds.map(id => String(id)));
        const previewNotMasteredIdSet = new Set(startSnapshotNotMasteredWordIds.map(id => String(id)));

        learnedWordIds.forEach((rawId) => {
          const wordId = String(rawId);
          if (previewMastery[wordId] !== undefined) {
            masterySnapshot[wordId] = previewMastery[wordId];
            if (previewMastery[wordId] === false || previewMastery[wordId] === 'difficult') {
              antiForgettingSeedSnapshot[wordId] = true;
            }
            return;
          }
          if (notMasteredIdSet.has(wordId)) {
            masterySnapshot[wordId] = 'difficult';
            if (previewNotMasteredIdSet.has(wordId)) {
              antiForgettingSeedSnapshot[wordId] = true;
            }
            return;
          }
          if (masteredIdSet.has(wordId)) {
            masterySnapshot[wordId] = 'mastered';
          }
        });

        // 兼容历史链路：若状态仍为空，保留“未掌握”状态，但不能据此推断为预习不会。
        if (Object.keys(masterySnapshot).length === 0) {
          learnedWordIds.forEach((rawId) => {
            const wordId = String(rawId);
            masterySnapshot[wordId] = 'difficult';
          });
        }

        this.updateWordMasteryStatus(learnedWordIds, 'mastered', masterySnapshot, {
          antiForgettingSeedSnapshot
        });

        // ★ 立即同步 wordMastery 到云端，防止本地数据丢失导致云端缺失
        const studentId = this.data.currentStudent?.id;
        const wordbookId = this.data.currentWordbook?.id;
        if (studentId && wordbookId) {
          const wordMastery = wx.getStorageSync('wordMastery') || {};
          const changedRecords = wordMastery[studentId]?.[wordbookId] || {};
          syncWordMasteryBatch(studentId, wordbookId, changedRecords).catch(err => {
            console.warn('[saveLearningRecord] wordMastery 云端同步失败:', err);
          });
        }
      }
      
      // 调用app.js中的方法，这样会触发全局事件
      const app = getApp();
      app.addLearningRecord(record);
      
      console.log('学习记录保存成功:', record);
      console.log('本次学习的单词数量:', learnedWordIds.length);
      console.log('计算的正确率:', calculatedCorrectRate);
      console.log('学习时长:', studyDuration, '秒');

      this.setData({
        finalTestSourceWordIds: [],
        finalTestSourceMasteredWordIds: [],
        finalTestSourceNotMasteredWordIds: [],
        finalTestSourceWordsDetailed: [],
        startLearningSourceWordIds: [],
        startLearningSourceMasteredWordIds: [],
        startLearningSourceNotMasteredWordIds: [],
        startLearningSourceWordsDetailed: []
      });
    } catch (error) {
      console.error('保存学习记录失败:', error);
    }
  },
  
  // 更新单词掌握状态
  updateWordMasteryStatus: function(wordIds, status = 'mastered', previewMastery = null, options = {}) {
    try {
      if (!Array.isArray(wordIds) || wordIds.length === 0) {
        console.log('没有需要更新的单词ID');
        return;
      }
      
      const studentId = this.data.currentStudent.id;
      const wordbookId = this.data.currentWordbook.id;
      const now = new Date().getTime();
      
      // 获取单词掌握状态存储
      let wordMastery = wx.getStorageSync('wordMastery') || {};
      
      // 确保学生和词书的嵌套结构存在
      if (!wordMastery[studentId]) {
        wordMastery[studentId] = {};
      }
      if (!wordMastery[studentId][wordbookId]) {
        wordMastery[studentId][wordbookId] = {};
      }
      
      const wordbookMastery = wordMastery[studentId][wordbookId];
      const markAntiForgettingSeed = !!options.markAntiForgettingSeed;
      const antiForgettingSeedSnapshot = options.antiForgettingSeedSnapshot || {};
      
      // 遍历新单词ID并更新掌握状态
      for (let i = 0; i < wordIds.length; i++) {
        // 将wordId转换为字符串类型，确保与复习页面的比较一致
        const wordId = String(wordIds[i]);
        
        // 确定掌握状态
        let isMastered, isDifficult;
        
        // 如果提供了previewMastery，根据实际标记来设置状态
        if (previewMastery && previewMastery[wordId] !== undefined) {
          const previewStatus = previewMastery[wordId];
          isMastered = (previewStatus === true || previewStatus === 'mastered');
          isDifficult = (previewStatus === false || previewStatus === 'difficult');
          console.log(`单词${wordId}使用previewMastery状态: ${previewStatus} → mastered=${isMastered}, difficult=${isDifficult}`);
        } else {
          // 否则使用统一的状态
          isMastered = (status === true || status === 'mastered');
          isDifficult = (status === false || status === 'difficult');
          console.log(`单词${wordId}使用统一状态: ${status} → mastered=${isMastered}, difficult=${isDifficult}`);
        }
        
        const shouldSeedAntiForgetting = markAntiForgettingSeed && isDifficult;
        const keepAntiForgettingSeed = antiForgettingSeedSnapshot[wordId] === true;

        // 获取当前单词的掌握记录
        const isExistingRecord = Object.prototype.hasOwnProperty.call(wordbookMastery, wordId);
        const currentWordRecord = wordbookMastery[wordId] || {};
        const nextAntiForgettingSeed = currentWordRecord.antiForgettingSeed === true ||
          currentWordRecord.antiForgettingSeed === 'true' ||
          shouldSeedAntiForgetting ||
          keepAntiForgettingSeed;
        const nextAntiForgettingSource = resolveAntiForgettingSourceForUpdate(currentWordRecord, {
          confirmedPreviewNotMastered: shouldSeedAntiForgetting || keepAntiForgettingSeed,
          isPreviewDecision: markAntiForgettingSeed,
          isDifficult,
          isExistingRecord
        });
        const antiForgettingSourceFields = nextAntiForgettingSource
          ? { antiForgettingSource: nextAntiForgettingSource }
          : {};
        
        // 计算复习次数
        // 这里是“预习结果同步”，不是一次真实复习，不应推进复习轮次。
        // 新单词从0开始；历史单词保持原有轮次，避免同一学习日出现轮次数量不一致。
        const reviewCount = wordbookMastery[wordId] ? (currentWordRecord.reviewCount || 0) : 0;
        
        // 创建复习记录对象
        const reviewRecord = {
          time: now,
          status: isMastered ? 'mastered' : (isDifficult ? 'difficult' : 'none'),
          reviewCount: reviewCount
        };
        
        // 获取现有的复习时间线或创建新的
        const reviewTimeline = currentWordRecord.reviewTimeline || [];
        
        // 添加新的复习记录到时间线
        reviewTimeline.push(reviewRecord);
        
        // 根据掌握程度确定masteryLevel
        let masteryLevel = 'full';
        if (!isMastered && isDifficult) {
          masteryLevel = 'partial';
        } else if (!isMastered && !isDifficult) {
          masteryLevel = 'none';
        }
        
        if (wordbookMastery[wordId]) {
          // 已存在的单词，更新复习次数和时间
          wordbookMastery[wordId] = {
            ...currentWordRecord,
            reviewCount: reviewCount,
            lastReviewTime: now,
            mastered: isMastered,
            difficult: isDifficult,
            antiForgettingSeed: nextAntiForgettingSeed,
            ...antiForgettingSourceFields,
            // 根据艾宾浩斯遗忘曲线计算下次复习时间
            nextReviewTime: this.calculateNextReviewTime(reviewCount, now, masteryLevel),
            reviewTimeline: reviewTimeline // 保存复习时间线
          };
        } else {
          // 新单词，初始化复习信息
          // 新单词第一次复习设置为当天（0天）
          wordbookMastery[wordId] = {
            reviewCount: reviewCount,
            firstMasteryTime: now,
            lastReviewTime: now,
            nextReviewTime: this.calculateNextReviewTime(reviewCount, now, masteryLevel), // 第一次复习时间为当天
            mastered: isMastered,
            difficult: isDifficult,
            antiForgettingSeed: nextAntiForgettingSeed,
            ...antiForgettingSourceFields,
            reviewTimeline: reviewTimeline // 保存复习时间线
          };
        }
      }
      
      // 保存更新后的单词掌握状态
      wx.setStorageSync('wordMastery', wordMastery);
      
      // 触发全局事件，通知其他页面数据已更新
      const app = getApp();
      if (app.emit) {
        app.emit('wordMasteryUpdated');
      }
      
      console.log('单词掌握状态已更新，单词数量:', Object.keys(wordbookMastery).length);
      console.log('更新的单词ID:', wordIds);
      console.log('使用的状态:', status);
    } catch (error) {
      console.error('更新单词掌握状态失败:', error);
    }
  },
  
  // 根据21天复习法计算下次复习时间（单位：毫秒）
  calculateNextReviewTime: function(reviewCount, lastReviewTime, masteryLevel = 'full') {
    // 用户指定的抗遗忘复习间隔（单位：天）
    // 复习间隔：1天（学习第二天）、2天、4天、7天、15天（共5次复习）
    const fixedIntervals = [1, 2, 4, 7, 15];
    
    // 新学单词的第一次复习时间设置为学习第二天（间隔1天）
    if (reviewCount <= 1) {
      // 新学单词，第一次复习在学习的第二天
      const nextReviewTime = lastReviewTime + 1 * 24 * 60 * 60 * 1000;
      console.log('新学单词，第一次复习时间为学习第二天:', new Date(nextReviewTime).toLocaleString());
      return nextReviewTime;
    }
    
    // 部分掌握与完全掌握使用相同的复习时间间隔
    let intervalDays;
    switch (masteryLevel) {
      case 'full':
      case 'partial':
        // 完全掌握和部分掌握：使用相同的21天复习法间隔
        intervalDays = fixedIntervals[Math.min(reviewCount - 1, fixedIntervals.length - 1)];
        break;
      case 'none':
        // 彻底没掌握：暂时不设置复习间隔，后续会过滤掉这些单词
        intervalDays = 0;
        break;
      default:
        // 默认使用完全掌握的间隔
        intervalDays = fixedIntervals[Math.min(reviewCount - 1, fixedIntervals.length - 1)];
    }
    
    // 转换为毫秒并计算下次复习时间（1天 = 24小时 * 60分钟 * 60秒 * 1000毫秒）
    const nextReviewTime = lastReviewTime + intervalDays * 24 * 60 * 60 * 1000;
    console.log('计算复习时间：复习次数', reviewCount, '掌握程度', masteryLevel, '间隔天数', intervalDays, '下次复习时间', new Date(nextReviewTime).toLocaleString());
    return nextReviewTime;
  },

  // 重试加载
  retryLoad: function() {
    this.setData({
      hasError: false,
      errorMessage: ''
    });
    this.initStudyProcess();
  },

  // 重置加载状态
  resetLoadingState: function() {
    this.setData({
      loading: false,
      hasError: false,
      errorMessage: ''
    });
  },

  // 开始学习时长统计
  startStudyTimer: function() {
    // 从全局变量获取学习开始时间，如果不存在则使用当前时间
    const app = getApp();
    const globalStartTime = app.globalData.studyStartTime;
    
    // 确保有学习开始时间
    if (globalStartTime) {
      this.setData({
        studyStartTime: globalStartTime
      });
    } else if (!this.data.studyStartTime) {
      this.setData({
        studyStartTime: new Date().getTime()
      });
    }
    
    // 清除可能存在的旧计时器
    if (this.studyTimer) {
      clearInterval(this.studyTimer);
    }
    
    // 立即更新一次学习时长
    this.updateStudyDuration();
    
    // 每秒钟更新一次学习时长
    this.studyTimer = setInterval(() => {
      this.updateStudyDuration();
    }, 1000);
    
    console.log('学习时长统计已开始');
  },

  // 停止学习时长统计
  stopStudyTimer: function() {
    // 安全检查：确保页面实例有效
    if (!this) {
      console.warn('页面实例无效，跳过停止学习时长统计');
      return;
    }
    
    if (this.studyTimer) {
      clearInterval(this.studyTimer);
      this.studyTimer = null;
    }
    
    // 最终更新学习时长
    this.updateStudyDuration();
    
    // 安全检查：确保data对象存在
    if (this.data) {
      console.log('学习时长统计已停止，总时长:', this.data.studyDuration, '秒');
    }
    
    // 清除全局变量中的学习开始时间，避免影响下一次学习
    try {
      const app = getApp();
      app.globalData.studyStartTime = null;
    } catch (error) {
      console.warn('清除全局学习开始时间时出错:', error);
    }
  },

  // 更新学习时长
  updateStudyDuration: function() {
    // 安全检查：确保页面实例有效
    if (!this || !this.data) {
      console.warn('页面实例无效，跳过学习时长更新');
      return;
    }
    
    if (this.data.studyStartTime) {
      const now = new Date().getTime();
      const duration = Math.floor((now - this.data.studyStartTime) / 1000);
      
      try {
        this.setData({
          studyDuration: duration
        });
      } catch (error) {
        console.warn('更新学习时长时出错:', error);
      }
    }
  }
});
