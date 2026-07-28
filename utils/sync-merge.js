'use strict';

const hasOwn = (value, key) => (
  !!value && Object.prototype.hasOwnProperty.call(value, key)
);

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
  if (value && typeof value === 'object') {
    const nestedDate = value.$date || value.date || value.value;
    if (nestedDate !== undefined) {
      return toTimestamp(nestedDate);
    }
    if (typeof value.toDate === 'function') {
      try {
        return toTimestamp(value.toDate());
      } catch (error) {
        return 0;
      }
    }
  }
  return 0;
};

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

const getTimelineLatestTime = (record) => {
  const timeline = record && Array.isArray(record.reviewTimeline)
    ? record.reviewTimeline
    : [];
  return timeline.reduce((latest, entry) => (
    Math.max(latest, toTimestamp(entry && entry.time))
  ), 0);
};

const resolveUpdatedAt = (record) => {
  if (!record || typeof record !== 'object') return 0;
  const fields = [
    record.updatedAt,
    record.updated_at,
    record.lastUpdated,
    record.lastUpdatedAt,
    record.updateTime
  ];
  for (const value of fields) {
    const timestamp = toTimestamp(value);
    if (timestamp) return timestamp;
  }
  return 0;
};

const resolveActivityTime = (record) => {
  if (!record || typeof record !== 'object') return 0;
  return Math.max(
    toTimestamp(record.lastReviewTime),
    getTimelineLatestTime(record),
    resolveUpdatedAt(record),
    toTimestamp(record.timestamp)
  );
};

const compareWordMasteryVersions = (leftRecord, rightRecord) => {
  const left = leftRecord || {};
  const right = rightRecord || {};
  const leftCount = toCount(left.reviewCount);
  const rightCount = toCount(right.reviewCount);
  if (leftCount !== rightCount) {
    return leftCount > rightCount ? 1 : -1;
  }

  const leftActivity = resolveActivityTime(left);
  const rightActivity = resolveActivityTime(right);
  if (leftActivity !== rightActivity) {
    return leftActivity > rightActivity ? 1 : -1;
  }

  const leftUpdated = resolveUpdatedAt(left);
  const rightUpdated = resolveUpdatedAt(right);
  if (leftUpdated !== rightUpdated) {
    return leftUpdated > rightUpdated ? 1 : -1;
  }
  return 0;
};

const mergeReviewTimeline = (leftRecord, rightRecord) => {
  const timelineMap = new Map();
  const append = (timeline) => {
    (Array.isArray(timeline) ? timeline : []).forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      const time = toTimestamp(entry.time);
      if (!time) return;
      const key = `${time}_${toCount(entry.reviewCount)}_${String(entry.status || '')}`;
      const existing = timelineMap.get(key);
      timelineMap.set(key, existing ? { ...existing, ...entry, time } : { ...entry, time });
    });
  };
  append(leftRecord && leftRecord.reviewTimeline);
  append(rightRecord && rightRecord.reviewTimeline);
  return Array.from(timelineMap.values()).sort((a, b) => a.time - b.time);
};

/**
 * 单词掌握状态采用“整条记录版本”合并，避免按字段 max/or 拼出不存在的组合。
 * 版本优先级：reviewCount > 最近活动时间 > updatedAt；完全相同时第二个参数作为云端/调用方权威值。
 */
const mergeWordMasteryRecord = (localRecord, cloudRecord) => {
  const local = localRecord && typeof localRecord === 'object' ? localRecord : {};
  const cloud = cloudRecord && typeof cloudRecord === 'object' ? cloudRecord : {};
  const comparison = compareWordMasteryVersions(local, cloud);
  const winner = comparison > 0 ? local : cloud;
  const loser = comparison > 0 ? cloud : local;
  const result = {
    ...loser,
    ...winner
  };

  const firstTimes = [
    toTimestamp(local.firstMasteryTime),
    toTimestamp(cloud.firstMasteryTime)
  ].filter(Boolean);
  if (firstTimes.length > 0) {
    result.firstMasteryTime = Math.min(...firstTimes);
  } else {
    delete result.firstMasteryTime;
  }

  result.reviewCount = toCount(winner.reviewCount);
  result.reviewTimeline = mergeReviewTimeline(local, cloud);

  const latestReviewTime = toTimestamp(winner.lastReviewTime);
  if (latestReviewTime) {
    result.lastReviewTime = latestReviewTime;
  } else if (!hasOwn(winner, 'lastReviewTime')) {
    const fallbackLastReviewTime = toTimestamp(loser.lastReviewTime);
    if (fallbackLastReviewTime) result.lastReviewTime = fallbackLastReviewTime;
  }

  if (hasOwn(winner, 'antiForgettingSeed')) {
    result.antiForgettingSeed = toBoolean(winner.antiForgettingSeed) === true;
  } else if (hasOwn(loser, 'antiForgettingSeed')) {
    result.antiForgettingSeed = toBoolean(loser.antiForgettingSeed) === true;
  }

  const winnerMastered = hasOwn(winner, 'mastered') ? toBoolean(winner.mastered) : null;
  const winnerDifficult = hasOwn(winner, 'difficult') ? toBoolean(winner.difficult) : null;
  if (winnerDifficult === true) {
    result.difficult = true;
    result.mastered = false;
  } else if (winnerMastered === true) {
    result.mastered = true;
    result.difficult = false;
  } else {
    if (winnerMastered !== null) result.mastered = winnerMastered;
    if (winnerDifficult !== null) result.difficult = winnerDifficult;
  }

  if (result.reviewCount >= 5) {
    result.antiForgettingSeed = false;
  }

  return result;
};

const resolveRecordTimestamp = (record) => {
  if (!record || typeof record !== 'object') return 0;
  const values = [
    record.updatedAt,
    record.updated_at,
    record.lastUpdated,
    record.lastUpdatedAt,
    record.updateTime,
    record.timestamp,
    record.studyDate,
    record.learningDate,
    record.date,
    record.createdAt
  ];
  for (const value of values) {
    const timestamp = toTimestamp(value);
    if (timestamp) return timestamp;
  }
  return 0;
};

const mergeById = (localItems, cloudItems, idKey) => {
  const map = new Map();
  (Array.isArray(localItems) ? localItems : []).forEach((item) => {
    if (!item || item[idKey] === undefined || item[idKey] === null) return;
    map.set(String(item[idKey]), item);
  });

  (Array.isArray(cloudItems) ? cloudItems : []).forEach((item) => {
    if (!item || item[idKey] === undefined || item[idKey] === null) return;
    const id = String(item[idKey]);
    const localItem = map.get(id);
    if (!localItem) {
      map.set(id, item);
      return;
    }

    const localTime = resolveRecordTimestamp(localItem);
    const cloudTime = resolveRecordTimestamp(item);
    if (cloudTime >= localTime) {
      map.set(id, {
        ...localItem,
        ...item
      });
    } else {
      map.set(id, {
        ...item,
        ...localItem
      });
    }
  });
  return Array.from(map.values());
};

module.exports = {
  compareWordMasteryVersions,
  mergeById,
  mergeWordMasteryRecord,
  resolveActivityTime,
  resolveRecordTimestamp,
  resolveUpdatedAt,
  toTimestamp
};
