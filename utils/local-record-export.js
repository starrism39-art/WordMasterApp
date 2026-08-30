'use strict';

const {
  COMPATIBILITY_LEVELS,
  MASTERY_STATUSES,
  RECORD_KINDS,
  normalizeRecordForExport
} = require('./record-export-contract.js');

const EXPORT_SCOPES = Object.freeze({
  ALL: 'all',
  MASTERED: 'mastered',
  NOT_MASTERED: 'notMastered'
});

const EXPORT_FORMATS = Object.freeze({
  PDF: 'pdf',
  XLSX: 'xlsx'
});

const normalizeText = (value) => String(value === undefined || value === null ? '' : value).trim();

const toShanghaiParts = (value) => {
  const timestamp = typeof value === 'number' && Number.isFinite(value)
    ? value
    : Date.parse(value);
  const safeTimestamp = Number.isFinite(timestamp) ? timestamp : Date.now();
  const date = new Date(safeTimestamp + (8 * 60 * 60 * 1000));
  return {
    year: date.getUTCFullYear(),
    month: String(date.getUTCMonth() + 1).padStart(2, '0'),
    day: String(date.getUTCDate()).padStart(2, '0'),
    hour: String(date.getUTCHours()).padStart(2, '0'),
    minute: String(date.getUTCMinutes()).padStart(2, '0')
  };
};

const formatShanghaiDate = (value) => {
  const parts = toShanghaiParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const formatShanghaiTime = (value) => {
  const parts = toShanghaiParts(value);
  return `${parts.hour}:${parts.minute}`;
};

const createExportError = (code, userMessage) => {
  const error = new Error(code);
  error.code = code;
  error.userMessage = userMessage || '';
  return error;
};

const filterWordsForExport = (snapshot, scope = EXPORT_SCOPES.ALL) => {
  const safeSnapshot = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const words = Array.isArray(safeSnapshot.wordsSnapshot) ? safeSnapshot.wordsSnapshot : [];
  const recordKind = safeSnapshot.recordKind || RECORD_KINDS.LEARNING;

  if (recordKind === RECORD_KINDS.ANTI_FORGETTING_REVIEW && scope !== EXPORT_SCOPES.ALL) {
    throw createExportError('ANTI_FORGETTING_SCOPE_MUST_BE_ALL', '抗遗忘复习记录只能导出全部单词');
  }
  if (scope === EXPORT_SCOPES.ALL) return words.slice();
  if (scope === EXPORT_SCOPES.MASTERED) {
    return words.filter((word) => word && word.masteryStatus === MASTERY_STATUSES.MASTERED);
  }
  if (scope === EXPORT_SCOPES.NOT_MASTERED) {
    return words.filter((word) => word && word.masteryStatus === MASTERY_STATUSES.NOT_MASTERED);
  }
  throw createExportError('UNSUPPORTED_EXPORT_SCOPE', '不支持的导出范围');
};

const sanitizeFilenamePart = (value, fallback = '未命名') => {
  const sanitized = normalizeText(value)
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/_+/g, '_')
    .replace(/[_ .]+$/g, '')
    .slice(0, 40)
    .trim();
  return sanitized || fallback;
};

const buildRecordExportFilename = ({
  studentName,
  wordbookTitle,
  recordKind,
  scope = EXPORT_SCOPES.ALL,
  completedAt,
  extension
} = {}) => {
  const normalizedExtension = normalizeText(extension).toLowerCase().replace(/^\./, '');
  if (normalizedExtension !== EXPORT_FORMATS.PDF && normalizedExtension !== EXPORT_FORMATS.XLSX) {
    throw createExportError('UNSUPPORTED_EXPORT_FORMAT', '不支持的导出格式');
  }

  const parts = [
    sanitizeFilenamePart(studentName, '学生'),
    sanitizeFilenamePart(wordbookTitle, '词书'),
    recordKind === RECORD_KINDS.ANTI_FORGETTING_REVIEW ? '抗遗忘复习记录' : '学习记录'
  ];
  if (recordKind !== RECORD_KINDS.ANTI_FORGETTING_REVIEW && scope !== EXPORT_SCOPES.ALL) {
    parts.push(scope === EXPORT_SCOPES.MASTERED ? '已掌握' : '未掌握');
  }
  parts.push(formatShanghaiDate(completedAt));

  const suffix = `.${normalizedExtension}`;
  const filename = parts.join('_').slice(0, 116 - suffix.length).replace(/[. ]+$/g, '');
  return `${filename}${suffix}`;
};

const getOriginalRecordId = (record) => {
  if (!record || typeof record !== 'object' || record.hasStableRecordId === false) return '';
  return normalizeText(record.originalRecordId || record.id || record.recordId || record._id);
};

const getRecordCompletedAt = (record = {}) => (
  record.completedAt || record.studyDate || record.timestamp || record.learningDate || record.date
);

const getExportWordIdentity = (word) => {
  const safeWord = word && typeof word === 'object' ? word : {};
  const wordId = normalizeText(safeWord.wordId || safeWord.sourceWordId || safeWord.id);
  if (wordId) return Object.freeze({ key: `id:${wordId}`, source: 'wordId' });

  const wordText = normalizeText(safeWord.word);
  if (wordText) {
    return Object.freeze({ key: `word:${wordText.toLowerCase()}`, source: 'word' });
  }
  return Object.freeze({ key: '', source: 'missing' });
};

// snapshots 必须按原始记录时间从旧到新传入；Map 只保留一个身份，后写入的快照自然胜出。
const mergeWordSnapshotsForExport = (snapshots = []) => {
  const wordsByIdentity = new Map();
  let usedFallbackWordText = false;
  let missingIdentityCount = 0;

  (Array.isArray(snapshots) ? snapshots : []).forEach((snapshot) => {
    const words = snapshot && Array.isArray(snapshot.wordsSnapshot)
      ? snapshot.wordsSnapshot
      : [];
    words.forEach((word) => {
      const identity = getExportWordIdentity(word);
      if (!identity.key) {
        missingIdentityCount += 1;
        return;
      }
      if (identity.source === 'word') usedFallbackWordText = true;
      wordsByIdentity.set(identity.key, Object.freeze({ ...word }));
    });
  });

  return Object.freeze({
    wordsSnapshot: Object.freeze(Array.from(wordsByIdentity.values())),
    usedFallbackWordText,
    missingIdentityCount
  });
};

const buildOriginalRecordChoices = (displayRecord) => {
  const originals = displayRecord && Array.isArray(displayRecord.originalRecords)
    ? displayRecord.originalRecords
    : [displayRecord];
  return originals.filter(Boolean).map((record, index) => {
    const completedAt = getRecordCompletedAt(record);
    const words = Array.isArray(record.wordsSnapshot)
      ? record.wordsSnapshot
      : (Array.isArray(record.studyWordsDetailed) ? record.studyWordsDetailed : []);
    const totalWords = Math.max(0, Number(record.totalWords || record.wordCount || words.length || 0) || 0);
    const recordId = getOriginalRecordId(record);
    return Object.freeze({
      recordId,
      stable: !!recordId,
      label: `第${index + 1}次 · ${formatShanghaiTime(completedAt)} · ${totalWords}词`,
      timeLabel: formatShanghaiTime(completedAt),
      totalWords
    });
  });
};

const buildMergedRecordExportChoice = (displayRecord) => {
  const originals = displayRecord && Array.isArray(displayRecord.originalRecords)
    ? displayRecord.originalRecords.filter(Boolean)
    : [];
  if (originals.length <= 1) return null;

  const normalizedRecords = originals.map((record) => normalizeRecordForExport(record));
  const recordIds = originals.map(getOriginalRecordId);
  const mergedWords = mergeWordSnapshotsForExport(
    normalizedRecords.map((record) => record.snapshot)
  );
  const hasBlockedRecord = normalizedRecords.some((record) => (
    record.compatibility.level === COMPATIBILITY_LEVELS.D
  ));
  const hasStableRecordIds = recordIds.every(Boolean);
  const available = hasStableRecordIds
    && !hasBlockedRecord
    && mergedWords.missingIdentityCount === 0
    && mergedWords.wordsSnapshot.length > 0;
  const userMessage = !hasStableRecordIds
    ? '该合并历史记录缺少稳定 recordId，无法整体导出'
    : (hasBlockedRecord || mergedWords.missingIdentityCount > 0
        ? '该合并历史记录含无法可靠识别的词条，无法整体导出，请逐次导出'
        : '');

  return Object.freeze({
    recordIds: Object.freeze(recordIds.slice()),
    recordCount: originals.length,
    totalWords: mergedWords.wordsSnapshot.length,
    available,
    usedFallbackWordText: mergedWords.usedFallbackWordText,
    userMessage,
    label: available
      ? `全部导出 · ${originals.length}次 · 共${mergedWords.wordsSnapshot.length}词`
      : `全部导出 · ${originals.length}次 · 无法可靠去重`
  });
};

module.exports = {
  EXPORT_FORMATS,
  EXPORT_SCOPES,
  buildMergedRecordExportChoice,
  buildOriginalRecordChoices,
  buildRecordExportFilename,
  createExportError,
  filterWordsForExport,
  formatShanghaiDate,
  formatShanghaiTime,
  getExportWordIdentity,
  getOriginalRecordId,
  getRecordCompletedAt,
  mergeWordSnapshotsForExport,
  sanitizeFilenamePart
};
