'use strict';

const RECORD_SCHEMA_VERSION = 1;

const RECORD_KINDS = Object.freeze({
  LEARNING: 'learning',
  ANTI_FORGETTING_REVIEW: 'anti_forgetting_review'
});

const COMPATIBILITY_LEVELS = Object.freeze({
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D'
});

const EXPORT_ELIGIBILITY = Object.freeze({
  READY: 'ready',
  REQUIRES_HISTORICAL_VERSION: 'requires_historical_version',
  PARTIAL_ONLY: 'partial_only',
  BLOCKED: 'blocked'
});

const MASTERY_STATUSES = Object.freeze({
  MASTERED: 'mastered',
  NOT_MASTERED: 'notMastered'
});

const WORDBOOK_SOURCE_TYPES = Object.freeze({
  OFFICIAL: 'official',
  TEACHER_CUSTOM: 'teacher_custom'
});

const EXPORT_RESOLUTION_STATES = Object.freeze({
  COMPLETE: 'complete',
  PARTIAL: 'partial',
  BLOCKED: 'blocked',
  HISTORICAL_VERSION_REQUIRED: 'historical_version_required',
  HISTORICAL_VERSION_UNAVAILABLE: 'historical_version_unavailable'
});

const DISPLAY_VALUE_SOURCES = Object.freeze({
  HISTORICAL_SNAPSHOT: 'historical_snapshot',
  RECORD_FIELD: 'record_field',
  CURRENT_STUDENT_DISPLAY: 'current_student_display',
  MISSING: 'missing'
});

const normalizeText = (value) => String(value === undefined || value === null ? '' : value).trim();

const normalizePositiveVersion = (value) => {
  const version = Number(value);
  return Number.isInteger(version) && version > 0 ? version : null;
};

const normalizeCompletedAt = (value) => {
  const timestamp = typeof value === 'number' && Number.isFinite(value)
    ? value
    : (value instanceof Date ? value.getTime() : Date.parse(value));
  return Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp).toISOString() : '';
};

const normalizeRecordKind = (record = {}) => (
  record.recordKind === RECORD_KINDS.ANTI_FORGETTING_REVIEW ||
  record.recordType === RECORD_KINDS.ANTI_FORGETTING_REVIEW ||
  record.isAntiForgettingReview === true
    ? RECORD_KINDS.ANTI_FORGETTING_REVIEW
    : RECORD_KINDS.LEARNING
);

const normalizeMasteryStatus = (value, recordKind) => {
  if (recordKind === RECORD_KINDS.ANTI_FORGETTING_REVIEW) {
    return null;
  }

  const normalized = normalizeText(value).toLowerCase().replace(/[\s_-]/g, '');
  if (normalized === 'mastered') return MASTERY_STATUSES.MASTERED;
  if (normalized === 'notmastered' || normalized === 'unmastered' || normalized === 'difficult') {
    return MASTERY_STATUSES.NOT_MASTERED;
  }
  return null;
};

const buildExplicitStatusMap = (record = {}) => {
  const statusMap = Object.create(null);
  const assign = (values, status) => {
    (Array.isArray(values) ? values : []).forEach((value) => {
      const wordId = normalizeText(value && typeof value === 'object'
        ? (value.wordId || value.sourceWordId || value.id)
        : value);
      if (wordId) statusMap[wordId] = status;
    });
  };

  assign(record.masteredWordIds, MASTERY_STATUSES.MASTERED);
  assign(record.notMasteredWordIds, MASTERY_STATUSES.NOT_MASTERED);
  return statusMap;
};

const normalizeWordSnapshot = (rawWord, recordKind, explicitStatusMap = {}) => {
  const source = rawWord && typeof rawWord === 'object' ? rawWord : {};
  const wordId = normalizeText(source.wordId || source.sourceWordId || source.id);
  const explicitStatus = wordId ? explicitStatusMap[wordId] : null;

  return {
    wordId,
    word: normalizeText(source.word),
    meaning: normalizeText(source.meaning || source.translation),
    phonetic: normalizeText(source.phonetic),
    masteryStatus: normalizeMasteryStatus(source.masteryStatus || explicitStatus, recordKind)
  };
};

const freezeSnapshotFields = (fields) => {
  fields.wordsSnapshot.forEach(Object.freeze);
  Object.freeze(fields.wordsSnapshot);
  Object.freeze(fields.studentSnapshot);
  Object.freeze(fields.wordbookSnapshot);
  return Object.freeze(fields);
};

const buildRecordSnapshotFields = ({
  recordKind,
  completedAt,
  student,
  wordbook,
  words
} = {}) => {
  const normalizedKind = normalizeRecordKind({ recordKind });
  const safeStudent = student && typeof student === 'object' ? student : {};
  const safeWordbook = wordbook && typeof wordbook === 'object' ? wordbook : {};
  const wordbookId = normalizeText(safeWordbook.id || safeWordbook.wordbookId);
  const sourceType = normalizeText(safeWordbook.sourceType);
  const rawVersion = safeWordbook.version !== undefined && safeWordbook.version !== null
    ? safeWordbook.version
    : safeWordbook.wordbookVersion;
  const normalizedWords = (Array.isArray(words) ? words : [])
    .map((word) => normalizeWordSnapshot(word, normalizedKind));

  return freezeSnapshotFields({
    recordSchemaVersion: RECORD_SCHEMA_VERSION,
    recordKind: normalizedKind,
    completedAt: normalizeCompletedAt(completedAt),
    studentSnapshot: {
      id: normalizeText(safeStudent.id || safeStudent.studentId || safeStudent.student_id),
      name: normalizeText(safeStudent.name || safeStudent.studentName || safeStudent.student_name)
    },
    wordbookSnapshot: {
      id: wordbookId,
      title: normalizeText(safeWordbook.title || safeWordbook.wordbookTitle || safeWordbook.wordbookName),
      sourceType,
      // teacher_custom 的数字发布版本是可证明历史证据；official 不借用目录默认值伪造版本。
      version: sourceType === WORDBOOK_SOURCE_TYPES.TEACHER_CUSTOM
        ? normalizePositiveVersion(rawVersion)
        : null
    },
    wordsSnapshot: normalizedWords
  });
};

const getRecordWordIds = (record = {}) => {
  const ids = [];
  const seen = new Set();
  const add = (value) => {
    const wordId = normalizeText(value && typeof value === 'object'
      ? (value.wordId || value.sourceWordId || value.id)
      : value);
    if (wordId && !seen.has(wordId)) {
      seen.add(wordId);
      ids.push(wordId);
    }
  };

  [
    'learnedWordIds',
    'studyWords',
    'masteredWordIds',
    'notMasteredWordIds',
    'wordIds',
    'wordsSnapshot',
    'studyWordsDetailed',
    'learnedWordsDetailed'
  ]
    .forEach((field) => (Array.isArray(record[field]) ? record[field] : []).forEach(add));
  return ids;
};

const getRecordWordTexts = (record = {}) => {
  const texts = [];
  const seen = new Set();
  ['learnedWordTexts', 'masteredWordTexts', 'notMasteredWordTexts', 'words']
    .forEach((field) => {
      (Array.isArray(record[field]) ? record[field] : []).forEach((value) => {
        const word = normalizeText(value && typeof value === 'object' ? value.word : value);
        if (word && !seen.has(word)) {
          seen.add(word);
          texts.push(word);
        }
      });
    });
  return texts;
};

const getDetailedWordSource = (record = {}) => {
  const candidates = [
    ['wordsSnapshot', record.wordsSnapshot],
    ['studyWordsDetailed', record.studyWordsDetailed],
    ['learnedWordsDetailed', record.learnedWordsDetailed]
  ];
  return candidates.find(([, values]) => Array.isArray(values) && values.length > 0) || ['', []];
};

const buildNormalizedSnapshotFromRecord = (record = {}) => {
  const recordKind = normalizeRecordKind(record);
  const [detailedSource, detailedWords] = getDetailedWordSource(record);
  const explicitStatusMap = buildExplicitStatusMap(record);
  let wordsSnapshot = detailedWords.map((word) => (
    normalizeWordSnapshot(word, recordKind, explicitStatusMap)
  ));

  if (wordsSnapshot.length === 0) {
    const wordIds = getRecordWordIds(record);
    const wordTexts = getRecordWordTexts(record);
    wordsSnapshot = wordIds.map((wordId) => normalizeWordSnapshot({
      wordId,
      masteryStatus: explicitStatusMap[wordId]
    }, recordKind, explicitStatusMap));
    if (wordsSnapshot.length === 0) {
      wordsSnapshot = wordTexts.map((word) => normalizeWordSnapshot({ word }, recordKind));
    }
  }

  const existingStudentSnapshot = record.studentSnapshot && typeof record.studentSnapshot === 'object'
    ? record.studentSnapshot
    : {};
  const existingWordbookSnapshot = record.wordbookSnapshot && typeof record.wordbookSnapshot === 'object'
    ? record.wordbookSnapshot
    : {};
  const completedAt = record.completedAt || record.studyDate || record.timestamp || record.learningDate || record.date;
  const snapshotFields = buildRecordSnapshotFields({
    recordKind,
    completedAt,
    student: {
      id: existingStudentSnapshot.id || record.studentId || record.student_id || record.userId,
      name: existingStudentSnapshot.name || record.studentName || record.student_name
    },
    wordbook: {
      id: existingWordbookSnapshot.id || record.wordbookId || record.wordbook_id,
      title: existingWordbookSnapshot.title || record.wordbookTitle || record.wordbookName,
      sourceType: existingWordbookSnapshot.sourceType || record.sourceType || record.wordbookSourceType,
      version: existingWordbookSnapshot.version || record.wordbookVersion
    },
    words: wordsSnapshot
  });

  return { detailedSource, snapshotFields };
};

const assessRecordCompatibility = (record = {}) => {
  const recordKind = normalizeRecordKind(record);
  const { detailedSource, snapshotFields } = buildNormalizedSnapshotFromRecord(record);
  const words = snapshotFields.wordsSnapshot;
  const hasCompleteContent = words.length > 0 && words.every((word) => (
    !!word.wordId && !!word.word && !!word.meaning
  ));
  const hasCompleteLearningStatuses = recordKind === RECORD_KINDS.ANTI_FORGETTING_REVIEW ||
    words.every((word) => (
      word.masteryStatus === MASTERY_STATUSES.MASTERED ||
      word.masteryStatus === MASTERY_STATUSES.NOT_MASTERED
    ));
  const hasFullSnapshotSource = detailedSource === 'wordsSnapshot' || detailedSource === 'studyWordsDetailed';
  const wordIds = getRecordWordIds(record);
  const wordTexts = getRecordWordTexts(record);
  const version = snapshotFields.wordbookSnapshot.version;

  let level = COMPATIBILITY_LEVELS.D;
  let eligibility = EXPORT_ELIGIBILITY.BLOCKED;
  let reason = 'missing_word_data';

  if (hasFullSnapshotSource && hasCompleteContent && hasCompleteLearningStatuses) {
    level = COMPATIBILITY_LEVELS.A;
    eligibility = EXPORT_ELIGIBILITY.READY;
    reason = 'complete_record_snapshot';
  } else if (
    snapshotFields.wordbookSnapshot.sourceType === WORDBOOK_SOURCE_TYPES.TEACHER_CUSTOM
    && version
    && wordIds.length > 0
  ) {
    level = COMPATIBILITY_LEVELS.B;
    eligibility = EXPORT_ELIGIBILITY.REQUIRES_HISTORICAL_VERSION;
    reason = 'versioned_word_ids';
  } else if (words.length > 0 || wordIds.length > 0 || wordTexts.length > 0) {
    level = COMPATIBILITY_LEVELS.C;
    eligibility = EXPORT_ELIGIBILITY.PARTIAL_ONLY;
    reason = 'partial_record_word_evidence';
  }

  return Object.freeze({
    level,
    eligibility,
    reason,
    historicallyAccurate: level === COMPATIBILITY_LEVELS.A,
    canGenerateCompleteExport: level === COMPATIBILITY_LEVELS.A,
    canGeneratePartialExport: level === COMPATIBILITY_LEVELS.A || level === COMPATIBILITY_LEVELS.C,
    requiresHistoricalVersionResolution: level === COMPATIBILITY_LEVELS.B
  });
};

const normalizeRecordForExport = (record = {}) => {
  const recordId = normalizeText(record.id || record.recordId || record._id);
  const compatibility = assessRecordCompatibility(record);
  const { snapshotFields } = buildNormalizedSnapshotFromRecord(record);

  return Object.freeze({
    recordId,
    recordKind: snapshotFields.recordKind,
    compatibility,
    snapshot: snapshotFields,
    readyForCompleteExport: !!recordId && !!snapshotFields.completedAt && compatibility.canGenerateCompleteExport
  });
};

const resolveDisplayMetadata = (record = {}, currentStudent = null) => {
  const studentSnapshot = record.studentSnapshot && typeof record.studentSnapshot === 'object'
    ? record.studentSnapshot
    : {};
  const wordbookSnapshot = record.wordbookSnapshot && typeof record.wordbookSnapshot === 'object'
    ? record.wordbookSnapshot
    : {};
  const historicalStudentName = normalizeText(studentSnapshot.name);
  const recordStudentName = normalizeText(record.studentName || record.student_name);
  const currentStudentName = normalizeText(currentStudent && (
    currentStudent.name || currentStudent.studentName || currentStudent.student_name
  ));
  const historicalWordbookTitle = normalizeText(wordbookSnapshot.title);
  const recordWordbookTitle = normalizeText(record.wordbookTitle || record.wordbookName);

  const studentName = historicalStudentName
    ? {
        value: historicalStudentName,
        source: DISPLAY_VALUE_SOURCES.HISTORICAL_SNAPSHOT,
        isHistoricalSnapshot: true
      }
    : (recordStudentName
        ? {
            value: recordStudentName,
            source: DISPLAY_VALUE_SOURCES.RECORD_FIELD,
            isHistoricalSnapshot: false
          }
        : (currentStudentName
            ? {
                value: currentStudentName,
                source: DISPLAY_VALUE_SOURCES.CURRENT_STUDENT_DISPLAY,
                isHistoricalSnapshot: false
              }
            : {
                value: '',
                source: DISPLAY_VALUE_SOURCES.MISSING,
                isHistoricalSnapshot: false
              }));
  const wordbookTitle = historicalWordbookTitle
    ? {
        value: historicalWordbookTitle,
        source: DISPLAY_VALUE_SOURCES.HISTORICAL_SNAPSHOT,
        isHistoricalSnapshot: true
      }
    : (recordWordbookTitle
        ? {
            value: recordWordbookTitle,
            source: DISPLAY_VALUE_SOURCES.RECORD_FIELD,
            isHistoricalSnapshot: false
          }
        : {
            value: '',
            source: DISPLAY_VALUE_SOURCES.MISSING,
            isHistoricalSnapshot: false
          });

  return Object.freeze({
    studentName: Object.freeze(studentName),
    wordbookTitle: Object.freeze(wordbookTitle)
  });
};

const collectSnapshotMissingFields = (recordId, snapshot) => {
  const missing = [];
  if (!normalizeText(recordId)) missing.push('recordId');
  if (!snapshot.completedAt) missing.push('completedAt');
  if (!snapshot.studentSnapshot.id) missing.push('studentSnapshot.id');
  if (!snapshot.wordbookSnapshot.id) missing.push('wordbookSnapshot.id');
  if (snapshot.wordsSnapshot.length === 0) missing.push('wordsSnapshot');

  snapshot.wordsSnapshot.forEach((word, index) => {
    if (!word.wordId) missing.push(`wordsSnapshot[${index}].wordId`);
    if (!word.word) missing.push(`wordsSnapshot[${index}].word`);
    if (!word.meaning) missing.push(`wordsSnapshot[${index}].meaning`);
    if (
      snapshot.recordKind === RECORD_KINDS.LEARNING
      && word.masteryStatus !== MASTERY_STATUSES.MASTERED
      && word.masteryStatus !== MASTERY_STATUSES.NOT_MASTERED
    ) {
      missing.push(`wordsSnapshot[${index}].masteryStatus`);
    }
  });
  return missing;
};

const buildResolvedExportResult = ({
  normalizedRecord,
  record,
  snapshot,
  state,
  currentStudent,
  historicalVersionAccessed = false,
  resolutionError = ''
}) => {
  const missingFields = collectSnapshotMissingFields(normalizedRecord.recordId, snapshot);
  const complete = state === EXPORT_RESOLUTION_STATES.COMPLETE && missingFields.length === 0;
  const finalState = complete
    ? EXPORT_RESOLUTION_STATES.COMPLETE
    : (state === EXPORT_RESOLUTION_STATES.COMPLETE ? EXPORT_RESOLUTION_STATES.PARTIAL : state);
  const userMessage = finalState === EXPORT_RESOLUTION_STATES.BLOCKED
    ? '该历史记录缺少完整词条数据'
    : '';

  return Object.freeze({
    recordId: normalizedRecord.recordId,
    recordKind: snapshot.recordKind,
    compatibility: normalizedRecord.compatibility,
    state: finalState,
    snapshot,
    display: resolveDisplayMetadata(record, currentStudent),
    missingFields: Object.freeze(missingFields),
    canGenerateCompleteExport: finalState === EXPORT_RESOLUTION_STATES.COMPLETE,
    canGeneratePartialExport: finalState === EXPORT_RESOLUTION_STATES.COMPLETE
      || finalState === EXPORT_RESOLUTION_STATES.PARTIAL,
    historicalVersionAccessed,
    resolutionError: normalizeText(resolutionError),
    userMessage
  });
};

const getDefaultHistoricalWordbookLoader = () => {
  try {
    const loader = require('./teacher-custom-wordbook-loader.js');
    return loader && loader.loadTeacherCustomWordbookVersion;
  } catch (error) {
    return null;
  }
};

const resolveRecordExportSnapshot = async (record = {}, options = {}) => {
  const normalizedRecord = normalizeRecordForExport(record);
  const level = normalizedRecord.compatibility.level;
  const baseResult = {
    normalizedRecord,
    record,
    snapshot: normalizedRecord.snapshot,
    currentStudent: options.currentStudent
  };

  if (level === COMPATIBILITY_LEVELS.A) {
    return buildResolvedExportResult({
      ...baseResult,
      state: EXPORT_RESOLUTION_STATES.COMPLETE
    });
  }

  if (level === COMPATIBILITY_LEVELS.C) {
    return buildResolvedExportResult({
      ...baseResult,
      state: EXPORT_RESOLUTION_STATES.PARTIAL
    });
  }

  if (level === COMPATIBILITY_LEVELS.D) {
    return buildResolvedExportResult({
      ...baseResult,
      state: EXPORT_RESOLUTION_STATES.BLOCKED
    });
  }

  const sourceWordbook = normalizedRecord.snapshot.wordbookSnapshot;
  const wordIds = getRecordWordIds(record);
  const loadHistoricalWordbook = options.loadHistoricalWordbook
    || getDefaultHistoricalWordbookLoader();
  if (typeof loadHistoricalWordbook !== 'function') {
    return buildResolvedExportResult({
      ...baseResult,
      state: EXPORT_RESOLUTION_STATES.HISTORICAL_VERSION_REQUIRED,
      resolutionError: 'HISTORICAL_VERSION_LOADER_REQUIRED'
    });
  }

  try {
    const loadedBook = await loadHistoricalWordbook({
      id: sourceWordbook.id,
      wordbookId: sourceWordbook.id,
      title: sourceWordbook.title,
      sourceType: WORDBOOK_SOURCE_TYPES.TEACHER_CUSTOM,
      version: sourceWordbook.version
    });
    const loadedWordbookId = normalizeText(loadedBook && (loadedBook.wordbookId || loadedBook.id));
    const loadedVersion = normalizePositiveVersion(loadedBook && loadedBook.version);
    const loadedSourceType = normalizeText(loadedBook && loadedBook.sourceType);
    if (
      loadedWordbookId !== sourceWordbook.id
      || loadedVersion !== sourceWordbook.version
      || loadedSourceType !== WORDBOOK_SOURCE_TYPES.TEACHER_CUSTOM
    ) {
      throw createContractError('HISTORICAL_VERSION_MISMATCH');
    }

    const loadedWords = Array.isArray(loadedBook.words) ? loadedBook.words : [];
    const loadedWordMap = new Map();
    loadedWords.forEach((word) => {
      const wordId = normalizeText(word && (word.wordId || word.sourceWordId || word.id));
      if (wordId && !loadedWordMap.has(wordId)) loadedWordMap.set(wordId, word);
    });
    const explicitStatusMap = buildExplicitStatusMap(record);
    const recoveredWords = wordIds.map((wordId) => {
      const historicalWord = loadedWordMap.get(wordId);
      return normalizeWordSnapshot(
        historicalWord ? { ...historicalWord, wordId } : { wordId },
        normalizedRecord.recordKind,
        explicitStatusMap
      );
    });
    const recoveredSnapshot = buildRecordSnapshotFields({
      recordKind: normalizedRecord.recordKind,
      completedAt: normalizedRecord.snapshot.completedAt,
      student: normalizedRecord.snapshot.studentSnapshot,
      wordbook: sourceWordbook,
      words: recoveredWords
    });

    return buildResolvedExportResult({
      ...baseResult,
      snapshot: recoveredSnapshot,
      state: EXPORT_RESOLUTION_STATES.COMPLETE,
      historicalVersionAccessed: true
    });
  } catch (error) {
    return buildResolvedExportResult({
      ...baseResult,
      state: EXPORT_RESOLUTION_STATES.HISTORICAL_VERSION_UNAVAILABLE,
      historicalVersionAccessed: true,
      resolutionError: error && (error.code || error.message)
        ? (error.code || error.message)
        : 'HISTORICAL_VERSION_UNAVAILABLE'
    });
  }
};

const collectOriginalRecords = (records = []) => {
  const originals = [];
  (Array.isArray(records) ? records : []).forEach((record) => {
    if (!record || typeof record !== 'object') return;
    if (Array.isArray(record.originalRecords)) {
      originals.push(...collectOriginalRecords(record.originalRecords));
      return;
    }
    originals.push(record);
  });
  return originals;
};

const createContractError = (code) => {
  const error = new Error(code);
  error.code = code;
  return error;
};

const resolveRecordForExport = (recordId, records = []) => {
  return normalizeRecordForExport(findOriginalRecordById(recordId, records));
};

const findOriginalRecordById = (recordId, records = []) => {
  const targetId = normalizeText(recordId);
  if (!targetId) throw createContractError('RECORD_ID_REQUIRED');

  const matches = collectOriginalRecords(records).filter((record) => (
    normalizeText(record.id || record.recordId || record._id) === targetId
  ));
  if (matches.length === 0) throw createContractError('RECORD_NOT_FOUND');
  if (matches.length > 1) {
    throw createContractError('DUPLICATE_RECORD_ID');
  }
  return matches[0];
};

module.exports = {
  COMPATIBILITY_LEVELS,
  DISPLAY_VALUE_SOURCES,
  EXPORT_ELIGIBILITY,
  EXPORT_RESOLUTION_STATES,
  MASTERY_STATUSES,
  RECORD_KINDS,
  RECORD_SCHEMA_VERSION,
  WORDBOOK_SOURCE_TYPES,
  assessRecordCompatibility,
  buildRecordSnapshotFields,
  collectOriginalRecords,
  findOriginalRecordById,
  normalizeRecordForExport,
  resolveDisplayMetadata,
  resolveRecordExportSnapshot,
  resolveRecordForExport
};
