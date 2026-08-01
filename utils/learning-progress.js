'use strict';

const PROGRESS_CALCULATION_VERSION = 2;

const isPlainObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value)
);

const toCount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};

const toBoolean = (value) => {
  if (value === true || value === 1 || value === '1') return true;
  if (value === false || value === 0 || value === '0') return false;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return null;
};

const normalizeStatus = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z]/g, '');

const getRecordState = (record) => {
  if (!isPlainObject(record)) {
    if (record === true) return { mastered: true, difficult: false };
    if (record === false) return { mastered: false, difficult: true };
    const status = normalizeStatus(record);
    return {
      mastered: status === 'mastered',
      difficult: status === 'difficult' || status === 'notmastered' || status === 'unmastered'
    };
  }

  const status = normalizeStatus(record.status || record.masteryStatus || record.legacyStatus);
  return {
    mastered: toBoolean(record.mastered) === true || status === 'mastered',
    difficult: toBoolean(record.difficult) === true ||
      status === 'difficult' || status === 'notmastered' || status === 'unmastered'
  };
};

const isActiveAntiForgettingRemediation = (record) => {
  if (!isPlainObject(record)) return false;
  const reviewCount = toCount(record.reviewCount);
  if (reviewCount >= 5) return false;

  const source = String(record.antiForgettingSource || record.anti_forgetting_source || '')
    .trim()
    .toLowerCase();
  return source === 'preview_not_mastered' || toBoolean(record.antiForgettingSeed) === true;
};

const normalizeWordId = (value) => {
  let candidate = value;
  if (isPlainObject(value)) {
    candidate = value.sourceWordId || value.id || value.word || '';
  }
  return String(candidate || '').trim().toLowerCase();
};

const getWordbookMasterySummary = (wordbookId, wordbookMastery) => {
  if (Array.isArray(wordbookMastery)) {
    const ids = new Set(wordbookMastery.map(normalizeWordId).filter(Boolean));
    return {
      entryCount: ids.size,
      learnedCount: ids.size,
      masteredCount: ids.size,
      unmasteredCount: 0
    };
  }

  if (!isPlainObject(wordbookMastery)) {
    return { entryCount: 0, learnedCount: 0, masteredCount: 0, unmasteredCount: 0 };
  }

  const entries = Object.keys(wordbookMastery)
    .filter((wordId) => wordbookMastery[wordId] !== undefined && wordbookMastery[wordId] !== null)
    .map((wordId) => ({ wordId, record: wordbookMastery[wordId] }));
  const prefix = wordbookId ? `${wordbookId}_` : '';
  const hasScopedIds = prefix && entries.some((item) => String(item.wordId).startsWith(prefix));
  const scopedEntries = entries.filter((item) => {
    if (!hasScopedIds) return true;
    if (String(item.wordId).startsWith(prefix)) return true;
    const recordBookId = isPlainObject(item.record)
      ? (item.record.wordbookId || item.record.wordbook_id)
      : '';
    return recordBookId && String(recordBookId) === String(wordbookId);
  });

  let learnedCount = 0;
  let masteredCount = 0;
  let unmasteredCount = 0;
  scopedEntries.forEach((item) => {
    const state = getRecordState(item.record);
    const needsRemediation = isActiveAntiForgettingRemediation(item.record);
    if (state.mastered || state.difficult) learnedCount += 1;
    if (state.mastered) masteredCount += 1;
    if (state.difficult || needsRemediation) unmasteredCount += 1;
  });

  return {
    entryCount: scopedEntries.length,
    learnedCount,
    masteredCount,
    unmasteredCount
  };
};

const getRecordLearnedWordIds = (learningRecords, studentId, wordbookId) => {
  const ids = new Set();
  const addValues = (values) => {
    if (!Array.isArray(values)) return;
    values.forEach((value) => {
      const normalized = normalizeWordId(value);
      if (normalized) ids.add(normalized);
    });
  };

  (Array.isArray(learningRecords) ? learningRecords : []).forEach((record) => {
    if (!isPlainObject(record)) return;
    if (String(record.studentId || record.userId || '') !== String(studentId || '')) return;
    if (String(record.wordbookId || '') !== String(wordbookId || '')) return;
    if (record.recordType === 'anti_forgetting_review' || record.isAntiForgettingReview === true) return;

    addValues(record.learnedWordIds);
    addValues(record.studyWords);
    addValues(record.studyWordsDetailed);
    addValues(record.masteredWordIds);
    addValues(record.notMasteredWordIds);
    addValues(record.difficultWordIds);
  });

  return ids;
};

let wordbooksModule = null;
let wordbooksModuleLoaded = false;

const resolveKnownWordbookTotal = (wordbookId) => {
  if (!wordbookId) return 0;
  if (!wordbooksModuleLoaded) {
    wordbooksModuleLoaded = true;
    try {
      wordbooksModule = require('../data/wordbooks.js');
    } catch (error) {
      wordbooksModule = null;
    }
  }

  try {
    const book = wordbooksModule && wordbooksModule.getBookById
      ? wordbooksModule.getBookById(wordbookId)
      : null;
    return toCount(book && book.totalWords);
  } catch (error) {
    return 0;
  }
};

const reconcileStudentLearningProgress = (options = {}) => {
  const studentId = String(options.studentId || '');
  const sourceProgress = isPlainObject(options.progressData) ? options.progressData : {};
  const sourceWordbooks = isPlainObject(sourceProgress.wordbooks) ? sourceProgress.wordbooks : {};
  const studentMastery = isPlainObject(options.studentMastery) ? options.studentMastery : {};
  const bookTotals = isPlainObject(options.bookTotals) ? options.bookTotals : {};
  const learningRecords = Array.isArray(options.learningRecords) ? options.learningRecords : [];
  const updatedBookId = String(options.updatedBookId || '');
  const lastStudyTime = options.lastStudyTime || '';

  const bookIds = new Set([
    ...Object.keys(sourceWordbooks),
    ...Object.keys(studentMastery),
    ...Object.keys(bookTotals)
  ]);
  learningRecords.forEach((record) => {
    if (!isPlainObject(record)) return;
    if (String(record.studentId || record.userId || '') !== studentId) return;
    if (record.wordbookId) bookIds.add(String(record.wordbookId));
  });
  if (updatedBookId) bookIds.add(updatedBookId);

  if (bookIds.size === 0) {
    return {
      ...sourceProgress,
      learnedWords: toCount(sourceProgress.learnedWords),
      totalWords: toCount(sourceProgress.totalWords),
      wordbooks: { ...sourceWordbooks }
    };
  }

  const nextWordbooks = {};
  let totalLearned = 0;
  let totalWords = 0;

  bookIds.forEach((bookId) => {
    const currentBook = isPlainObject(sourceWordbooks[bookId]) ? sourceWordbooks[bookId] : {};
    const currentCompleted = toCount(currentBook.completedCount || currentBook.learnedWords);
    const currentTotal = toCount(currentBook.totalCount);
    const masterySummary = getWordbookMasterySummary(bookId, studentMastery[bookId]);
    const recordWordIds = getRecordLearnedWordIds(learningRecords, studentId, bookId);

    let completedCount = currentCompleted;
    let progressSource = currentBook.progressSource || 'legacyProgress';
    if (masterySummary.entryCount > 0) {
      completedCount = masterySummary.learnedCount;
      progressSource = 'wordMastery';
    } else if (recordWordIds.size > 0) {
      completedCount = recordWordIds.size;
      progressSource = 'learningRecords';
    }

    const configuredTotal = Math.max(
      toCount(bookTotals[bookId]),
      resolveKnownWordbookTotal(bookId)
    );
    const knownTotal = configuredTotal > 0
      ? Math.max(configuredTotal, completedCount)
      : Math.max(currentTotal, completedCount);
    const nextBook = {
      ...currentBook,
      completedCount,
      learnedWords: completedCount,
      totalCount: knownTotal,
      progressSource,
      progressCalculationVersion: PROGRESS_CALCULATION_VERSION
    };

    if (currentCompleted > 0 && currentCompleted !== completedCount) {
      nextBook.legacyCompletedCount = Math.max(
        toCount(currentBook.legacyCompletedCount),
        currentCompleted
      );
    }
    if (currentTotal > 0 && currentTotal !== knownTotal) {
      nextBook.legacyTotalCount = Math.max(toCount(currentBook.legacyTotalCount), currentTotal);
    }
    if (bookId === updatedBookId && lastStudyTime) {
      nextBook.lastStudyTime = lastStudyTime;
      nextBook.lastStudied = lastStudyTime;
    }
    if (bookId === updatedBookId && options.updatedAt) {
      nextBook.updatedAt = options.updatedAt;
    }

    nextWordbooks[bookId] = nextBook;
    totalLearned += completedCount;
    totalWords += knownTotal;
  });

  const nextProgress = {
    ...sourceProgress,
    learnedWords: totalLearned,
    totalWords,
    wordbooks: nextWordbooks,
    progressSource: 'wordMastery+learningRecords',
    progressCalculationVersion: PROGRESS_CALCULATION_VERSION
  };
  const currentLearned = toCount(sourceProgress.learnedWords);
  const currentTotalWords = toCount(sourceProgress.totalWords);
  if (currentLearned > 0 && currentLearned !== totalLearned) {
    nextProgress.legacyLearnedWords = Math.max(
      toCount(sourceProgress.legacyLearnedWords),
      currentLearned
    );
  }
  if (currentTotalWords > 0 && currentTotalWords !== totalWords) {
    nextProgress.legacyTotalWords = Math.max(
      toCount(sourceProgress.legacyTotalWords),
      currentTotalWords
    );
  }
  if (options.updatedAt) {
    nextProgress.updatedAt = options.updatedAt;
  }

  return nextProgress;
};

const reconcileLearningProgressMap = (progressRoot, masteryRoot, learningRecords) => {
  const sourceProgress = isPlainObject(progressRoot) ? progressRoot : {};
  const sourceMastery = isPlainObject(masteryRoot) ? masteryRoot : {};
  const records = Array.isArray(learningRecords) ? learningRecords : [];
  const studentIds = new Set([...Object.keys(sourceProgress), ...Object.keys(sourceMastery)]);
  records.forEach((record) => {
    if (!isPlainObject(record)) return;
    const studentId = record.studentId || record.userId;
    if (studentId) studentIds.add(String(studentId));
  });

  const result = {};
  studentIds.forEach((studentId) => {
    result[studentId] = reconcileStudentLearningProgress({
      studentId,
      progressData: sourceProgress[studentId],
      studentMastery: sourceMastery[studentId],
      learningRecords: records
    });
  });
  return result;
};

module.exports = {
  PROGRESS_CALCULATION_VERSION,
  getWordbookMasterySummary,
  getRecordLearnedWordIds,
  resolveKnownWordbookTotal,
  reconcileStudentLearningProgress,
  reconcileLearningProgressMap
};
