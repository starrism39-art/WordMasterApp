// subpages/agreement/agreement.js
Page({
  data: {
    type: 'all' // 'user' | 'privacy' | 'all'
  },

  onLoad: function (options) {
    const type = options.type || 'all';
    const titles = {
      user: '用户协议',
      privacy: '隐私政策',
      all: '用户协议与隐私政策'
    };
    wx.setNavigationBarTitle({
      title: titles[type] || '用户协议与隐私政策'
    });
    this.setData({ type });
  }
});
