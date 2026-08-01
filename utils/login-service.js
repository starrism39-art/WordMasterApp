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

// 核心：静默登录（等待云端数据同步完成，确保数据就绪）
function doSilentLogin() {
  if (_loginPromise) return _loginPromise;

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

  function pushAfterPull(openid) {
    var alreadyMigrated = hasCompletedMigration(openid);
    var shouldMigrate = hasLocalDataToMigrate(localSnapshotBeforePull) && !alreadyMigrated;

    if (!shouldMigrate && !alreadyMigrated) {
      markMigrationComplete(openid, 'cloud_bootstrap');
    } else if (alreadyMigrated && !getMigrationEntry(openid)) {
      // Promote the old global marker to the account-scoped marker.
      markMigrationComplete(openid, 'legacy_marker');
    }

    var migration = shouldMigrate ? migrateLocalDataToCloud() : Promise.resolve({ skipped: true });
    return migration.then(function(result) {
      if (result && result.error) {
        throw new Error(result.error);
      }
      if (shouldMigrate && result && result.success === true) {
        markMigrationComplete(openid, 'legacy_migration');
      }
      return retryPendingSyncs();
    });
  }

  var cachedOpenId = wx.getStorageSync('openid');
  var workflow;
  if (cachedOpenId) {
    console.log('[login-service] 使用缓存 openid:', cachedOpenId);
    workflow = pullFromCloud(cachedOpenId).then(function() {
      return pushAfterPull(cachedOpenId);
    });
  } else {
    // 无缓存 openid → 获取身份、建立教师记录，再拉取云端；本地写入仍必须排在拉取成功之后。
    workflow = fetchOpenId().then(function(openid) {
      wx.setStorageSync('openid', openid);
      return ensureTeacherRecord(openid).then(function() {
        return pullFromCloud(openid);
      });
    }).then(function() {
      return pushAfterPull(wx.getStorageSync('openid'));
    });
  }

  _loginPromise = workflow.then(function() {
    return { ok: true };
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
