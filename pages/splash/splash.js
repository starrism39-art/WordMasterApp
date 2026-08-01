// pages/splash/splash.js
const loginService = require('../../utils/login-service.js');

Page({
  data: {
    isFading: false
  },

  onLoad() {
    // 最短展示动画时间（1.5s）
    const MIN_DISPLAY_MS = 1500;
    // 最长等待同步时间（20s 兜底）
    const SAFE_TIMEOUT_MS = 20000;

    const startTime = Date.now();

    // 启动静默登录（拉取云端数据）
    const syncPromise = loginService.doSilentLogin().catch(function(err) {
      console.warn('[splash] doSilentLogin 失败（非阻塞）:', err);
      return { ok: false, error: err };
    });

    // 等同步完成 & 最短展示时间后跳转
    const waitForReady = function() {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);

      Promise.all([
        syncPromise,
        new Promise(function(r) { setTimeout(r, remaining); })
      ]).then(function(results) {
        try {
          const app = getApp();
          const syncResult = results && results[0];
          const pending = Number(syncResult && syncResult.pending) || 0;
          app.globalData.syncFreshCompleted = !!(syncResult && syncResult.ok === true && pending === 0);
          app.globalData.syncFreshPendingCount = pending;
          app.globalData.syncFreshFailed = !(syncResult && syncResult.ok === true);
        } catch (e) {
          // ignore
        }
        splashJump.call(this);
      }.bind(this));
    }.bind(this);

    // 安全兜底：超时后强制跳转
    this.splashTimer = setTimeout(function() {
      console.warn('[splash] 同步超时，强制跳转首页');
      try {
        const app = getApp();
        app.globalData.syncFreshCompleted = false;
        app.globalData.syncFreshPendingCount = 0;
        app.globalData.syncFreshFailed = true;
      } catch (e) {
        // ignore
      }
      splashJump.call(this);
    }.bind(this), SAFE_TIMEOUT_MS);

    // 先展示动画
    this.fadeTimer = setTimeout(function() {
      this.setData({ isFading: true });
    }.bind(this), 1120);

    // 同步完成后跳转
    waitForReady();
  },

  onUnload() {
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }

    if (this.splashTimer) {
      clearTimeout(this.splashTimer);
      this.splashTimer = null;
    }
  }
});

/**
 * 执行跳转到首页
 * 使用 reLaunch 而非 switchTab，避免真机调试时 splash 页面未完全初始化
 * 就尝试切换 tab 导致的 "pageId not exists" 框架错误
 */
function splashJump() {
  if (this._jumped) return;
  this._jumped = true;
  if (this.splashTimer) {
    clearTimeout(this.splashTimer);
    this.splashTimer = null;
  }
  wx.reLaunch({
    url: '/pages/index/index',
    fail: function(err) {
      console.error('[splash] reLaunch 失败，降级使用 switchTab:', err);
      wx.switchTab({
        url: '/pages/index/index'
      });
    }
  });
}
