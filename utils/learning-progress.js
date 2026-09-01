'use strict';

const PROGRESS_CALCULATION_VERSION = 2;
const { toTimestamp } = require('./sync-merge.js');

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

const resolveCurrentWordbookTotal = (currentTotal, storedTotal) => (
  toCount(currentTotal) || toCount(storedTotal)
);

const getProgressUpdatedTime = (progress) => {
  if (!isPlainObject(progress)) return 0;
  return Math.max(
    toTimestamp(progress.updatedAt),
    toTimestamp(progress.updated_at),
    toTimestamp(progress.lastUpdated),
    toTimestamp(progress.lastUpdatedAt),
    toTimestamp(progress.updateTime)
  );
};

const getProgressStudyTime = (progress) => {
  if (!isPlainObject(progress)) return 0;
  return Math.max(
    toTimestamp(progress.lastStudyTime),
    toTimestamp(progress.lastStudied)
  );
};

const getProgressVersionTime = (progress) => Math.max(
  getProgressUpdatedTime(progress),
  getProgressStudyTime(progress)
);

const mergePlainProgressMetadata = (olderValue, newerValue) => {
  const older = isPlainObject(olderValue) ? olderValue : {};
  const newer = isPlainObject(newerValue) ? newerValue : {};
  const result = { ...older };
  Object.keys(newer).forEach((key) => {
    const olderItem = result[key];
    const newerItem = newer[key];
    if (isPlainObject(olderItem) && isPlainObject(newerItem)) {
      result[key] = mergePlainProgressMetadata(olderItem, newerItem);
    } else if (newerItem !== undefined) {
      result[key] = newerItem;
    }
  });
  return result;
};

const selectLatestProgressValue = (currentValue, incomingValue) => {
  const currentTime = toTimestamp(currentValue);
  const incomingTime = toTimestamp(incomingValue);
  if (incomingTime > currentTime) return incomingValue;
  if (currentTime > 0) return currentValue;
  if (incomingValue !== undefined && incomingValue !== null && incomingValue !== '') {
    return incomingValue;
  }
  return currentValue;
};

const getBookCompletedCount = (bookProgress) => Math.max(
  toCount(bookProgress && bookProgress.completedCount),
  toCount(bookProgress && bookProgress.learnedWords)
);

/**
 * Merge one wordbook's derived progress cache without allowing a stale snapshot
 * to regress learned counts or recent activity. totalCount is not permanently
 * monotonic: current catalog metadata wins when supplied; otherwise the newer
 * wordbook snapshot wins and the existing positive value is the safe fallback.
 */
const mergeLearningProgressBook = (
  currentBookProgress,
  incomingBookProgress,
  options = {}
) => {
  const current = isPlainObject(currentBookProgress) ? currentBookProgress : {};
  const incoming = isPlainObject(incomingBookProgress) ? incomingBookProgress : {};
  const currentCompleted = getBookCompletedCount(current);
  const incomingCompleted = getBookCompletedCount(incoming);
  const completedCount = Math.max(currentCompleted, incomingCompleted);
  const currentTime = getProgressVersionTime(current);
  const incomingTime = getProgressVersionTime(incoming);
  const incomingWins = incomingTime > currentTime || (
    incomingTime === currentTime && incomingCompleted > currentCompleted
  );
  const winner = incomingWins ? incoming : current;
  const loser = incomingWins ? current : incoming;
  const result = mergePlainProgressMetadata(loser, winner);

  const wordbookId = String(options.wordbookId || '');
  const bookTotals = isPlainObject(options.bookTotals) ? options.bookTotals : {};
  const hasExplicitTotal = wordbookId && Object.prototype.hasOwnProperty.call(bookTotals, wordbookId);
  const explicitTotal = hasExplicitTotal ? toCount(bookTotals[wordbookId]) : 0;
  const catalogTotal = !hasExplicitTotal && options.useKnownWordbookTotals !== false
    ? resolveKnownWordbookTotal(wordbookId)
    : 0;
  const authoritativeTotal = explicitTotal || catalogTotal;
  const winnerTotal = toCount(winner.totalCount);
  const loserTotal = toCount(loser.totalCount);
  const fallbackTotal = winnerTotal || loserTotal;

  result.completedCount = completedCount;
  result.learnedWords = completedCount;
  result.totalCount = Math.max(authoritativeTotal || fallbackTotal, completedCount);

  const lastStudyTime = selectLatestProgressValue(
    current.lastStudyTime || current.lastStudied,
    incoming.lastStudyTime || incoming.lastStudied
  );
  if (lastStudyTime) {
    result.lastStudyTime = lastStudyTime;
    result.lastStudied = lastStudyTime;
  }

  const updatedAt = selectLatestProgressValue(
    current.updatedAt || current.updated_at || current.lastUpdated,
    incoming.updatedAt || incoming.updated_at || incoming.lastUpdated
  );
  if (updatedAt) result.updatedAt = updatedAt;

  const calculationVersion = Math.max(
    toCount(current.progressCalculationVersion),
    toCount(incoming.progressCalculationVersion)
  );
  if (calculationVersion > 0) result.progressCalculationVersion = calculationVersion;
  const legacyCompletedCount = Math.max(
    toCount(current.legacyCompletedCount),
    toCount(incoming.legacyCompletedCount)
  );
  if (legacyCompletedCount > 0) result.legacyCompletedCount = legacyCompletedCount;
  const legacyTotalCount = Math.max(
    toCount(current.legacyTotalCount),
    toCount(incoming.legacyTotalCount)
  );
  if (legacyTotalCount > 0) result.legacyTotalCount = legacyTotalCount;

  return result;
};

/**
 * Merge a student's progress document per wordbook. The student-level counters
 * are recomputed from the merged wordbooks because they are derived cache fields.
 * The first argument is the currently persisted state; the second is an incoming
 * snapshot. With no reliable version evidence, current metadata remains the
 * fallback while monotonic learned counts are still protected.
 */
const mergeLearningProgress = (currentProgress, incomingProgress, options = {}) => {
  const current = isPlainObject(currentProgress) ? currentProgress : {};
  const incoming = isPlainObject(incomingProgress) ? incomingProgress : {};
  const currentTime = getProgressVersionTime(current);
  const incomingTime = getProgressVersionTime(incoming);
  const incomingWins = incomingTime > currentTime;
  const winner = incomingWins ? incoming : current;
  const loser = incomingWins ? current : incoming;
  const result = mergePlainProgressMetadata(loser, winner);
  const currentWordbooks = isPlainObject(current.wordbooks) ? current.wordbooks : {};
  const incomingWordbooks = isPlainObject(incoming.wordbooks) ? incoming.wordbooks : {};
  const wordbookIds = new Set([
    ...Object.keys(currentWordbooks),
    ...Object.keys(incomingWordbooks)
  ]);
  const mergedWordbooks = {};

  wordbookIds.forEach((wordbookId) => {
    mergedWordbooks[wordbookId] = mergeLearningProgressBook(
      currentWordbooks[wordbookId],
      incomingWordbooks[wordbookId],
      {
        ...options,
        wordbookId
      }
    );
  });

  result.wordbooks = mergedWordbooks;
  if (wordbookIds.size > 0) {
    result.learnedWords = Object.keys(mergedWordbooks).reduce((sum, wordbookId) => (
      sum + getBookCompletedCount(mergedWordbooks[wordbookId])
    ), 0);
    result.totalWords = Object.keys(mergedWordbooks).reduce((sum, wordbookId) => (
      sum + toCount(mergedWordbooks[wordbookId] && mergedWordbooks[wordbookId].totalCount)
    ), 0);
  } else {
    result.learnedWords = Math.max(
      toCount(current.learnedWords),
      toCount(incoming.learnedWords)
    );
    const winnerTotal = toCount(winner.totalWords);
    result.totalWords = winnerTotal || toCount(loser.totalWords);
  }

  const updatedAt = selectLatestProgressValue(
    current.updatedAt || current.updated_at || current.lastUpdated,
    incoming.updatedAt || incoming.updated_at || incoming.lastUpdated
  );
  if (updatedAt) result.updatedAt = updatedAt;
  const calculationVersion = Math.max(
    toCount(current.progressCalculationVersion),
    toCount(incoming.progressCalculationVersion)
  );
  if (calculationVersion > 0) result.progressCalculationVersion = calculationVersion;

  return result;
};

const mergeLearningProgressMap = (currentProgressMap, incomingProgressMap, options = {}) => {
  const current = isPlainObject(currentProgressMap) ? currentProgressMap : {};
  const incoming = isPlainObject(incomingProgressMap) ? incomingProgressMap : {};
  const result = {};
  const studentIds = new Set([...Object.keys(current), ...Object.keys(incoming)]);
  studentIds.forEach((studentId) => {
    const bookTotalsByStudent = isPlainObject(options.bookTotalsByStudent)
      ? options.bookTotalsByStudent
      : {};
    result[studentId] = mergeLearningProgress(current[studentId], incoming[studentId], {
      ...options,
      bookTotals: isPlainObject(bookTotalsByStudent[studentId])
        ? bookTotalsByStudent[studentId]
        : options.bookTotals
    });
  });
  return result;
};

const refreshStudentLearningProgressTotals = (options = {}) => {
  const sourceProgress = isPlainObject(options.progressData) ? options.progressData : {};
  const sourceWordbooks = isPlainObject(sourceProgress.wordbooks) ? sourceProgress.wordbooks : {};
  const bookTotals = isPlainObject(options.bookTotals) ? options.bookTotals : {};
  const nextWordbooks = { ...sourceWordbooks };
  let changed = false;

  Object.keys(bookTotals).forEach((bookId) => {
    const currentBook = sourceWordbooks[bookId];
    if (!isPlainObject(currentBook)) return;

    const currentTotal = toCount(bookTotals[bookId]);
    if (currentTotal < 1 || toCount(currentBook.totalCount) === currentTotal) return;

    nextWordbooks[bookId] = {
      ...currentBook,
      totalCount: currentTotal
    };
    changed = true;
  });

  if (!changed) return sourceProgress;

  const totalWords = Object.keys(nextWordbooks).reduce((sum, bookId) => (
    sum + toCount(nextWordbooks[bookId] && nextWordbooks[bookId].totalCount)
  ), 0);

  return {
    ...sourceProgress,
    totalWords,
    wordbooks: nextWordbooks
  };
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
  resolveCurrentWordbookTotal,
  mergeLearningProgressBook,
  mergeLearningProgress,
  mergeLearningProgressMap,
  refreshStudentLearningProgressTotals,
  reconcileStudentLearningProgress,
  reconcileLearningProgressMap
};
