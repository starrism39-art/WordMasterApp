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
      wx.redirectTo({
        url: '/pages/login/login'
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