// pages/data-backup/data-backup.js
const DataMigration = require('../../utils/data-migration.js');

Page({
  data: {
    currentVersion: '',
    backupInfo: null,
    exportData: null,
    showExportModal: false,
    logs: [],
    availableBackups: [],
    recoverySummary: {
      backupCount: 0,
      latestVersion: '',
      latestTimestamp: '',
      recoverableItems: 0
    },
    dataStats: {
      students: 0,
      learningRecords: 0,
      wordMastery: 0
    }
  },

  onLoad: function() {
    this.loadBackupStatus();
    this.loadDataStats();
    this.loadAvailableBackups();
  },

  // 加载备份状态
  loadBackupStatus: function() {
    try {
      const currentVersion = wx.getStorageSync('dataVersion') || '未初始化';
      const backupKey = `dataBackup_v${currentVersion}_info`;
      const backupInfo = wx.getStorageSync(backupKey);
      
      this.setData({
        currentVersion: currentVersion,
        backupInfo: backupInfo
      });
      
      console.log('当前版本:', currentVersion);
      console.log('备份信息:', backupInfo);
    } catch (error) {
      console.error('加载备份状态失败:', error);
      this.addLog('加载备份状态失败: ' + error.message);
    }
  },

  // 加载数据统计
  loadDataStats: function() {
    try {
      const students = wx.getStorageSync('students') || [];
      const learningRecords = wx.getStorageSync('learningRecords') || [];
      const wordMastery = wx.getStorageSync('wordMastery') || {};
      
      const stats = {
        students: Array.isArray(students) ? students.length : 0,
        learningRecords: Array.isArray(learningRecords) ? learningRecords.length : 0,
        wordMastery: Object.keys(wordMastery).length
      };
      
      this.setData({ dataStats: stats });
      this.addLog(`数据统计: 学生=${stats.students}, 记录=${stats.learningRecords}, 掌握=${stats.wordMastery}`);
    } catch (error) {
      console.error('加载数据统计失败:', error);
      this.addLog('加载数据统计失败: ' + error.message);
    }
  },

  // 扫描可恢复备份
  loadAvailableBackups: function() {
    try {
      const backups = DataMigration.getAvailableBackups() || [];
      const latestBackup = backups[0] || null;
      const totalRecoverableItems = backups.reduce((sum, item) => sum + (item.dataCount || 0), 0);

      const recoverySummary = {
        backupCount: backups.length,
        latestVersion: latestBackup ? latestBackup.version : '',
        latestTimestamp: latestBackup ? latestBackup.timestamp : '',
        recoverableItems: totalRecoverableItems
      };

      this.setData({
        availableBackups: backups,
        recoverySummary
      });

      this.addLog(`扫描到 ${backups.length} 个可恢复备份，共 ${totalRecoverableItems} 个数据项`);
    } catch (error) {
      console.error('扫描可恢复备份失败:', error);
      this.addLog('扫描可恢复备份失败: ' + error.message);
    }
  },

  // 导出数据
  exportData: function() {
    try {
      const exportData = DataMigration.exportAllData();
      if (exportData) {
        this.setData({
          exportData: exportData,
          showExportModal: true
        });
        this.addLog('数据导出成功');
      } else {
        wx.showToast({
          title: '导出失败',
          icon: 'error'
        });
      }
    } catch (error) {
      console.error('导出数据失败:', error);
      this.addLog('导出数据失败: ' + error.message);
      wx.showToast({
        title: '导出失败',
        icon: 'error'
      });
    }
  },

  // 复制导出数据到剪贴板
  copyExportData: function() {
    try {
      const dataStr = JSON.stringify(this.data.exportData, null, 2);
      wx.setClipboardData({
        data: dataStr,
        success: () => {
          wx.showToast({
            title: '已复制到剪贴板',
            icon: 'success'
          });
          this.addLog('导出数据已复制到剪贴板');
        }
      });
    } catch (error) {
      wx.showToast({
        title: '复制失败',
        icon: 'error'
      });
    }
  },

  // 恢复备份
  restoreBackup: function(event) {
    const version = event.currentTarget.dataset.version;
    
    wx.showModal({
      title: '恢复备份',
      content: `确定要恢复版本 ${version} 的备份数据吗？`,
      cancelText: '取消',
      confirmText: '恢复',
      success: (res) => {
        if (res.confirm) {
          try {
            const success = DataMigration.restoreBackup(version, false);
            if (success) {
              wx.showToast({
                title: '备份恢复成功',
                icon: 'success'
              });
              this.addLog(`版本 ${version} 的备份已恢复`);
              this.loadDataStats();
            } else {
              wx.showToast({
                title: '备份恢复失败',
                icon: 'error'
              });
            }
          } catch (error) {
            console.error('恢复备份失败:', error);
            wx.showToast({
              title: '恢复失败',
              icon: 'error'
            });
            this.addLog('恢复备份失败: ' + error.message);
          }
        }
      }
    });
  },

  // 清空所有日志
  clearLogs: function() {
    this.setData({ logs: [] });
    this.addLog('日志已清空');
  },

  // 添加日志
  addLog: function(message) {
    const timestamp = new Date().toLocaleTimeString();
    const log = `[${timestamp}] ${message}`;
    const logs = this.data.logs;
    logs.unshift(log);
    
    // 限制日志数量
    if (logs.length > 50) {
      logs.pop();
    }
    
    this.setData({ logs: logs });
  },

  // 关闭导出模态框
  closeExportModal: function() {
    this.setData({ showExportModal: false });
  },

  // 手动触发备份（用于测试）
  manualBackup: function() {
    wx.showModal({
      title: '手动备份',
      content: '确定要立即备份当前数据吗？',
      success: (res) => {
        if (res.confirm) {
          try {
            const version = wx.getStorageSync('dataVersion');
            const backupKey = DataMigration.backupDataByVersion(version);
            wx.showToast({
              title: '备份成功',
              icon: 'success'
            });
            this.addLog(`已手动备份到 ${backupKey}`);
            this.loadBackupStatus();
            this.loadAvailableBackups();
          } catch (error) {
            console.error('手动备份失败:', error);
            wx.showToast({
              title: '备份失败',
              icon: 'error'
            });
            this.addLog('手动备份失败: ' + error.message);
          }
        }
      }
    });
  },

  // 刷新备份扫描结果
  refreshBackups: function() {
    this.loadBackupStatus();
    this.loadDataStats();
    this.loadAvailableBackups();
  },
  // 从聊天文件导入备份 JSON
  importFromFile: function() {
    const that = this;
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: function(res) {
        const filePath = res.tempFiles[0].path;
        const fs = wx.getFileSystemManager();
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const backup = JSON.parse(content);
          
          // 验证备份格式
          if (!backup.wordMastery && !backup.students) {
            wx.showToast({ title: '无效的备份文件', icon: 'error' });
            that.addLog('导入失败: 文件格式不正确');
            return;
          }

          wx.showModal({
            title: '确认导入',
            content: '将导入 ' + (backup.students?.length || 0) + ' 个学生、' +
              JSON.stringify(Object.keys(backup.wordMastery || {})).length + ' 组单词数据。\n当前数据将被合并，不会丢失已有数据。',
            success: function(modalRes) {
              if (!modalRes.confirm) return;

              // ★ 统一使用公共安全合并函数，覆盖全部 6 种数据
              var safeMergeModule = require('../../utils/safe-merge-restore.js');
              var mergeResult = safeMergeModule.safeMergeRestore(backup);

              // 日志输出
              if (mergeResult.students && !mergeResult.students.error) {
                that.addLog('学生: 新增' + (mergeResult.students.added || 0) + ' 跳过' + (mergeResult.students.skipped || 0));
              }
              if (mergeResult.wordMastery && !mergeResult.wordMastery.error) {
                that.addLog('单词掌握: 新增' + (mergeResult.wordMastery.added || 0) + '词 跳过' + (mergeResult.wordMastery.skipped || 0) + '词');
              }
              if (mergeResult.learningRecords && !mergeResult.learningRecords.error) {
                that.addLog('学习记录: 新增' + (mergeResult.learningRecords.added || 0) + '条');
              }
              if (mergeResult.learningProgress && !mergeResult.learningProgress.error) {
                that.addLog('学习进度: 新增' + (mergeResult.learningProgress.added || 0) + '项');
              }
              if (mergeResult.antiForgettingRecords && !mergeResult.antiForgettingRecords.error) {
                that.addLog('抗遗忘记录: 新增' + (mergeResult.antiForgettingRecords.added || 0) + '条');
              }

              // 单值字段：仅本地为空时恢复
              if (backup.selectedStudent && !wx.getStorageSync('selectedStudent')) {
                wx.setStorageSync('selectedStudent', backup.selectedStudent);
              }
              if (backup.selectedWordbook && !wx.getStorageSync('selectedWordbook')) {
                wx.setStorageSync('selectedWordbook', backup.selectedWordbook);
              }
              if (backup.currentStudent && !wx.getStorageSync('currentStudent')) {
                wx.setStorageSync('currentStudent', backup.currentStudent);
              }
              if (backup.currentWordbook && !wx.getStorageSync('currentWordbook')) {
                wx.setStorageSync('currentWordbook', backup.currentWordbook);
              }

              wx.showToast({ title: '导入成功', icon: 'success' });
              that.addLog('备份文件导入成功');
              that.loadDataStats();
            }
          });
        } catch (err) {
          console.error('读取备份文件失败:', err);
          wx.showToast({ title: '文件读取失败', icon: 'error' });
          that.addLog('导入失败: ' + (err.message || '未知错误'));
        }
      },
      fail: function(err) {
        if (err.errMsg && err.errMsg.indexOf('cancel') === -1) {
          wx.showToast({ title: '选择文件失败', icon: 'error' });
        }
      }
    });
  },});
