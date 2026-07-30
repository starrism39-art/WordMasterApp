'use strict';

const REVIEW_INTERVAL_DAYS = [1, 2, 4, 7, 15];
const DAY_MS = 24 * 60 * 60 * 1000;
const ANTI_FORGETTING_SOURCES = Object.freeze({
  PREVIEW_NOT_MASTERED: 'preview_not_mastered',
  PREVIEW_MASTERED: 'preview_mastered',
  NON_PREVIEW_DIFFICULT: 'non_preview_difficult'
});

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

const getAntiForgettingSource = (wordRecord) => (
  wordRecord && typeof wordRecord.antiForgettingSource === 'string'
    ? wordRecord.antiForgettingSource.trim()
    : ''
);

/**
 * 生成单词状态更新时要保存的抗遗忘来源。
 *
 * - 已有种子和已有“预习不会”来源继续兼容，避免旧五轮记录消失；
 * - 新的预习不会写入明确来源；
 * - 新的非预习困难词写入排除来源，不能仅凭 difficult 入池；
 * - 没有来源字段的旧困难记录保持原样，由读取兼容规则处理，不迁移旧数据。
 */
const resolveAntiForgettingSourceForUpdate = (currentWordRecord, options = {}) => {
  const currentRecord = currentWordRecord && typeof currentWordRecord === 'object'
    ? currentWordRecord
    : {};
  const currentSource = getAntiForgettingSource(currentRecord);
  const hasLegacySeed = toBoolean(currentRecord.antiForgettingSeed) === true;
  const confirmedPreviewNotMastered = options.confirmedPreviewNotMastered === true;
  const isPreviewDecision = options.isPreviewDecision === true;
  const isDifficult = options.isDifficult === true;

  if (
    confirmedPreviewNotMastered ||
    currentSource === ANTI_FORGETTING_SOURCES.PREVIEW_NOT_MASTERED ||
    hasLegacySeed
  ) {
    return ANTI_FORGETTING_SOURCES.PREVIEW_NOT_MASTERED;
  }

  if (isPreviewDecision) {
    return isDifficult
      ? ANTI_FORGETTING_SOURCES.PREVIEW_NOT_MASTERED
      : ANTI_FORGETTING_SOURCES.PREVIEW_MASTERED;
  }

  if (currentSource) {
    return currentSource;
  }

  if (isDifficult && options.isExistingRecord === false) {
    return ANTI_FORGETTING_SOURCES.NON_PREVIEW_DIFFICULT;
  }

  return '';
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

const getLocalDateKey = (timestamp) => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
 * - 新记录只有明确来自“预习不会”才进入抗遗忘；
 * - 旧记录保留 antiForgettingSeed 时继续完成原有五轮；
 * - 缺少来源字段的旧 difficult / notMastered 记录按旧规则只读兼容，不迁移、不清空；
 * - 明确来自预习会或其他困难来源的新记录不得进入；
 * - 旧数组误迁移产生的无明确状态对象不会进入列表；
 * - 到期判断使用精确时间戳，未到 scheduledTime 时只能展示计划、不能开始复习。
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
  const source = getAntiForgettingSource(wordRecord);
  const hasSeed = toBoolean(wordRecord.antiForgettingSeed) === true;
  if (!isDifficult && !isMastered) {
    return { include: false, reason: 'ambiguous_legacy_status' };
  }

  const isPreviewNotMastered = source === ANTI_FORGETTING_SOURCES.PREVIEW_NOT_MASTERED;
  const isLegacyDifficult = !source && !hasSeed && isDifficult;
  if (!isPreviewNotMastered && !hasSeed && !isLegacyDifficult) {
    return { include: false, reason: 'not_preview_not_mastered' };
  }

  const scheduledTime = getScheduledReviewTime(wordRecord, reviewCount);
  if (!scheduledTime) {
    return { include: false, reason: 'missing_review_time' };
  }

  const now = toTimestamp(context.now) || Date.now();
  if (scheduledTime > now) {
    if (context.includeNotDue === true) {
      return {
        include: true,
        reason: 'scheduled',
        canReview: false,
        reviewType: 'remedial',
        reviewTypeLabel: '未掌握复习',
        scheduledTime,
        round: reviewCount + 1,
        reviewCount,
        firstStudyTime: getFirstStudyTime(wordRecord)
      };
    }
    return {
      include: false,
      reason: 'not_due',
      scheduledTime,
      round: reviewCount + 1
    };
  }

  const reviewType = 'remedial';
  return {
    include: true,
    reason: 'due',
    canReview: true,
    reviewType,
    reviewTypeLabel: '未掌握复习',
    scheduledTime,
    round: reviewCount + 1,
    reviewCount,
    firstStudyTime: getFirstStudyTime(wordRecord)
  };
};

/**
 * 只读生成当前单词尚未完成的五轮时间表。
 *
 * 当前轮以 nextReviewTime 为准；后续轮次基于当前轮向后投影，避免用户延期
 * 复习时把多个历史日期同时开放。此函数不修改 wordRecord。
 */
const buildAntiForgettingSchedule = (wordId, wordRecord, context = {}) => {
  const now = toTimestamp(context.now) || Date.now();
  const currentRound = shouldIncludeAntiForgettingWord(wordId, wordRecord, {
    ...context,
    now,
    includeNotDue: true
  });
  if (!currentRound.include) {
    return [];
  }

  const currentIndex = currentRound.round - 1;
  const projectionAnchor = currentRound.canReview && currentRound.scheduledTime < now
    ? now
    : currentRound.scheduledTime;
  const learningBatchKey = currentRound.firstStudyTime
    ? `study_day_${getLocalDateKey(currentRound.firstStudyTime)}`
    : `legacy_${currentRound.scheduledTime}_${currentRound.reviewCount}`;

  return REVIEW_INTERVAL_DAYS
    .map((intervalDays, index) => {
      if (index < currentIndex) {
        return null;
      }
      const isCurrentRound = index === currentIndex;
      const scheduledTime = isCurrentRound
        ? currentRound.scheduledTime
        : projectionAnchor + (intervalDays - REVIEW_INTERVAL_DAYS[currentIndex]) * DAY_MS;
      const canReview = isCurrentRound && currentRound.canReview === true;

      return {
        round: index + 1,
        scheduledTime,
        canReview,
        scheduleStatus: canReview ? 'ready' : 'scheduled',
        reviewType: currentRound.reviewType,
        reviewTypeLabel: currentRound.reviewTypeLabel,
        firstStudyTime: currentRound.firstStudyTime,
        learningBatchKey
      };
    })
    .filter(Boolean);
};

module.exports = {
  ANTI_FORGETTING_SOURCES,
  REVIEW_INTERVAL_DAYS,
  buildAntiForgettingSchedule,
  resolveAntiForgettingSourceForUpdate,
  shouldIncludeAntiForgettingWord,
};
