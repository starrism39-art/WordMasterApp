'use strict';

const crypto = require('crypto');
const { normalizeWordIdentity } = require('./upload-parser');

const normalizeText = (value) => (
  String(value === undefined || value === null ? '' : value).trim()
);

const createRowKey = () => crypto.randomBytes(16).toString('hex');

const attachRowKeys = (rows) => (
  (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    row_key: normalizeText(row && row.row_key) || createRowKey()
  }))
);

const createStableWordId = ({ wordbookId, publishToken, rowKey }) => {
  const safeWordbookId = normalizeText(wordbookId);
  const safePublishToken = normalizeText(publishToken);
  const safeRowKey = normalizeText(rowKey);
  if (!safeWordbookId || !safePublishToken || !safeRowKey) {
    throw new Error('WORD_ID_INPUT_INVALID');
  }

  const digest = crypto.createHash('sha256')
    .update(`${safeWordbookId}:${safePublishToken}:${safeRowKey}`)
    .digest('hex')
    .slice(0, 16);
  return `${safeWordbookId}_w_${digest}`;
};

const indexVersionWords = (words, label) => {
  const byIdentity = new Map();
  (Array.isArray(words) ? words : []).forEach((word) => {
    const identity = normalizeWordIdentity(word && word.word);
    const wordId = normalizeText(word && word.id);
    if (!identity || !wordId) throw new Error('WORD_HISTORY_INVALID');
    if (byIdentity.has(identity)) throw new Error(`DUPLICATE_WORD:${label}`);
    byIdentity.set(identity, wordId);
  });
  return byIdentity;
};

const matchWordIds = ({
  wordbookId,
  previousWords,
  historicalWordSets = [],
  nextRows,
  publishToken
}) => {
  if (!Array.isArray(previousWords) || !Array.isArray(nextRows)) {
    throw new Error('WORD_MATCH_INPUT_INVALID');
  }
  if (!Array.isArray(historicalWordSets)
    || historicalWordSets.some((words) => !Array.isArray(words))) {
    throw new Error('WORD_HISTORY_INPUT_INVALID');
  }

  const historicalIds = new Map();
  historicalWordSets.forEach((words, index) => {
    indexVersionWords(words, `history-${index + 1}`).forEach((wordId, identity) => {
      historicalIds.set(identity, wordId);
    });
  });
  indexVersionWords(previousWords, 'previous').forEach((wordId, identity) => {
    historicalIds.set(identity, wordId);
  });

  const nextIdentities = new Set();
  const usedWordIds = new Set();

  return nextRows.map((row, index) => {
    const rowKey = normalizeText(row && row.row_key);
    if (!rowKey) throw new Error('WORD_ROW_KEY_REQUIRED');

    const identity = normalizeWordIdentity(row && row.word);
    if (!identity) throw new Error('WORD_IDENTITY_REQUIRED');
    if (nextIdentities.has(identity)) throw new Error('DUPLICATE_WORD:next');
    nextIdentities.add(identity);

    const wordId = historicalIds.get(identity)
      || createStableWordId({ wordbookId, publishToken, rowKey });
    if (usedWordIds.has(wordId)) throw new Error('WORD_ID_DUPLICATE');
    usedWordIds.add(wordId);

    return {
      id: wordId,
      wordbookId: normalizeText(wordbookId),
      word: normalizeText(row && row.word),
      phonetic: normalizeText(row && row.phonetic),
      meaning: normalizeText(row && row.meaning),
      order: index + 1
    };
  });
};

module.exports = {
  attachRowKeys,
  createStableWordId,
  indexVersionWords,
  matchWordIds
};
