'use strict';

const {
  assignStableWordIds,
  stripStableWordOccurrenceSuffix
} = require('./learning-word-ids.js');

const normalizeWordKey = (value) => String(value || '')
  .replace(/_/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const normalizeWordIdPart = (value) => normalizeWordKey(value).replace(/\s+/g, '_');

const buildReviewWordLookup = (words, wordbookId) => {
  const sourceWords = Array.isArray(words) ? words : [];
  const normalizedWordbookId = String(wordbookId || '').trim();
  const stableWords = assignStableWordIds(sourceWords, normalizedWordbookId);
  const byId = Object.create(null);
  const byWord = Object.create(null);

  const addIdAlias = (id, entry) => {
    const key = String(id || '').trim();
    if (!key || !entry) return;
    if (!byId[key]) byId[key] = entry;
    const lowerKey = key.toLowerCase();
    if (!byId[lowerKey]) byId[lowerKey] = entry;
  };

  sourceWords.forEach((entry, index) => {
    if (!entry || typeof entry.word !== 'string' || !entry.word.trim()) return;

    const wordKey = normalizeWordKey(entry.word);
    const wordIdPart = normalizeWordIdPart(entry.word);
    const stableEntry = stableWords[index] || {};

    if (!byWord[wordKey]) byWord[wordKey] = entry;

    addIdAlias(entry.id, entry);
    addIdAlias(entry.sourceWordId, entry);
    addIdAlias(stableEntry.id, entry);

    if (normalizedWordbookId && wordIdPart) {
      addIdAlias(`${normalizedWordbookId}_${wordIdPart}`, entry);
      addIdAlias(`${normalizedWordbookId}_real_${wordIdPart}`, entry);
      addIdAlias(`${normalizedWordbookId}_word_real_${wordIdPart}`, entry);
    }
  });

  return {
    wordbookId: normalizedWordbookId,
    words: sourceWords,
    byId,
    byWord
  };
};

const extractDisplayWordFromReviewId = (wordId, wordbookId) => {
  const sourceId = String(wordId || '').trim();
  if (!sourceId) return '';

  let candidate = stripStableWordOccurrenceSuffix(sourceId);
  const prefix = wordbookId ? `${wordbookId}_` : '';
  if (prefix && candidate.startsWith(prefix)) {
    candidate = candidate.slice(prefix.length);
  }

  candidate = candidate
    .replace(/^word_real_/, '')
    .replace(/^real_/, '')
    .replace(/_real_/g, '_')
    .replace(/_\d+$/, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return candidate;
};

const resolveReviewWordEntry = (wordId, lookup) => {
  const safeLookup = lookup || {};
  const sourceId = String(wordId || '').trim();
  const byId = safeLookup.byId || Object.create(null);
  const byWord = safeLookup.byWord || Object.create(null);
  const wordbookId = String(safeLookup.wordbookId || '').trim();

  const exactEntry = byId[sourceId] || byId[sourceId.toLowerCase()];
  if (exactEntry) {
    return {
      entry: exactEntry,
      displayWord: String(exactEntry.word || '').trim(),
      source: 'exact_id'
    };
  }

  const withoutOccurrence = stripStableWordOccurrenceSuffix(sourceId);
  const occurrenceEntry = byId[withoutOccurrence] || byId[withoutOccurrence.toLowerCase()];
  if (occurrenceEntry) {
    return {
      entry: occurrenceEntry,
      displayWord: String(occurrenceEntry.word || '').trim(),
      source: 'legacy_occurrence_id'
    };
  }

  if (/^\d+$/.test(sourceId)) {
    const wordIndex = Number(sourceId) - 1;
    const numericEntry = wordIndex >= 0 && safeLookup.words && safeLookup.words[wordIndex];
    if (numericEntry && numericEntry.word) {
      return {
        entry: numericEntry,
        displayWord: String(numericEntry.word).trim(),
        source: 'legacy_numeric_id'
      };
    }
  }

  const extractedWord = extractDisplayWordFromReviewId(sourceId, wordbookId);
  const wordEntry = byWord[normalizeWordKey(extractedWord)];
  if (wordEntry) {
    return {
      entry: wordEntry,
      displayWord: String(wordEntry.word || '').trim(),
      source: 'legacy_word_text'
    };
  }

  return {
    entry: null,
    displayWord: extractedWord,
    source: 'safe_text_fallback'
  };
};

module.exports = {
  buildReviewWordLookup,
  extractDisplayWordFromReviewId,
  resolveReviewWordEntry
};
