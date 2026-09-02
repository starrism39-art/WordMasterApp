'use strict';

const TYPE_META = Object.freeze({
  version_update: { label: '版本更新', className: 'version' },
  system: { label: '系统公告', className: 'system' },
  wordbook: { label: '新词书', className: 'wordbook' },
  activity: { label: '活动', className: 'activity' },
  membership: { label: '会员相关', className: 'membership' }
});

const PRIORITIES = new Set(['normal', 'important', 'major']);

const formatPublishDate = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
};

const normalizeCardEntry = (entry = {}, placement = 'list') => {
  const announcement = entry && entry.announcement ? entry.announcement : entry;
  const safeAnnouncement = announcement && typeof announcement === 'object' ? announcement : {};
  const readState = entry && entry.readState && typeof entry.readState === 'object'
    ? entry.readState
    : null;
  const typeMeta = TYPE_META[safeAnnouncement.type] || TYPE_META.system;
  const priority = PRIORITIES.has(safeAnnouncement.priority)
    ? safeAnnouncement.priority
    : 'normal';
  const read = typeof entry.read === 'boolean'
    ? entry.read
    : Boolean(readState && readState.readAt);
  const isNew = entry.isNew === true || safeAnnouncement.isNew === true;

  return {
    id: String(safeAnnouncement._id || safeAnnouncement.id || ''),
    title: String(safeAnnouncement.title || ''),
    summary: String(safeAnnouncement.summary || ''),
    typeLabel: typeMeta.label,
    typeClass: typeMeta.className,
    priority,
    priorityLabel: priority === 'major' ? '重大' : (priority === 'important' ? '重要' : ''),
    publishDate: formatPublishDate(safeAnnouncement.publishTime),
    read,
    showNew: !read && isNew,
    showUnreadDot: !read,
    placement: placement === 'home' ? 'home' : 'list'
  };
};

Component({
  properties: {
    entry: {
      type: Object,
      value: {}
    },
    placement: {
      type: String,
      value: 'list'
    }
  },

  data: {
    view: normalizeCardEntry()
  },

  observers: {
    'entry, placement': function observeEntry(entry, placement) {
      this.setData({ view: normalizeCardEntry(entry, placement) });
    }
  },

  methods: {
    onDetailTap() {
      if (!this.data.view.id) return;
      this.triggerEvent('detail', {
        announcementId: this.data.view.id,
        entry: this.properties.entry
      });
    }
  }
});

module.exports = {
  TYPE_META,
  formatPublishDate,
  normalizeCardEntry
};
