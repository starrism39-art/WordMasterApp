/**
 * utils/cloud-sync.js
 * Incremental cloud sync utilities.
 */
'use strict';

const DEFAULT_ENV = 'cloudbase-4gafzdch60ad597b';
const { syncStudentStatsToCloud } = require('./stats-engine.js');
const { reconcileStudentLearningProgress } = require('./learning-progress.js');
const { createCloudReadOnlyResult, isCloudReadOnlyMode } = require('./cloud-mode.js');
const {
  compareWordMasteryVersions,
  mergeWordMasteryRecord
} = require('./sync-merge.js');
const syncStudentStatistics = syncStudentStatsToCloud;

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

const markPendingSync = () => {
  try {
    wx.setStorageSync('pendingSyncProgress', true);
  } catch (e) {
    // ignore
  }
  const status = getSyncStatus();
  status.pending = (status.pending || 0) + 1;
  status.lastFail = Date.now();
  try { wx.setStorageSync(SYNC_STATUS_KEY, status); } catch (e) { /* ignore */ }
};

const markSyncSuccess = (count) => {
  if (!count || count <= 0) return;
  const status = getSyncStatus();
  status.pending = Math.max(0, (status.pending || 0) - count);
  status.lastOk = Date.now();
  try { wx.setStorageSync(SYNC_STATUS_KEY, status); } catch (e) { /* ignore */ }
};

const retryPendingSyncs = async () => {
  if (isCloudReadOnlyMode()) {
    console.log('[cloud-sync] 只读模式：跳过待同步重试');
    return createCloudReadOnlyResult('retryPendingSyncs');
  }

  const db = ensureDb();
  const openid = getOpenId();
  if (!db || !openid) {
    console.warn('[cloud-sync] retryPendingSyncs: db或openid不可用，跳过 (db=', !!db, 'openid=', !!openid, ')');
    return { skipped: true };
  }

  const promises = [];

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
          syncWordMasteryBatch(studentId, wordbookId, group.records).then((result) => {
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
      console.log('[cloud-sync] 重试同步 learning_progress:', pendingProgress.studentId);
      promises.push(syncLearningProgress(pendingProgress.studentId, pendingProgress.progressData).then((result) => {
        if (!result || !result.ok) return;
        const currentRaw = wx.getStorageSync('pendingLearningProgressSync') || {};
        if (currentRaw.studentId && currentRaw.progressData) {
          if (String(currentRaw.studentId) === String(pendingProgress.studentId)) {
            wx.removeStorageSync('pendingLearningProgressSync');
          }
          return;
        }
        delete currentRaw[String(pendingProgress.studentId)];
        if (Object.keys(currentRaw).length === 0) {
          wx.removeStorageSync('pendingLearningProgressSync');
        } else {
          wx.setStorageSync('pendingLearningProgressSync', currentRaw);
        }
      }));
    });
  } catch (e) { /* ignore */ }

  // 清理 pending 标记
  try {
    if (wx.getStorageSync('pendingSyncProgress')) {
      wx.removeStorageSync('pendingSyncProgress');
    }
  } catch (e) { /* ignore */ }

  await Promise.all(promises);
  try {
    // 重试完成后，用实际待同步数据量更新计数器
    const pendingWords = wx.getStorageSync('pendingWordMasterySync') || {};
    const pendingProg = wx.getStorageSync('pendingLearningProgressSync') || {};
    const pendingProgressCount = pendingProg.studentId && pendingProg.progressData
      ? 1
      : Object.keys(pendingProg).length;
    const realPending = Object.keys(pendingWords).length + pendingProgressCount;
    const status = getSyncStatus();
    status.pending = realPending;
    status.lastOk = realPending === 0 ? Date.now() : status.lastOk;
    wx.setStorageSync(SYNC_STATUS_KEY, status);
  } catch (e) { /* ignore */ }
  return { ok: true };
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
  const { _id, _openid, ...clean } = value;
  return clean;
};

const withUpdatedAt = (obj) => {
  const base = obj && typeof obj === 'object' ? { ...obj } : {};
  const updatedAt = resolveUpdatedAt(base) || Date.now();
  // 剥离系统保留字段，避免 _id 被带入 .set() 导致 E11000 主键冲突
  const clean = stripSystemFields(base);
  return { ...clean, updatedAt };
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

const syncLearningRecord = (record) => {
  if (isCloudReadOnlyMode()) {
    return Promise.resolve(createCloudReadOnlyResult('syncLearningRecord'));
  }

  const db = ensureDb();
  const openid = getOpenId();
  if (!db || !openid || !record) {
    console.warn('[cloud-sync] syncLearningRecord 跳过: db=', !!db, 'openid=', !!openid, 'record=', !!record);
    markPendingSync();
    return Promise.resolve({ skipped: true, reason: 'precondition_failed' });
  }

  const cleanRecord = withUpdatedAt({ ...record });
  const stableRecordId = ensureLearningRecordId(cleanRecord);
  const recordStudentId = cleanRecord.studentId || cleanRecord.student_id || '';
  const displayNames = recordStudentId ? getDisplayNames(recordStudentId) : { studentName: '', teacherName: '' };
  delete cleanRecord._wordKeyMap;
  delete cleanRecord.emit;
  delete cleanRecord._openid;
  delete cleanRecord._id;

  const docId = buildScopedDocId(openid, 'record', stableRecordId);

  // 先读云端，保留未知字段，防止不同版本互相覆盖
  return db.collection('learning_records')
    .doc(docId)
    .get()
    .then((res) => {
      const cloudData = (res && res.data) ? res.data : {};
      return db.collection('learning_records')
        .doc(docId)
        .set({
          data: {
            ...cloudData,
            teacher_id: openid,
            id: stableRecordId,
            ...(displayNames.studentName ? { student_name: displayNames.studentName } : {}),
            ...(displayNames.teacherName ? { teacher_name: displayNames.teacherName } : {}),
            ...cleanRecord
          }
        });
    })
    .catch((getError) => {
      // 文档不存在（首次写入），直接写
      if (getError && getError.errCode === -1) {
        return db.collection('learning_records')
          .doc(docId)
          .set({
            data: {
              teacher_id: openid,
              id: stableRecordId,
              ...(displayNames.studentName ? { student_name: displayNames.studentName } : {}),
              ...(displayNames.teacherName ? { teacher_name: displayNames.teacherName } : {}),
              ...cleanRecord
            }
          });
      }
      throw getError;
    })
    .then(() => {
      console.log('[cloud-sync] learning record synced:', stableRecordId);
      markSyncSuccess(1);
      return { ok: true };
    })
    .catch((error) => {
      console.warn('[cloud-sync] failed to sync learning record:', error);
      markPendingSync();
      return { ok: false, error };
    });
};

const syncWordMasteryRecord = (studentId, wordbookId, wordId, wordRecord) => {
  if (!wordId || !wordRecord) {
    markPendingSync();
    return Promise.resolve({ skipped: true, reason: 'invalid_word_record' });
  }
  return syncWordMasteryBatch(studentId, wordbookId, {
    [String(wordId)]: wordRecord
  });
};

const syncWordMasteryBatch = async (studentId, wordbookId, wordRecordsMap) => {
  if (isCloudReadOnlyMode()) {
    return createCloudReadOnlyResult('syncWordMasteryBatch');
  }

  const db = ensureDb();
  const openid = getOpenId();
  if (!db || !openid || !studentId || !wordbookId || !wordRecordsMap) {
    console.warn('[cloud-sync] syncWordMasteryBatch 前置条件不满足, db:', !!db, 'openid:', !!openid);
    markPendingSync();
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

  for (let i = 0; i < wordIds.length; i += BATCH_SIZE) {
    const batch = wordIds.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(syncOneWord));
    allResults.push(...batchResults);
    if (i + BATCH_SIZE < wordIds.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  const failed = allResults.filter((r) => r && !r.ok);
  const succeeded = allResults.filter((r) => r && r.ok && !r.skipped);
  const skippedCloudFresher = allResults.filter((r) => r && r.ok && r.skipped && r.reason === 'cloud_fresher');
  const skippedAlreadyExists = allResults.filter((r) => r && r.ok && r.skipped && r.reason === 'already_exists');
  const totalSkipped = skippedCloudFresher.length + skippedAlreadyExists.length;
  console.log('[cloud-sync] word mastery batch 完成:', succeeded.length, '成功,', failed.length, '失败,', skippedCloudFresher.length, '跳过(云端更新),', skippedAlreadyExists.length, '跳过(已存在)');
  if (succeeded.length > 0) {
    markSyncSuccess(succeeded.length);
  }
  // 清理 pendingWordMasterySync 中已跳过（云端更新/已存在）的记录
  if (totalSkipped > 0) {
    try {
      const pendingWords = wx.getStorageSync('pendingWordMasterySync') || {};
      [...skippedCloudFresher, ...skippedAlreadyExists].forEach((f) => {
        if (!f || !f.wordId) return;
        delete pendingWords[buildPendingMasteryKey(studentId, wordbookId, f.wordId)];
        const legacyRecord = pendingWords[f.wordId];
        const legacyStudentId = legacyRecord && (legacyRecord.student_id || legacyRecord.studentId);
        const legacyWordbookId = legacyRecord && (legacyRecord.wordbook_id || legacyRecord.wordbookId);
        if (!legacyRecord ||
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
      markSyncSuccess(totalSkipped);
    } catch (e) { /* ignore */ }
  }
  if (failed.length > 0) {
    markPendingSync();
    // 把失败的 wordId 存到本地，下次重试
    try {
      const pendingWords = wx.getStorageSync('pendingWordMasterySync') || {};
      failed.forEach((f) => {
        if (f && f.wordId && wordRecordsMap[f.wordId]) {
          pendingWords[buildPendingMasteryKey(studentId, wordbookId, f.wordId)] = {
            ...wordRecordsMap[f.wordId],
            student_id: String(studentId),
            wordbook_id: String(wordbookId),
            word_id: String(f.wordId)
          };
        }
      });
      wx.setStorageSync('pendingWordMasterySync', pendingWords);
    } catch (storeError) {
      console.warn('[cloud-sync] 无法保存待重试记录:', storeError);
    }
  }
  return { succeeded: succeeded.length, failed: failed.length };
};

const syncLearningProgress = (studentId, progressData) => {
  let correctedProgress = progressData;
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
  const openid = getOpenId();
  if (!db || !openid || !studentId || !correctedProgress) {
    console.warn('[cloud-sync] syncLearningProgress 跳过: db=', !!db, 'openid=', !!openid);
    markPendingSync();
    return Promise.resolve({ skipped: true, reason: 'precondition_failed' });
  }

  const displayNames = getDisplayNames(studentId);
  const docId = buildScopedDocId(openid, 'progress', studentId);

  // 云端旧值更大时先保留云端，避免尚未拉取完整明细的设备覆盖其他设备数据。
  // 本地页面始终使用上面根据原始明细重算后的结果。
  return db.collection('learning_progress')
    .doc(docId)
    .get()
    .then((res) => {
      const cloudData = (res && res.data) ? res.data : null;
      if (cloudData) {
        const localLearned = typeof correctedProgress.learnedWords === 'number' ? correctedProgress.learnedWords : 0;
        const cloudLearned = typeof cloudData.learnedWords === 'number' ? cloudData.learnedWords : 0;
        if (cloudLearned > localLearned) {
          console.log('[cloud-sync] 跳过 learningProgress 写入（云端更新）: cloud learnedWords=', cloudLearned, 'local=', localLearned);
          return { ok: true, skipped: true, reason: 'cloud_fresher' };
        }
      }

      // 剔除系统保留字段，避免 _openid 等只读字段导致写入失败
      const { _id, _openid, ...safeCloudData } = cloudData || {};
      return db.collection('learning_progress')
        .doc(docId)
        .set({
          data: {
            ...safeCloudData,
            teacher_id: openid,
            student_id: String(studentId),
            ...(displayNames.studentName ? { student_name: displayNames.studentName } : {}),
            ...(displayNames.teacherName ? { teacher_name: displayNames.teacherName } : {}),
            ...withUpdatedAt(correctedProgress)
          }
        });
    })
    .catch((getError) => {
      // 读取失败（可能文档不存在），正常写入
      if (getError && getError.errCode === -1) {
        return db.collection('learning_progress')
          .doc(docId)
          .set({
            data: {
              teacher_id: openid,
              student_id: String(studentId),
              ...(displayNames.studentName ? { student_name: displayNames.studentName } : {}),
              ...(displayNames.teacherName ? { teacher_name: displayNames.teacherName } : {}),
              ...withUpdatedAt(correctedProgress)
            }
          });
      }
      throw getError;
    })
    .then(() => {
      console.log('[cloud-sync] learning progress synced, studentId:', studentId);
      return { ok: true };
    })
    .catch((error) => {
      console.warn('[cloud-sync] failed to sync learning progress:', error);
      markPendingSync();
      // 失败时保存待重试记录
      try {
        const currentPending = wx.getStorageSync('pendingLearningProgressSync') || {};
        const pendingProgressMap = currentPending.studentId && currentPending.progressData
          ? { [String(currentPending.studentId)]: currentPending }
          : currentPending;
        pendingProgressMap[String(studentId)] = {
          studentId: String(studentId),
          progressData: correctedProgress,
          failedAt: Date.now()
        };
        wx.setStorageSync('pendingLearningProgressSync', pendingProgressMap);
      } catch (e) { /* ignore */ }
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
const syncPreviewState = (studentId, wordbookId, previewData) => {
  if (isCloudReadOnlyMode()) {
    return Promise.resolve(createCloudReadOnlyResult('syncPreviewState'));
  }

  const db = ensureDb();
  const openid = getOpenId();
  if (!db || !openid || !studentId || !wordbookId) {
    console.warn('[cloud-sync] syncPreviewState 跳过: db=', !!db, 'openid=', !!openid);
    return Promise.resolve({ skipped: true, reason: 'precondition_failed' });
  }

  const docId = buildScopedDocId(openid, 'preview', studentId, wordbookId);
  const displayNames = getDisplayNames(studentId);
  const incomingOrder = previewData.order || [];
  const incomingExcluded = previewData.excluded || [];
  const incomingMastery = previewData.mastery || {};

  // 先读云端已有数据，合并后再写入，防止 review/grid 页空数组覆盖 learning 页的 order/excluded
  return db.collection('preview_state')
    .doc(docId)
    .get()
    .then((res) => {
      const existing = (res && res.data) ? res.data : {};
      const mergedOrder = incomingOrder.length > 0 ? incomingOrder : (existing.order || []);
      const mergedExcluded = incomingExcluded.length > 0 ? incomingExcluded : (existing.excluded || []);
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
      return { ok: true };
    })
    .catch((error) => {
      console.warn('[cloud-sync] preview_state 同步失败:', error);
      markPendingSync();
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
