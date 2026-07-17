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
  shouldIncludeAntiForgettingWord,

  /**
   * ★ 修复：补回因 saveLearningRecord 兼容路径 bug 而缺失的 antiForgettingSeed
   * 遍历 wordMastery 中所有学生/词书，对 difficult=true 但缺少 antiForgettingSeed 的单词自动修复
   * @returns {number} 修复的单词数量
   */
  repairMissingAntiForgettingSeed: function() {
    try {
      const wordMastery = wx.getStorageSync('wordMastery') || {};
      let totalRepaired = 0;

      for (const studentId in wordMastery) {
        const studentData = wordMastery[studentId];
        if (!studentData || typeof studentData !== 'object' || Array.isArray(studentData)) continue;

        for (const wordbookId in studentData) {
          const wordbookMastery = studentData[wordbookId];
          if (!wordbookMastery || typeof wordbookMastery !== 'object' || Array.isArray(wordbookMastery)) continue;

          let bookRepaired = 0;
          for (const wordId in wordbookMastery) {
            const record = wordbookMastery[wordId];
            if (!record || typeof record !== 'object') continue;
            if (record.difficult === true && !record.antiForgettingSeed) {
              wordbookMastery[wordId] = { ...record, antiForgettingSeed: true };
              bookRepaired++;
            }
          }

          if (bookRepaired > 0) {
            totalRepaired += bookRepaired;
            console.log('[repairAntiForgettingSeed] 学生:', studentId, '词书:', wordbookId, '修复:', bookRepaired, '个');
          }
        }
      }

      if (totalRepaired > 0) {
        wx.setStorageSync('wordMastery', wordMastery);
        console.log('[repairAntiForgettingSeed] 总计修复:', totalRepaired, '个单词');
      }

      return totalRepaired;
    } catch (error) {
      console.error('[repairAntiForgettingSeed] 修复失败:', error);
      return 0;
    }
  }
};
