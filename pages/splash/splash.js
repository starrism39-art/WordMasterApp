// pages/splash/splash.js
Page({
  data: {
    isFading: false
  },

  onLoad() {
    this.fadeTimer = setTimeout(() => {
      this.setData({ isFading: true });
    }, 1120);

    this.jumpTimer = setTimeout(() => {
      // 不再强制跳转登录页，直接进入首页体验功能
      wx.switchTab({
        url: '/pages/index/index',
        fail: () => {
          wx.redirectTo({ url: '/pages/index/index' });
        }
      });
    }, 1300);
  },

  onUnload() {
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }

    if (this.jumpTimer) {
      clearTimeout(this.jumpTimer);
      this.jumpTimer = null;
    }
  }
});