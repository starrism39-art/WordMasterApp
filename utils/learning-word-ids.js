'use strict';

const normalizeWordForId = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '_');

const STABLE_OCCURRENCE_MARKER = '__wm_occurrence_';

const stripStableWordOccurrenceSuffix = (value) => String(value || '')
  .replace(/__wm_occurrence_\d+$/, '');

const isHandledPreviewStatus = (status) => (
  status === true
  || status === false
  || status === 'mastered'
  || status === 'difficult'
);

const normalizeScopedWordId = (value, wordbookId) => {
  const normalizedId = normalizeWordForId(value);
  const normalizedWordbookId = normalizeWordForId(wordbookId);
  if (!normalizedId || !normalizedWordbookId) {
    return '';
  }

  const prefix = `${normalizedWordbookId}_`;
  return normalizedId.startsWith(prefix) && normalizedId.length > prefix.length
    ? normalizedId
    : '';
};

const getScopedWordMastery = (wordMastery, studentId, wordbookId) => {
  if (!wordMastery || typeof wordMastery !== 'object') {
    return null;
  }

  const studentMastery = wordMastery[String(studentId)];
  if (!studentMastery || typeof studentMastery !== 'object') {
    return null;
  }

  return studentMastery[String(wordbookId)] || null;
};

/**
 * Collects the exact current IDs that have already been handled in preview or
 * proved learned by persisted state. Matching always stays inside the current
 * student/book and resolves to a current full ID; it never uses substring or
 * English-spelling-only matching for duplicate entries.
 */
const collectProcessedPreviewWordIds = ({
  words,
  studentId,
  wordbookId,
  previewMastery,
  previewExcludedWordIds,
  wordMastery,
  learningRecords
} = {}) => {
  const currentWords = Array.isArray(words) ? words : [];
  const canonicalIdMap = new Map();
  const normalizedWordMap = new Map();
  const processedIds = new Set();

  currentWords.forEach((word) => {
    const currentId = String(word && word.id || '').trim();
    const canonicalId = normalizeScopedWordId(currentId, wordbookId);
    if (!currentId || !canonicalId) {
      return;
    }

    canonicalIdMap.set(canonicalId, currentId);

    const sourceWordId = normalizeScopedWordId(word && word.sourceWordId, wordbookId);
    if (sourceWordId && !canonicalIdMap.has(sourceWordId)) {
      canonicalIdMap.set(sourceWordId, currentId);
    }

    const normalizedWord = normalizeWordForId(word && word.word);
    if (normalizedWord) {
      const ids = normalizedWordMap.get(normalizedWord) || [];
      ids.push(currentId);
      normalizedWordMap.set(normalizedWord, ids);
    }
  });

  const addScopedId = (rawId) => {
    const canonicalId = normalizeScopedWordId(rawId, wordbookId);
    const currentId = canonicalId && canonicalIdMap.get(canonicalId);
    if (currentId) {
      processedIds.add(currentId);
      return true;
    }
    return false;
  };

  const addDetailedWord = (detail) => {
    if (!detail || typeof detail !== 'object') {
      return;
    }

    if (addScopedId(detail.sourceWordId) || addScopedId(detail.wordId) || addScopedId(detail.word_id) || addScopedId(detail.id)) {
      return;
    }

    // A spelling-only historical detail is safe only when the spelling maps
    // to exactly one position in this book. Duplicate positions stay visible
    // unless the record carries an exact/stable source ID.
    const normalizedWord = normalizeWordForId(detail.word);
    const matchingIds = normalizedWordMap.get(normalizedWord) || [];
    if (matchingIds.length === 1) {
      processedIds.add(matchingIds[0]);
    }
  };

  Object.keys(previewMastery || {}).forEach((wordId) => {
    if (isHandledPreviewStatus(previewMastery[wordId])) {
      addScopedId(wordId);
    }
  });

  (Array.isArray(previewExcludedWordIds) ? previewExcludedWordIds : []).forEach(addScopedId);

  const scopedMastery = getScopedWordMastery(wordMastery, studentId, wordbookId);
  if (Array.isArray(scopedMastery)) {
    scopedMastery.forEach((item) => {
      if (item && typeof item === 'object') {
        addScopedId(item.wordId || item.word_id || item.id);
      } else {
        addScopedId(item);
      }
    });
  } else if (scopedMastery && typeof scopedMastery === 'object') {
    Object.keys(scopedMastery).forEach(addScopedId);
  }

  (Array.isArray(learningRecords) ? learningRecords : []).forEach((record) => {
    if (!record || typeof record !== 'object') {
      return;
    }

    const recordStudentId = String(record.studentId || record.student_id || record.userId || '').trim();
    const recordWordbookId = String(record.wordbookId || record.wordbook_id || '').trim();
    if (recordStudentId !== String(studentId || '').trim() || recordWordbookId !== String(wordbookId || '').trim()) {
      return;
    }

    ['learnedWordIds', 'studyWords', 'masteredWordIds', 'notMasteredWordIds'].forEach((field) => {
      const values = Array.isArray(record[field]) ? record[field] : [];
      values.forEach((value) => {
        if (value && typeof value === 'object') {
          addDetailedWord(value);
        } else {
          addScopedId(value);
        }
      });
    });

    ['studyWordsDetailed', 'learnedWordsDetailed', 'masteredWordsDetailed', 'notMasteredWordsDetailed'].forEach((field) => {
      (Array.isArray(record[field]) ? record[field] : []).forEach(addDetailedWord);
    });
  });

  return currentWords
    .map((word) => String(word && word.id || '').trim())
    .filter((wordId) => processedIds.has(wordId));
};

/**
 * Builds the state persisted at completion. The original preview decision has
 * priority over answers made during the later learning/test pages so a word
 * marked "not mastered" remains difficult and eligible for anti-forgetting.
 */
const buildCompletionMasterySnapshot = ({
  learnedWordIds,
  previewMastery,
  startMasteredWordIds,
  startNotMasteredWordIds,
  masteredWordIds,
  notMasteredWordIds
} = {}) => {
  const masterySnapshot = {};
  const antiForgettingSeedSnapshot = {};
  const startMasteredSet = new Set((startMasteredWordIds || []).map(id => String(id)));
  const startNotMasteredSet = new Set((startNotMasteredWordIds || []).map(id => String(id)));
  const masteredSet = new Set((masteredWordIds || []).map(id => String(id)));
  const notMasteredSet = new Set((notMasteredWordIds || []).map(id => String(id)));

  (learnedWordIds || []).forEach((rawId) => {
    const wordId = String(rawId);
    if (startNotMasteredSet.has(wordId)) {
      masterySnapshot[wordId] = 'difficult';
      antiForgettingSeedSnapshot[wordId] = true;
      return;
    }
    if (startMasteredSet.has(wordId)) {
      masterySnapshot[wordId] = 'mastered';
      return;
    }

    const currentStatus = previewMastery && previewMastery[wordId];
    if (currentStatus === false || currentStatus === 'difficult') {
      masterySnapshot[wordId] = 'difficult';
      antiForgettingSeedSnapshot[wordId] = true;
      return;
    }
    if (currentStatus === true || currentStatus === 'mastered') {
      masterySnapshot[wordId] = 'mastered';
      return;
    }
    if (notMasteredSet.has(wordId)) {
      masterySnapshot[wordId] = 'difficult';
      return;
    }
    if (masteredSet.has(wordId)) {
      masterySnapshot[wordId] = 'mastered';
    }
  });

  if (Object.keys(masterySnapshot).length === 0) {
    (learnedWordIds || []).forEach((rawId) => {
      masterySnapshot[String(rawId)] = 'difficult';
    });
  }

  return { masterySnapshot, antiForgettingSeedSnapshot };
};

/**
 * Merges a preview_state response that arrived after the page was rendered.
 * Cloud state may refresh the request-time snapshot, but a decision made by
 * the user while that request was in flight always wins.
 */
const mergeLatePreviewMastery = (requestTimeLocal, currentLocal, cloudMastery) => {
  const requestSnapshot = requestTimeLocal && typeof requestTimeLocal === 'object'
    ? requestTimeLocal
    : {};
  const liveSnapshot = currentLocal && typeof currentLocal === 'object'
    ? currentLocal
    : {};
  const cloudSnapshot = cloudMastery && typeof cloudMastery === 'object'
    ? cloudMastery
    : {};
  const merged = { ...requestSnapshot, ...liveSnapshot };

  Object.keys(cloudSnapshot).forEach((wordId) => {
    const cloudStatus = cloudSnapshot[wordId];
    if (cloudStatus === undefined || cloudStatus === null) {
      return;
    }

    const requestHadValue = Object.prototype.hasOwnProperty.call(requestSnapshot, wordId);
    const liveHadValue = Object.prototype.hasOwnProperty.call(liveSnapshot, wordId);
    const changedWhileLoading = liveHadValue && (
      !requestHadValue || liveSnapshot[wordId] !== requestSnapshot[wordId]
    );
    if (!changedWhileLoading) {
      merged[wordId] = cloudStatus;
    }
  });

  return merged;
};

/**
 * Assigns deterministic IDs while preserving the legacy ID for the first
 * occurrence of a word. Repeated textbook entries receive stable numeric
 * suffixes so one preview decision can never overwrite another entry.
 */
const assignStableWordIds = (words, wordbookId) => {
  const normalizedWordbookId = String(wordbookId || '').trim();
  const occurrenceByBaseId = {};
  const sourceWords = Array.isArray(words) ? words : [];
  // Reserve every legacy base ID first so a duplicate suffix can never steal
  // the legacy ID of a different literal word.
  const reservedBaseIds = new Set(sourceWords.map((word) => {
    const normalizedWord = normalizeWordForId(word && word.word);
    return `${normalizedWordbookId}_${normalizedWord || 'unknown'}`;
  }));
  const assignedIds = new Set();

  return sourceWords.map((word) => {
    const normalizedWord = normalizeWordForId(word && word.word);
    const baseId = `${normalizedWordbookId}_${normalizedWord || 'unknown'}`;
    const occurrence = (occurrenceByBaseId[baseId] || 0) + 1;
    occurrenceByBaseId[baseId] = occurrence;
    let id = baseId;

    if (occurrence > 1 || assignedIds.has(id)) {
      let suffix = Math.max(2, occurrence);
      id = `${baseId}${STABLE_OCCURRENCE_MARKER}${suffix}`;
      while (reservedBaseIds.has(id) || assignedIds.has(id)) {
        suffix += 1;
        id = `${baseId}${STABLE_OCCURRENCE_MARKER}${suffix}`;
      }
    }
    assignedIds.add(id);

    return {
      ...word,
      id
    };
  });
};

/**
 * Returns only exact, current-book IDs explicitly marked as not mastered.
 * Exact matching is required because suffix-stripping would select every
 * repeated occurrence when the teacher marked only one of them.
 */
const selectPreviewNotMasteredWords = (words, previewMastery, wordbookId) => {
  const normalizedWordbookId = String(wordbookId || '').trim();
  const prefix = `${normalizedWordbookId}_`;
  const availableWords = Array.isArray(words) ? words : [];
  const availableIds = new Set(availableWords.map((word) => String(word && word.id || '')));
  const selectedIds = new Set();

  Object.keys(previewMastery || {}).forEach((wordId) => {
    const normalizedId = String(wordId);
    const status = previewMastery[wordId];
    if (
      normalizedId.startsWith(prefix)
      && availableIds.has(normalizedId)
      && (status === false || status === 'difficult')
    ) {
      selectedIds.add(normalizedId);
    }
  });

  return availableWords.filter((word) => selectedIds.has(String(word && word.id || '')));
};

module.exports = {
  assignStableWordIds,
  buildCompletionMasterySnapshot,
  collectProcessedPreviewWordIds,
  mergeLatePreviewMastery,
  selectPreviewNotMasteredWords,
  stripStableWordOccurrenceSuffix
};
