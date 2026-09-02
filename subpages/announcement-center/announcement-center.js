'use strict';

const {
  listHistory,
  markRead
} = require('../../utils/announcement-service');

const getAnnouncement = (entry) => (
  entry && entry.announcement && typeof entry.announcement === 'object'
    ? entry.announcement
    : null
);

const getAnnouncementId = (entry) => {
  const announcement = getAnnouncement(entry);
  return announcement ? String(announcement._id || announcement.id || '') : '';
};

const isUnreadEntry = (entry) => !(
  entry
  && entry.readState
  && entry.readState.readAt
);

const mergeHistoryItems = (current = [], incoming = []) => {
  const order = [];
  const byId = new Map();
  current.concat(incoming).forEach((entry) => {
    const id = getAnnouncementId(entry);
    if (!id) return;
    if (!byId.has(id)) order.push(id);
    byId.set(id, entry);
  });
  return order.map((id) => byId.get(id));
};

const applyReadState = (items = [], announcementId, readState) => items.map((entry) => (
  getAnnouncementId(entry) === announcementId
    ? { ...entry, readState: readState || entry.readState || null }
    : entry
));

Page({
  data: {
    activeTab: 'all',
    allItems: [],
    visibleItems: [],
    nextCursor: 1,
    hasMore: true,
    loading: true,
    loadingMore: false,
    error: '',
    popupPreviewVisible: false,
    popupPreviewAnnouncement: {}
  },

  onLoad() {
    this.loadInitial();
  },

  async loadInitial() {
    this._loadedCursors = new Set();
    this.setData({
      allItems: [],
      visibleItems: [],
      nextCursor: 1,
      hasMore: true,
      loading: true,
      error: ''
    });

    try {
      await this.loadNextPage();
      if (this.data.activeTab === 'unread') await this.ensureUnreadComplete();
      this.refreshVisibleItems();
    } catch (error) {
      this.setData({ error: '公告暂时加载失败，请稍后重试' });
    } finally {
      this.setData({ loading: false, loadingMore: false });
      if (typeof wx !== 'undefined' && wx.stopPullDownRefresh) wx.stopPullDownRefresh();
    }
  },

  async loadNextPage() {
    if (!this.data.hasMore) return;
    if (this._loadingPagePromise) return this._loadingPagePromise;
    const cursor = Number(this.data.nextCursor) || 1;
    this._loadedCursors = this._loadedCursors || new Set();
    if (this._loadedCursors.has(cursor)) throw new Error('ANNOUNCEMENT_CURSOR_LOOP');

    const loadPromise = (async () => {
      this.setData({ loadingMore: cursor > 1 });
      try {
        const result = await listHistory({ cursor });
        const incoming = Array.isArray(result.items) ? result.items : [];
        const merged = mergeHistoryItems(this.data.allItems, incoming);
        const hasMore = result.hasMore === true;
        const nextCursor = hasMore ? Number(result.cursor) : null;
        if (hasMore && (!Number.isSafeInteger(nextCursor) || nextCursor <= 0)) {
          throw new Error('ANNOUNCEMENT_CURSOR_INVALID');
        }
        this._loadedCursors.add(cursor);
        this.setData({
          allItems: merged,
          hasMore,
          nextCursor,
          error: ''
        });
        this.refreshVisibleItems();
      } finally {
        this.setData({ loadingMore: false });
      }
    })();

    this._loadingPagePromise = loadPromise;
    try {
      return await loadPromise;
    } finally {
      if (this._loadingPagePromise === loadPromise) this._loadingPagePromise = null;
    }
  },

  async ensureUnreadComplete() {
    while (this.data.hasMore) {
      await this.loadNextPage();
    }
    this.refreshVisibleItems();
  },

  refreshVisibleItems() {
    const visibleItems = this.data.activeTab === 'unread'
      ? this.data.allItems.filter(isUnreadEntry)
      : this.data.allItems;
    this.setData({ visibleItems });
  },

  async onTabTap(event) {
    const tab = event.currentTarget.dataset.tab;
    if (tab !== 'all' && tab !== 'unread') return;
    this.setData({ activeTab: tab, error: '' });
    this.refreshVisibleItems();

    if (tab === 'unread' && this.data.hasMore) {
      this.setData({ loading: true });
      try {
        await this.ensureUnreadComplete();
      } catch (error) {
        this.setData({ error: '未读公告暂时加载失败，请稍后重试' });
      } finally {
        this.setData({ loading: false, loadingMore: false });
      }
    }
  },

  async onAnnouncementDetail(event) {
    const announcementId = String(event.detail.announcementId || '');
    if (!announcementId) return;

    try {
      const result = await markRead(announcementId);
      const updatedItems = applyReadState(
        this.data.allItems,
        announcementId,
        result.readState
      );
      this.setData({ allItems: updatedItems });
      this.refreshVisibleItems();
      wx.navigateTo({
        url: `/subpages/announcement-detail/announcement-detail?id=${encodeURIComponent(announcementId)}`
      });
    } catch (error) {
      wx.showToast({ title: '暂时无法打开公告', icon: 'none' });
    }
  },

  onRetry() {
    this.loadInitial();
  },

  onPullDownRefresh() {
    this.loadInitial();
  },

  async onReachBottom() {
    if (this.data.activeTab !== 'all' || !this.data.hasMore || this.data.loadingMore) return;
    try {
      await this.loadNextPage();
    } catch (error) {
      this.setData({ error: '更多公告暂时加载失败，请稍后重试' });
    }
  }
});

module.exports = {
  getAnnouncementId,
  isUnreadEntry,
  mergeHistoryItems,
  applyReadState
};
