'use strict';

const { MASTERY_STATUSES, RECORD_KINDS } = require('./record-export-contract.js');

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

const buildOriginalRecordChoices = (displayRecord) => {
  const originals = displayRecord && Array.isArray(displayRecord.originalRecords)
    ? displayRecord.originalRecords
    : [displayRecord];
  return originals.filter(Boolean).map((record, index) => {
    const completedAt = record.completedAt || record.studyDate || record.timestamp || record.learningDate || record.date;
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

module.exports = {
  EXPORT_FORMATS,
  EXPORT_SCOPES,
  buildOriginalRecordChoices,
  buildRecordExportFilename,
  createExportError,
  filterWordsForExport,
  formatShanghaiDate,
  formatShanghaiTime,
  getOriginalRecordId,
  sanitizeFilenamePart
};
