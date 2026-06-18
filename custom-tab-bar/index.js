Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页'
      },
      {
        pagePath: 'pages/students/students',
        text: '我的'
      }
    ]
  },

  attached: function() {
    this.updateSelectedByRoute();
  },

  methods: {
    switchTab: function(e) {
      const index = Number(e.currentTarget.dataset.index);
      if (Number.isNaN(index)) return;

      const target = this.data.list[index];
      if (!target || !target.pagePath) return;

      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      const currentRoute = currentPage ? currentPage.route : '';

      // 如果已在目标页，仅修正选中态，不再触发切换。
      if (currentRoute === target.pagePath) {
        if (this.data.selected !== index) {
          this.setData({ selected: index });
        }
        return;
      }

      this.setData({ selected: index });

      wx.switchTab({
        url: '/' + target.pagePath,
        fail: () => {
          // 兼容不同基础库对 URL 前导斜杠的差异处理。
          wx.switchTab({
            url: target.pagePath,
            fail: () => {
              this.updateSelectedByRoute();
            }
          });
        }
      });
    },

    setSelected: function(index) {
      const normalized = Number(index);
      if (Number.isNaN(normalized)) return;
      if (this.data.selected !== normalized) {
        this.setData({ selected: normalized });
      }
    },

    updateSelectedByRoute: function() {
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      const route = currentPage ? currentPage.route : '';
      const tabIndex = this.data.list.findIndex(item => item.pagePath === route);

      if (tabIndex >= 0 && tabIndex !== this.data.selected) {
        this.setData({ selected: tabIndex });
      }
    }
  }
});
