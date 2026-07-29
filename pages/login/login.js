// login.js - 双入口登录页（新用户体验 / 老用户登录）
const { syncDataFromCloud, migrateLocalDataToCloud } = require('../../utils/cloud-migration');
const { retryPendingSyncs, syncAllLocalLearningRecords } = require('../../utils/cloud-sync.js');
const { isCloudReadOnlyMode } = require('../../utils/cloud-mode.js');

Page({
  data: {
    isLoading: false,
    hasAgreed: false,
    showAgreementModal: false
  },

  onLoad: function() {
    console.log('登录页面加载');
    // 每次进入登录页，清除隐私政策确认标记，确保登录后首页重新弹出
    try {
      wx.removeStorageSync('privacyConfirmed');
    } catch (e) { /* ignore */ }
    // 已同意过的老用户，自动勾选协议（但仍需手动点击登录）
    try {
      const agreed = !!wx.getStorageSync('hasAgreedToPolicies');
      if (agreed) {
        this.setData({ hasAgreed: true });
      }
    } catch (e) {
      // ignore
    }
  },

  onShow: function() {
    // 不再自动登录，用户需手动点击按钮
  },

  // ===== 老用户：点击"微信一键登录" =====
  onLoginTap: function() {
    // 已同意过协议的直接登录，否则弹出协议弹窗
    if (this.data.hasAgreed) {
      this.doLogin();
    } else {
      this.setData({ showAgreementModal: true });
    }
  },

  // ===== 新用户：点击"先体验一下" =====
  onGuestTap: function() {
    // 不调用任何隐私接口，直接进首页
    console.log('[Guest] 新用户体验模式，跳过登录');
    this.navigateToHome();
  },

  // ===== 协议弹窗：勾选 =====
  toggleAgreement: function() {
    this.setData({ hasAgreed: !this.data.hasAgreed });
  },

  // ===== 协议弹窗：同意并登录 =====
  confirmAgreement: function() {
    if (!this.data.hasAgreed) {
      wx.showToast({ title: '请先勾选同意协议', icon: 'none' });
      return;
    }
    try {
      wx.setStorageSync('hasAgreedToPolicies', true);
    } catch (e) { /* ignore */ }
    this.setData({ showAgreementModal: false }, () => {
      this.doLogin();
    });
  },

  // ===== 协议弹窗：取消 =====
  closeAgreementModal: function() {
    this.setData({ showAgreementModal: false, hasAgreed: false });
  },

  // ===== 核心登录流程（仅在同意协议后调用） =====
  async doLogin() {
    if (this._autoLoginInProgress) return;
    this._autoLoginInProgress = true;
    this._autoChecked = true;

    try {
      const cachedOpenId = wx.getStorageSync('openid');
      if (cachedOpenId) {
        console.log('检测到本地 OpenID 缓存:', cachedOpenId);
        retryPendingSyncs();

        const hasLocalData = this.hasLocalDataToMigrate();
        if (hasLocalData) {
          this.setData({ isLoading: true });
          await this.runBlockingMigrate();
        }

        this.setData({ isLoading: true });
        const syncResult = await this.runBlockingSync(cachedOpenId);
        if (syncResult && syncResult.error) {
          wx.showToast({ title: '云端同步失败，数据仅保存在本地', icon: 'none', duration: 3000 });
        }
        // 补推历史学习记录到云端
        syncAllLocalLearningRecords();
        this.navigateToHome();
        return;
      }

      // 无缓存，走完整登录
      if (!wx.cloud) {
        this.handleLoginError('当前基础库不支持云开发');
        return;
      }

      this.setData({ isLoading: true });
      const openid = await this.fetchOpenId();
      wx.setStorageSync('openid', openid);
      await this.ensureTeacherRecord(openid);
      retryPendingSyncs();
      await this.runBlockingMigrate();

      const syncResult = await this.runBlockingSync(openid);
      if (syncResult && syncResult.error) {
        wx.showToast({ title: '云端同步失败，数据仅保存在本地', icon: 'none', duration: 3000 });
      }
      // 补推历史学习记录到云端
      syncAllLocalLearningRecords();
      this.navigateToHome();
    } catch (error) {
      console.error('登录流程失败:', error);
      this.handleLoginError('登录失败，请稍后重试');
    } finally {
      this._autoLoginInProgress = false;
      this.setData({ isLoading: false });
    }
  },

  /**
   * 是否有本地数据需要迁移到云端
   */
  hasLocalDataToMigrate() {
    // 已迁移过则跳过
    if (wx.getStorageSync('hasMigratedToCloud')) {
      return false;
    }

    const students = wx.getStorageSync('students');
    const learningRecords = wx.getStorageSync('learningRecords');
    const learningProgress = wx.getStorageSync('learningProgress');
    const wordMastery = wx.getStorageSync('wordMastery');

    const hasStudents = Array.isArray(students) && students.length > 0;
    const hasRecords = Array.isArray(learningRecords) && learningRecords.length > 0;
    const hasProgress =
      learningProgress &&
      typeof learningProgress === 'object' &&
      !Array.isArray(learningProgress) &&
      Object.keys(learningProgress).length > 0;
    const hasMastery =
      wordMastery &&
      typeof wordMastery === 'object' &&
      !Array.isArray(wordMastery) &&
      Object.keys(wordMastery).length > 0;

    return hasStudents || hasRecords || hasProgress || hasMastery;
  },

  /**
   * 阻塞式迁移本地数据到云端
   */
  async runBlockingMigrate() {
    wx.showLoading({
      title: '首次数据上云中...',
      mask: true
    });

    try {
      const result = await migrateLocalDataToCloud();
      if (result && result.success) {
        console.log('[Migration] 本地数据全量上云成功, counts:', result.counts);
      } else if (result && result.skipped) {
        console.log('[Migration] 已迁移过，跳过');
      } else {
        console.warn('[Migration] 上云返回异常:', result);
      }
    } catch (error) {
      console.error('[Migration] 本地数据上云失败（非阻塞）:', error);
    } finally {
      wx.hideLoading();
      this.setData({ isLoading: false });
    }
  },

  /**
   * 调用云函数获取 OpenID
   */
  async fetchOpenId() {
    const res = await wx.cloud.callFunction({
      name: 'login',
      data: {}
    });

    console.log('云函数 login 响应:', res);

    const openid = this.extractOpenId(res);
    if (!openid) {
      throw new Error('missing_openid');
    }

    console.log('成功获取 OpenID:', openid);
    return openid;
  },

  /**
   * 从云函数响应中提取 OpenID
   * 兼容多种响应格式
   */
  extractOpenId(response) {
    if (!response) {
      return null;
    }

    // 标准响应格式：res.result.openid
    if (response.result) {
      return response.result.openid || response.result.OPENID || response.result.openId || null;
    }

    // 直接响应格式
    return response.openid || response.OPENID || response.openId || null;
  },

  /**
   * 确保云端 teachers 集合存在该教师记录
   * 若不存在，静默创建一条
   */
  async ensureTeacherRecord(openid) {
    try {
      if (!wx.cloud) {
        console.warn('wx.cloud 不可用，跳过教师档案创建');
        return;
      }

      const db = wx.cloud.database({ env: 'cloudbase-4gafzdch60ad597b' });
      const teachersCollection = db.collection('teachers');

      const queryRes = await teachersCollection
        .where({ teacher_id: openid })
        .limit(1)
        .get();

      const hasRecord = queryRes && Array.isArray(queryRes.data) && queryRes.data.length > 0;
      if (hasRecord) {
        console.log('教师档案已存在，同步权限字段...');
        // 【权限基座】从云端读取教师完整档案，规范化权限字段后写入本地
        const cloudTeacher = queryRes.data[0];
        const app = getApp();
        const normalizedUser = app.ensureUserPermissions({
          id: openid,
          username: openid,
          name: cloudTeacher.name || '教师',
          userRole: cloudTeacher.userRole || 'external',
          memberLevel: cloudTeacher.memberLevel || 'free'
        });
        wx.setStorageSync('currentUser', normalizedUser);
        app.globalData.currentUser = normalizedUser;
        console.log('[Permission] 已有教师权限基座同步完成, userRole:', normalizedUser.userRole);
        return;
      }

      if (isCloudReadOnlyMode()) {
        console.warn('[cloud-read-only] skip createTeacherRecord');
        return;
      }

      console.log('教师档案不存在，准备创建...');
      await this.createTeacherRecord(openid, teachersCollection);
    } catch (error) {
      console.error('确保教师档案出错:', error);
    }
  },

  /**
   * 创建教师档案
   */
  async createTeacherRecord(openid, teachersCollection) {
    if (isCloudReadOnlyMode()) {
      console.warn('[cloud-read-only] skip createTeacherRecord');
      return;
    }

    const teacherData = {
      teacher_id: openid,
      openid: openid,
      name: '教师',
      userRole: 'external',
      memberLevel: 'free',
      createdAt: new Date().toISOString(),
      status: 'active'
    };

    try {
      const res = await teachersCollection.add({ data: teacherData });
      console.log('教师档案创建成功:', res);

      // 【权限基座】写回本地 currentUser，确保权限字段就绪
      const app = getApp();
      const normalizedUser = app.ensureUserPermissions({
        id: openid,
        username: openid,
        name: '教师',
        userRole: 'external',
        memberLevel: 'free'
      });
      wx.setStorageSync('currentUser', normalizedUser);
      app.globalData.currentUser = normalizedUser;
      console.log('[Permission] 新教师权限基座已写入, userRole:', normalizedUser.userRole);
    } catch (error) {
      console.error('创建教师档案失败:', error);
    }
  },

  /**
   * 阻塞式同步云端数据
   */
  async runBlockingSync(openid) {
    wx.showLoading({
      title: '数据同步中...',
      mask: true
    });

    try {
      const result = await syncDataFromCloud(openid);
      console.log('云端数据同步完成');
      return result;
    } catch (error) {
      console.error('云端数据同步失败:', error);
      return { error: error && error.message ? error.message : 'sync_failed' };
    } finally {
      wx.hideLoading();
      this.setData({ isLoading: false });
    }
  },

  /**
   * 处理登录错误
   */
  handleLoginError(errorMessage) {
    wx.hideLoading();
    this.setData({ isLoading: false });
    
    wx.showToast({
      title: errorMessage,
      icon: 'none',
      duration: 2500
    });
    
    console.error('登录错误:', errorMessage);
  },

  /**
   * 导航到首页
   */
  navigateToHome() {
    wx.hideLoading();
    this.setData({ isLoading: false });

    console.log('登录完成，准备跳转到首页...');
    
    // 延迟 500ms 以确保所有存储操作完成
    setTimeout(() => {
      wx.switchTab({
        url: '/pages/index/index',
        success: () => {
          console.log('成功跳转到首页');
        },
        fail: (err) => {
          console.error('switchTab 失败:', err, '尝试 navigateTo...');
          wx.navigateTo({
            url: '/pages/index/index'
          });
        }
      });
    }, 500);
  },


  onViewUserAgreement() {
    wx.showModal({
      title: "用户协议",
      content: "请在小程序内查看完整用户协议。",
      showCancel: false
    });
  },

  noop() {}
});
