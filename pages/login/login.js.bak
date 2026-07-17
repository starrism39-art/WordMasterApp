// login.js
var syncDataFromCloud = require("../../utils/cloud-migration").syncDataFromCloud;
var migrateLocalDataToCloud = require("../../utils/cloud-migration").migrateLocalDataToCloud;
var retryPendingSyncs = require("../../utils/cloud-sync.js").retryPendingSyncs;

Page({
  data: {
    isLoading: false,
    hasAgreed: false,
    showAgreementModal: false
  },

  onLoad: function() {
    var agreed = !!wx.getStorageSync("hasAgreedToPolicies");
    if (agreed) {
      this.setData({ hasAgreed: true, showAgreementModal: false }, function() {
        this.doLogin();
      }.bind(this));
    }
  },

  onShow: function() {
    if (this.data.hasAgreed && !this._autoChecked) {
      this.doLogin();
    }
  },

  onLoginTap: function() {
    this.setData({ showAgreementModal: true });
  },

  onGuestTap: function() {
    this.navigateToHome();
  },

  toggleAgreement: function() {
    this.setData({ hasAgreed: !this.data.hasAgreed });
  },

  confirmAgreement: function() {
    if (!this.data.hasAgreed) {
      wx.showToast({ title: "please agree first", icon: "none" });
      return;
    }
    try { wx.setStorageSync("hasAgreedToPolicies", true); } catch (e) {}
    this.setData({ showAgreementModal: false }, function() {
      this.doLogin();
    }.bind(this));
  },

  closeAgreementModal: function() {
    this.setData({ showAgreementModal: false, hasAgreed: false });
  },

  doLogin: function() {
    if (this._autoLoginInProgress) return;
    this._autoLoginInProgress = true;
    this._autoChecked = true;
    var that = this;
    var cachedOpenId = wx.getStorageSync("openid");

    if (cachedOpenId) {
      retryPendingSyncs();
      if (this.hasLocalDataToMigrate()) {
        this.setData({ isLoading: true });
        this.runBlockingMigrate().then(function() {
          return that.runBlockingSync(cachedOpenId);
        }).then(function(r) {
          if (r && r.error) wx.showToast({ title: "sync failed", icon: "none" });
          that.navigateToHome();
        }).catch(function(e) {
          that.handleLoginError("login failed");
        }).finally(function() {
          that._autoLoginInProgress = false;
          that.setData({ isLoading: false });
        });
      } else {
        this.setData({ isLoading: true });
        this.runBlockingSync(cachedOpenId).then(function(r) {
          if (r && r.error) wx.showToast({ title: "sync failed", icon: "none" });
          that.navigateToHome();
        }).catch(function(e) {
          that.handleLoginError("login failed");
        }).finally(function() {
          that._autoLoginInProgress = false;
          that.setData({ isLoading: false });
        });
      }
      return;
    }

    if (!wx.cloud) { this.handleLoginError("cloud not available"); return; }
    this.setData({ isLoading: true });
    this.fetchOpenId().then(function(openid) {
      wx.setStorageSync("openid", openid);
      return that.ensureTeacherRecord(openid);
    }).then(function() {
      retryPendingSyncs();
      return that.runBlockingMigrate();
    }).then(function() {
      return that.runBlockingSync(wx.getStorageSync("openid"));
    }).then(function(r) {
      if (r && r.error) wx.showToast({ title: "sync failed", icon: "none" });
      that.navigateToHome();
    }).catch(function(e) {
      that.handleLoginError("login failed");
    }).finally(function() {
      that._autoLoginInProgress = false;
      that.setData({ isLoading: false });
    });
  },

  hasLocalDataToMigrate: function() {
    if (wx.getStorageSync("hasMigratedToCloud")) return false;
    var s = wx.getStorageSync("students");
    var r = wx.getStorageSync("learningRecords");
    var p = wx.getStorageSync("learningProgress");
    var m = wx.getStorageSync("wordMastery");
    return (Array.isArray(s) && s.length > 0) ||
           (Array.isArray(r) && r.length > 0) ||
           (p && typeof p === "object" && !Array.isArray(p) && Object.keys(p).length > 0) ||
           (m && typeof m === "object" && !Array.isArray(m) && Object.keys(m).length > 0);
  },

  runBlockingMigrate: function() {
    wx.showLoading({ title: "uploading...", mask: true });
    var that = this;
    return migrateLocalDataToCloud().finally(function() {
      wx.hideLoading(); that.setData({ isLoading: false });
    });
  },

  fetchOpenId: function() {
    return wx.cloud.callFunction({ name: "login", data: {} }).then(function(res) {
      var o = null;
      if (res && res.result) o = res.result.openid || res.result.OPENID || res.result.openId;
      if (!o) throw new Error("missing_openid");
      return o;
    });
  },

  ensureTeacherRecord: function(openid) {
    if (!wx.cloud) return Promise.resolve();
    var db = wx.cloud.database({ env: "cloudbase-4gafzdch60ad597b" });
    var col = db.collection("teachers");
    return col.where({ teacher_id: openid }).limit(1).get().then(function(res) {
      if (res && res.data && res.data.length > 0) {
        var t = res.data[0];
        var app = getApp();
        var u = app.ensureUserPermissions({
          id: openid, username: openid, name: t.name || "teacher",
          userRole: t.userRole || "external", memberLevel: t.memberLevel || "free"
        });
        wx.setStorageSync("currentUser", u);
        app.globalData.currentUser = u;
        return;
      }
      return col.add({ data: {
        teacher_id: openid, openid: openid, name: "teacher",
        userRole: "external", memberLevel: "free",
        createdAt: new Date().toISOString(), status: "active"
      }}).then(function() {
        var app = getApp();
        var u = app.ensureUserPermissions({
          id: openid, username: openid, name: "teacher",
          userRole: "external", memberLevel: "free"
        });
        wx.setStorageSync("currentUser", u);
        app.globalData.currentUser = u;
      });
    });
  },

  runBlockingSync: function(openid) {
    wx.showLoading({ title: "syncing...", mask: true });
    var that = this;
    return syncDataFromCloud(openid).finally(function() {
      wx.hideLoading(); that.setData({ isLoading: false });
    });
  },

  handleLoginError: function(msg) {
    wx.hideLoading();
    this.setData({ isLoading: false });
    wx.showToast({ title: msg, icon: "none", duration: 2500 });
  },

  navigateToHome: function() {
    wx.hideLoading();
    this.setData({ isLoading: false });
    setTimeout(function() {
      wx.switchTab({ url: "/pages/index/index" });
    }, 500);
  },

  onViewUserAgreement: function() {
    wx.showModal({ title: "user agreement", content: "view in app.", showCancel: false });
  },

  onViewPrivacy: function() {
    if (wx.openPrivacyContract) {
      wx.openPrivacyContract({});
      return;
    }
    wx.showModal({ title: "privacy", content: "upgrade wechat.", showCancel: false });
  },

  noop: function() {}
});