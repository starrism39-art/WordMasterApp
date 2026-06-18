'use strict';

const isEmptyObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return true;
  }
  return Object.keys(value).length === 0;
};

const shouldIncludeAntiForgettingWord = (wordId, wordRecord) => {
  const normalizedWordId = String(wordId || '').trim();
  if (!normalizedWordId || normalizedWordId === 'undefined' || normalizedWordId === 'null') {
    return { include: false, reason: 'missing_wordId' };
  }

  if (!wordRecord || typeof wordRecord !== 'object' || isEmptyObject(wordRecord)) {
    return { include: false, reason: 'invalid_record' };
  }

  const masteryField = wordRecord.mastery || wordRecord.masteryStatus;
  const isMastered = masteryField === 'mastered' || wordRecord.mastered === true;
  // 有 antiForgettingSeed 的单词说明需要抗遗忘复习，不因 mastered 状态而排除
  if (isMastered && !wordRecord.antiForgettingSeed) {
    return { include: false, reason: 'mastered' };
  }

  const hasSeed = wordRecord.antiForgettingSeed === true;

  if (hasSeed) {
    return { include: true, reason: 'seed' };
  }

  return { include: false, reason: 'no_seed' };
};

module.exports = {
  shouldIncludeAntiForgettingWord
};
