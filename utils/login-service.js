/**
 * utils/login-service.js
 * 静默登录服务 - 不依赖页面 UI，可在任何地方调用
 */
'use strict';

const DEFAULT_ENV = 'cloudbase-4gafzdch60ad597b';
const syncDataFromCloud = require('./cloud-migration.js').syncDataFromCloud;
const migrateLocalDataToCloud = require('./cloud-migration.js').migrateLocalDataToCloud;
const retryPendingSyncs = require('./cloud-sync.js').retryPendingSyncs;
const { createCloudReadOnlyResult, isCloudReadOnlyMode } = require('./cloud-mode.js');
const {
  getMigrationEntry,
  hasCompletedMigration,
  markMigrationComplete
} = require('./cloud-migration-state.js');

let _loginPromise = null;

// 是否已有登录凭证
function isLoggedIn() {
  return !!wx.getStorageSync('openid') && !!wx.getStorageSync('currentUser');
}

// 获取 openid（调云函数）
function fetchOpenId() {
  return new Promise(function(resolve, reject) {
    var timer = setTimeout(function() {
      reject(new Error('fetchOpenId timeout'));
    }, 8000);
    wx.cloud.callFunction({ name: 'login', data: {} }).then(function(res) {
      clearTimeout(timer);
      var openid = res && res.result && (res.result.openid || res.result.OPENID || res.result.openId);
      if (!openid) {
        reject(new Error('missing_openid'));
        return;
      }
      console.log('[login-service] openid:', openid);
      resolve(openid);
    }).catch(function(err) {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// 确保教师记录存在
function ensureTeacherRecord(openid) {
  if (isCloudReadOnlyMode()) {
    return Promise.resolve(createCloudReadOnlyResult('ensureTeacherRecord'));
  }

  if (!wx.cloud) return Promise.resolve();
  var db = wx.cloud.database({ env: DEFAULT_ENV });
  var teachersCollection = db.collection('teachers');
  return teachersCollection.where({ teacher_id: openid }).limit(1).get().then(function(queryRes) {
    var hasRecord = queryRes && Array.isArray(queryRes.data) && queryRes.data.length > 0;
    if (hasRecord) {
      var cloudTeacher = queryRes.data[0];
      var app = getApp();
      var normalizedUser = app.ensureUserPermissions({
        id: openid, username: openid,
        name: cloudTeacher.name || '教师',
        userRole: cloudTeacher.userRole || 'external',
        memberLevel: cloudTeacher.memberLevel || 'free'
      });
      wx.setStorageSync('currentUser', normalizedUser);
      app.globalData.currentUser = normalizedUser;
      return;
    }
    var ts = String(Date.now()).slice(-4);
    return teachersCollection.add({
      data: {
        teacher_id: openid, openid: openid,
        name: '教师' + ts, userRole: 'external', memberLevel: 'free',
        createdAt: new Date().toISOString(), status: 'active'
      }
    }).then(function() {
      var app = getApp();
      var normalizedUser = app.ensureUserPermissions({
        id: openid, username: openid, name: '教师' + ts,
        userRole: 'external', memberLevel: 'free'
      });
      wx.setStorageSync('currentUser', normalizedUser);
      app.globalData.currentUser = normalizedUser;
    });
  }).catch(function(error) {
    console.error('[login-service] ensureTeacherRecord failed:', error);
  });
}

// 是否有本地数据需要迁移
function readLocalMigrationSnapshot() {
  return {
    students: wx.getStorageSync('students'),
    learningRecords: wx.getStorageSync('learningRecords'),
    learningProgress: wx.getStorageSync('learningProgress'),
    wordMastery: wx.getStorageSync('wordMastery')
  };
}

function hasLocalDataToMigrate(snapshot) {
  var source = snapshot || readLocalMigrationSnapshot();
  var students = source.students;
  var learningRecords = source.learningRecords;
  var learningProgress = source.learningProgress;
  var wordMastery = source.wordMastery;
  return !!(
    (Array.isArray(students) && students.length > 0) ||
    (Array.isArray(learningRecords) && learningRecords.length > 0) ||
    (learningProgress && typeof learningProgress === 'object' && !Array.isArray(learningProgress) && Object.keys(learningProgress).length > 0) ||
    (wordMastery && typeof wordMastery === 'object' && !Array.isArray(wordMastery) && Object.keys(wordMastery).length > 0)
  );
}

function normalizeId(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

function getOwnerId(value) {
  return normalizeId(value && (
    value.teacher_id || value.teacherId || value.ownerId || value.ownerUsername
  ));
}

function getStudentId(value) {
  return normalizeId(value && (value.student_id || value.studentId || value.id || value._id));
}

function getRecordId(value) {
  return normalizeId(value && (value.id || value._id));
}

function getUpdatedAt(value) {
  if (!value || typeof value !== 'object') return 0;
  var raw = value.updatedAt || value.updated_at || value.lastUpdated || value.lastUpdatedAt || 0;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (raw instanceof Date) return raw.getTime();
  var parsed = Date.parse(raw || '');
  return Number.isNaN(parsed) ? 0 : parsed;
}

function localEntryIsCovered(localValue, cloudValue) {
  if (!cloudValue) return false;
  var localUpdatedAt = getUpdatedAt(localValue);
  var cloudUpdatedAt = getUpdatedAt(cloudValue);
  return !(localUpdatedAt > 0 && cloudUpdatedAt > 0 && localUpdatedAt > cloudUpdatedAt);
}

// 已有缓存客户端升级到新同步逻辑时，本地通常已经是上次云拉取的副本。
// 只有云端确实缺少本地条目（或本地版本明确更新）时，才允许走一次旧数据迁移，
// 避免把云端数据重新批量写回并制造“部分数据待同步”的假警报。
function isLocalSnapshotCoveredByCloud(snapshot, cloudSnapshot, openid) {
  if (!cloudSnapshot || typeof cloudSnapshot !== 'object') return false;

  var source = snapshot || {};
  var normalizedOpenId = normalizeId(openid);
  var localStudents = Array.isArray(source.students) ? source.students : [];
  var scopedStudents = localStudents.filter(function(student) {
    var ownerId = getOwnerId(student);
    return !ownerId || ownerId === normalizedOpenId;
  });
  var allowedStudentIds = {};
  scopedStudents.forEach(function(student) {
    var studentId = getStudentId(student);
    if (studentId) allowedStudentIds[studentId] = true;
  });

  var cloudStudentsById = {};
  (Array.isArray(cloudSnapshot.students) ? cloudSnapshot.students : []).forEach(function(student) {
    var studentId = getStudentId(student);
    if (studentId) cloudStudentsById[studentId] = student;
  });
  for (var i = 0; i < scopedStudents.length; i++) {
    var scopedStudentId = getStudentId(scopedStudents[i]);
    if (!scopedStudentId || !localEntryIsCovered(scopedStudents[i], cloudStudentsById[scopedStudentId])) {
      return false;
    }
  }

  var cloudRecordsById = {};
  (Array.isArray(cloudSnapshot.learningRecords) ? cloudSnapshot.learningRecords : []).forEach(function(record) {
    var recordId = getRecordId(record);
    if (recordId) cloudRecordsById[recordId] = record;
  });
  var localRecords = Array.isArray(source.learningRecords) ? source.learningRecords : [];
  for (var r = 0; r < localRecords.length; r++) {
    var localRecord = localRecords[r];
    var ownerId = getOwnerId(localRecord);
    var recordStudentId = getStudentId(localRecord);
    if ((ownerId && ownerId !== normalizedOpenId) || !allowedStudentIds[recordStudentId]) continue;
    var recordId = getRecordId(localRecord);
    if (!recordId || !localEntryIsCovered(localRecord, cloudRecordsById[recordId])) return false;
  }

  var localProgress = source.learningProgress && typeof source.learningProgress === 'object'
    ? source.learningProgress
    : {};
  var cloudProgress = cloudSnapshot.learningProgress && typeof cloudSnapshot.learningProgress === 'object'
    ? cloudSnapshot.learningProgress
    : {};
  var progressStudentIds = Object.keys(localProgress);
  for (var p = 0; p < progressStudentIds.length; p++) {
    var progressStudentId = normalizeId(progressStudentIds[p]);
    if (!allowedStudentIds[progressStudentId]) continue;
    if (!localEntryIsCovered(localProgress[progressStudentId], cloudProgress[progressStudentId])) return false;
  }

  var localMastery = source.wordMastery && typeof source.wordMastery === 'object'
    ? source.wordMastery
    : {};
  var cloudMastery = cloudSnapshot.wordMastery && typeof cloudSnapshot.wordMastery === 'object'
    ? cloudSnapshot.wordMastery
    : {};
  var masteryStudentIds = Object.keys(localMastery);
  for (var m = 0; m < masteryStudentIds.length; m++) {
    var masteryStudentId = normalizeId(masteryStudentIds[m]);
    if (!allowedStudentIds[masteryStudentId]) continue;
    var localBooks = localMastery[masteryStudentId] || {};
    var cloudBooks = cloudMastery[masteryStudentId] || {};
    var wordbookIds = Object.keys(localBooks);
    for (var b = 0; b < wordbookIds.length; b++) {
      var wordbookId = wordbookIds[b];
      var localWords = localBooks[wordbookId] || {};
      var cloudWords = cloudBooks[wordbookId] || {};
      var wordIds = Object.keys(localWords);
      for (var w = 0; w < wordIds.length; w++) {
        var wordId = wordIds[w];
        if (!localEntryIsCovered(localWords[wordId], cloudWords[wordId])) return false;
      }
    }
  }

  return true;
}

// 核心：静默登录（等待云端数据同步完成，确保数据就绪）
function doSilentLogin() {
  if (_loginPromise) return _loginPromise;

  var protectionState = wx.getStorageSync('upgradeProtectionState');
  var appProtectionBlocked = false;
  var appProtectionError = null;
  try {
    var currentApp = getApp();
    appProtectionBlocked = !!(currentApp && currentApp.globalData && currentApp.globalData.upgradeProtectionBlocked);
    appProtectionError = currentApp && currentApp.globalData && currentApp.globalData.upgradeProtectionError;
  } catch (e) {
    // 存储状态仍可独立完成保护判定。
  }
  if (appProtectionBlocked || (protectionState && protectionState.status === 'blocked')) {
    var protectionError = new Error(
      appProtectionError || protectionState && protectionState.message || 'upgrade_protection_blocked'
    );
    protectionError.code = 'upgrade_protection_blocked';
    console.error('[login-service] 升级保护未完成，阻断登录与云同步:', protectionError);
    return Promise.resolve({ ok: false, blocked: true, error: protectionError });
  }

  // Snapshot before cloud pull. Data written by the pull itself is cloud
  // bootstrap data and must never be treated as legacy local data.
  var localSnapshotBeforePull = readLocalMigrationSnapshot();

  console.log('[login-service] 开始静默登录');

  // 云端拉取必须成功，后续才允许迁移/重试本地待写数据，避免旧设备先覆盖新云端状态。
  function pullFromCloud(openid) {
    return syncDataFromCloud(openid).then(function(result) {
      if (!result || result.error || result.success === false) {
        throw new Error(result && result.error ? result.error : 'cloud_pull_failed');
      }
      try { getApp().emit('cloudSyncComplete'); } catch(e) {}
      console.log('[login-service] 云端数据拉取并合并完成');
      return result;
    });
  }

  function pushAfterPull(openid, pullResult) {
    var alreadyMigrated = hasCompletedMigration(openid);
    var hasLocalSnapshot = hasLocalDataToMigrate(localSnapshotBeforePull);
    var cloudCovered = hasLocalSnapshot && isLocalSnapshotCoveredByCloud(
      localSnapshotBeforePull,
      pullResult && pullResult.cloudSnapshot,
      openid
    );
    var shouldMigrate = hasLocalSnapshot && !alreadyMigrated && !cloudCovered;

    if ((!hasLocalSnapshot || cloudCovered) && !alreadyMigrated) {
      markMigrationComplete(openid, cloudCovered ? 'cloud_reconciled' : 'cloud_bootstrap');
    } else if (alreadyMigrated && !getMigrationEntry(openid)) {
      // Promote the old global marker to the account-scoped marker.
      markMigrationComplete(openid, 'legacy_marker');
    }

    var migration = shouldMigrate
      ? migrateLocalDataToCloud({ suppressToast: true })
      : Promise.resolve({ skipped: true });
    return migration.then(function(migrationResult) {
      if (migrationResult && migrationResult.error) {
        throw new Error(migrationResult.error);
      }
      if (shouldMigrate && migrationResult && migrationResult.success === true) {
        markMigrationComplete(openid, 'legacy_migration');
      }
      return retryPendingSyncs().then(function(retryResult) {
        var pending = Number(retryResult && retryResult.pending) || 0;
        var nonRetryableFailures = migrationResult && migrationResult.partial && migrationResult.failures
          ? Number(migrationResult.failures.students || 0) || 0
          : 0;
        var unresolved = pending + nonRetryableFailures;

        if (
          shouldMigrate &&
          migrationResult &&
          migrationResult.partial === true &&
          unresolved === 0
        ) {
          markMigrationComplete(openid, 'legacy_migration_recovered');
        }

        return {
          pending: unresolved,
          migration: migrationResult || null,
          retry: retryResult || null
        };
      });
    });
  }

  var cachedOpenId = wx.getStorageSync('openid');
  var workflow;
  if (cachedOpenId) {
    console.log('[login-service] 使用缓存 openid:', cachedOpenId);
    workflow = pullFromCloud(cachedOpenId).then(function(pullResult) {
      return pushAfterPull(cachedOpenId, pullResult);
    });
  } else {
    // 无缓存 openid → 获取身份、建立教师记录，再拉取云端；本地写入仍必须排在拉取成功之后。
    workflow = fetchOpenId().then(function(openid) {
      wx.setStorageSync('openid', openid);
      return ensureTeacherRecord(openid).then(function() {
        return pullFromCloud(openid);
      }).then(function(pullResult) {
        return pushAfterPull(openid, pullResult);
      });
    });
  }

  _loginPromise = workflow.then(function(syncResult) {
    return {
      ok: true,
      pending: Number(syncResult && syncResult.pending) || 0,
      migration: syncResult && syncResult.migration,
      retry: syncResult && syncResult.retry
    };
  }).catch(function(error) {
    console.error('[login-service] 登录或同步失败:', error);
    return { ok: false, error: error };
  }).then(function(result) {
    _loginPromise = null;
    return result;
  });

  return _loginPromise;
}

module.exports = {
  isLoggedIn: isLoggedIn,
  doSilentLogin: doSilentLogin,
  fetchOpenId: fetchOpenId,
  ensureTeacherRecord: ensureTeacherRecord
};
