'use strict';

const normalizeHighlights = (announcement = {}, explicitHighlights = []) => {
  const source = Array.isArray(explicitHighlights) && explicitHighlights.length
    ? explicitHighlights
    : (
      Array.isArray(announcement.popupHighlights)
        ? announcement.popupHighlights
        : (Array.isArray(announcement.highlights) ? announcement.highlights : [])
    );

  return source.slice(0, 4).map((item, index) => {
    if (typeof item === 'string') {
      return { title: item, description: '', icon: String(index + 1) };
    }
    const safeItem = item && typeof item === 'object' ? item : {};
    return {
      title: String(safeItem.title || ''),
      description: String(safeItem.description || safeItem.summary || ''),
      icon: String(safeItem.icon || index + 1)
    };
  }).filter((item) => item.title);
};

const normalizePopup = (announcement = {}, highlights = []) => ({
  id: String(announcement._id || announcement.id || ''),
  eyebrow: String(announcement.popupLabel || '啃词更新啦'),
  title: String(announcement.popupTitle || announcement.title || ''),
  summary: String(announcement.popupSummary || announcement.summary || ''),
  highlights: normalizeHighlights(announcement, highlights)
});

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    announcement: {
      type: Object,
      value: {}
    },
    highlights: {
      type: Array,
      value: []
    }
  },

  data: {
    view: normalizePopup()
  },

  observers: {
    'announcement, highlights': function observeAnnouncement(announcement, highlights) {
      this.setData({ view: normalizePopup(announcement, highlights) });
    }
  },

  methods: {
    stopPropagation() {},

    onDetailTap() {
      if (!this.data.view.id) return;
      this.triggerEvent('detail', { announcementId: this.data.view.id });
    },

    onAcknowledgeTap() {
      if (!this.data.view.id) return;
      this.triggerEvent('acknowledge', { announcementId: this.data.view.id });
    }
  }
});

module.exports = {
  normalizeHighlights,
  normalizePopup
};
