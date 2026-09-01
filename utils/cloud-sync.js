/**
 * utils/cloud-sync.js
 * Incremental cloud sync utilities.
 */
'use strict';

const DEFAULT_ENV = 'cloudbase-4gafzdch60ad597b';
const { syncStudentStatsToCloud } = require('./stats-engine.js');
const {
  mergeLearningProgress,
  reconcileStudentLearningProgress
} = require('./learning-progress.js');
const { createCloudReadOnlyResult, isCloudReadOnlyMode } = require('./cloud-mode.js');
const {
  compareWordMasteryVersions,
  mergeWordMasteryRecord
} = require('./sync-merge.js');
const syncStudentStatistics = syncStudentStatsToCloud;
const MASTERY_ATOM_FUNCTION_NAME = 'syncMasteryAtom';
const MASTERY_ATOM_PROTOCOL_VERSION = 2;
const MASTERY_ATOM_CAPABILITY_TTL_MS = 5 * 60 * 1000;
const MASTERY_ATOM_RETRY_TTL_MS = 30 * 1000;
let masteryAtomCapabilityCache = null;

const toSafeDocIdPart = (value) => {
  return String(value === undefined || value === null ? '' : value)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);
};

const buildScopedDocId = (openid, ...parts) => {
  const scoped = [toSafeDocIdPart(openid), ...parts.map(toSafeDocIdPart)].filter(Boolean).join('__');
  return scoped.slice(0, 500);
};

const buildPendingMasteryKey = (studentId, wordbookId, wordId) => (
  [studentId, wordbookId, wordId].map(toSafeDocIdPart).join('__')
);

const queuePendingWordMasteryRecords = (studentId, wordbookId, wordRecordsMap, accountId) => {
  if (!studentId || !wordbookId || !wordRecordsMap || typeof wordRecordsMap !== 'object') {
    return 0;
  }
  try {
    const pendingWords = wx.getStorageSync('pendingWordMasterySync') || {};
    let queued = 0;
    Object.keys(wordRecordsMap).forEach((wordId) => {
      const wordRecord = wordRecordsMap[wordId];
      if (!wordRecord || typeof wordRecord !== 'object') return;
      const pendingKey = selectPendingStorageKey(
        pendingWords,
        buildPendingMasteryKey(studentId, wordbookId, wordId),
        accountId
      );
      pendingWords[pendingKey] = {
        ...wordRecord,
        student_id: String(studentId),
        wordbook_id: String(wordbookId),
        word_id: String(wordId),
        ...(accountId ? { accountId: String(accountId) } : {})
      };
      queued++;
    });
    if (queued > 0) wx.setStorageSync('pendingWordMasterySync', pendingWords);
    return queued;
  } catch (e) {
    console.warn('[cloud-sync] failed to persist pending mastery records:', e);
    return 0;
  }
};

const queuePendingLearningProgress = (studentId, progressData, accountId) => {
  if (!studentId || !progressData || typeof progressData !== 'object') return false;
  try {
    const currentPending = wx.getStorageSync('pendingLearningProgressSync') || {};
    const pendingProgressMap = currentPending.studentId && currentPending.progressData
      ? { [String(currentPending.studentId)]: currentPending }
      : currentPending;
    const pendingKey = selectPendingStorageKey(pendingProgressMap, String(studentId), accountId);
    const existingPending = pendingProgressMap[pendingKey];
    const sameAccountPending = existingPending &&
      String(existingPending.studentId || '') === String(studentId) &&
      getPendingAccountId(existingPending) === normalizeAccountId(accountId);
    const mergedProgressData = sameAccountPending
      ? mergeLearningProgress(existingPending.progressData, progressData)
      : progressData;
    pendingProgressMap[pendingKey] = {
      studentId: String(studentId),
      progressData: mergedProgressData,
      failedAt: Date.now(),
      pendingVersion: sameAccountPending
        ? (Number(existingPending.pendingVersion || 0) || 0) + 1
        : 1,
      ...(accountId ? { accountId: String(accountId) } : {})
    };
    wx.setStorageSync('pendingLearningProgressSync', pendingProgressMap);
    return true;
  } catch (e) {
    console.warn('[cloud-sync] failed to persist pending learning progress:', e);
    return false;
  }
};

const isSamePendingLearningProgress = (currentPending, retrySnapshot) => {
  if (!currentPending || !retrySnapshot) return false;
  if (String(currentPending.studentId || '') !== String(retrySnapshot.studentId || '')) return false;
  if (getPendingAccountId(currentPending) !== getPendingAccountId(retrySnapshot)) return false;
  const currentVersion = Number(currentPending.pendingVersion || 0) || 0;
  const retryVersion = Number(retrySnapshot.pendingVersion || 0) || 0;
  if (currentVersion > 0 || retryVersion > 0) {
    return currentVersion === retryVersion;
  }
  return Number(currentPending.failedAt || 0) === Number(retrySnapshot.failedAt || 0) &&
    JSON.stringify(currentPending.progressData || {}) === JSON.stringify(retrySnapshot.progressData || {});
};

const selectWordMasteryRecords = (wordRecordsMap, wordIds) => {
  const source = wordRecordsMap && typeof wordRecordsMap === 'object' && !Array.isArray(wordRecordsMap)
    ? wordRecordsMap
    : {};
  const selected = {};
  const seen = new Set();
  (Array.isArray(wordIds) ? wordIds : []).forEach((rawWordId) => {
    const wordId = String(rawWordId === undefined || rawWordId === null ? '' : rawWordId);
    if (!wordId || seen.has(wordId)) {
      return;
    }
    seen.add(wordId);
    if (Object.prototype.hasOwnProperty.call(source, wordId) && source[wordId]) {
      selected[wordId] = source[wordId];
    }
  });
  return selected;
};

const ensureDb = () => {
  if (!wx.cloud) {
    return null;
  }
  try {
    return wx.cloud.database({ env: DEFAULT_ENV });
  } catch (error) {
    console.warn('[cloud-sync] failed to get db instance:', error);
    return null;
  }
};

const getOpenId = () => {
  try {
    const val = wx.getStorageSync('openid');
    if (!val) {
      console.warn('[cloud-sync] getOpenId: openid 为空，所有云同步将跳过');
    }
    return val || null;
  } catch (error) {
    console.warn('[cloud-sync] getOpenId 读取异常:', error);
    return null;
  }
};

const normalizeAccountId = (value) => String(
  value === undefined || value === null ? '' : value
).trim();

const getPendingAccountId = (pending) => normalizeAccountId(
  pending && (pending.accountId || pending.teacher_id || pending.teacherId || pending.ownerId || pending.ownerUsername)
);

const selectPendingStorageKey = (pendingMap, baseKey, accountId) => {
  const existing = pendingMap && pendingMap[baseKey];
  const normalizedAccountId = normalizeAccountId(accountId);
  if (!existing || getPendingAccountId(existing) === normalizedAccountId) return baseKey;
  return baseKey + '__account__' + toSafeDocIdPart(normalizedAccountId || 'unknown');
};

const getStudentOwnerForPending = (pending) => {
  const studentId = String(pending && (
    pending.studentId || pending.student_id || pending.userId
  ) || '').trim();
  if (!studentId) return '';
  try {
    const students = wx.getStorageSync('students');
    const owners = new Set((Array.isArray(students) ? students : [])
      .filter((student) => String(student && (student.id || student.student_id) || '') === studentId)
      .map((student) => normalizeAccountId(student && (
        student.ownerId || student.ownerUsername || student.teacher_id || student.teacherId
      )))
      .filter(Boolean));
    return owners.size === 1 ? Array.from(owners)[0] : '';
  } catch (error) {
    return '';
  }
};

const resolvePendingAccount = (pending) => {
  const explicit = getPendingAccountId(pending);
  if (explicit) return { known: true, accountId: explicit, source: 'pending' };
  const studentOwner = getStudentOwnerForPending(pending);
  if (studentOwner) return { known: true, accountId: studentOwner, source: 'student_owner' };
  return { known: false, accountId: '', source: 'unknown' };
};

const pendingBelongsToAccount = (pending, accountId) => {
  const resolved = resolvePendingAccount(pending);
  return resolved.known && resolved.accountId === normalizeAccountId(accountId);
};

const countPendingForAccount = (pendingMap, accountId) => Object.values(
  pendingMap && typeof pendingMap === 'object' && !Array.isArray(pendingMap) ? pendingMap : {}
).filter((pending) => pendingBelongsToAccount(pending, accountId)).length;

const removePendingEntriesForAccount = (pendingMap, baseKey, accountId) => {
  let removed = false;
  Object.keys(pendingMap || {}).forEach((key) => {
    if (key !== baseKey && key.indexOf(baseKey + '__account__') !== 0) return;
    if (!pendingBelongsToAccount(pendingMap[key], accountId)) return;
    delete pendingMap[key];
    removed = true;
  });
  return removed;
};

const accountSideEffectsAreCurrent = (options) => {
  const accountSession = options && options.accountSession;
  if (!accountSession) return true;
  const { isAccountSessionCurrent } = require('./account-session.js');
  return isAccountSessionCurrent(accountSession);
};

const captureOperationOptions = (options, accountId) => {
  if (options && options.accountSession) return options;
  const { captureAccountSession } = require('./account-session.js');
  return {
    ...(options || {}),
    accountSession: captureAccountSession(accountId)
  };
};

const getMasteryAtomCapability = async () => {
  if (!wx.cloud || typeof wx.cloud.callFunction !== 'function') {
    return { supported: false, reason: 'call_function_unavailable' };
  }

  const now = Date.now();
  if (
    masteryAtomCapabilityCache
    && now - masteryAtomCapabilityCache.checkedAt
      < (masteryAtomCapabilityCache.supported
        ? MASTERY_ATOM_CAPABILITY_TTL_MS
        : MASTERY_ATOM_RETRY_TTL_MS)
  ) {
    return masteryAtomCapabilityCache;
  }

  try {
    const response = await wx.cloud.callFunction({
      name: MASTERY_ATOM_FUNCTION_NAME,
      data: { action: 'capabilities' }
    });
    const result = response && response.result ? response.result : {};
    const supported = result.success === true
      && Number(result.protocolVersion) === MASTERY_ATOM_PROTOCOL_VERSION
      && result.features
      && result.features.transactionalMasteryMerge === true
      && result.features.legacyOwnershipAdoption === true;
    masteryAtomCapabilityCache = {
      supported: !!supported,
      maxBatchSize: supported
        ? Math.max(1, Math.min(20, Number(result.maxBatchSize) || 20))
        : 0,
      checkedAt: now,
      reason: supported ? 'supported' : 'unsupported_protocol'
    };
  } catch (error) {
    masteryAtomCapabilityCache = masteryAtomCapabilityCache
      && masteryAtomCapabilityCache.supported
      ? {
        ...masteryAtomCapabilityCache,
        checkedAt: now,
        reason: 'stale_supported_after_capability_error',
        error
      }
      : {
        supported: false,
        maxBatchSize: 0,
        checkedAt: now,
        reason: 'capability_check_failed',
        error
      };
  }
  return masteryAtomCapabilityCache;
};

// 同步状态管理（全局持久化，供首页展示）
const SYNC_STATUS_KEY = '__syncStatus';

const getSyncStatus = () => {
  try {
    const raw = wx.getStorageSync(SYNC_STATUS_KEY);
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return { pending: raw.pending || 0, lastOk: raw.lastOk || 0, lastFail: raw.lastFail || 0 };
    }
  } catch (e) { /* ignore */ }
  return { pending: 0, lastOk: 0, lastFail: 0 };
};

const _updateSyncStatus = (patch) => {
  try {
    const current = getSyncStatus();
    const updated = { ...current, ...patch };
    wx.setStorageSync(SYNC_STATUS_KEY, updated);
    return updated;
  } catch (e) { return null; }
};

const countObjectEntries = (value) => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value).length
    : 0
);

const getPersistedPendingSyncCount = () => {
  try {
    const pendingProgress = wx.getStorageSync('pendingLearningProgressSync') || {};
    const pendingProgressCount = pendingProgress.studentId && pendingProgress.progressData
      ? 1
      : countObjectEntries(pendingProgress);
    return countObjectEntries(wx.getStorageSync('pendingLearningRecordSync')) +
      countObjectEntries(wx.getStorageSync('pendingWordMasterySync')) +
      pendingProgressCount +
      countObjectEntries(wx.getStorageSync('pendingPreviewStateSync'));
  } catch (e) {
    return 0;
  }
};

const refreshPendingSyncStatus = (eventType) => {
  const pending = getPersistedPendingSyncCount();
  const status = getSyncStatus();
  status.pending = pending;
  if (eventType === 'fail') status.lastFail = Date.now();
  if (eventType === 'success') status.lastOk = Date.now();
  try {
    if (pending > 0) {
      wx.setStorageSync('pendingSyncProgress', true);
    } else {
      wx.removeStorageSync('pendingSyncProgress');
    }
    wx.setStorageSync(SYNC_STATUS_KEY, status);
  } catch (e) { /* ignore */ }
  return status;
};

const markPendingSync = () => {
  return refreshPendingSyncStatus('fail');
};

const markSyncSuccess = (count) => {
  if (!count || count <= 0) return;
  return refreshPendingSyncStatus('success');
};

const PENDING_LEARNING_RECORDS_KEY = 'pendingLearningRecordSync';
const PENDING_PREVIEW_STATE_KEY = 'pendingPreviewStateSync';

const buildPendingPreviewStateKey = (studentId, wordbookId) => {
  if (!studentId || !wordbookId) return '';
  return String(studentId) + '__' + String(wordbookId);
};

const readPendingPreviewStates = () => {
  try {
    const raw = wx.getStorageSync(PENDING_PREVIEW_STATE_KEY);
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch (e) {
    console.warn('[cloud-sync] failed to read pending preview states:', e);
    return {};
  }
};

const queuePendingPreviewState = (studentId, wordbookId, previewData, accountId) => {
  const pendingKey = buildPendingPreviewStateKey(studentId, wordbookId);
  if (!pendingKey || !previewData || typeof previewData !== 'object') return null;
  try {
    const pendingStates = readPendingPreviewStates();
    const storageKey = selectPendingStorageKey(pendingStates, pendingKey, accountId);
    const added = !Object.prototype.hasOwnProperty.call(pendingStates, storageKey);
    pendingStates[storageKey] = {
      studentId: String(studentId),
      wordbookId: String(wordbookId),
      previewData: {
        mastery: previewData.mastery || {},
        order: previewData.order || [],
        excluded: previewData.excluded || [],
        reset: previewData.reset === true
      },
      failedAt: Date.now(),
      ...(accountId ? { accountId: String(accountId) } : {})
    };
    wx.setStorageSync(PENDING_PREVIEW_STATE_KEY, pendingStates);
    return { added, pendingKey };
  } catch (e) {
    console.warn('[cloud-sync] failed to persist pending preview state:', e);
    return null;
  }
};

const markPreviewStatePending = (studentId, wordbookId, previewData, accountId) => {
  const queued = queuePendingPreviewState(studentId, wordbookId, previewData, accountId);
  if (!queued || queued.added) {
    markPendingSync();
  } else {
    _updateSyncStatus({ lastFail: Date.now() });
  }
};

const removePendingPreviewState = (studentId, wordbookId, accountId) => {
  const pendingKey = buildPendingPreviewStateKey(studentId, wordbookId);
  if (!pendingKey) return false;
  try {
    const pendingStates = readPendingPreviewStates();
    const removed = removePendingEntriesForAccount(pendingStates, pendingKey, accountId);
    if (!removed) return false;
    if (Object.keys(pendingStates).length === 0) {
      wx.removeStorageSync(PENDING_PREVIEW_STATE_KEY);
    } else {
      wx.setStorageSync(PENDING_PREVIEW_STATE_KEY, pendingStates);
    }
    return true;
  } catch (e) {
    console.warn('[cloud-sync] failed to clear pending preview state:', e);
    return false;
  }
};

const readPendingLearningRecords = () => {
  try {
    const raw = wx.getStorageSync(PENDING_LEARNING_RECORDS_KEY);
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return raw;
    }
  } catch (e) {
    console.warn('[cloud-sync] failed to read pending learning records:', e);
  }
  return {};
};

const normalizePendingLearningRecord = (record) => {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return null;
  }
  const normalized = withUpdatedAt({ ...record });
  const stableRecordId = ensureLearningRecordId(normalized);
  if (!stableRecordId) {
    return null;
  }
  normalized.id = stableRecordId;
  delete normalized._wordKeyMap;
  delete normalized.emit;
  delete normalized._openid;
  delete normalized._id;
  return normalized;
};

const buildPendingLearningRecordKey = (record) => {
  const normalized = normalizePendingLearningRecord(record);
  if (!normalized) {
    return '';
  }
  const studentId = normalized.studentId || normalized.student_id || normalized.userId || '';
  const wordbookId = normalized.wordbookId || normalized.wordbook_id || '';
  return JSON.stringify([String(studentId), String(wordbookId), String(normalized.id)]);
};

const queuePendingLearningRecord = (record, accountId) => {
  const normalized = normalizePendingLearningRecord(record);
  if (!normalized) {
    return null;
  }
  const pendingKey = buildPendingLearningRecordKey(normalized);
  if (!pendingKey) {
    return null;
  }
  try {
    const pendingRecords = readPendingLearningRecords();
    const storageKey = selectPendingStorageKey(pendingRecords, pendingKey, accountId);
    const added = !Object.prototype.hasOwnProperty.call(pendingRecords, storageKey);
    pendingRecords[storageKey] = {
      ...normalized,
      ...(accountId ? { accountId: String(accountId) } : {})
    };
    wx.setStorageSync(PENDING_LEARNING_RECORDS_KEY, pendingRecords);
    return { added, pendingKey };
  } catch (e) {
    console.warn('[cloud-sync] failed to persist pending learning record:', e);
    return null;
  }
};

const markLearningRecordPending = (record, accountId) => {
  const queued = queuePendingLearningRecord(record, accountId);
  if (!queued || queued.added) {
    markPendingSync();
    return;
  }
  _updateSyncStatus({ lastFail: Date.now() });
};

const removePendingLearningRecord = (record, accountId) => {
  const pendingKey = buildPendingLearningRecordKey(record);
  if (!pendingKey) {
    return false;
  }
  try {
    const pendingRecords = readPendingLearningRecords();
    const removed = removePendingEntriesForAccount(pendingRecords, pendingKey, accountId);
    if (!removed) return false;
    if (Object.keys(pendingRecords).length === 0) {
      wx.removeStorageSync(PENDING_LEARNING_RECORDS_KEY);
    } else {
      wx.setStorageSync(PENDING_LEARNING_RECORDS_KEY, pendingRecords);
    }
    return true;
  } catch (e) {
    console.warn('[cloud-sync] failed to clear pending learning record:', e);
    return false;
  }
};

const retryPendingSyncs = async (options = {}) => {
  if (isCloudReadOnlyMode()) {
    console.log('[cloud-sync] 只读模式：跳过待同步重试');
    return createCloudReadOnlyResult('retryPendingSyncs');
  }

  const db = ensureDb();
  const openid = normalizeAccountId(options.accountId || getOpenId());
  const {
    captureAccountSession,
    isAccountSessionCurrent
  } = require('./account-session.js');
  const accountSession = options.accountSession || captureAccountSession(openid);
  if (accountSession && !isAccountSessionCurrent(accountSession)) {
    return { skipped: true, reason: 'account_session_changed' };
  }
  if (!db || !openid) {
    console.warn('[cloud-sync] retryPendingSyncs: db或openid不可用，跳过 (db=', !!db, 'openid=', !!openid, ')');
    return { skipped: true };
  }

  const promises = [];

  // 学习记录使用稳定记录 ID 重试，确保重复尝试仍写入同一个云端文档。
  try {
    const pendingRecords = readPendingLearningRecords();
    Object.keys(pendingRecords).forEach((pendingKey) => {
      const pendingRecord = pendingRecords[pendingKey];
      if (!pendingRecord || typeof pendingRecord !== 'object') {
        console.warn('[cloud-sync] invalid pending learning record retained:', pendingKey);
        return;
      }
      if (!pendingBelongsToAccount(pendingRecord, openid)) return;
      promises.push(syncLearningRecord(pendingRecord, {
        accountId: openid,
        accountSession
      }));
    });
  } catch (e) {
    console.warn('[cloud-sync] retry pending learning records failed:', e);
  }

  // 重试失败的 word_mastery 记录
  try {
    const pendingWords = wx.getStorageSync('pendingWordMasterySync') || {};
    const pendingKeys = Object.keys(pendingWords);
    if (pendingKeys.length > 0) {
      console.log('[cloud-sync] 重试同步', pendingKeys.length, '条失败的 word_mastery 记录');
      // 新格式以 student + wordbook + word 作为 key；旧格式仍兼容 wordId→record。
      const byStudentWordbook = {};
      let orphanCount = 0;

      pendingKeys.forEach((pendingKey) => {
        const record = pendingWords[pendingKey];
        if (!record) return;
        if (!pendingBelongsToAccount(record, openid)) return;
        const wordId = String(record.word_id || record.wordId || pendingKey);
        let sid = record.student_id || record.studentId || '';
        let wid = record.wordbook_id || record.wordbookId || '';

        // 兜底：从本地 wordMastery 反查 studentId / wordbookId
        if (!sid || !wid) {
          try {
            const wordMastery = wx.getStorageSync('wordMastery') || {};
            const studentIds = Object.keys(wordMastery);
            for (let si = 0; si < studentIds.length && (!sid || !wid); si++) {
              const sId = studentIds[si];
              const wbIds = Object.keys(wordMastery[sId] || {});
              for (let wi = 0; wi < wbIds.length && (!sid || !wid); wi++) {
                const wbId = wbIds[wi];
                if (wordMastery[sId][wbId] && wordMastery[sId][wbId][wordId] !== undefined) {
                  sid = sId;
                  wid = wbId;
                }
              }
            }
          } catch (e) { /* ignore */ }
        }

        if (!sid || !wid) {
          orphanCount++;
          return;
        }
        const key = sid + '|' + wid;
        if (!byStudentWordbook[key]) {
          byStudentWordbook[key] = { records: {}, pendingKeys: [] };
        }
        byStudentWordbook[key].records[wordId] = record;
        byStudentWordbook[key].pendingKeys.push(pendingKey);
      });

      if (orphanCount > 0) {
        console.warn('[cloud-sync] 重试时发现', orphanCount, '条孤儿记录（无法确定归属），保留待人工定位');
      }

      Object.keys(byStudentWordbook).forEach((key) => {
        const [studentId, wordbookId] = key.split('|');
        const group = byStudentWordbook[key];
        promises.push(
          syncWordMasteryBatch(studentId, wordbookId, group.records, {
            accountId: openid,
            accountSession
          }).then((result) => {
            if (!result || result.failed !== 0 || result.skipped || result.error) return;
            const remaining = wx.getStorageSync('pendingWordMasterySync') || {};
            group.pendingKeys.forEach((pendingKey) => {
              delete remaining[pendingKey];
            });
            if (Object.keys(remaining).length === 0) {
              wx.removeStorageSync('pendingWordMasterySync');
            } else {
              wx.setStorageSync('pendingWordMasterySync', remaining);
            }
          })
        );
      });
    }
  } catch (e) {
    console.warn('[cloud-sync] 重试 pendingWordMasterySync 失败:', e);
  }

  // 重试失败的 learning_progress 同步
  try {
    const pendingProgressRaw = wx.getStorageSync('pendingLearningProgressSync') || {};
    const pendingProgressMap = pendingProgressRaw.studentId && pendingProgressRaw.progressData
      ? { [String(pendingProgressRaw.studentId)]: pendingProgressRaw }
      : pendingProgressRaw;
    Object.keys(pendingProgressMap).forEach((pendingStudentId) => {
      const pendingProgress = pendingProgressMap[pendingStudentId];
      if (!pendingProgress || !pendingProgress.studentId || !pendingProgress.progressData) return;
      if (!pendingBelongsToAccount(pendingProgress, openid)) return;
      console.log('[cloud-sync] 重试同步 learning_progress:', pendingProgress.studentId);
      promises.push(syncLearningProgress(
        pendingProgress.studentId,
        pendingProgress.progressData,
        { accountId: openid, accountSession }
      ).then((result) => {
        if (!result || !result.ok) return;
        const currentRaw = wx.getStorageSync('pendingLearningProgressSync') || {};
        if (currentRaw.studentId && currentRaw.progressData) {
          if (isSamePendingLearningProgress(currentRaw, pendingProgress)) {
            wx.removeStorageSync('pendingLearningProgressSync');
          }
          return;
        }
        if (isSamePendingLearningProgress(currentRaw[pendingStudentId], pendingProgress)) {
          delete currentRaw[pendingStudentId];
        }
        if (Object.keys(currentRaw).length === 0) {
          wx.removeStorageSync('pendingLearningProgressSync');
        } else {
          wx.setStorageSync('pendingLearningProgressSync', currentRaw);
        }
      }));
    });
  } catch (e) { /* ignore */ }

  try {
    const pendingPreviewStates = readPendingPreviewStates();
    Object.keys(pendingPreviewStates).forEach((pendingKey) => {
      const pending = pendingPreviewStates[pendingKey];
      if (!pending || !pending.studentId || !pending.wordbookId || !pending.previewData) return;
      if (!pendingBelongsToAccount(pending, openid)) return;
      promises.push(syncPreviewState(
        pending.studentId,
        pending.wordbookId,
        pending.previewData,
        { accountId: openid, accountSession }
      ));
    });
  } catch (e) {
    console.warn('[cloud-sync] retry pending preview states failed:', e);
  }

  await Promise.all(promises);
  if (accountSession && !isAccountSessionCurrent(accountSession)) {
    return { skipped: true, reason: 'account_session_changed' };
  }
  let realPending = 0;
  let actionablePending = 0;
  try {
    // 重试完成后，用实际待同步数据量更新计数器
    const pendingRecords = readPendingLearningRecords();
    const pendingWords = wx.getStorageSync('pendingWordMasterySync') || {};
    const pendingProg = wx.getStorageSync('pendingLearningProgressSync') || {};
    const pendingPreview = readPendingPreviewStates();
    const pendingProgressCount = pendingProg.studentId && pendingProg.progressData
      ? 1
      : Object.keys(pendingProg).length;
    realPending = Object.keys(pendingRecords).length +
      Object.keys(pendingWords).length +
      pendingProgressCount +
      Object.keys(pendingPreview).length;
    actionablePending = countPendingForAccount(pendingRecords, openid) +
      countPendingForAccount(pendingWords, openid) +
      countPendingForAccount(pendingProg.studentId && pendingProg.progressData
        ? { legacy: pendingProg }
        : pendingProg, openid) +
      countPendingForAccount(pendingPreview, openid);
    if (realPending === 0) {
      wx.removeStorageSync('pendingSyncProgress');
    } else {
      wx.setStorageSync('pendingSyncProgress', true);
    }
    const status = getSyncStatus();
    status.pending = realPending;
    status.lastOk = realPending === 0 ? Date.now() : status.lastOk;
    wx.setStorageSync(SYNC_STATUS_KEY, status);
  } catch (e) { /* ignore */ }
  const retryResult = { ok: true, pending: actionablePending };
  const retained = realPending - actionablePending;
  if (retained > 0) retryResult.retained = retained;
  return retryResult;
};

const resolveUpdatedAt = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return 0;
  }
  if (typeof obj.updatedAt === 'number') {
    return obj.updatedAt;
  }
  const parsed = Date.parse(obj.updatedAt || obj.updated_at || obj.lastUpdatedAt || obj.updateTime || '');
  return Number.isNaN(parsed) ? 0 : parsed;
};

const stripSystemFields = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const { _id, _openid, _createTime, _updateTime, ...clean } = value;
  return clean;
};

const withUpdatedAt = (obj) => {
  const base = obj && typeof obj === 'object' ? { ...obj } : {};
  const updatedAt = resolveUpdatedAt(base) || Date.now();
  // 剥离系统保留字段，避免 _id 被带入 .set() 导致 E11000 主键冲突
  const clean = stripSystemFields(base);
  return { ...clean, updatedAt };
};

const isPlainRecordObject = (value) => (
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.prototype.toString.call(value) === '[object Object]'
);

const isNonEmptyRecordValue = (value) => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  if (isPlainRecordObject(value)) {
    return Object.keys(value).some((key) => isNonEmptyRecordValue(value[key]));
  }
  return true;
};

const cloneRecordValue = (value) => {
  if (Array.isArray(value)) return value.map((item) => cloneRecordValue(item));
  if (!isPlainRecordObject(value)) return value;
  const cloned = {};
  Object.keys(value).forEach((key) => {
    const item = cloneRecordValue(value[key]);
    if (item !== undefined) cloned[key] = item;
  });
  return cloned;
};

// 历史记录默认以云端已有非空字段为准；只有调用方已经带有可靠版本证据时，
// 才允许指定的版本化历史字段用非空新值更新。空值永远不能擦除已有值。
const mergeRecordObjectValues = (cloudValue, incomingValue, incomingWins) => {
  const cloudObject = isPlainRecordObject(cloudValue) ? cloudValue : {};
  const incomingObject = isPlainRecordObject(incomingValue) ? incomingValue : {};
  const merged = {};
  const keys = new Set(Object.keys(cloudObject).concat(Object.keys(incomingObject)));
  keys.forEach((key) => {
    const cloudItem = cloudObject[key];
    const incomingItem = incomingObject[key];
    let value;
    if (isPlainRecordObject(cloudItem) || isPlainRecordObject(incomingItem)) {
      value = mergeRecordObjectValues(cloudItem, incomingItem, incomingWins);
    } else if (incomingWins) {
      value = isNonEmptyRecordValue(incomingItem)
        ? cloneRecordValue(incomingItem)
        : cloneRecordValue(cloudItem);
    } else {
      value = isNonEmptyRecordValue(cloudItem)
        ? cloneRecordValue(cloudItem)
        : cloneRecordValue(incomingItem);
    }
    if (value !== undefined) merged[key] = value;
  });
  return merged;
};

const getWordSnapshotIdentity = (word, index) => {
  if (!word || typeof word !== 'object') return `value:${index}:${String(word)}`;
  const identity = word.wordId || word.sourceWordId || word.id || word.word;
  return identity ? `word:${String(identity)}` : `value:${index}:${JSON.stringify(word)}`;
};

const mergeWordSnapshots = (cloudWords, incomingWords, incomingWins) => {
  const merged = [];
  const positions = new Map();
  (Array.isArray(cloudWords) ? cloudWords : []).forEach((word, index) => {
    const key = getWordSnapshotIdentity(word, index);
    positions.set(key, merged.length);
    merged.push(cloneRecordValue(word));
  });
  (Array.isArray(incomingWords) ? incomingWords : []).forEach((word, index) => {
    const key = getWordSnapshotIdentity(word, index);
    const existingIndex = positions.get(key);
    if (existingIndex === undefined) {
      positions.set(key, merged.length);
      merged.push(cloneRecordValue(word));
      return;
    }
    merged[existingIndex] = mergeRecordObjectValues(merged[existingIndex], word, incomingWins);
  });
  return merged;
};

const resolveRecordSchemaVersion = (record) => {
  const value = Number(record && record.recordSchemaVersion);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

const mergeLearningRecordForWrite = (cloudRecord, incomingRecord, options = {}) => {
  const cloud = stripSystemFields(cloudRecord);
  const incoming = stripSystemFields(incomingRecord);
  const cloudSchemaVersion = resolveRecordSchemaVersion(cloud);
  const incomingSchemaVersion = resolveRecordSchemaVersion(incoming);
  const cloudUpdatedAt = resolveUpdatedAt(cloud);
  const incomingUpdatedAt = resolveUpdatedAt(incoming);
  // recordSchemaVersion 描述数据格式，不是同一事件的修改序号；它只能单调提升并安全补字段，
  // 不能单独作为覆盖云端非空历史值的依据。
  const newerByTime = options.incomingHadReliableUpdatedAt === true &&
    cloudUpdatedAt > 0 &&
    incomingUpdatedAt > cloudUpdatedAt &&
    incomingSchemaVersion >= cloudSchemaVersion;
  const incomingHistoryWins = newerByTime;
  const merged = mergeRecordObjectValues(cloud, incoming, false);

  ['recordKind', 'completedAt', 'studentSnapshot', 'wordbookSnapshot'].forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(cloud, field) &&
      !Object.prototype.hasOwnProperty.call(incoming, field)) return;
    if (isPlainRecordObject(cloud[field]) || isPlainRecordObject(incoming[field])) {
      merged[field] = mergeRecordObjectValues(cloud[field], incoming[field], incomingHistoryWins);
      return;
    }
    merged[field] = incomingHistoryWins && isNonEmptyRecordValue(incoming[field])
      ? cloneRecordValue(incoming[field])
      : (isNonEmptyRecordValue(cloud[field])
        ? cloneRecordValue(cloud[field])
        : cloneRecordValue(incoming[field]));
  });

  if (Array.isArray(cloud.wordsSnapshot) || Array.isArray(incoming.wordsSnapshot)) {
    merged.wordsSnapshot = mergeWordSnapshots(
      cloud.wordsSnapshot,
      incoming.wordsSnapshot,
      incomingHistoryWins
    );
  }

  const schemaVersion = Math.max(cloudSchemaVersion, incomingSchemaVersion);
  if (schemaVersion > 0) merged.recordSchemaVersion = schemaVersion;
  const updatedAt = Math.max(cloudUpdatedAt, incomingUpdatedAt);
  if (updatedAt > 0) merged.updatedAt = updatedAt;
  return stripSystemFields(merged);
};

const ensureLearningRecordId = (record) => {
  if (!record || typeof record !== 'object') {
    return '';
  }
  if (record.id !== undefined && record.id !== null && String(record.id).trim()) {
    return String(record.id).trim();
  }
  const studentId = record.studentId || record.student_id || record.userId || '';
  const wordbookId = record.wordbookId || record.wordbook_id || '';
  const timeSeed = record.timestamp || record.updatedAt || record.studyDate || record.learningDate || '';
  const wordsSeed = record.totalWords || record.masteredWords || record.wordCount || 0;
  return `${studentId}|${wordbookId}|${timeSeed}|${wordsSeed}`;
};

const getDisplayNames = (studentId) => {
  let studentName = '';
  let teacherName = '';
  try {
    const students = wx.getStorageSync('students') || [];
    const match = students.find((student) => String(student && (student.id || student.student_id || '')) === String(studentId));
    if (match && match.name) {
      studentName = match.name;
    } else {
      const currentStudent = wx.getStorageSync('currentStudent') || {};
      if (currentStudent.name && String(currentStudent.id || '') === String(studentId)) {
        studentName = currentStudent.name;
      }
      if (currentStudent.teacher_name) {
        teacherName = currentStudent.teacher_name;
      }
    }
    if (match && match.teacher_name) {
      teacherName = match.teacher_name;
    }
    if (!teacherName) {
      const currentUser = wx.getStorageSync('currentUser') || {};
      if (currentUser.name) {
        teacherName = currentUser.name;
      }
    }
  } catch (e) {
    // ignore
  }
  return { studentName, teacherName };
};

const syncWordMasteryViaAtom = async (
  studentId,
  wordbookId,
  wordRecordsMap,
  displayNames,
  capability
) => {
  const wordIds = Object.keys(wordRecordsMap || {});
  const batchSize = Math.max(1, Number(capability && capability.maxBatchSize) || 20);
  const allResults = [];

  for (let offset = 0; offset < wordIds.length; offset += batchSize) {
    const batchWordIds = wordIds.slice(offset, offset + batchSize);
    const records = batchWordIds.map((wordId) => {
      const cleanRecord = withUpdatedAt(stripSystemFields(wordRecordsMap[wordId]));
      [
        'accountId',
        'teacher_id', 'teacherId',
        'student_id', 'studentId',
        'wordbook_id', 'wordbookId',
        'word_id', 'wordId'
      ].forEach((key) => delete cleanRecord[key]);
      return {
        ...cleanRecord,
        studentId: String(studentId),
        wordbookId: String(wordbookId),
        wordId: String(wordId),
        ...displayNames
      };
    });

    try {
      const response = await wx.cloud.callFunction({
        name: MASTERY_ATOM_FUNCTION_NAME,
        data: { records }
      });
      const result = response && response.result ? response.result : {};
      if (Number(result.protocolVersion) !== MASTERY_ATOM_PROTOCOL_VERSION) {
        batchWordIds.forEach((wordId) => {
          allResults.push({
            wordId,
            ok: false,
            error: 'mastery_atom_protocol_mismatch'
          });
        });
        continue;
      }

      const resultMap = new Map();
      (Array.isArray(result.results) ? result.results : []).forEach((item) => {
        if (item && item.wordId !== undefined && item.wordId !== null) {
          resultMap.set(String(item.wordId), item);
        }
      });
      batchWordIds.forEach((wordId) => {
        const item = resultMap.get(String(wordId));
        allResults.push(item
          ? {
            ...item,
            wordId: String(wordId),
            ok: item.ok === true
          }
          : {
            wordId: String(wordId),
            ok: false,
            error: result.error || 'mastery_atom_missing_result'
          });
      });
    } catch (error) {
      batchWordIds.forEach((wordId) => {
        allResults.push({
          wordId: String(wordId),
          ok: false,
          error
        });
      });
    }
  }

  return allResults;
};

const syncLearningRecord = (record, options = {}) => {
  if (isCloudReadOnlyMode()) {
    return Promise.resolve(createCloudReadOnlyResult('syncLearningRecord'));
  }

  const db = ensureDb();
  const openid = normalizeAccountId(options.accountId || getOpenId());
  const operationOptions = captureOperationOptions(options, openid);
  if (!db || !openid || !record) {
    console.warn('[cloud-sync] syncLearningRecord 跳过: db=', !!db, 'openid=', !!openid, 'record=', !!record);
    if (record) {
      markLearningRecordPending(record, openid || getStudentOwnerForPending(record));
    } else {
      markPendingSync();
    }
    return Promise.resolve({ skipped: true, reason: 'precondition_failed' });
  }

  const incomingHadReliableUpdatedAt = resolveUpdatedAt(record) > 0;
  const cleanRecord = withUpdatedAt({ ...record });
  const stableRecordId = ensureLearningRecordId(cleanRecord);
  cleanRecord.id = stableRecordId;
  const recordStudentId = cleanRecord.studentId || cleanRecord.student_id || '';
  const displayNames = recordStudentId ? getDisplayNames(recordStudentId) : { studentName: '', teacherName: '' };
  delete cleanRecord._wordKeyMap;
  delete cleanRecord.emit;
  delete cleanRecord.accountId;
  delete cleanRecord._openid;
  delete cleanRecord._id;

  const docId = buildScopedDocId(openid, 'record', stableRecordId);
  const incomingWriteData = {
    ...cleanRecord,
    ...(displayNames.studentName ? { student_name: displayNames.studentName } : {}),
    ...(displayNames.teacherName ? { teacher_name: displayNames.teacherName } : {}),
    teacher_id: openid,
    id: stableRecordId
  };

  // 先读云端，保留未知字段，防止不同版本互相覆盖
  return db.collection('learning_records')
    .doc(docId)
    .get()
    .then((res) => {
      const cloudData = (res && res.data) ? res.data : {};
      const mergedRecord = mergeLearningRecordForWrite(cloudData, incomingWriteData, {
        incomingHadReliableUpdatedAt
      });
      return db.collection('learning_records')
        .doc(docId)
        .set({
          data: {
            ...mergedRecord,
            teacher_id: openid,
            id: stableRecordId
          }
        });
    })
    .catch((getError) => {
      // 文档不存在（首次写入），直接写
      if (getError && getError.errCode === -1) {
        return db.collection('learning_records')
          .doc(docId)
          .set({
            data: stripSystemFields(incomingWriteData)
          });
      }
      throw getError;
    })
    .then(() => {
      console.log('[cloud-sync] learning record synced:', stableRecordId);
      const removedPendingRecord = removePendingLearningRecord(cleanRecord, openid);
      if (removedPendingRecord) {
        if (accountSideEffectsAreCurrent(operationOptions)) markSyncSuccess(1);
      } else if (accountSideEffectsAreCurrent(operationOptions)) {
        _updateSyncStatus({ lastOk: Date.now() });
      }
      return { ok: true };
    })
    .catch((error) => {
      console.warn('[cloud-sync] failed to sync learning record:', error);
      const queued = queuePendingLearningRecord(cleanRecord, openid);
      if (accountSideEffectsAreCurrent(operationOptions)) {
        if (!queued || queued.added) markPendingSync();
        else _updateSyncStatus({ lastFail: Date.now() });
      }
      return { ok: false, error };
    });
};

const syncWordMasteryRecord = (studentId, wordbookId, wordId, wordRecord) => {
  if (!wordId || !wordRecord) {
    _updateSyncStatus({ lastFail: Date.now() });
    return Promise.resolve({ skipped: true, reason: 'invalid_word_record' });
  }
  return syncWordMasteryBatch(studentId, wordbookId, {
    [String(wordId)]: wordRecord
  });
};

const syncWordMasteryBatch = async (studentId, wordbookId, wordRecordsMap, options = {}) => {
  if (isCloudReadOnlyMode()) {
    return createCloudReadOnlyResult('syncWordMasteryBatch');
  }

  const db = ensureDb();
  const openid = normalizeAccountId(options.accountId || getOpenId());
  const operationOptions = captureOperationOptions(options, openid);
  if (!db || !openid || !studentId || !wordbookId || !wordRecordsMap) {
    console.warn('[cloud-sync] syncWordMasteryBatch 前置条件不满足, db:', !!db, 'openid:', !!openid);
    const pendingAccountId = openid || getStudentOwnerForPending({ studentId });
    if (queuePendingWordMasteryRecords(studentId, wordbookId, wordRecordsMap, pendingAccountId) > 0) {
      markPendingSync();
    } else {
      _updateSyncStatus({ lastFail: Date.now() });
    }
    return { skipped: true, reason: 'precondition_failed' };
  }

  const wordIds = Object.keys(wordRecordsMap);
  if (wordIds.length === 0) {
    return { skipped: true, reason: 'empty_batch' };
  }

  const collection = db.collection('word_mastery');
  const displayNames = getDisplayNames(studentId);

  // 【V2.0 防退化】逐条同步前先读云端，若云端进度更优则跳过写入
  // 分批并发，每批 MAX_BATCH 条，避免超限限流

  const syncOneWord = (wordId) => {
    const wordRecord = wordRecordsMap[wordId];
    if (!wordRecord) {
      return Promise.resolve({ wordId, ok: true, skipped: true });
    }

    const docId = buildScopedDocId(openid, 'mastery', studentId, wordbookId, wordId);

    // 先读取云端记录，按整条状态版本比较，避免旧本地状态覆盖新云端状态。
    return collection.doc(docId).get()
      .then((res) => {
        const cloudData = (res && res.data) ? res.data : null;
        if (cloudData && compareWordMasteryVersions(cloudData, wordRecord) > 0) {
          console.log('[cloud-sync] 跳过写入（云端整条记录更新）:', wordId);
          return { wordId, ok: true, skipped: true, reason: 'cloud_fresher' };
        }

        // 本地更新或同版本时，以本次本地操作为权威状态；仅合并未知字段和复习时间线。
        const mergedRecord = mergeWordMasteryRecord(cloudData || {}, wordRecord);
        const { _id: _cdId, _openid: _cdOpenid, ...safeMergedRecord } = mergedRecord;
        const data = {
          ...withUpdatedAt(safeMergedRecord),
          teacher_id: openid,
          student_id: String(studentId),
          wordbook_id: String(wordbookId),
          word_id: String(wordId),
          ...displayNames
        };
        delete data.accountId;

        return collection.doc(docId).set({ data })
          .then(() => ({ wordId, ok: true }))
          .catch((error) => {
            if (error && error.errMsg && error.errMsg.indexOf('E11000') !== -1) {
              return { wordId, ok: true, skipped: true, reason: 'already_exists' };
            }
            console.warn('[cloud-sync] 单条 word_mastery 同步失败:', wordId, error);
            return { wordId, ok: false, error };
          });
      })
      .catch((getError) => {
        if (getError && getError.errCode === -1) {
          const data = {
            teacher_id: openid,
            student_id: String(studentId),
            wordbook_id: String(wordbookId),
            word_id: String(wordId),
            ...displayNames,
            ...withUpdatedAt(wordRecord)
          };
          delete data.accountId;
          return collection.doc(docId).set({ data })
            .then(() => ({ wordId, ok: true }))
            .catch((error) => {
              if (error && error.errMsg && error.errMsg.indexOf('E11000') !== -1) {
                return { wordId, ok: true, skipped: true, reason: 'already_exists' };
              }
              console.warn('[cloud-sync] 单条 word_mastery 同步失败:', wordId, error);
              return { wordId, ok: false, error };
            });
        }
        console.warn('[cloud-sync] 读取云端记录失败:', wordId, getError);
        return { wordId, ok: false, error: getError };
      });
  };

  const BATCH_SIZE = 5;
  const allResults = [];

  const masteryAtomCapability = await getMasteryAtomCapability();
  if (masteryAtomCapability.supported) {
    const atomResults = await syncWordMasteryViaAtom(
      studentId,
      wordbookId,
      wordRecordsMap,
      displayNames,
      masteryAtomCapability
    );
    allResults.push(...atomResults);
  } else if (
    masteryAtomCapability.reason === 'unsupported_protocol'
    || masteryAtomCapability.reason === 'call_function_unavailable'
  ) {
    for (let i = 0; i < wordIds.length; i += BATCH_SIZE) {
      const batch = wordIds.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(syncOneWord));
      allResults.push(...batchResults);
      if (i + BATCH_SIZE < wordIds.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  } else {
    // 能力探测超时/失败时无法判断云函数是否已经收到请求或是否临时不可用。
    // 为避免两台设备退回非事务直写后互相覆盖，保留本地待同步队列，稍后重试。
    wordIds.forEach((wordId) => {
      allResults.push({
        wordId: String(wordId),
        ok: false,
        error: 'mastery_atom_capability_unknown'
      });
    });
  }

  const failed = allResults.filter((r) => r && !r.ok);
  const succeeded = allResults.filter((r) => r && r.ok && !r.skipped);
  const skippedCloudFresher = allResults.filter((r) => r && r.ok && r.skipped && r.reason === 'cloud_fresher');
  const skippedAlreadyExists = allResults.filter((r) => r && r.ok && r.skipped && r.reason === 'already_exists');
  const totalSkipped = skippedCloudFresher.length + skippedAlreadyExists.length;
  console.log('[cloud-sync] word mastery batch 完成:', succeeded.length, '成功,', failed.length, '失败,', skippedCloudFresher.length, '跳过(云端更新),', skippedAlreadyExists.length, '跳过(已存在)');
  if (succeeded.length > 0) {
    if (accountSideEffectsAreCurrent(operationOptions)) markSyncSuccess(succeeded.length);
  }
  // 清理 pendingWordMasterySync 中已跳过（云端更新/已存在）的记录
  if (totalSkipped > 0) {
    try {
      const pendingWords = wx.getStorageSync('pendingWordMasterySync') || {};
      [...skippedCloudFresher, ...skippedAlreadyExists].forEach((f) => {
        if (!f || !f.wordId) return;
        const baseKey = buildPendingMasteryKey(studentId, wordbookId, f.wordId);
        removePendingEntriesForAccount(pendingWords, baseKey, openid);
        const legacyRecord = pendingWords[f.wordId];
        const legacyStudentId = legacyRecord && (legacyRecord.student_id || legacyRecord.studentId);
        const legacyWordbookId = legacyRecord && (legacyRecord.wordbook_id || legacyRecord.wordbookId);
        if (legacyRecord && pendingBelongsToAccount(legacyRecord, openid) &&
          ((!legacyStudentId || String(legacyStudentId) === String(studentId)) &&
            (!legacyWordbookId || String(legacyWordbookId) === String(wordbookId)))) {
          delete pendingWords[f.wordId];
        }
      });
      if (Object.keys(pendingWords).length === 0) {
        wx.removeStorageSync('pendingWordMasterySync');
      } else {
        wx.setStorageSync('pendingWordMasterySync', pendingWords);
      }
      if (accountSideEffectsAreCurrent(operationOptions)) markSyncSuccess(totalSkipped);
    } catch (e) { /* ignore */ }
  }
  if (failed.length > 0) {
    // 把失败的 wordId 存到本地，下次重试
    try {
      const pendingWords = wx.getStorageSync('pendingWordMasterySync') || {};
      failed.forEach((f) => {
        if (f && f.wordId && wordRecordsMap[f.wordId]) {
          const baseKey = buildPendingMasteryKey(studentId, wordbookId, f.wordId);
          const pendingKey = selectPendingStorageKey(pendingWords, baseKey, openid);
          pendingWords[pendingKey] = {
            ...wordRecordsMap[f.wordId],
            student_id: String(studentId),
            wordbook_id: String(wordbookId),
            word_id: String(f.wordId),
            accountId: openid
          };
        }
      });
      wx.setStorageSync('pendingWordMasterySync', pendingWords);
      if (accountSideEffectsAreCurrent(operationOptions)) markPendingSync();
    } catch (storeError) {
      console.warn('[cloud-sync] 无法保存待重试记录:', storeError);
      _updateSyncStatus({ lastFail: Date.now() });
    }
  }
  return { succeeded: succeeded.length, failed: failed.length };
};

const syncLearningProgress = (studentId, progressData, options = {}) => {
  let correctedProgress = progressData;
  let mergedProgressForWrite = progressData;
  try {
    const wordMastery = wx.getStorageSync('wordMastery') || {};
    const learningRecords = wx.getStorageSync('learningRecords') || [];
    correctedProgress = reconcileStudentLearningProgress({
      studentId,
      progressData,
      studentMastery: wordMastery[studentId],
      learningRecords
    });

    const lp = wx.getStorageSync('learningProgress') || {};
    if (JSON.stringify(lp[studentId] || {}) !== JSON.stringify(correctedProgress)) {
      lp[studentId] = correctedProgress;
      wx.setStorageSync('learningProgress', lp);
      console.log('[cloud-sync] learningProgress 已按单词明细去重修正:', studentId, correctedProgress.learnedWords);
    }
  } catch (e) {
    console.warn('[cloud-sync] 从 wordMastery 修正 learningProgress 失败，使用原值:', e);
  }

  if (isCloudReadOnlyMode()) {
    return Promise.resolve(createCloudReadOnlyResult('syncLearningProgress'));
  }

  const db = ensureDb();
  const openid = normalizeAccountId(options.accountId || getOpenId());
  const operationOptions = captureOperationOptions(options, openid);
  if (!db || !openid || !studentId || !correctedProgress) {
    console.warn('[cloud-sync] syncLearningProgress 跳过: db=', !!db, 'openid=', !!openid);
    if (queuePendingLearningProgress(
      studentId,
      correctedProgress,
      openid || getStudentOwnerForPending({ studentId })
    )) {
      markPendingSync();
    } else {
      _updateSyncStatus({ lastFail: Date.now() });
    }
    return Promise.resolve({ skipped: true, reason: 'precondition_failed' });
  }

  const displayNames = getDisplayNames(studentId);
  const docId = buildScopedDocId(openid, 'progress', studentId);

  // 学生级 learning_progress 是派生缓存；云端写入必须按 wordbookId 逐本合并，
  // 避免两台设备基于旧快照分别学习不同词书时互相整块覆盖。
  return db.collection('learning_progress')
    .doc(docId)
    .get()
    .then((res) => {
      const cloudData = (res && res.data) ? res.data : null;
      mergedProgressForWrite = mergeLearningProgress(cloudData, correctedProgress, {
        bookTotals: options.bookTotals
      });

      // 剔除系统保留字段，避免 _openid 等只读字段导致写入失败
      const { _id, _openid, ...safeMergedProgress } = mergedProgressForWrite || {};
      return db.collection('learning_progress')
        .doc(docId)
        .set({
          data: {
            ...withUpdatedAt(safeMergedProgress),
            teacher_id: openid,
            student_id: String(studentId),
            ...(displayNames.studentName ? { student_name: displayNames.studentName } : {}),
            ...(displayNames.teacherName ? { teacher_name: displayNames.teacherName } : {})
          }
        });
    })
    .catch((getError) => {
      // 读取失败（可能文档不存在），正常写入
      if (getError && getError.errCode === -1) {
        mergedProgressForWrite = mergeLearningProgress({}, correctedProgress, {
          bookTotals: options.bookTotals
        });
        return db.collection('learning_progress')
          .doc(docId)
          .set({
            data: {
              ...withUpdatedAt(mergedProgressForWrite),
              teacher_id: openid,
              student_id: String(studentId),
              ...(displayNames.studentName ? { student_name: displayNames.studentName } : {}),
              ...(displayNames.teacherName ? { teacher_name: displayNames.teacherName } : {})
            }
          });
      }
      throw getError;
    })
    .then(() => {
      console.log('[cloud-sync] learning progress synced, studentId:', studentId);
      return { ok: true, progress: mergedProgressForWrite };
    })
    .catch((error) => {
      console.warn('[cloud-sync] failed to sync learning progress:', error);
      // 失败时保存待重试记录
      try {
        if (!queuePendingLearningProgress(studentId, correctedProgress, openid)) {
          throw new Error('failed_to_queue_learning_progress');
        }
        if (accountSideEffectsAreCurrent(operationOptions)) markPendingSync();
      } catch (e) {
        _updateSyncStatus({ lastFail: Date.now() });
      }
      return { ok: false, error };
    });
};

// 批量补推所有本地 learningProgress 到云端（幂等，用于历史数据恢复）
const syncAllLocalLearningProgress = () => {
  if (isCloudReadOnlyMode()) {
    return Promise.resolve(createCloudReadOnlyResult('syncAllLocalLearningProgress'));
  }

  const db = ensureDb();
  const openid = getOpenId();
  if (!db || !openid) {
    console.warn('[cloud-sync] syncAllLocalLearningProgress: db或openid不可用，跳过 (db=', !!db, 'openid=', !!openid, ')');
    return Promise.resolve({ skipped: true, reason: 'precondition_failed' });
  }

  try {
    const learningProgress = wx.getStorageSync('learningProgress') || {};
    const studentIds = Object.keys(learningProgress).filter(function(sid) {
      var sp = learningProgress[sid];
      return sp && typeof sp === 'object' && !Array.isArray(sp);
    });

    if (studentIds.length === 0) {
      console.log('[cloud-sync] syncAllLocalLearningProgress: 本地无 learningProgress 数据');
      return Promise.resolve({ skipped: true, reason: 'empty' });
    }

    console.log('[cloud-sync] 开始批量补推 learningProgress, 学生数:', studentIds.length);

    var promises = studentIds.map(function(studentId) {
      var studentProgress = learningProgress[studentId];
      return syncLearningProgress(studentId, studentProgress);
    });

    return Promise.all(promises).then(function(results) {
      var succeeded = results.filter(function(r) { return r && r.ok; }).length;
      console.log('[cloud-sync] 批量补推完成:', succeeded, '/', studentIds.length);
      return { succeeded: succeeded, total: studentIds.length };
    });
  } catch (e) {
    console.warn('[cloud-sync] syncAllLocalLearningProgress 异常:', e);
    return Promise.resolve({ error: e && e.message ? e.message : 'unknown' });
  }
};

// ===== 预览状态云同步 =====
// 将预习/复习/九宫格的标记状态同步到云端，解决换设备丢失问题
// 每个 student+wordbook 组合用一个云文档存储全部预览状态

/**
 * 同步预览状态到云端
 * @param {string} studentId
 * @param {string} wordbookId
 * @param {object} previewData - { mastery: {...}, order: [...], excluded: [...] }
 */
const syncPreviewState = (studentId, wordbookId, previewData, options = {}) => {
  if (isCloudReadOnlyMode()) {
    return Promise.resolve(createCloudReadOnlyResult('syncPreviewState'));
  }

  const db = ensureDb();
  const openid = normalizeAccountId(options.accountId || getOpenId());
  const operationOptions = captureOperationOptions(options, openid);
  if (!db || !openid || !studentId || !wordbookId) {
    console.warn('[cloud-sync] syncPreviewState 跳过: db=', !!db, 'openid=', !!openid);
    if (studentId && wordbookId && previewData) {
      markPreviewStatePending(
        studentId,
        wordbookId,
        previewData,
        openid || getStudentOwnerForPending({ studentId })
      );
    }
    return Promise.resolve({ skipped: true, reason: 'precondition_failed' });
  }

  const docId = buildScopedDocId(openid, 'preview', studentId, wordbookId);
  const displayNames = getDisplayNames(studentId);
  const incomingOrder = previewData.order || [];
  const incomingExcluded = previewData.excluded || [];
  const incomingMastery = previewData.mastery || {};
  const shouldReset = previewData.reset === true;

  // 先读云端已有数据，合并后再写入，防止 review/grid 页空数组覆盖 learning 页的 order/excluded
  return db.collection('preview_state')
    .doc(docId)
    .get()
    .then((res) => {
      const existing = (res && res.data) ? res.data : {};
      const mergedOrder = shouldReset
        ? incomingOrder
        : (incomingOrder.length > 0 ? incomingOrder : (existing.order || []));
      const mergedExcluded = shouldReset
        ? incomingExcluded
        : (incomingExcluded.length > 0 ? incomingExcluded : (existing.excluded || []));
      // 剥离系统保留字段，避免 _openid 等只读字段导致写入失败
      const { _id: _eid, _openid: _eoid, ...safeExisting } = existing || {};

      return db.collection('preview_state')
        .doc(docId)
        .set({
          data: {
            ...safeExisting,
            teacher_id: openid,
            student_id: String(studentId),
            wordbook_id: String(wordbookId),
            ...(displayNames.studentName ? { student_name: displayNames.studentName } : {}),
            ...(displayNames.teacherName ? { teacher_name: displayNames.teacherName } : {}),
            mastery: incomingMastery,
            order: mergedOrder,
            excluded: mergedExcluded,
            updatedAt: Date.now()
          }
        });
    })
    .catch((error) => {
      // 文档不存在(首次同步)时直接写入，不需要合并
      if (error && error.errCode === -1) {
        return db.collection('preview_state')
          .doc(docId)
          .set({
            data: {
              teacher_id: openid,
              student_id: String(studentId),
              wordbook_id: String(wordbookId),
              ...(displayNames.studentName ? { student_name: displayNames.studentName } : {}),
              ...(displayNames.teacherName ? { teacher_name: displayNames.teacherName } : {}),
              mastery: incomingMastery,
              order: incomingOrder,
              excluded: incomingExcluded,
              updatedAt: Date.now()
            }
          });
      }
      throw error;
    })
    .then(() => {
      console.log('[cloud-sync] preview_state 同步成功:', studentId, wordbookId,
        'mastery=', Object.keys(incomingMastery).length,
        'order=', incomingOrder.length,
        'excluded=', incomingExcluded.length);
      const removedPendingState = removePendingPreviewState(studentId, wordbookId, openid);
      if (removedPendingState) {
        if (accountSideEffectsAreCurrent(operationOptions)) markSyncSuccess(1);
      } else if (accountSideEffectsAreCurrent(operationOptions)) {
        _updateSyncStatus({ lastOk: Date.now() });
      }
      return { ok: true };
    })
    .catch((error) => {
      console.warn('[cloud-sync] preview_state 同步失败:', error);
      const queued = queuePendingPreviewState(studentId, wordbookId, previewData, openid);
      if (accountSideEffectsAreCurrent(operationOptions)) {
        if (!queued || queued.added) markPendingSync();
        else _updateSyncStatus({ lastFail: Date.now() });
      }
      return { ok: false, error };
    });
};

/**
 * 从云端加载预览状态
 * @param {string} studentId
 * @param {string} wordbookId
 * @returns {Promise<{mastery: {}, order: [], excluded: []}>}
 */
const loadPreviewStateFromCloud = (studentId, wordbookId) => {
  const db = ensureDb();
  const openid = getOpenId();
  if (!db || !openid || !studentId || !wordbookId) {
    return Promise.resolve({ mastery: {}, order: [], excluded: [] });
  }

  const docId = buildScopedDocId(openid, 'preview', studentId, wordbookId);

  return db.collection('preview_state')
    .doc(docId)
    .get()
    .then((res) => {
      if (res && res.data) {
        console.log('[cloud-sync] 从云端加载预览状态:', studentId, wordbookId,
          'mastery=', Object.keys(res.data.mastery || {}).length);
        return {
          mastery: res.data.mastery || {},
          order: res.data.order || [],
          excluded: res.data.excluded || []
        };
      }
      return { mastery: {}, order: [], excluded: [] };
    })
    .catch((error) => {
      // 文档不存在是正常情况（首次使用）
      if (error && error.errCode === -1) {
        return { mastery: {}, order: [], excluded: [] };
      }
      console.warn('[cloud-sync] 加载预览状态失败:', error);
      return { mastery: {}, order: [], excluded: [] };
    });
};

// 批量补推所有本地学习记录到云端（一次性，用于历史数据恢复）
const syncAllLocalLearningRecords = () => {
  if (isCloudReadOnlyMode()) {
    return Promise.resolve(createCloudReadOnlyResult('syncAllLocalLearningRecords'));
  }

  const db = ensureDb();
  const openid = getOpenId();
  if (!db || !openid) {
    console.warn('[cloud-sync] syncAllLocalLearningRecords: db或openid不可用');
    return Promise.resolve({ skipped: true, reason: 'precondition_failed' });
  }

  try {
    const learningRecords = wx.getStorageSync('learningRecords') || [];
    if (!Array.isArray(learningRecords) || learningRecords.length === 0) {
      console.log('[cloud-sync] syncAllLocalLearningRecords: 本地无学习记录');
      return Promise.resolve({ skipped: true, reason: 'empty' });
    }

    console.log('[cloud-sync] 开始批量补推学习记录, 数量:', learningRecords.length);
    const promises = learningRecords.map(record => syncLearningRecord(record));

    return Promise.all(promises).then(results => {
      const succeeded = results.filter(r => r && r.ok).length;
      console.log('[cloud-sync] 学习记录补推完成:', succeeded, '/', learningRecords.length);
      return { succeeded, total: learningRecords.length };
    });
  } catch (e) {
    console.warn('[cloud-sync] syncAllLocalLearningRecords 异常:', e);
    return Promise.resolve({ error: e && e.message ? e.message : 'unknown' });
  }
};

module.exports = {
  buildScopedDocId,
  selectWordMasteryRecords,
  stripSystemFields,
  syncLearningRecord,
  syncWordMasteryRecord,
  syncWordMasteryBatch,
  syncLearningProgress,
  syncAllLocalLearningProgress,
  syncAllLocalLearningRecords,
  syncStudentStatistics,
  retryPendingSyncs,
  markPendingSync,
  getSyncStatus,
  markSyncSuccess,
  syncPreviewState,
  loadPreviewStateFromCloud
};
