'use strict';

const normalizeWordForId = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '_');

const STABLE_OCCURRENCE_MARKER = '__wm_occurrence_';

const stripStableWordOccurrenceSuffix = (value) => String(value || '')
  .replace(/__wm_occurrence_\d+$/, '');

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
  selectPreviewNotMasteredWords,
  stripStableWordOccurrenceSuffix
};
