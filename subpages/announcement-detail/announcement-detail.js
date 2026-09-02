'use strict';

const {
  getDetail,
  markRead,
  resolveAnnouncementAction
} = require('../../utils/announcement-service');

const TYPE_LABELS = Object.freeze({
  version_update: '版本更新',
  system: '系统公告',
  wordbook: '新词书',
  activity: '活动',
  membership: '会员相关'
});

const TYPE_CLASSES = Object.freeze({
  version_update: 'version',
  system: 'system',
  wordbook: 'wordbook',
  activity: 'activity',
  membership: 'membership'
});

const formatDetailDate = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
};

const normalizeContentBlocks = (announcement = {}) => {
  if (Array.isArray(announcement.contentBlocks)) {
    return announcement.contentBlocks.map((block) => {
      if (typeof block === 'string') return { title: '', body: block };
      const safeBlock = block && typeof block === 'object' ? block : {};
      return {
        title: String(safeBlock.title || ''),
        body: String(safeBlock.body || safeBlock.content || '')
      };
    }).filter((block) => block.title || block.body);
  }

  const content = String(announcement.content || '').trim();
  if (!content) return [];
  return content.split(/\n\s*\n/).map((body) => ({ title: '', body: body.trim() }));
};

const normalizeDetail = (announcement = {}) => ({
  id: String(announcement._id || announcement.id || ''),
  title: String(announcement.title || ''),
  summary: String(announcement.summary || ''),
  typeLabel: TYPE_LABELS[announcement.type] || TYPE_LABELS.system,
  typeClass: TYPE_CLASSES[announcement.type] || TYPE_CLASSES.system,
  publishDate: formatDetailDate(announcement.publishTime),
  blocks: normalizeContentBlocks(announcement)
});

const buildActionView = (announcement = {}) => {
  if (!announcement.action) return null;
  let resolved;
  try {
    resolved = resolveAnnouncementAction(announcement.action);
  } catch (error) {
    return null;
  }
  if (!resolved.available || !resolved.route || resolved.target === 'announcement_detail') return null;
  return {
    label: String(announcement.actionLabel || '去词书管理'),
    route: resolved.route,
    params: resolved.params || {}
  };
};

const buildActionUrl = (actionView) => {
  if (!actionView || !actionView.route) return '';
  const query = Object.keys(actionView.params || {}).map((key) => (
    `${encodeURIComponent(key)}=${encodeURIComponent(String(actionView.params[key]))}`
  )).join('&');
  return query ? `${actionView.route}?${query}` : actionView.route;
};

Page({
  data: {
    announcementId: '',
    announcement: null,
    readState: null,
    detailView: normalizeDetail(),
    actionView: null,
    loading: true,
    error: ''
  },

  onLoad(options = {}) {
    const announcementId = String(options.id || options.announcementId || '');
    this.setData({ announcementId });
    if (!announcementId) {
      this.setData({ loading: false, error: '公告参数无效' });
      return;
    }
    this.loadAnnouncement();
  },

  async loadAnnouncement() {
    const announcementId = this.data.announcementId;
    this.setData({ loading: true, error: '' });
    try {
      const result = await getDetail(announcementId);
      if (!result.announcement) throw new Error('ANNOUNCEMENT_NOT_FOUND');
      const detailView = normalizeDetail(result.announcement);
      this.setData({
        announcement: result.announcement,
        readState: result.readState,
        detailView,
        actionView: buildActionView(result.announcement),
        loading: false
      });

      try {
        const readResult = await markRead(announcementId);
        this.setData({ readState: readResult.readState });
      } catch (readError) {
        wx.showToast({ title: '已读状态同步失败', icon: 'none' });
      }
    } catch (error) {
      this.setData({ loading: false, error: '公告暂时无法查看，请稍后重试' });
    }
  },

  onRetry() {
    this.loadAnnouncement();
  },

  onActionTap() {
    const url = buildActionUrl(this.data.actionView);
    if (!url) return;
    wx.navigateTo({
      url,
      fail: () => wx.showToast({ title: '该功能暂时不可用', icon: 'none' })
    });
  }
});

module.exports = {
  formatDetailDate,
  normalizeContentBlocks,
  normalizeDetail,
  buildActionView,
  buildActionUrl
};
