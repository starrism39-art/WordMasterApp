'use strict';

const BackupService = require('./data-backup-service.js');
const { safeMergeRestore } = require('./safe-merge-restore.js');

const CURRENT_DATA_VERSION = '2.0.0';
const PROTECTION_STATE_KEY = BackupService.PROTECTION_STATE_KEY;

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isEmptyValue(value) {
  if (value === undefined || value === null || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (isPlainObject(value)) return Object.keys(value).length === 0;
  return false;
}

function hasMeaningfulLocalData(data) {
  const ignored = new Set(['openid', 'currentUser', 'dataVersion']);
  return Object.keys(data || {}).some((key) => !ignored.has(key) && !isEmptyValue(data[key]));
}

function markProtectionState(state) {
  const value = Object.assign({ updatedAt: new Date().toISOString() }, state || {});
  wx.setStorageSync(PROTECTION_STATE_KEY, value);
  return value;
}

function normalizeWordMastery(input) {
  if (input === undefined) return undefined;
  if (!isPlainObject(input)) throw new Error('invalid_word_mastery_root');
  const result = clone(input);
  const migrationTime = Date.now();

  Object.keys(result).forEach((studentId) => {
    const books = result[studentId];
    if (!isPlainObject(books)) throw new Error('invalid_word_mastery_student:' + studentId);
    Object.keys(books).forEach((wordbookId) => {
      const words = books[wordbookId];
      if (Array.isArray(words)) {
        const upgraded = {};
        words.forEach((legacyWord, index) => {
          const isRecord = isPlainObject(legacyWord);
          const rawWordId = isRecord
            ? (legacyWord.wordId || legacyWord.word_id || legacyWord.id)
            : legacyWord;
          if (rawWordId === undefined || rawWordId === null || String(rawWordId).trim() === '') {
            throw new Error('invalid_legacy_word_mastery_item:' + studentId + ':' + wordbookId + ':' + index);
          }
          const normalizedWordId = String(rawWordId);
          if (hasOwn(upgraded, normalizedWordId)) return;
          upgraded[normalizedWordId] = Object.assign({
            mastered: false,
            difficult: false,
            reviewCount: 0,
            firstMasteryTime: migrationTime,
            lastReviewTime: migrationTime,
            nextReviewTime: migrationTime,
            antiForgettingSeed: true,
            reviewTimeline: []
          }, isRecord ? clone(legacyWord) : {});
        });
        books[wordbookId] = upgraded;
      } else if (!isPlainObject(words)) {
        throw new Error('invalid_word_mastery_wordbook:' + studentId + ':' + wordbookId);
      }
    });
  });
  return result;
}

function normalizeLearningRecords(input) {
  if (input === undefined) return undefined;
  if (!Array.isArray(input)) throw new Error('invalid_learning_records_root');
  return input.map((record, index) => {
    if (!isPlainObject(record)) throw new Error('invalid_learning_record:' + index);
    const normalized = clone(record);
    if (typeof normalized.date === 'number') {
      const parsed = new Date(normalized.date);
      if (Number.isNaN(parsed.getTime())) throw new Error('invalid_learning_record_date:' + index);
      normalized.date = parsed.toISOString().split('T')[0];
    }
    return normalized;
  });
}

function validateDynamicState(data) {
  Object.keys(data).forEach((key) => {
    const value = data[key];
    if (key.indexOf('previewMastery_') === 0 ||
        key.indexOf('reviewMastery_') === 0 ||
        key.indexOf('gridMastery_') === 0) {
      if (!isPlainObject(value)) throw new Error('invalid_dynamic_state:' + key);
    }
    if (key.indexOf('previewWordOrder_') === 0 ||
        key.indexOf('previewExcludedWordIds_') === 0) {
      if (!Array.isArray(value)) throw new Error('invalid_dynamic_state:' + key);
    }
  });
}

function normalizeProtectedData(input) {
  const output = clone(input || {});
  if (hasOwn(output, 'wordMastery')) output.wordMastery = normalizeWordMastery(output.wordMastery);
  if (hasOwn(output, 'learningRecords')) output.learningRecords = normalizeLearningRecords(output.learningRecords);
  if (hasOwn(output, 'students') && !Array.isArray(output.students)) {
    throw new Error('invalid_students_root');
  }
  if (hasOwn(output, 'antiForgettingRecords') && !Array.isArray(output.antiForgettingRecords)) {
    throw new Error('invalid_anti_forgetting_records_root');
  }
  if (hasOwn(output, 'learningProgress') && !isPlainObject(output.learningProgress)) {
    throw new Error('invalid_learning_progress_root');
  }
  validateDynamicState(output);
  return output;
}

function validateNoDataLoss(before, after) {
  const beforeManifest = BackupService.buildManifest(before);
  const afterManifest = BackupService.buildManifest(after);
  const protectedCounts = [
    'students',
    'learningRecords',
    'wordMasteryWords',
    'learningProgressStudents',
    'antiForgettingRecords',
    'dynamicKeys',
    'pendingItems'
  ];
  protectedCounts.forEach((key) => {
    if (afterManifest.counts[key] < beforeManifest.counts[key]) {
      throw new Error('migration_count_loss:' + key);
    }
  });
  return { before: beforeManifest, after: afterManifest };
}

function writeMigratedData(before, after) {
  const keys = Object.keys(after).filter((key) => key !== 'dataVersion').sort();
  keys.forEach((key) => {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      wx.setStorageSync(key, clone(after[key]));
    }
  });
  wx.setStorageSync('dataVersion', CURRENT_DATA_VERSION);
}

function initializeDataVersion() {
  const storedVersion = wx.getStorageSync('dataVersion');
  const previousState = wx.getStorageSync(PROTECTION_STATE_KEY);
  if (storedVersion === CURRENT_DATA_VERSION) {
    if (previousState && previousState.status === 'blocked') {
      return {
        error: true,
        blocked: true,
        message: previousState.message || 'upgrade_protection_blocked',
        version: CURRENT_DATA_VERSION
      };
    }
    markProtectionState({ status: 'complete', version: CURRENT_DATA_VERSION, action: 'already-current' });
    return { isFirstRun: false, upgraded: false, version: CURRENT_DATA_VERSION };
  }

  const before = BackupService.collectProtectedData();
  const meaningful = hasMeaningfulLocalData(before);
  if (!meaningful) {
    try {
      wx.setStorageSync('dataVersion', CURRENT_DATA_VERSION);
      markProtectionState({ status: 'complete', version: CURRENT_DATA_VERSION, action: 'fresh-install' });
      return { isFirstRun: true, version: CURRENT_DATA_VERSION };
    } catch (error) {
      try {
        markProtectionState({ status: 'blocked', stage: 'fresh-install', message: error.message });
      } catch (ignore) {}
      return { error: true, blocked: true, message: error.message };
    }
  }

  const oldVersion = storedVersion || 'legacy-unversioned';
  let persisted = null;
  let writesStarted = false;
  try {
    const envelope = BackupService.createBackupEnvelope({
      data: before,
      sourceDataVersion: oldVersion,
      targetDataVersion: CURRENT_DATA_VERSION,
      reason: 'automatic-pre-upgrade'
    });
    persisted = BackupService.persistVerifiedSnapshot(envelope);
    if (envelope.ownerId) {
      BackupService.assertBackupOwnerCompatible(envelope, envelope.ownerId);
    }

    const migrated = normalizeProtectedData(before);
    const validation = validateNoDataLoss(before, migrated);
    writesStarted = true;
    writeMigratedData(before, migrated);
    markProtectionState({
      status: 'complete',
      action: 'upgraded',
      oldVersion,
      version: CURRENT_DATA_VERSION,
      backupPath: persisted.path,
      checksum: persisted.envelope.checksum,
      validation
    });
    return {
      isFirstRun: false,
      upgraded: true,
      oldVersion,
      newVersion: CURRENT_DATA_VERSION,
      backupPath: persisted.path,
      checksum: persisted.envelope.checksum
    };
  } catch (error) {
    let rollbackSucceeded = false;
    let rollbackError = null;
    if (persisted && writesStarted) {
      try {
        BackupService.restoreExactProtectedData(persisted.envelope.data);
        rollbackSucceeded = true;
      } catch (restoreError) {
        rollbackError = restoreError.message || String(restoreError);
      }
    }
    try {
      markProtectionState({
        status: 'blocked',
        stage: persisted ? (writesStarted ? 'migration' : 'validation') : 'snapshot',
        oldVersion,
        targetVersion: CURRENT_DATA_VERSION,
        backupPath: persisted && persisted.path,
        message: error.message || String(error),
        rollbackSucceeded,
        rollbackError
      });
    } catch (stateError) {
      console.error('[data-migration] 无法记录阻断状态:', stateError);
    }
    return {
      error: true,
      blocked: true,
      oldVersion,
      newVersion: CURRENT_DATA_VERSION,
      message: error.message || String(error),
      rollbackSucceeded,
      rollbackError
    };
  }
}

function backupDataByVersion(version) {
  const envelope = BackupService.createBackupEnvelope({
    sourceDataVersion: version || wx.getStorageSync('dataVersion') || 'legacy-unversioned',
    targetDataVersion: null,
    reason: 'manual-local-backup'
  });
  BackupService.assertBackupOwnerCompatible(envelope, BackupService.resolveCurrentOwnerId());
  const persisted = BackupService.persistVerifiedSnapshot(envelope);
  return persisted.path;
}

function getAllStorageKeys() {
  try {
    const info = wx.getStorageInfoSync();
    return info && Array.isArray(info.keys) ? info.keys : [];
  } catch (error) {
    return [];
  }
}

function getAvailableBackups() {
  const currentOwnerId = BackupService.resolveCurrentOwnerId();
  const modern = wx.getStorageSync(BackupService.BACKUP_INDEX_KEY);
  const result = (Array.isArray(modern) ? modern : [])
    .filter((item) => !item.ownerId || !currentOwnerId || item.ownerId === currentOwnerId)
    .map((item) => ({
    version: item.sourceDataVersion || 'unknown',
    backupKey: item.path,
    path: item.path,
    timestamp: item.createdAt || null,
    dataCount: item.manifest && Array.isArray(item.manifest.keys) ? item.manifest.keys.length : 0,
    availableKeys: item.manifest && item.manifest.keys || [],
    manifest: item.manifest || null,
    ownerId: item.ownerId || '',
    format: BackupService.BACKUP_FORMAT
    }));

  getAllStorageKeys().filter((key) => /^dataBackup_v.+$/.test(key) && !/_info$/.test(key))
    .forEach((backupKey) => {
      const version = backupKey.replace(/^dataBackup_v/, '');
      const info = wx.getStorageSync(backupKey + '_info') || {};
      const data = wx.getStorageSync(backupKey) || {};
      result.push({
        version,
        backupKey,
        timestamp: info.timestamp || null,
        dataCount: typeof info.dataCount === 'number' ? info.dataCount : Object.keys(data).length,
        availableKeys: Object.keys(data),
        legacy: true
      });
    });

  result.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  return result;
}

function exportAllData() {
  const envelope = BackupService.createBackupEnvelope({
    sourceDataVersion: wx.getStorageSync('dataVersion') || 'legacy-unversioned',
    reason: 'manual-export'
  });
  BackupService.assertBackupOwnerCompatible(envelope, BackupService.resolveCurrentOwnerId());
  const verification = BackupService.verifyBackupEnvelope(envelope);
  if (!verification.ok) throw new Error(verification.error);
  return envelope;
}

function mergeQueueValue(existing, incoming) {
  if (isPlainObject(incoming)) return Object.assign({}, clone(incoming), clone(existing || {}));
  if (Array.isArray(incoming)) {
    const values = Array.isArray(existing) ? clone(existing) : [];
    const seen = new Set(values.map((item) => JSON.stringify(item)));
    incoming.forEach((item) => {
      const identity = JSON.stringify(item);
      if (!seen.has(identity)) {
        seen.add(identity);
        values.push(clone(item));
      }
    });
    return values;
  }
  return isEmptyValue(existing) ? clone(incoming) : existing;
}

function restoreSupplementalData(data) {
  const pendingKeys = new Set([
    'pendingWordMasterySync',
    'pendingLearningRecordSync',
    'pendingLearningProgressSync',
    'pendingPreviewStateSync',
    'pendingSyncProgress'
  ]);
  const singleKeys = new Set([
    'currentStudent',
    'currentWordbook',
    'currentWordbookStudentId',
    'selectedStudent',
    'selectedWordbook',
    'studentSettings',
    'wordbooksMetadata'
  ]);
  let restored = 0;

  Object.keys(data).forEach((key) => {
    if (pendingKeys.has(key)) {
      wx.setStorageSync(key, mergeQueueValue(wx.getStorageSync(key), data[key]));
      restored += 1;
      return;
    }
    const dynamic = BackupService.isDynamicProtectedStorageKey(key);
    if (dynamic || singleKeys.has(key)) {
      const existing = wx.getStorageSync(key);
      if (isEmptyValue(existing) && !isEmptyValue(data[key])) {
        wx.setStorageSync(key, clone(data[key]));
        restored += 1;
      }
    }
  });
  return restored;
}

function importBackupData(input, options) {
  const settings = options || {};
  const currentOwnerId = String(
    settings.currentOwnerId || BackupService.resolveCurrentOwnerId()
  ).trim();
  const envelope = BackupService.normalizeBackupEnvelope(input, {
    currentOwnerId,
    targetDataVersion: CURRENT_DATA_VERSION
  });
  if (!envelope.ownerId && !settings.allowUnownedLegacy) throw new Error('backup_owner_missing');
  BackupService.assertBackupOwnerCompatible(envelope, currentOwnerId);

  const dryRun = safeMergeRestore(envelope.data, { dryRun: true });
  if (dryRun.summary && dryRun.summary.errors > 0) throw new Error('backup_merge_validation_failed');

  const rollbackEnvelope = BackupService.createBackupEnvelope({
    sourceDataVersion: wx.getStorageSync('dataVersion') || 'legacy-unversioned',
    targetDataVersion: CURRENT_DATA_VERSION,
    reason: 'automatic-pre-import'
  });
  const persistedRollback = BackupService.persistVerifiedSnapshot(rollbackEnvelope);

  try {
    const report = safeMergeRestore(envelope.data);
    if (report.summary && report.summary.errors > 0) throw new Error('backup_merge_failed');
    report.supplementalRestored = restoreSupplementalData(envelope.data);
    return { ok: true, report, rollbackPath: persistedRollback.path };
  } catch (error) {
    BackupService.restoreExactProtectedData(persistedRollback.envelope.data);
    throw error;
  }
}

function restoreBackup(version) {
  try {
    const currentOwnerId = BackupService.resolveCurrentOwnerId();
    const modernIndex = wx.getStorageSync(BackupService.BACKUP_INDEX_KEY);
    const modern = Array.isArray(modernIndex)
      ? modernIndex.slice().reverse().find((item) => (
        (!item.ownerId || item.ownerId === currentOwnerId) &&
        (item.sourceDataVersion === version || item.path === version)
      ))
      : null;
    if (modern && modern.path) {
      return importBackupData(BackupService.readPersistedSnapshot(modern.path), {
        currentOwnerId
      }).ok;
    }

    const legacy = wx.getStorageSync('dataBackup_v' + version);
    if (!legacy) return false;
    return importBackupData(legacy, {
      currentOwnerId,
      allowUnownedLegacy: true
    }).ok;
  } catch (error) {
    console.error('[data-migration] 恢复备份失败:', error);
    return false;
  }
}

function migrateDataIfNeeded(fromVersion, toVersion) {
  if (fromVersion === toVersion) return { migrated: false };
  const before = BackupService.collectProtectedData();
  const after = normalizeProtectedData(before);
  return { migrated: true, data: after, validation: validateNoDataLoss(before, after) };
}

function cleanupOldBackups() {
  // 最高安全等级下不自动删除任何备份文件。
  return { skipped: true, reason: 'automatic_backup_deletion_disabled' };
}

module.exports = {
  CURRENT_DATA_VERSION,
  initializeDataVersion,
  backupDataByVersion,
  migrateDataIfNeeded,
  restoreBackup,
  getAvailableBackups,
  exportAllData,
  importBackupData,
  cleanupOldBackups,
  normalizeProtectedData,
  validateNoDataLoss,
  hasMeaningfulLocalData
};
