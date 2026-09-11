const membershipBusiness = require('../../utils/membership-business-client');
﻿﻿// pages/students/students.js
const app = getApp();
const loginService = require('../../utils/login-service.js');
const { isCloudReadOnlyMode } = require('../../utils/cloud-mode.js');

Page({
  data: {
    currentUser: null,
    isLoggedIn: false,
    isLoggingOut: false,
    storageUsage: '未知',
    isEditingNickname: false,
    nicknameEditValue: ''
  },

  loadTeacherProfile: async function() {
    try {
      const openid = wx.getStorageSync('openid');
      if (!openid || !wx.cloud) {
        // 云不可用时保留本地缓存的名字，不做覆盖
        return;
      }

      const db = wx.cloud.database({ env: 'cloudbase-4gafzdch60ad597b' });
      // 用 teacher_id 查询，与 saveNickname / createTeacherRecord 一致
      const res = await db.collection('teachers').where({ teacher_id: openid }).limit(1).get();
      const teacher = (res && Array.isArray(res.data) && res.data[0]) || null;

      if (teacher) {
        // 云端有记录：优先用云端 name，否则保留本地已编辑的名字
        const localName = (this.data.currentUser && this.data.currentUser.name) || '';
        const cloudName = teacher.name || '';
        const finalName = cloudName || localName || '';

        this.setData({
          currentUser: {
            ...(this.data.currentUser || {}),
            ...(teacher || {}),
            name: finalName
          }
        });
      }
      // 云端无记录时不做任何覆盖，保留本地 currentUser
    } catch (error) {
      console.error('拉取教师档案失败:', error);
      // 失败也不覆盖本地名字
    }
  },

  // 开始编辑昵称
  startEditNickname: function() {
    const currentName = this.data.currentUser?.name || '';
    this.setData({
      isEditingNickname: true,
      nicknameEditValue: currentName
    });
  },

  // 取消编辑昵称
  cancelEditNickname: function() {
    this.setData({
      isEditingNickname: false,
      nicknameEditValue: ''
    });
  },

  // 输入昵称
  onNicknameInput: function(e) {
    this.setData({
      nicknameEditValue: e.detail.value
    });
  },

  // 保存昵称到云端 + 本地
  saveNickname: async function() {
    const newName = (this.data.nicknameEditValue || '').trim();
    if (!newName) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });

    try {
      // 1. 更新本地 currentUser
      const updatedUser = {
        ...(this.data.currentUser || {}),
        name: newName
      };
      this.setData({
        currentUser: updatedUser,
        isEditingNickname: false,
        nicknameEditValue: ''
      });

      // 2. 更新 globalData 和 Storage
      const app = getApp();
      if (app.globalData.currentUser) {
        app.globalData.currentUser.name = newName;
      }
      wx.setStorageSync('currentUser', updatedUser);

      // 3. 更新云端 teachers 集合
      const openid = wx.getStorageSync('openid');
      if (openid && wx.cloud && !isCloudReadOnlyMode()) {
        const db = wx.cloud.database({ env: 'cloudbase-4gafzdch60ad597b' });
        const teachersRef = db.collection('teachers');
        const existing = await teachersRef.where({ teacher_id: openid }).limit(1).get();
        if (existing && Array.isArray(existing.data) && existing.data.length > 0) {
          await teachersRef.doc(existing.data[0]._id).update({
            data: { name: newName }
          });
          console.log('[Nickname] 云端教师昵称已更新:', newName);
        }

        // ★ 4. 级联更新：批量更新该老师名下所有学生的 teacher_name
        try {
          const studentsRef = db.collection('students');
          const studentsRes = await studentsRef
            .where({ teacher_id: openid })
            .get();

          if (studentsRes && Array.isArray(studentsRes.data) && studentsRes.data.length > 0) {
            const BATCH_SIZE = 50;
            const batches = [];
            for (let i = 0; i < studentsRes.data.length; i += BATCH_SIZE) {
              batches.push(studentsRes.data.slice(i, i + BATCH_SIZE));
            }

            for (const batch of batches) {
              const nowTs = Date.now();
              await Promise.all(batch.map((studentDoc) =>
                membershipBusiness.call('updateStudentDisplay', { studentId: String(studentDoc.student_id || studentDoc.id), documentId: studentDoc._id, teacherName: newName })
              ));
            }

            console.log('[Nickname] 级联更新完成, 受影响学生数:', studentsRes.data.length);

            // ★ 同步更新本地 students 缓存
            const localStudents = wx.getStorageSync('students') || [];
            const nowTs = Date.now();
            const updatedLocalStudents = localStudents.map(s => {
              if (s && s.teacher_id === openid) {
                return { ...s, teacher_name: newName, updatedAt: nowTs };
              }
              return s;
            });
            wx.setStorageSync('students', updatedLocalStudents);
          }
        } catch (cascadeError) {
          console.error('[Nickname] 级联更新学生失败（非阻塞）:', cascadeError);
        }

        // ★ 5. 级联更新 word_mastery（分批查+批量写，防超限）
        try {
          const masteryRef = db.collection('word_mastery');
          let masteryProcessed = 0;
          let masteryOffset = 0;
          const BATCH = 100;
          while (true) {
            const res = await masteryRef
              .where({ teacher_id: openid })
              .limit(BATCH)
              .skip(masteryOffset)
              .get();
            if (!res || !Array.isArray(res.data) || res.data.length === 0) break;
            const nowTs = Date.now();
            await Promise.all(res.data.map(doc =>
              masteryRef.doc(doc._id).update({
                data: { teacher_name: newName, updatedAt: nowTs }
              })
            ));
            masteryProcessed += res.data.length;
            masteryOffset += BATCH;
            if (res.data.length < BATCH) break;
          }
          console.log('[Nickname] word_mastery 级联更新完成, 受影响数:', masteryProcessed);
        } catch (cascadeError) {
          console.error('[Nickname] 级联更新 word_mastery 失败（非阻塞）:', cascadeError);
        }

        // ★ 6. 级联更新 learning_records
        try {
          const recordsRef = db.collection('learning_records');
          let recordsProcessed = 0;
          let recordsOffset = 0;
          const BATCH = 100;
          while (true) {
            const res = await recordsRef
              .where({ teacher_id: openid })
              .limit(BATCH)
              .skip(recordsOffset)
              .get();
            if (!res || !Array.isArray(res.data) || res.data.length === 0) break;
            const nowTs = Date.now();
            await Promise.all(res.data.map(doc =>
              recordsRef.doc(doc._id).update({
                data: { teacher_name: newName, updatedAt: nowTs }
              })
            ));
            recordsProcessed += res.data.length;
            recordsOffset += BATCH;
            if (res.data.length < BATCH) break;
          }
          console.log('[Nickname] learning_records 级联更新完成, 受影响数:', recordsProcessed);
        } catch (cascadeError) {
          console.error('[Nickname] 级联更新 learning_records 失败（非阻塞）:', cascadeError);
        }

        // ★ 7. 级联更新 learning_progress
        try {
          const progressRef = db.collection('learning_progress');
          let progressProcessed = 0;
          let progressOffset = 0;
          while (true) {
            const res = await progressRef
              .where({ teacher_id: openid })
              .limit(100)
              .skip(progressOffset)
              .get();
            if (!res || !Array.isArray(res.data) || res.data.length === 0) break;
            const nowTs = Date.now();
            await Promise.all(res.data.map(doc =>
              progressRef.doc(doc._id).update({
                data: { teacher_name: newName, updatedAt: nowTs }
              })
            ));
            progressProcessed += res.data.length;
            progressOffset += 100;
            if (res.data.length < 100) break;
          }
          console.log('[Nickname] learning_progress 级联更新完成, 受影响数:', progressProcessed);
        } catch (cascadeError) {
          console.error('[Nickname] 级联更新 learning_progress 失败（非阻塞）:', cascadeError);
        }

        // ★ 8. 级联更新 student_statistics
        try {
          const statsRef = db.collection('student_statistics');
          let statsProcessed = 0;
          let statsOffset = 0;
          while (true) {
            const res = await statsRef
              .where({ teacher_id: openid })
              .limit(100)
              .skip(statsOffset)
              .get();
            if (!res || !Array.isArray(res.data) || res.data.length === 0) break;
            const nowTs = Date.now();
            await Promise.all(res.data.map(doc =>
              statsRef.doc(doc._id).update({
                data: { teacher_name: newName, updatedAt: nowTs }
              })
            ));
            statsProcessed += res.data.length;
            statsOffset += 100;
            if (res.data.length < 100) break;
          }
          console.log('[Nickname] student_statistics 级联更新完成, 受影响数:', statsProcessed);
        } catch (cascadeError) {
          console.error('[Nickname] 级联更新 student_statistics 失败（非阻塞）:', cascadeError);
        }
      } else if (openid && wx.cloud) {
        console.warn('[cloud-read-only] skip saveNickname cloud cascade');
      }

      wx.hideLoading();
      wx.showToast({ title: '昵称已保存', icon: 'success' });
    } catch (error) {
      console.error('[Nickname] 保存昵称失败:', error);
      wx.hideLoading();
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },

  // 跳转到添加学生信息页面
  navigateToAddStudent() {
    wx.navigateTo({
      url: '/subpages/add-student/add-student',
      success: () => {
        console.log('成功跳转到添加学生信息页面');
      },
      fail: (err) => {
        console.error('跳转到添加学生信息页面失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },
  
  // 跳转到学生列表页面
  navigateToStudentList() {
    wx.navigateTo({
      url: '/subpages/student-list/student-list',
      success: () => {
        console.log('成功跳转到学生列表页面');
      },
      fail: (err) => {
        console.error('跳转到学生列表页面失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },
  
  // 检查存储使用情况
  checkStorageUsage() {
    wx.getStorageInfo({
      success: (res) => {
        const used = res.currentSize;
        const total = res.limitSize;
        const percent = ((used / total) * 100).toFixed(1);
        
        this.setData({
          storageUsage: `${used}KB / ${total}KB (${percent}%)`
        });
        
        wx.showModal({
          title: '存储使用情况',
          content: `当前使用: ${used}KB\n总容量: ${total}KB\n使用率: ${percent}%`,
          showCancel: false,
          confirmText: '知道了'
        });
      },
      fail: (error) => {
        console.error('获取存储信息失败:', error);
        wx.showToast({
          title: '获取存储信息失败',
          icon: 'none'
        });
      }
    });
  },

  // 显示数据管理菜单
  showDataManagement() {
    wx.showActionSheet({
      itemList: ['数据修复中心', '备份与恢复', '清理30天前数据', '清理60天前数据', '清理90天前数据', '查看存储使用情况'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0:
            this.navigateToDataRepair();
            break;
          case 1:
            // 导航到备份与恢复页面
            this.navigateToDataBackup();
            break;
          case 2:
            this.cleanupOldRecords(30);
            break;
          case 3:
            this.cleanupOldRecords(60);
            break;
          case 4:
            this.cleanupOldRecords(90);
            break;
          case 5:
            this.checkStorageUsage();
            break;
        }
      }
    });
  },

  goToManualStats() {
    const currentStudent = app.globalData.currentStudent || wx.getStorageSync('currentStudent');
    const currentWordbook = app.globalData.currentWordbook || app.globalData.selectedWordbook || wx.getStorageSync('selectedWordbook');

    if (!currentStudent || !currentStudent.id) {
      wx.showModal({
        title: '需要选择学生',
        content: '先选择学生后再手动修正统计。是否前往学生列表？',
        success: (res) => {
          if (res.confirm) {
            this.navigateToStudentList();
          }
        }
      });
      return;
    }

    wx.showActionSheet({
      itemList: ['核心统计', '词书详细统计'],
      success: (res) => {
        // 两个模式都需要词书上下文
        if (!currentWordbook || !currentWordbook.id) {
          wx.showToast({ title: '请先选择词书', icon: 'none' });
          return;
        }

        const studentId = encodeURIComponent(currentStudent.id);
        const wordbookId = encodeURIComponent(currentWordbook.id);
        const mode = res.tapIndex === 0 ? 'core' : 'wordbook';
        wx.navigateTo({
          url: `/pages/debug-update-stats/index?mode=${mode}&studentId=${studentId}&wordbookId=${wordbookId}`,
          fail: (error) => {
            console.error('导航到手动修正统计页面失败:', error);
            wx.showToast({ title: '页面导航失败', icon: 'error' });
          }
        });
      }
    });
  },

  // 导航到备份与恢复页面
  navigateToDataBackup() {
    wx.navigateTo({
      url: '/subpages/data-backup/data-backup',
      fail: (error) => {
        console.error('导航到数据备份页面失败:', error);
        wx.showToast({
          title: '页面导航失败',
          icon: 'error'
        });
      }
    });
  },

  // 导航到数据修复页面
  navigateToDataRepair() {
    wx.navigateTo({
      url: '/subpages/data-repair/data-repair',
      fail: (error) => {
        console.error('导航到数据修复页面失败:', error);
        wx.showToast({
          title: '页面导航失败',
          icon: 'error'
        });
      }
    });
  },

  // 清理旧记录
  cleanupOldRecords(days) {
    wx.showModal({
      title: '确认清理',
      content: `确定要清理${days}天前的学习记录吗？`,
      showCancel: true,
      cancelText: '取消',
      confirmText: '确定',
      success: (res) => {
        if (res.confirm) {
          const app = getApp();
          const result = app.cleanupOldData({
            days: days,
            types: ['learningRecords']
          });

          if (result.success) {
            wx.showToast({
              title: `成功清理${result.deletedCount}条记录`,
              icon: 'success',
              duration: 1500
            });
            // 重新加载数据
            this.getRecordCount();
          } else {
            wx.showToast({
              title: '清理失败',
              icon: 'none',
              duration: 1500
            });
          }
        }
      }
    });
  },

  onLoad: function() {
    this.checkLoginStatus();
    this.loadTeacherProfile();
    this.loadData();
  },
  
  onShow: function() {
    if (typeof this.getTabBar === 'function') {
      const tabBar = this.getTabBar();
      if (tabBar && typeof tabBar.setSelected === 'function') {
        tabBar.setSelected(1);
      } else if (tabBar && typeof tabBar.setData === 'function') {
        tabBar.setData({ selected: 1 });
      }
    }

    // 每次页面显示时检查登录状态和刷新教师名称
    this.checkLoginStatus();
    this.loadTeacherProfile();
    this.loadData();
    
    // 检查是否为学生选择模式
    if (app.globalData.studentSelectMode) {
      console.log('检测到学生选择模式，自动跳转到学生列表');
      // 清除选择模式标记，避免重复跳转
      app.globalData.studentSelectMode = false;
      // 立即跳转到学生列表页面
      this.navigateToStudentList();
    }
  },

  // 检查登录状态
  checkLoginStatus: function() {
    const openid = wx.getStorageSync('openid');
    const currentUser = wx.getStorageSync('currentUser');
    const isLoggedIn = !!(openid && currentUser);
    this.setData({
      isLoggedIn: isLoggedIn,
      currentUser: currentUser || null
    });
  },

  // 静默登录（游客一键开启云端同步）
  goToLogin: function() {
    wx.showLoading({ title: '登录中...' });
    loginService.doSilentLogin().then((result) => {
      wx.hideLoading();
      if (result && result.ok) {
        wx.showToast({ title: '登录成功', icon: 'success' });
        this.checkLoginStatus();
      } else {
        wx.showToast({ title: '登录失败，请检查网络', icon: 'none' });
      }
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '登录失败，请检查网络', icon: 'none' });
    });
  },
  
  // 加载所有数据
  loadData() {
    this.updateStorageUsage();
  },
  // 更新存储使用情况
  updateStorageUsage() {
    wx.getStorageInfo({
      success: (res) => {
        const used = res.currentSize;
        const total = res.limitSize;
        const percent = ((used / total) * 100).toFixed(1);
        
        this.setData({
          storageUsage: `${percent}%`
        });
      },
      fail: (error) => {
        console.error('获取存储信息失败:', error);
      }
    });
  },
  
  // 退出登录功能
  logout: function() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？退出后仍可使用本地功能。',
      success: (res) => {
        if (res.confirm) {
          // 设置退出中状态
          this.setData({ isLoggingOut: true });
          loginService.invalidateLoginSession();
          
          // 清除全局用户信息
          if (app.globalData) {
            app.globalData.currentUser = null;
            app.globalData.currentStudent = null;
          }

          // ★ 清除登录凭证，防止自动静默登录（支持多账号切换）
          wx.removeStorageSync('openid');
          wx.removeStorageSync('currentUser');
          wx.removeStorageSync('currentStudent');
          
          // 更新页面状态为未登录
          this.setData({
            isLoggingOut: false,
            isLoggedIn: false,
            currentUser: null
          });

          // 退到首页（游客模式）
          wx.switchTab({
            url: '/pages/index/index'
          });
        }
      }
    });
  },

  // 备份数据
  backupData: function() {
    console.log('备份数据');
    try {
      const openid = wx.getStorageSync('openid') || '';
      // 收集所有需要备份的数据
      const backupData = {
        appId: 'wordMaster_backup',
        openid: openid,
        students: wx.getStorageSync('students') || [],
        wordbooks: wx.getStorageSync('wordbooks') || [],
        wordMastery: wx.getStorageSync('wordMastery') || {},
        learningProgress: wx.getStorageSync('learningProgress') || {},
        antiForgettingRecords: wx.getStorageSync('antiForgettingRecords') || [],
        selectedStudent: wx.getStorageSync('selectedStudent') || null,
        selectedWordbook: wx.getStorageSync('selectedWordbook') || null,
        currentStudent: wx.getStorageSync('currentStudent') || null,
        currentWordbook: wx.getStorageSync('currentWordbook') || null,
        learningRecords: wx.getStorageSync('learningRecords') || [],
        timestamp: Date.now(),
        version: '1.0'
      };

      // 将数据转换为JSON字符串
      const backupJson = JSON.stringify(backupData);
      console.log('备份数据大小:', backupJson.length, '字符');

      // 将数据复制到剪贴板
      wx.setClipboardData({
        data: backupJson,
        success: function(res) {
          // 剪贴板成功后，同时写一份到云端（兜底剪贴板容量限制）
          const openid = wx.getStorageSync('openid');
          if (openid && wx.cloud && backupJson.length < 800000 && !isCloudReadOnlyMode()) {
            const db = wx.cloud.database({ env: 'cloudbase-4gafzdch60ad597b' });
            const backupId = `backup_${openid}_${Date.now()}`;
            db.collection('backups').doc(backupId).set({
              data: {
                teacher_id: openid,
                backup_id: backupId,
                payload: backupData,
                size_bytes: backupJson.length,
                created_at: new Date().toISOString()
              }
            }).then(() => {
              console.log('云端备份已保存:', backupId);
            }).catch((cloudError) => {
              console.error('云端备份保存失败:', cloudError);
            });
          } else if (openid && wx.cloud && backupJson.length < 800000) {
            console.warn('[cloud-read-only] skip cloud backup');
          }
          wx.showToast({
            title: '数据备份成功，已复制到剪贴板',
            icon: 'success',
            duration: 2000
          });
        },
        fail: function(err) {
          console.error('复制到剪贴板失败:', err);
          wx.showToast({
            title: '备份失败，请重试',
            icon: 'none',
            duration: 2000
          });
        }
      });
    } catch (error) {
      console.error('备份数据失败:', error);
      wx.showToast({
        title: '备份失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 恢复数据
  restoreData: function() {
    console.log('恢复数据');
    wx.showModal({
      title: '恢复数据',
      content: '请确保已将备份数据复制到剪贴板，点击确定后将从剪贴板恢复数据。',
      success: function(res) {
        if (res.confirm) {
          // 从剪贴板获取数据
          wx.getClipboardData({
            success: function(res) {
              try {
                // 解析数据
                const backupData = JSON.parse(res.data);

                // 校验备份签名，防止误恢复或恶意覆盖
                if (backupData.appId !== 'wordMaster_backup') {
                  throw new Error('格式不匹配');
                }

                // openid 归属校验：跨账号恢复给出警示但允许继续
                const currentOpenid = wx.getStorageSync('openid') || '';
                const backupOpenid = backupData.openid || '';
                if (backupOpenid && currentOpenid && backupOpenid !== currentOpenid) {
                  console.warn('备份数据来自不同账号，当前 openid:', currentOpenid, '备份 openid:', backupOpenid);
                }

                console.log('恢复数据:', backupData);

                // 安全合并：只追加不覆盖，单项隔离，不丢已有数据
                var safeMergeModule = require('../../utils/safe-merge-restore.js');
                var mergeResult = safeMergeModule.safeMergeRestore(backupData);
                console.log('[restoreData] 合并结果:', JSON.stringify(mergeResult.summary));

                // 单值字段：仅本地为空时才恢复（不覆盖已有选择）
                if (!wx.getStorageSync('selectedStudent')) {
                  wx.setStorageSync('selectedStudent', backupData.selectedStudent || null);
                }
                if (!wx.getStorageSync('selectedWordbook')) {
                  wx.setStorageSync('selectedWordbook', backupData.selectedWordbook || null);
                }
                if (!wx.getStorageSync('currentStudent')) {
                  wx.setStorageSync('currentStudent', backupData.currentStudent || null);
                }
                if (!wx.getStorageSync('currentWordbook')) {
                  wx.setStorageSync('currentWordbook', backupData.currentWordbook || null);
                }

                // 显示恢复成功提示
                var addedTotal = mergeResult.summary && mergeResult.summary.totalAdded || 0;
                wx.showToast({
                  title: '数据恢复成功' + (addedTotal > 0 ? '，新增' + addedTotal + '项' : ''),
                  icon: 'success',
                  duration: 2000
                });

                // 刷新页面
                setTimeout(function() {
                  try {
                    wx.reLaunch({
                      url: '/pages/index/index',
                      fail: function(rlErr) {
                        console.error('reLaunch 失败，尝试 switchTab 兜底:', rlErr);
                        wx.switchTab({ url: '/pages/index/index' });
                      }
                    });
                  } catch (rlErr) {
                    console.error('reLaunch 异常，尝试 switchTab 兜底:', rlErr);
                    wx.switchTab({ url: '/pages/index/index' });
                  }
                }, 2000);
              } catch (error) {
                console.error('解析备份数据失败:', error);
                wx.showToast({
                  title: error && error.message === '格式不匹配'
                    ? '剪贴板内容不是有效的数据备份文件！'
                    : '恢复失败，数据格式错误',
                  icon: 'none',
                  duration: 2000
                });
              }
            },
            fail: function(err) {
              console.error('获取剪贴板数据失败:', err);
              wx.showToast({
                title: '恢复失败，请重试',
                icon: 'none',
                duration: 2000
              });
            }
          });
        }
      }
    });
  }
});
