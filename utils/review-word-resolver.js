'use strict';

const {
  assignStableWordIds,
  stripStableWordOccurrenceSuffix
} = require('./learning-word-ids.js');
const { generateWordsForBook } = require('../data/wordbook-loader.js');
const cloudWordbookLoader = require('./cloud-wordbook-loader.js');
const teacherCustomWordbookLoader = require('./teacher-custom-wordbook-loader.js');

const PLACEHOLDER_MEANINGS = new Set([
  '单词释义',
  '无释义',
  '未知',
  '未知释义',
  '暂无释义',
  '暂无释义，请尝试其他单词'
]);

const MEANING_FIELDS = [
  'meaning',
  'translation',
  'chineseMeaning',
  'chinese',
  'definitionZh',
  'definitionCN',
  'cnMeaning',
  'definition'
];

const normalizeMeaningValue = (value) => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).replace(/\s+/g, ' ').trim();
  }
  if (Array.isArray(value)) {
    return value.map(normalizeMeaningValue).filter(Boolean).join('；');
  }
  if (value && typeof value === 'object') {
    const nestedFields = ['zh', 'cn', 'meaning', 'translation', 'text'];
    for (const field of nestedFields) {
      const normalized = normalizeMeaningValue(value[field]);
      if (normalized) return normalized;
    }
  }
  return '';
};

const isRealChineseMeaning = (value) => {
  const normalized = normalizeMeaningValue(value);
  return !!normalized
    && !PLACEHOLDER_MEANINGS.has(normalized)
    && /[\u3400-\u9fff]/.test(normalized);
};

const getReviewWordMeaning = (entry) => {
  if (!entry || typeof entry !== 'object') {
    return { meaning: '', field: '', status: 'entry_not_found' };
  }

  for (const field of MEANING_FIELDS) {
    const meaning = normalizeMeaningValue(entry[field]);
    if (isRealChineseMeaning(meaning)) {
      return { meaning, field, status: 'resolved' };
    }
  }

  return { meaning: '', field: '', status: 'source_meaning_missing' };
};

const getReviewWordPhonetic = (entry) => {
  if (!entry || typeof entry !== 'object') return '';
  return normalizeMeaningValue(entry.phonetic || entry.phonetics || entry.pronunciation);
};

const normalizeWordKey = (value) => String(value || '')
  .replace(/_/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const normalizeWordIdPart = (value) => normalizeWordKey(value).replace(/\s+/g, '_');

const LEGACY_RECORD_RECOVERY_SOURCE = 'historical_compatibility_recovery';

const normalizeRecordWordId = (value) => String(
  value && typeof value === 'object'
    ? (value.wordId || value.sourceWordId || value.id || '')
    : (value || '')
).trim();

const normalizeRecordWordText = (value) => String(
  value && typeof value === 'object' ? (value.word || '') : (value || '')
).replace(/\s+/g, ' ').trim();

const getLegacyRecordWordInputs = (record = {}) => {
  const statusInputs = [];
  if (Array.isArray(record.masteredWordIds)) statusInputs.push(...record.masteredWordIds);
  if (Array.isArray(record.notMasteredWordIds)) statusInputs.push(...record.notMasteredWordIds);

  let candidates = statusInputs;
  let plainStringsAreWords = false;
  if (candidates.length === 0 && Array.isArray(record.learnedWordIds) && record.learnedWordIds.length > 0) {
    candidates = record.learnedWordIds;
  } else if (candidates.length === 0 && Array.isArray(record.studyWords) && record.studyWords.length > 0) {
    candidates = record.studyWords;
  } else if (candidates.length === 0 && Array.isArray(record.wordIds) && record.wordIds.length > 0) {
    candidates = record.wordIds;
  } else if (candidates.length === 0 && Array.isArray(record.words) && record.words.length > 0) {
    candidates = record.words;
    plainStringsAreWords = true;
  } else if (candidates.length === 0 && Array.isArray(record.learnedWordTexts) && record.learnedWordTexts.length > 0) {
    candidates = record.learnedWordTexts;
    plainStringsAreWords = true;
  }
  const seen = new Set();

  return candidates.reduce((result, value) => {
    const wordId = plainStringsAreWords && (!value || typeof value !== 'object')
      ? ''
      : normalizeRecordWordId(value);
    const word = value && typeof value === 'object'
      ? normalizeRecordWordText(value)
      : (plainStringsAreWords ? normalizeRecordWordText(value) : '');
    const identity = wordId ? `id:${wordId}` : (word ? `word:${word.toLowerCase()}` : '');
    if (!identity || seen.has(identity)) return result;
    seen.add(identity);
    result.push({ raw: value, wordId, word });
    return result;
  }, []);
};

const buildLegacyMasteryStatusMap = (record = {}) => {
  const statusMap = Object.create(null);
  const assign = (values, status) => {
    (Array.isArray(values) ? values : []).forEach((value) => {
      const wordId = normalizeRecordWordId(value);
      if (wordId) statusMap[wordId] = status;
    });
  };
  assign(record.masteredWordIds, 'mastered');
  assign(record.notMasteredWordIds, 'notMastered');
  return statusMap;
};

const buildCurrentWordById = (words) => {
  const byId = Object.create(null);
  const add = (id, entry) => {
    const key = String(id || '').trim();
    if (!key || !entry) return;
    if (!byId[key]) byId[key] = entry;
    const lowerKey = key.toLowerCase();
    if (!byId[lowerKey]) byId[lowerKey] = entry;
  };
  (Array.isArray(words) ? words : []).forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    add(entry.wordId, entry);
    add(entry.sourceWordId, entry);
    add(entry.id, entry);
  });
  return byId;
};

const hasReliableEmbeddedWord = (wordId, wordbookId, extractedWord) => {
  const sourceId = String(wordId || '').trim();
  const bookId = String(wordbookId || '').trim();
  const word = String(extractedWord || '').trim();
  if (!sourceId || !word || /^\d+$/.test(sourceId)) return false;
  if (!/^[a-zA-Z][a-zA-Z\s'\-.,/]*$/.test(word)) return false;

  const sourceLower = stripStableWordOccurrenceSuffix(sourceId).toLowerCase();
  const bookPrefixes = [bookId, normalizeWordIdPart(bookId)]
    .filter(Boolean)
    .map((value) => `${String(value).toLowerCase()}_`);
  return bookPrefixes.some((prefix) => sourceLower.startsWith(prefix))
    && /(^|_)real_/.test(sourceLower.slice(bookPrefixes.find((prefix) => sourceLower.startsWith(prefix)).length));
};

// 仅用于缺少完整历史快照/精确版本、但仍保存稳定词条身份的兼容记录。
// 调用方显式传入当前可查看词书映射，保证“查看明细”和“导出”使用同一恢复算法。
const resolveLegacyRecordWords = (record = {}, options = {}) => {
  const inputs = getLegacyRecordWordInputs(record);
  const wordMap = options.wordMap && typeof options.wordMap === 'object'
    ? options.wordMap
    : Object.create(null);
  const findWord = typeof options.findWord === 'function' ? options.findWord : () => null;
  const lookUpPhrase = typeof options.lookUpPhrase === 'function'
    ? options.lookUpPhrase
    : (word) => word;
  const currentWordById = buildCurrentWordById(options.words);
  const masteryStatusMap = buildLegacyMasteryStatusMap(record);
  const recoveredWords = [];
  const unresolvedWordIds = [];

  inputs.forEach((input, index) => {
    const wordId = input.wordId;
    if (wordId && /^\d+$/.test(wordId)) {
      unresolvedWordIds.push(wordId);
      return;
    }

    const exactEntry = wordId
      ? (currentWordById[wordId] || currentWordById[wordId.toLowerCase()])
      : null;
    let displayWord = input.word || (exactEntry && exactEntry.word) || '';
    if (!displayWord && wordId) {
      displayWord = extractDisplayWordFromReviewId(wordId, record.wordbookId);
    }
    displayWord = String(lookUpPhrase(displayWord, wordMap) || '').replace(/\s+/g, ' ').trim();

    const normalizedWord = displayWord.toLowerCase();
    let mappedEntry = exactEntry || wordMap[normalizedWord];
    if (!mappedEntry && normalizedWord === 'ms' && wordMap.miss) mappedEntry = wordMap.miss;
    if (!mappedEntry && normalizedWord.length >= 3) mappedEntry = findWord(displayWord, wordMap);

    const reliableWord = mappedEntry && mappedEntry.word
      ? String(mappedEntry.word).replace(/\s+/g, ' ').trim()
      : (input.word || hasReliableEmbeddedWord(wordId, record.wordbookId, displayWord) ? displayWord : '');
    if (!reliableWord) {
      unresolvedWordIds.push(wordId || input.word || `index:${index}`);
      return;
    }

    const meaningInfo = getReviewWordMeaning(mappedEntry);
    recoveredWords.push(Object.freeze({
      id: wordId,
      sourceWordId: wordId,
      wordId,
      word: reliableWord,
      meaning: meaningInfo.meaning,
      translation: meaningInfo.meaning,
      phonetic: getReviewWordPhonetic(mappedEntry),
      masteryStatus: wordId ? (masteryStatusMap[wordId] || null) : null,
      compatibilitySource: LEGACY_RECORD_RECOVERY_SOURCE
    }));
  });

  return Object.freeze({
    source: LEGACY_RECORD_RECOVERY_SOURCE,
    words: Object.freeze(recoveredWords),
    requestedCount: inputs.length,
    recoveredCount: recoveredWords.length,
    failedCount: unresolvedWordIds.length,
    unresolvedWordIds: Object.freeze(unresolvedWordIds),
    usesCurrentRecoverableContent: true,
    historicallyAccurate: false
  });
};

const buildReviewWordLookup = (words, wordbookId, options = {}) => {
  const sourceWords = Array.isArray(words) ? words : [];
  const normalizedWordbookId = String(wordbookId || '').trim();
  const isTeacherCustom = options.sourceType === teacherCustomWordbookLoader.SOURCE_TYPE;
  const stableWords = isTeacherCustom
    ? sourceWords
    : assignStableWordIds(sourceWords, normalizedWordbookId);
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
  const prefixCandidates = [
    String(wordbookId || '').trim(),
    normalizeWordIdPart(wordbookId)
  ]
    .filter(Boolean)
    .map((prefix) => `${prefix}_`)
    .sort((left, right) => right.length - left.length);
  const lowerCandidate = candidate.toLowerCase();
  const matchedPrefix = prefixCandidates.find((prefix) => lowerCandidate.startsWith(prefix.toLowerCase()));
  if (matchedPrefix) {
    candidate = candidate.slice(matchedPrefix.length);
  }

  candidate = candidate
    .replace(/^word_real_/i, '')
    .replace(/^real_/i, '')
    .replace(/_real_/gi, '_')
    .replace(/_\d+$/, '')
    // 旧版数量兜底项使用 `<word>_gen_<index>` 作为仅供页面使用的 ID。
    // `_gen` 是内部生成标记，不属于真实词面；须在转空格前移除。
    .replace(/_gen$/i, '')
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

const resolveReviewWordObject = (wordId, lookup) => {
  const resolved = resolveReviewWordEntry(wordId, lookup);
  const entry = resolved.entry;
  const meaningInfo = getReviewWordMeaning(entry);
  const word = entry && entry.word
    ? String(entry.word).trim()
    : String(resolved.displayWord || '').replace(/\s+/g, ' ').trim();

  return {
    id: String(wordId || ''),
    word,
    meaning: meaningInfo.meaning,
    translation: meaningInfo.meaning,
    phonetic: getReviewWordPhonetic(entry),
    _reviewResolution: {
      source: resolved.source,
      meaningField: meaningInfo.field,
      status: meaningInfo.status,
      matchFailureReason: entry ? '' : 'current_wordbook_exact_entry_not_found'
    }
  };
};

const loadReviewWordbookWords = async (wordbook) => {
  const safeWordbook = wordbook || {};
  const wordbookId = String(safeWordbook.id || '').trim();
  const category = String(safeWordbook.category || 'primary').trim() || 'primary';

  if (!wordbookId) {
    return {
      words: [],
      wordbookId,
      category,
      dataSource: 'missing_wordbook',
      loadError: 'missing_wordbook_id'
    };
  }

  if (safeWordbook.sourceType === teacherCustomWordbookLoader.SOURCE_TYPE) {
    try {
      const loadedBook = await teacherCustomWordbookLoader.loadTeacherCustomWordbook(safeWordbook);
      return {
        words: loadedBook.words,
        wordbookId,
        category,
        version: loadedBook.version,
        dataSource: 'teacher_custom',
        loadError: ''
      };
    } catch (error) {
      return {
        words: [],
        wordbookId,
        category,
        version: Number(safeWordbook.version || 0),
        dataSource: 'teacher_custom',
        loadError: error && error.message ? error.message : 'teacher_wordbook_unavailable'
      };
    }
  }

  if (!safeWordbook.sourceType && wordbookId.startsWith('twb_')) {
    return {
      words: [],
      wordbookId,
      category,
      dataSource: 'teacher_custom',
      loadError: 'teacher_wordbook_source_required'
    };
  }

  let dataSource = 'local';
  if (cloudWordbookLoader.isCloudWordbook(wordbookId)) {
    dataSource = 'cloud';
    const cloudWords = await cloudWordbookLoader.ensureWordsLoaded(wordbookId);
    if (!cloudWordbookLoader.isCompleteWordList(wordbookId, cloudWords)) {
      return {
        words: [],
        wordbookId,
        category,
        dataSource,
        loadError: 'cloud_wordbook_unavailable'
      };
    }
  }

  const words = generateWordsForBook(category, wordbookId, 0, 99999);
  return {
    words: Array.isArray(words) ? words : [],
    wordbookId,
    category,
    dataSource,
    loadError: ''
  };
};

module.exports = {
  LEGACY_RECORD_RECOVERY_SOURCE,
  buildReviewWordLookup,
  extractDisplayWordFromReviewId,
  getLegacyRecordWordInputs,
  getReviewWordMeaning,
  isRealChineseMeaning,
  loadReviewWordbookWords,
  resolveLegacyRecordWords,
  resolveReviewWordEntry,
  resolveReviewWordObject
};
