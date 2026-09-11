const membershipBusiness = require('../../utils/membership-business-client');
const { isCloudReadOnlyMode } = require('../../utils/cloud-mode.js');

Page({
  data: {
    userLabel: '未登录',
    studentsTotal: 0,
    ownedCount: 0,
    unownedCount: 0,
    legacyMockCount: 0,
    backupInfo: null,
    logs: [],
    repairingCloudNames: false
  },

  _defaultEnv: 'cloudbase-4gafzdch60ad597b',

  onLoad: function() {
    this.showReleaseGuideOnce();
    this.refreshRepairStatus();
  },

  onShow: function() {
    this.refreshRepairStatus();
  },

  refreshRepairStatus: function() {
    try {
      const app = getApp();
      const currentUser = wx.getStorageSync('currentUser') || (app.globalData || {}).currentUser || null;
      const currentUserId = currentUser && (currentUser.id || currentUser.username);
      const students = wx.getStorageSync('students') || [];
      const backup = wx.getStorageSync('students_safety_backup_latest') || null;
      const legacyMockIds = new Set(['20001', '20002', '20003', 'student_1']);

      let ownedCount = 0;
      let unownedCount = 0;
      let legacyMockCount = 0;

      students.forEach((s) => {
        if (!s) return;
        const id = String(s.id || '');
        if (legacyMockIds.has(id)) {
          legacyMockCount += 1;
          return;
        }
        const owner = s.ownerId || s.ownerUsername;
        if (!owner) {
          unownedCount += 1;
          return;
        }
        if (currentUserId && owner === currentUserId) {
          ownedCount += 1;
        }
      });

      const userLabel = currentUser ? (currentUser.username || currentUser.id || '已登录用户') : '未登录';

      this.setData({
        userLabel,
        studentsTotal: Array.isArray(students) ? students.length : 0,
        ownedCount,
        unownedCount,
        legacyMockCount,
        backupInfo: backup
      });

      this.addLog('状态已刷新');
    } catch (error) {
      console.error('刷新修复状态失败:', error);
      this.addLog('刷新失败: ' + error.message);
      wx.showToast({ title: '刷新失败', icon: 'none' });
    }
  },

  showReleaseGuideOnce: function() {
    try {
      const shown = wx.getStorageSync('dataRepairGuideShown');
      if (shown) return;

      wx.setStorageSync('dataRepairGuideShown', true);
      wx.showModal({
        title: '使用建议',
        content: '若数据异常，请按顺序操作：1. 立即手动备份 2. 预览迁移影响 3. 执行无归属学生迁移 4. 异常时一键回滚。',
        showCancel: false,
        confirmText: '知道了'
      });
    } catch (error) {
      console.error('展示首次引导失败:', error);
    }
  },

  previewMigration: function() {
    const { unownedCount } = this.data;
    wx.showModal({
      title: '迁移预览',
      content: `预计会认领 ${unownedCount} 条无归属学生数据到当前账号。`,
      showCancel: false,
      confirmText: '知道了'
    });
    this.addLog('已查看迁移预览');
  },

  runMigration: function() {
    const app = getApp();
    if (!app || typeof app.migrateLegacyStudentsForUser !== 'function') {
      wx.showToast({ title: '迁移功能不可用', icon: 'none' });
      return;
    }

    const currentUser = wx.getStorageSync('currentUser') || (app.globalData || {}).currentUser || null;
    if (!currentUser) {
      wx.showToast({ title: '请先登录账号', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认迁移',
      content: '将把无归属学生数据认领到当前账号，迁移前会自动安全备份。是否继续？',
      success: (res) => {
        if (!res.confirm) return;

        const result = app.migrateLegacyStudentsForUser(currentUser);
        if (result && result.reason === 'migrated') {
          wx.showToast({ title: `迁移成功 ${result.migrated} 条`, icon: 'success' });
          this.addLog(`迁移成功，数量: ${result.migrated}`);
          this.refreshRepairStatus();
          return;
        }

        const reasonTextMap = {
          no_user: '无登录用户',
          no_students: '暂无学生数据',
          already_owned: '当前账号已有归属学生，未执行迁移',
          no_legacy_unowned: '无可迁移的无归属学生',
          error: '迁移失败'
        };
        const reason = (result && reasonTextMap[result.reason]) || '无需迁移';
        wx.showToast({ title: reason, icon: 'none' });
        this.addLog('迁移未执行: ' + reason);
        this.refreshRepairStatus();
      }
    });
  },

  restoreFromBackup: function() {
    const app = getApp();
    if (!app || typeof app.restoreStudentsFromSafetyBackup !== 'function') {
      wx.showToast({ title: '回滚功能不可用', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认回滚',
      content: '将用最近一次安全备份覆盖当前学生数据，是否继续？',
      success: (res) => {
        if (!res.confirm) return;

        const result = app.restoreStudentsFromSafetyBackup();
        if (result && result.restored) {
          wx.showToast({ title: `已回滚 ${result.count} 条`, icon: 'success' });
          this.addLog(`回滚成功，数量: ${result.count}`);
          this.refreshRepairStatus();
          return;
        }

        wx.showToast({ title: '无可用备份', icon: 'none' });
        this.addLog('回滚失败: 无可用备份');
      }
    });
  },

  createSafetyBackup: function() {
    const app = getApp();
    if (!app || typeof app.backupStudentsSafetySnapshot !== 'function') {
      wx.showToast({ title: '备份功能不可用', icon: 'none' });
      return;
    }

    const result = app.backupStudentsSafetySnapshot('manual_data_repair_page');
    if (result && result.backedUp) {
      wx.showToast({ title: `已备份 ${result.count} 条`, icon: 'success' });
      this.addLog(`手动备份成功，数量: ${result.count}`);
      this.refreshRepairStatus();
      return;
    }

    wx.showToast({ title: '暂无可备份学生数据', icon: 'none' });
    this.addLog('手动备份未执行');
  },

  repairCloudStudentNames: async function() {
    if (this.data.repairingCloudNames) return;
    if (isCloudReadOnlyMode()) {
      console.warn('[cloud-read-only] skip repairCloudStudentNames');
      wx.showToast({ title: '云端只读模式，已跳过修复', icon: 'none' });
      return;
    }
    if (!wx.cloud) {
      wx.showToast({ title: '云能力不可用', icon: 'none' });
      return;
    }

    this.setData({ repairingCloudNames: true });
    wx.showLoading({ title: '云端修复中...', mask: true });

    const isPlaceholderTeacherName = (value) => {
      const text = String(value || '').trim();
      if (!text) return true;
      return text === '未知教师' || text === '教师' || text.toLowerCase() === 'unknown teacher';
    };

    try {
      const db = wx.cloud.database({ env: this._defaultEnv });
      const nowTs = Date.now();

      const teachersRes = await db.collection('teachers').limit(200).get();
      const teacherMap = new Map();
      (teachersRes.data || []).forEach((teacher) => {
        const teacherId = String(teacher.teacher_id || '').trim();
        const teacherName = String(teacher.name || '').trim();
        if (teacherId) teacherMap.set(teacherId, teacherName);
      });

      const studentsRes = await db.collection('students').limit(1000).get();
      const students = studentsRes.data || [];

      let patched = 0;
      let skipped = 0;

      for (const student of students) {
        const docId = String(student._id || '').trim();
        if (!docId) {
          skipped += 1;
          continue;
        }

        const teacherId = String(student.teacher_id || '').trim();
        const cloudTeacherName = teacherMap.get(teacherId) || '';
        const displayName = String(student.name || student.student_name || '').trim();
        const currentStudentName = String(student.student_name || '').trim();
        const currentTeacherName = String(student.teacher_name || '').trim();

        const patch = {};
        if (displayName && currentStudentName !== displayName) {
          patch.student_name = displayName;
          if (!student.name) {
            patch.name = displayName;
          }
        }
        if (cloudTeacherName && !isPlaceholderTeacherName(cloudTeacherName) && currentTeacherName !== cloudTeacherName) {
          patch.teacher_name = cloudTeacherName;
        }

        if (Object.keys(patch).length > 0) {
          patch.updatedAt = nowTs;
          await membershipBusiness.call('updateStudentDisplay', { studentId: String(student.student_id || student.id), documentId: docId, teacherName: cloudTeacherName || currentTeacherName });
          patched += 1;
        } else {
          skipped += 1;
        }
      }

      this.addLog(`云端姓名修复完成: patched=${patched}, skipped=${skipped}`);
      wx.showToast({ title: `修复完成 ${patched} 条`, icon: 'success' });
    } catch (error) {
      console.error('repairCloudStudentNames failed:', error);
      this.addLog('云端姓名修复失败: ' + (error.message || 'unknown'));
      wx.showToast({ title: '淇澶辫触', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ repairingCloudNames: false });
    }
  },

  clearLogs: function() {
    this.setData({ logs: [] });
    this.addLog('日志已清空');
  },

  addLog: function(message) {
    const logs = this.data.logs || [];
    const timestamp = new Date().toLocaleTimeString();
    logs.unshift(`[${timestamp}] ${message}`);
    if (logs.length > 30) {
      logs.pop();
    }
    this.setData({ logs });
  }
});
