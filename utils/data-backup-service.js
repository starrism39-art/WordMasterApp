'use strict';

const BACKUP_FORMAT = 'wordmaster-backup';
const BACKUP_SCHEMA_VERSION = 2;
const BACKUP_INDEX_KEY = 'wordMasterBackupIndex';
const PROTECTION_STATE_KEY = 'upgradeProtectionState';

const FIXED_PROTECTED_KEYS = [
  'openid',
  'currentUser',
  'students',
  'wordbooks',
  'wordbooksMetadata',
  'learningRecords',
  'learningProgress',
  'wordMastery',
  'antiForgettingRecords',
  'currentStudent',
  'currentWordbook',
  'currentWordbookStudentId',
  'selectedStudent',
  'selectedWordbook',
  'studentSettings',
  'students_safety_backup_latest',
  'pendingWordMasterySync',
  'pendingLearningRecordSync',
  'pendingLearningProgressSync',
  'pendingPreviewStateSync',
  'pendingSyncProgress',
  'cloudMigrationStateByOpenId',
  'hasMigratedToCloud',
  'dataVersion'
];

const DYNAMIC_PROTECTED_PREFIXES = [
  'previewMastery_',
  'previewWordOrder_',
  'previewExcludedWordIds_',
  'reviewMastery_',
  'gridMastery_',
  'stats_',
  'wordbook_stats_'
];

const DYNAMIC_PROTECTED_SUFFIXES = [
  '_stats'
];

const OWNERSHIP_DATA_KEYS = [
  'students',
  'students_safety_backup_latest',
  'learningRecords',
  'learningProgress',
  'wordMastery',
  'antiForgettingRecords',
  'pendingWordMasterySync',
  'pendingLearningRecordSync',
  'pendingLearningProgressSync',
  'pendingPreviewStateSync'
];

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

function getAllStorageKeys() {
  try {
    const info = wx.getStorageInfoSync();
    return info && Array.isArray(info.keys) ? info.keys.slice() : [];
  } catch (error) {
    throw new Error('backup_storage_inventory_failed:' + (error.message || error));
  }
}

function isProtectedStorageKey(key) {
  return FIXED_PROTECTED_KEYS.indexOf(key) >= 0 ||
    isDynamicProtectedStorageKey(key);
}

function isDynamicProtectedStorageKey(key) {
  return DYNAMIC_PROTECTED_PREFIXES.some((prefix) => key.indexOf(prefix) === 0) ||
    DYNAMIC_PROTECTED_SUFFIXES.some((suffix) => key.endsWith(suffix));
}

function collectProtectedData() {
  const keys = getAllStorageKeys().filter(isProtectedStorageKey).sort();
  const data = {};
  keys.forEach((key) => {
    const value = wx.getStorageSync(key);
    if (value !== undefined) data[key] = clone(value);
  });
  return data;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => (
    JSON.stringify(key) + ':' + stableStringify(value[key])
  )).join(',') + '}';
}

function calculatePayloadChecksum(data) {
  const text = stableStringify(data || {});
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return 'fnv1a32:' + hash.toString(16).padStart(8, '0');
}

function countWordMasteryWords(mastery) {
  if (!isPlainObject(mastery)) return 0;
  let count = 0;
  Object.keys(mastery).forEach((studentId) => {
    const books = mastery[studentId];
    if (!isPlainObject(books)) return;
    Object.keys(books).forEach((wordbookId) => {
      const words = books[wordbookId];
      if (Array.isArray(words)) {
        const uniqueWordIds = new Set();
        words.forEach((item) => {
          const rawId = isPlainObject(item) ? (item.wordId || item.word_id || item.id) : item;
          if (rawId !== undefined && rawId !== null && String(rawId).trim()) {
            uniqueWordIds.add(String(rawId));
          }
        });
        count += uniqueWordIds.size;
      }
      else if (isPlainObject(words)) count += Object.keys(words).length;
    });
  });
  return count;
}

function countPendingItems(data) {
  return [
    'pendingWordMasterySync',
    'pendingLearningRecordSync',
    'pendingLearningProgressSync',
    'pendingPreviewStateSync'
  ].reduce((total, key) => {
    const value = data[key];
    if (Array.isArray(value)) return total + value.length;
    if (isPlainObject(value)) return total + Object.keys(value).length;
    return total;
  }, 0);
}

function buildManifest(data) {
  const keys = Object.keys(data || {}).sort();
  return {
    keys,
    counts: {
      students: Array.isArray(data.students) ? data.students.length : 0,
      learningRecords: Array.isArray(data.learningRecords) ? data.learningRecords.length : 0,
      wordMasteryWords: countWordMasteryWords(data.wordMastery),
      learningProgressStudents: isPlainObject(data.learningProgress)
        ? Object.keys(data.learningProgress).length
        : 0,
      antiForgettingRecords: Array.isArray(data.antiForgettingRecords)
        ? data.antiForgettingRecords.length
        : 0,
      dynamicKeys: keys.filter(isDynamicProtectedStorageKey).length,
      pendingItems: countPendingItems(data)
    }
  };
}

function resolveCurrentOwnerId(explicitOwnerId) {
  const explicit = String(explicitOwnerId || '').trim();
  if (explicit) return explicit;
  const storedOpenId = String(wx.getStorageSync('openid') || '').trim();
  if (storedOpenId) return storedOpenId;
  const user = wx.getStorageSync('currentUser') || {};
  return String(user.openid || user.openId || user.teacher_id || user.teacherId || user.id || '').trim();
}

function createBackupEnvelope(options) {
  const settings = options || {};
  const data = settings.data ? clone(settings.data) : collectProtectedData();
  const now = new Date().toISOString();
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: now,
    ownerId: resolveCurrentOwnerId(settings.ownerId),
    sourceDataVersion: settings.sourceDataVersion || data.dataVersion || 'legacy-unversioned',
    targetDataVersion: settings.targetDataVersion || null,
    reason: settings.reason || 'manual-export',
    manifest: buildManifest(data),
    data,
    checksum: calculatePayloadChecksum(data)
  };
}

function verifyBackupEnvelope(envelope) {
  try {
    if (!isPlainObject(envelope)) throw new Error('backup_envelope_invalid');
    if (envelope.format !== BACKUP_FORMAT) throw new Error('backup_format_invalid');
    if (envelope.schemaVersion !== BACKUP_SCHEMA_VERSION) throw new Error('backup_schema_unsupported');
    if (!isPlainObject(envelope.data)) throw new Error('backup_payload_invalid');
    if (envelope.checksum !== calculatePayloadChecksum(envelope.data)) {
      throw new Error('backup_checksum_mismatch');
    }
    const manifest = buildManifest(envelope.data);
    if (!isPlainObject(envelope.manifest) ||
        stableStringify(envelope.manifest) !== stableStringify(manifest)) {
      throw new Error('backup_manifest_mismatch');
    }
    return { ok: true, manifest };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
}

function sanitizeFilePart(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

function persistVerifiedSnapshot(envelope) {
  const beforeWrite = verifyBackupEnvelope(envelope);
  if (!beforeWrite.ok) throw new Error(beforeWrite.error);
  if (!wx.env || !wx.env.USER_DATA_PATH || !wx.getFileSystemManager) {
    throw new Error('persistent_backup_unavailable');
  }

  const fs = wx.getFileSystemManager();
  const fileName = [
    'wordmaster-upgrade',
    sanitizeFilePart(envelope.sourceDataVersion),
    Date.now()
  ].join('-') + '.json';
  const path = wx.env.USER_DATA_PATH + '/' + fileName;
  fs.writeFileSync(path, JSON.stringify(envelope), 'utf8');

  const persistedEnvelope = JSON.parse(fs.readFileSync(path, 'utf8'));
  const afterWrite = verifyBackupEnvelope(persistedEnvelope);
  if (!afterWrite.ok) throw new Error('persistent_backup_verify_failed:' + afterWrite.error);

  const currentIndex = wx.getStorageSync(BACKUP_INDEX_KEY);
  const index = Array.isArray(currentIndex) ? currentIndex.slice() : [];
  index.push({
    path,
    createdAt: persistedEnvelope.createdAt,
    ownerId: persistedEnvelope.ownerId,
    sourceDataVersion: persistedEnvelope.sourceDataVersion,
    targetDataVersion: persistedEnvelope.targetDataVersion,
    reason: persistedEnvelope.reason,
    checksum: persistedEnvelope.checksum,
    manifest: persistedEnvelope.manifest
  });
  wx.setStorageSync(BACKUP_INDEX_KEY, index);
  const verifiedIndex = wx.getStorageSync(BACKUP_INDEX_KEY);
  if (!Array.isArray(verifiedIndex) || !verifiedIndex.some((item) => item.path === path)) {
    throw new Error('backup_index_verify_failed');
  }

  return { path, envelope: persistedEnvelope };
}

function normalizeBackupEnvelope(input, options) {
  const settings = options || {};
  if (!isPlainObject(input)) throw new Error('backup_input_invalid');

  if (input.format === BACKUP_FORMAT) {
    const verification = verifyBackupEnvelope(input);
    if (!verification.ok) throw new Error(verification.error);
    return clone(input);
  }

  const historicalWrapper = isPlainObject(input.data) && (
    hasOwn(input, 'exportTime') || hasOwn(input, 'version')
  );
  const data = historicalWrapper ? input.data : input;
  if (!isPlainObject(data)) throw new Error('backup_payload_invalid');

  const normalized = createBackupEnvelope({
    data,
    ownerId: '',
    sourceDataVersion: historicalWrapper ? (input.version || 'legacy-unversioned') : 'legacy-unversioned',
    targetDataVersion: settings.targetDataVersion || null,
    reason: historicalWrapper ? 'legacy-export-import' : 'legacy-raw-import'
  });
  normalized.ownerId = '';
  normalized.legacy = true;
  normalized.originalExportTime = historicalWrapper ? (input.exportTime || null) : null;
  return normalized;
}

function collectExplicitOwnerIds(value, result) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectExplicitOwnerIds(item, result));
    return;
  }
  const ownerFields = [
    'ownerId', 'owner_id', 'teacherId', 'teacher_id',
    'teacherOpenId', 'teacher_openid', '_openid'
  ];
  ownerFields.forEach((field) => {
    if (!hasOwn(value, field)) return;
    const normalized = String(value[field] || '').trim();
    if (normalized) result.add(normalized);
  });
  Object.keys(value).forEach((key) => collectExplicitOwnerIds(value[key], result));
}

function assertBackupOwnerCompatible(envelope, currentOwnerId) {
  const current = String(currentOwnerId || '').trim();
  if (!current) throw new Error('missing_current_owner');
  const envelopeOwner = String(envelope && envelope.ownerId || '').trim();
  if (envelopeOwner && envelopeOwner !== current) throw new Error('backup_owner_mismatch');

  const explicitOwners = new Set();
  const data = envelope && envelope.data || {};
  OWNERSHIP_DATA_KEYS.forEach((key) => collectExplicitOwnerIds(data[key], explicitOwners));
  const foreign = Array.from(explicitOwners).filter((ownerId) => ownerId !== current);
  if (foreign.length > 0) throw new Error('backup_contains_foreign_owner');
  return true;
}

function restoreExactProtectedData(data) {
  if (!isPlainObject(data)) throw new Error('rollback_payload_invalid');
  const existingProtectedKeys = getAllStorageKeys().filter(isProtectedStorageKey);
  existingProtectedKeys.forEach((key) => {
    if (!hasOwn(data, key)) wx.removeStorageSync(key);
  });
  Object.keys(data).filter(isProtectedStorageKey).forEach((key) => {
    wx.setStorageSync(key, clone(data[key]));
  });
  return true;
}

function readPersistedSnapshot(path) {
  if (!path) throw new Error('backup_path_missing');
  const fs = wx.getFileSystemManager();
  const envelope = JSON.parse(fs.readFileSync(path, 'utf8'));
  const verification = verifyBackupEnvelope(envelope);
  if (!verification.ok) throw new Error(verification.error);
  return envelope;
}

module.exports = {
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  BACKUP_INDEX_KEY,
  PROTECTION_STATE_KEY,
  FIXED_PROTECTED_KEYS,
  DYNAMIC_PROTECTED_PREFIXES,
  DYNAMIC_PROTECTED_SUFFIXES,
  isProtectedStorageKey,
  isDynamicProtectedStorageKey,
  collectProtectedData,
  calculatePayloadChecksum,
  countWordMasteryWords,
  buildManifest,
  resolveCurrentOwnerId,
  createBackupEnvelope,
  verifyBackupEnvelope,
  persistVerifiedSnapshot,
  normalizeBackupEnvelope,
  assertBackupOwnerCompatible,
  restoreExactProtectedData,
  readPersistedSnapshot
};
