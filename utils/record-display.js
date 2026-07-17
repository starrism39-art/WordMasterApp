'use strict';

const WORD_BOOK_TONES = {
  senior_textbook_real: 'forest',
  gaokao_reading_words: 'amber'
};

const FALLBACK_TONES = ['forest', 'amber', 'ocean', 'slate'];

function normalizeWordbookTitle(title) {
  const normalized = String(title || '未知词书')
    .replace(/[（(]\s*抗遗忘复习\s*[）)]/g, '')
    .trim();
  return normalized || '未知词书';
}

function getWordbookTone(wordbookId, title) {
  const id = String(wordbookId || '').trim();
  if (WORD_BOOK_TONES[id]) return WORD_BOOK_TONES[id];

  const source = `${id}:${normalizeWordbookTitle(title)}`;
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0;
  }
  return FALLBACK_TONES[Math.abs(hash) % FALLBACK_TONES.length];
}

function prepareRecordForDisplay(record) {
  const source = record && typeof record === 'object' ? record : {};
  const sourceTitle = String(source.wordbookTitle || source.wordbookName || '');
  const isReview = source.recordCategory === 'anti' ||
    source.recordType === 'anti_forgetting_review' ||
    source.isAntiForgettingReview === true ||
    sourceTitle.includes('抗遗忘复习');
  const totalWords = Math.max(0, Number(source.totalWords || source.wordCount || 0) || 0);
  const masteredCount = Math.max(0, Number(source.masteredCount || 0) || 0);
  const notMasteredCount = Math.max(0, Number(source.notMasteredCount || 0) || 0);
  const masteryTotal = masteredCount + notMasteredCount;
  const recordCount = Math.max(1, Number(source.recordCount || 1) || 1);
  const displayWordbookTitle = normalizeWordbookTitle(sourceTitle);

  return Object.assign({}, source, {
    recordCategory: isReview ? 'anti' : 'word',
    displayWordbookTitle,
    wordbookTone: getWordbookTone(source.wordbookId, displayWordbookTitle),
    recordTypeLabel: isReview ? '复习记录' : '学习记录',
    totalWords,
    masteredCount,
    notMasteredCount,
    masteredPercentage: masteryTotal > 0 ? Math.round(masteredCount / masteryTotal * 100) : 0,
    notMasteredPercentage: masteryTotal > 0 ? Math.round(notMasteredCount / masteryTotal * 100) : 0,
    recordCount,
    recordCountLabel: recordCount > 1
      ? `当日 ${recordCount} 次${isReview ? '复习' : '学习'}已合并`
      : `单次${isReview ? '复习' : '学习'}`,
    totalLabel: isReview ? '复习词汇' : '本日学习'
  });
}

function createWordbookOptions(records) {
  const books = new Map();
  (Array.isArray(records) ? records : []).forEach((record) => {
    if (!record || typeof record !== 'object') return;
    const id = String(record.wordbookId || record.displayWordbookTitle || record.wordbookTitle || 'unknown_wordbook');
    const title = normalizeWordbookTitle(record.displayWordbookTitle || record.wordbookTitle);
    const existing = books.get(id) || {
      id,
      title,
      shortTitle: getShortWordbookTitle(title),
      tone: getWordbookTone(record.wordbookId, title),
      recordCount: 0
    };
    existing.recordCount += 1;
    books.set(id, existing);
  });

  return [{
    id: 'all',
    title: '全部词书',
    shortTitle: '全部词书',
    tone: 'all',
    recordCount: Array.isArray(records) ? records.length : 0
  }].concat(Array.from(books.values()).sort((left, right) => left.title.localeCompare(right.title, 'zh-CN')));
}

function getShortWordbookTitle(title) {
  return normalizeWordbookTitle(title)
    .replace(/英语词书$/, '')
    .replace(/英语阅读高频词汇$/, '阅读高频词汇')
    .replace(/英语$/, '')
    .trim();
}

module.exports = {
  createWordbookOptions,
  getWordbookTone,
  normalizeWordbookTitle,
  prepareRecordForDisplay
};
