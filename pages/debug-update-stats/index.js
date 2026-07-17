const statsEngine = require('../../utils/stats-engine.js');

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

Page({
  data: {
    mode: 'core',
    currentStudent: null,
    currentWordbook: null,
    currentStats: {
      masteredCount: 0,
      notMasteredCount: 0,
      checkinDays: 0
    },
    editStats: {
      masteredCount: '',
      notMasteredCount: '',
      checkinDays: ''
    },
    hasManualOverride: false,
    isSaving: false
  },

  onLoad(options) {
    const app = getApp();
    const currentStudent = app.globalData.currentStudent || wx.getStorageSync('currentStudent');
    const currentWordbook = app.globalData.currentWordbook || app.globalData.selectedWordbook || wx.getStorageSync('selectedWordbook');
    const mode = options && options.mode === 'wordbook' ? 'wordbook' : 'core';

    // 优先用 URL 参数中的 wordbookId，兼容两种入口
    const wordbookId = (options && options.wordbookId)
      ? decodeURIComponent(options.wordbookId)
      : (currentWordbook ? currentWordbook.id : null);
    const resolvedWordbook = (wordbookId && currentWordbook && currentWordbook.id === wordbookId)
      ? currentWordbook
      : { id: wordbookId };

    if (!currentStudent || !currentStudent.id) {
      wx.showToast({ title: '请先选择学生', icon: 'none' });
      return;
    }

    // 两个模式都要求词书（首页核心统计和详细统计都是词书维度）
    if (!wordbookId) {
      wx.showToast({ title: '请先选择词书', icon: 'none' });
      return;
    }

    const currentStats = statsEngine.calculateWordbookStats(currentStudent.id, wordbookId);

    const overrideKey = `wordbook_stats_${currentStudent.id}_${wordbookId}`;

    const override = wx.getStorageSync(overrideKey) || null;
    const hasManualOverride = !!(override && override.isManualOverride);

    const manualStats = hasManualOverride
      ? {
        masteredCount: toNumber(override.manualMasteredCount ?? override.masteredCount ?? currentStats.masteredCount),
        notMasteredCount: toNumber(override.manualNotMasteredCount ?? override.notMasteredCount ?? currentStats.notMasteredCount),
        checkinDays: toNumber(override.manualCheckinDays ?? override.checkinDays ?? currentStats.checkinDays)
      }
      : currentStats;

    this.setData({
      mode,
      currentStudent,
      currentWordbook: resolvedWordbook,
      currentStats,
      editStats: {
        masteredCount: String(manualStats.masteredCount),
        notMasteredCount: String(manualStats.notMasteredCount),
        checkinDays: String(manualStats.checkinDays)
      },
      hasManualOverride
    });
  },

  handleInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`editStats.${field}`]: value
    });
  },

  async saveOverride() {
    if (this.data.isSaving) return;

    const { mode, currentStudent, currentWordbook, currentStats, editStats } = this.data;
    if (!currentStudent || !currentStudent.id) {
      wx.showToast({ title: '请先选择学生', icon: 'none' });
      return;
    }

    // 两个模式都要求词书（首页核心统计和详细统计都是词书维度）
    if (!currentWordbook || !currentWordbook.id) {
      wx.showToast({ title: '请先选择词书', icon: 'none' });
      return;
    }

    const masteredCount = toNumber(editStats.masteredCount);
    const notMasteredCount = toNumber(editStats.notMasteredCount);
    const checkinDays = toNumber(editStats.checkinDays);

    const statsPayload = {
      masteredCount,
      notMasteredCount,
      checkinDays,
      baseMasteredCount: Number(currentStats.masteredCount || 0),
      baseNotMasteredCount: Number(currentStats.notMasteredCount || 0),
      baseCheckinDays: Number(currentStats.checkinDays || 0)
    };

    // 两个模式统一用词书级 action
    const action = 'setWordbook';
    const data = {
      action,
      studentId: currentStudent.id,
      stats: statsPayload,
      wordbookId: currentWordbook ? currentWordbook.id : ''
    };

    this.setData({ isSaving: true });
    wx.showLoading({ title: '保存中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'updateStudentStats',
        data
      });

      const result = res && res.result ? res.result : null;
      if (!result || result.success !== true) {
        throw new Error((result && result.error) || '保存失败');
      }

      const manualPayload = {
        masteredCount,
        notMasteredCount,
        checkinDays,
        manualMasteredCount: masteredCount,
        manualNotMasteredCount: notMasteredCount,
        manualCheckinDays: checkinDays,
        baseMasteredCount: statsPayload.baseMasteredCount,
        baseNotMasteredCount: statsPayload.baseNotMasteredCount,
        baseCheckinDays: statsPayload.baseCheckinDays,
        isManualOverride: true,
        calculatedAt: Date.now()
      };

      // 核心模式和词书模式都用词书级缓存
      const localKey = currentWordbook && currentWordbook.id
        ? `wordbook_stats_${currentStudent.id}_${currentWordbook.id}`
        : `stats_${currentStudent.id}`;
      wx.setStorageSync(localKey, manualPayload);

      // 同时更新全词书 stats_ 缓存（首页核心统计用）
      if (currentWordbook && currentWordbook.id) {
        const allStats = statsEngine.calculateStudentCoreStats(currentStudent.id);
        const allOverrideKey = `stats_${currentStudent.id}`;
        const allPayload = {
          masteredCount: Math.max(masteredCount, allStats.masteredCount),
          notMasteredCount: Math.max(notMasteredCount, allStats.notMasteredCount),
          checkinDays: Math.max(checkinDays, allStats.checkinDays),
          isManualOverride: true,
          calculatedAt: Date.now()
        };
        wx.setStorageSync(allOverrideKey, allPayload);
      }

      this.setData({ hasManualOverride: true });
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (error) {
      console.error('保存手动修正失败:', error);
      wx.showToast({ title: error.message || '保存失败', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ isSaving: false });
    }
  },

  async resetOverride() {
    if (this.data.isSaving) return;

    const { mode, currentStudent, currentWordbook, currentStats } = this.data;
    if (!currentStudent || !currentStudent.id) {
      wx.showToast({ title: '请先选择学生', icon: 'none' });
      return;
    }

    // 两个模式都要求词书
    if (!currentWordbook || !currentWordbook.id) {
      wx.showToast({ title: '请先选择词书', icon: 'none' });
      return;
    }

    // 两个模式统一用词书级 action
    const action = 'resetWordbook';
    const data = { action, studentId: currentStudent.id, wordbookId: currentWordbook ? currentWordbook.id : '' };

    this.setData({ isSaving: true });
    wx.showLoading({ title: '处理中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'updateStudentStats',
        data
      });

      const result = res && res.result ? res.result : null;
      if (!result || result.success !== true) {
        throw new Error((result && result.error) || '操作失败');
      }

      // 核心模式和词书模式都清除词书级缓存
      const localKey = currentWordbook && currentWordbook.id
        ? `wordbook_stats_${currentStudent.id}_${currentWordbook.id}`
        : `stats_${currentStudent.id}`;
      wx.removeStorageSync(localKey);

      // 同时清除全词书 stats_ 缓存
      const allKey = `stats_${currentStudent.id}`;
      wx.removeStorageSync(allKey);
      await statsEngine.refreshStudentStats(currentStudent.id);

      this.setData({
        hasManualOverride: false,
        editStats: {
          masteredCount: String(currentStats.masteredCount || 0),
          notMasteredCount: String(currentStats.notMasteredCount || 0),
          checkinDays: String(currentStats.checkinDays || 0)
        }
      });

      wx.showToast({ title: '已恢复自动', icon: 'success' });
    } catch (error) {
      console.error('恢复自动统计失败:', error);
      wx.showToast({ title: error.message || '操作失败', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ isSaving: false });
    }
  }
});