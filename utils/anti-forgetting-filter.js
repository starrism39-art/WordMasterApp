'use strict';

const REVIEW_INTERVAL_DAYS = [1, 2, 4, 7, 15];
const DAY_MS = 24 * 60 * 60 * 1000;

const isEmptyObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return true;
  }
  return Object.keys(value).length === 0;
};

const toTimestamp = (value) => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
  }
  if (typeof value === 'string' && value.trim()) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      return numericValue;
    }
    const parsedValue = Date.parse(value);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
  }
  return 0;
};

const normalizeStatus = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s_-]/g, '');

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

const getReviewState = (wordRecord) => {
  const statuses = [
    wordRecord.status,
    wordRecord.mastery,
    wordRecord.masteryStatus
  ].map(normalizeStatus);

  const isDifficult = toBoolean(wordRecord.difficult) === true || statuses.some((status) => (
    status === 'difficult' ||
    status === 'notmastered' ||
    status === 'unmastered' ||
    status === 'partial'
  ));

  const isMastered = !isDifficult && (
    toBoolean(wordRecord.mastered) === true ||
    statuses.some((status) => status === 'mastered' || status === 'full')
  );

  return {
    isDifficult,
    isMastered
  };
};

const getDayEndTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
};

const getFirstStudyTime = (wordRecord) => {
  const timelineFirstTime = Array.isArray(wordRecord.reviewTimeline) &&
    wordRecord.reviewTimeline.length > 0
    ? wordRecord.reviewTimeline[0] && wordRecord.reviewTimeline[0].time
    : 0;

  const candidates = [
    wordRecord.firstMasteryTime,
    timelineFirstTime,
    wordRecord.createdAt,
    wordRecord.firstStudyDate
  ];
  for (const candidate of candidates) {
    const timestamp = toTimestamp(candidate);
    if (timestamp) {
      return timestamp;
    }
  }
  return 0;
};

const getScheduledReviewTime = (wordRecord, reviewCount) => {
  const storedNextReviewTime = toTimestamp(wordRecord.nextReviewTime);
  if (storedNextReviewTime) {
    return storedNextReviewTime;
  }

  const firstStudyTime = getFirstStudyTime(wordRecord);
  const intervalDays = REVIEW_INTERVAL_DAYS[reviewCount];
  if (!firstStudyTime || typeof intervalDays !== 'number') {
    return 0;
  }
  return firstStudyTime + intervalDays * DAY_MS;
};

const scopeMatches = (recordValue, expectedValue) => {
  if (recordValue === undefined || recordValue === null || recordValue === '') {
    return true;
  }
  return String(recordValue) === String(expectedValue);
};

/**
 * 返回当前学生、当前词书中一个单词是否应进入“现在可复习”的抗遗忘列表。
 *
 * 兼容规则：
 * - difficult / notMastered 记录属于未掌握复习；
 * - mastered 记录只有保留 antiForgettingSeed 且到期时才属于巩固复习；
 * - 旧数组误迁移产生的无明确状态对象不会进入列表；
 * - 到期判断沿用项目现有“当天即可复习”的产品口径。
 */
const shouldIncludeAntiForgettingWord = (wordId, wordRecord, context = {}) => {
  const normalizedWordId = String(wordId || '').trim();
  if (!normalizedWordId || normalizedWordId === 'undefined' || normalizedWordId === 'null') {
    return { include: false, reason: 'missing_wordId' };
  }

  if (!wordRecord || typeof wordRecord !== 'object' || Array.isArray(wordRecord) || isEmptyObject(wordRecord)) {
    return { include: false, reason: 'invalid_record' };
  }

  const expectedStudentId = context.studentId;
  const expectedWordbookId = context.wordbookId;
  if (expectedStudentId !== undefined && expectedStudentId !== null) {
    const recordStudentId = wordRecord.studentId ?? wordRecord.student_id;
    if (!scopeMatches(recordStudentId, expectedStudentId)) {
      return { include: false, reason: 'student_scope' };
    }
  }
  if (expectedWordbookId !== undefined && expectedWordbookId !== null) {
    const recordWordbookId = wordRecord.wordbookId ?? wordRecord.wordbook_id;
    if (!scopeMatches(recordWordbookId, expectedWordbookId)) {
      return { include: false, reason: 'wordbook_scope' };
    }
    if (
      context.hasScopedWordIds === true &&
      !normalizedWordId.startsWith(`${expectedWordbookId}_`) &&
      (recordWordbookId === undefined || recordWordbookId === null || recordWordbookId === '')
    ) {
      return { include: false, reason: 'wordbook_scope' };
    }
  }

  const parsedReviewCount = Number(wordRecord.reviewCount);
  const reviewCount = Number.isFinite(parsedReviewCount)
    ? Math.max(0, Math.floor(parsedReviewCount))
    : 0;
  if (reviewCount >= REVIEW_INTERVAL_DAYS.length) {
    return { include: false, reason: 'completed' };
  }

  const { isDifficult, isMastered } = getReviewState(wordRecord);
  const hasSeed = wordRecord.antiForgettingSeed === true;
  if (!isDifficult && !isMastered) {
    return { include: false, reason: 'ambiguous_legacy_status' };
  }
  if (isMastered && !hasSeed) {
    return { include: false, reason: 'mastered_without_seed' };
  }

  const scheduledTime = getScheduledReviewTime(wordRecord, reviewCount);
  if (!scheduledTime) {
    return { include: false, reason: 'missing_review_time' };
  }

  const now = toTimestamp(context.now) || Date.now();
  if (scheduledTime > getDayEndTimestamp(now)) {
    return {
      include: false,
      reason: 'not_due',
      scheduledTime,
      round: reviewCount + 1
    };
  }

  const reviewType = isDifficult ? 'remedial' : 'consolidation';
  return {
    include: true,
    reason: 'due',
    reviewType,
    reviewTypeLabel: reviewType === 'remedial' ? '未掌握复习' : '巩固复习',
    scheduledTime,
    round: reviewCount + 1,
    firstStudyTime: getFirstStudyTime(wordRecord)
  };
};

/**
 * 仅在明确的当前学生/当前词书范围内补回 difficult 记录缺失的种子。
 * 不传作用域时不做任何写入，避免跨学生、跨词书批量修改本地数据。
 */
const repairMissingAntiForgettingSeed = (studentId, wordbookId) => {
  if (!studentId || !wordbookId || typeof wx === 'undefined') {
    return 0;
  }

  try {
    const wordMastery = wx.getStorageSync('wordMastery') || {};
    const studentData = wordMastery[studentId];
    const wordbookMastery = studentData && studentData[wordbookId];
    if (!wordbookMastery || typeof wordbookMastery !== 'object' || Array.isArray(wordbookMastery)) {
      return 0;
    }

    let repairedCount = 0;
    Object.keys(wordbookMastery).forEach((wordId) => {
      const record = wordbookMastery[wordId];
      if (record && typeof record === 'object' && record.difficult === true && record.antiForgettingSeed !== true) {
        wordbookMastery[wordId] = {
          ...record,
          antiForgettingSeed: true
        };
        repairedCount++;
      }
    });

    if (repairedCount > 0) {
      wx.setStorageSync('wordMastery', wordMastery);
      console.log(
        '[repairAntiForgettingSeed] 学生:',
        studentId,
        '词书:',
        wordbookId,
        '修复:',
        repairedCount,
        '个'
      );
    }
    return repairedCount;
  } catch (error) {
    console.error('[repairAntiForgettingSeed] 修复失败:', error);
    return 0;
  }
};

module.exports = {
  REVIEW_INTERVAL_DAYS,
  shouldIncludeAntiForgettingWord,
  repairMissingAntiForgettingSeed
};
