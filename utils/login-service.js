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

let _loginInProgress = false;

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
function hasLocalDataToMigrate() {
  var students = wx.getStorageSync('students');
  var learningRecords = wx.getStorageSync('learningRecords');
  var learningProgress = wx.getStorageSync('learningProgress');
  var wordMastery = wx.getStorageSync('wordMastery');
  return !!(
    (Array.isArray(students) && students.length > 0) ||
    (Array.isArray(learningRecords) && learningRecords.length > 0) ||
    (learningProgress && typeof learningProgress === 'object' && !Array.isArray(learningProgress) && Object.keys(learningProgress).length > 0) ||
    (wordMastery && typeof wordMastery === 'object' && !Array.isArray(wordMastery) && Object.keys(wordMastery).length > 0)
  );
}

// 核心：静默登录（等待云端数据同步完成，确保数据就绪）
function doSilentLogin() {
  if (_loginInProgress) return Promise.resolve({ skipped: true });
  _loginInProgress = true;

  console.log('[login-service] 开始静默登录');

  function finish(result) {
    _loginInProgress = false;
    return result;
  }

  // 后台下载完成后通知首页刷新（返回 promise，调用方可 await）
  function backgroundDownload(openid) {
    return syncDataFromCloud(openid).then(function() {
      try { getApp().emit('cloudSyncComplete'); } catch(e) {}
      console.log('[login-service] 后台拉取云端数据完成');
    }).catch(function(err) {
      console.warn('[login-service] 后台拉取云端数据失败:', err);
    });
  }

  var cachedOpenId = wx.getStorageSync('openid');

  // 上云与拉回之间留冷却时间，避免 CloudBase 请求限流
  var coolDown = function() {
    return new Promise(function(r) { setTimeout(r, 2000); });
  };

  if (cachedOpenId) {
    console.log('[login-service] 使用缓存 openid:', cachedOpenId);
    retryPendingSyncs();

    var p = hasLocalDataToMigrate()
      ? migrateLocalDataToCloud({ force: true }).then(coolDown)
      : Promise.resolve();

    return p.then(function() {
      return backgroundDownload(cachedOpenId);
    }).then(function() {
      return finish({ ok: true });
    }).catch(function(error) {
      console.error('[login-service] 登录失败:', error);
      return finish({ ok: false, error: error });
    });
  }

  // 无缓存 openid → 调云函数获取（同步等待云端数据下载完成）
  return fetchOpenId().then(function(openid) {
    wx.setStorageSync('openid', openid);
    return ensureTeacherRecord(openid).then(function() {
      retryPendingSyncs();
      return migrateLocalDataToCloud({ force: true });
    });
  }).then(function() {
    var openid = wx.getStorageSync('openid');
    if (openid) return coolDown().then(function() { return backgroundDownload(openid); });
  }).then(function() {
    return finish({ ok: true });
  }).catch(function(error) {
    console.error('[login-service] 登录失败:', error);
    return finish({ ok: false, error: error });
  });
}

module.exports = {
  isLoggedIn: isLoggedIn,
  doSilentLogin: doSilentLogin,
  fetchOpenId: fetchOpenId,
  ensureTeacherRecord: ensureTeacherRecord
};
