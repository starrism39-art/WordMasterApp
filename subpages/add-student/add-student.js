// pages/add-student/add-student.js
const MAX_STUDENT_LIMIT = 30;

Page({

  /**
   * 页面的初始数据
   */
  data: {
    name: '',
    grade: '',
    joinDate: '',
    gradeOptions: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '初一', '初二', '初三', '高一', '高二', '高三'],
    showDatePicker: false
  },

  // 权限热刷新 Promise，供 addStudent 等待
  _permissionRefreshPromise: null,

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 初始化加入日期为当前日期
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const currentDate = `${year}-${month}-${day}`;
    
    this.setData({
      joinDate: currentDate
    });

    // 【权限热刷新】每次进入页面时从云端拉取最新权限，无需重新登录
    this._permissionRefreshPromise = this.refreshPermissionFromCloud();
  },

  /**
   * 从云端实时刷新用户权限字段（userRole / memberLevel）
   * 让管理员在云数据库的改动即时生效，不需要用户重新登录
   */
  refreshPermissionFromCloud: async function() {
    const openid = wx.getStorageSync('openid');
    if (!openid || !wx.cloud) {
      console.log('[Permission] refreshPermissionFromCloud: 跳过（无openid或云不可用）');
      return;
    }

    try {
      const db = wx.cloud.database({ env: 'cloudbase-4gafzdch60ad597b' });
      const res = await db.collection('teachers')
        .where({ teacher_id: openid })
        .limit(1)
        .get();

      if (res && Array.isArray(res.data) && res.data.length > 0) {
        const cloudTeacher = res.data[0];
        const app = getApp();
        const normalizedUser = app.ensureUserPermissions
          ? app.ensureUserPermissions({
              id: openid,
              username: openid,
              name: cloudTeacher.name || '教师',
              userRole: cloudTeacher.userRole || 'external',
              memberLevel: cloudTeacher.memberLevel || 'free'
            })
          : {
              id: openid,
              userRole: cloudTeacher.userRole || 'external',
              memberLevel: cloudTeacher.memberLevel || 'free'
            };

        wx.setStorageSync('currentUser', normalizedUser);
        if (app.globalData) {
          app.globalData.currentUser = normalizedUser;
        }
        console.log('[Permission] 权限热刷新完成, userRole:', normalizedUser.userRole, 'memberLevel:', normalizedUser.memberLevel);
      } else {
        console.log('[Permission] refreshPermissionFromCloud: 云端未找到教师记录，使用本地缓存');
      }
    } catch (error) {
      console.warn('[Permission] 权限热刷新失败（使用本地缓存）:', error);
    }
  },

  /**
   * 输入学生姓名
   */
  inputName(e) {
    this.setData({
      name: e.detail.value
    });
  },

  /**
   * 改变年级选择
   */
  changeGrade(e) {
    const index = e.detail.value;
    this.setData({
      grade: this.data.gradeOptions[index]
    });
  },

  /**
   * 打开日期选择器
   */
  openDatePicker() {
    this.setData({
      showDatePicker: true
    });
  },

  /**
   * 关闭日期选择器
   */
  closeDatePicker() {
    this.setData({
      showDatePicker: false
    });
  },

  /**
   * 绑定日期变化
   */
  bindDateChange(e) {
    this.setData({
      joinDate: e.detail.value,
      showDatePicker: false
    });
  },

  /**
   * 重置表单
   */
  resetForm() {
    // 重置为初始状态
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const currentDate = `${year}-${month}-${day}`;
    
    this.setData({
      name: '',
      grade: '',
      joinDate: currentDate
    });
  },

  /**
   * 添加学生
   */
  addStudent: async function() {
    // 验证表单
    if (!this.data.name) {
      wx.showToast({
        title: '请输入学生姓名',
        icon: 'none',
        duration: 1500
      });
      return;
    }

    if (!this.data.grade) {
      wx.showToast({
        title: '请选择年级',
        icon: 'none',
        duration: 1500
      });
      return;
    }

    try {
      // 获取现有学生列表
      const students = wx.getStorageSync('students') || [];
      const app = getApp();
      const openid = wx.getStorageSync('openid');

      if (!openid) {
        wx.showToast({
          title: '请先登录',
          icon: 'none',
          duration: 1500
        });
        return;
      }

      // 【权限基座】等待热刷新完成（若仍在进行中），确保拿到最新云端权限
      if (this._permissionRefreshPromise) {
        try {
          await this._permissionRefreshPromise;
        } catch (e) {
          // 刷新失败不阻塞，继续用本地缓存
        }
      }

      // 【权限基座】读取当前用户权限，决定是否执行学生上限检查
      const currentUser = app.getCurrentUserWithPermissions
        ? app.getCurrentUserWithPermissions()
        : (wx.getStorageSync('currentUser') || app.globalData.currentUser || {});
      const userRole = currentUser.userRole || 'external';

      if (userRole === 'internal') {
        console.log('[Permission] 内部人员，跳过学生上限检查');
      } else {
        // external / 默认：执行 30 人上限拦截
        const ownedStudents = students.filter(s => s && (s.ownerId || s.teacher_id) === openid);
        if (ownedStudents.length >= MAX_STUDENT_LIMIT) {
          console.warn('[Permission] 外部用户已达学生上限, current:', ownedStudents.length, 'limit:', MAX_STUDENT_LIMIT);
          wx.showToast({
            title: '学生数量已达上限(' + MAX_STUDENT_LIMIT + '人)',
            icon: 'none',
            duration: 2000
          });
          return;
        }
        console.log('[Permission] 外部用户，学生数量检查通过, current:', ownedStudents.length, 'limit:', MAX_STUDENT_LIMIT);
      }

      // 创建新学生对象
      const newStudent = {
        id: 'student_' + Date.now(),
        name: this.data.name,
        grade: this.data.grade,
        joinDate: this.data.joinDate,
        teacher_id: openid,
        createdAt: new Date().toISOString()
      };

      // 添加到学生列表
      students.push(newStudent);

      // 保存到本地存储
      wx.setStorageSync('students', students);

      const syncStudentToCloud = (teacherOpenId) => {
        const db = wx.cloud.database({ env: 'cloudbase-4gafzdch60ad597b' });
        return db.collection('students')
          .doc(newStudent.id)
          .set({
            data: {
              teacher_id: teacherOpenId,
              student_id: newStudent.id,
              ...newStudent
            }
          });
      };
      if (wx.cloud) {
        if (openid) {
          syncStudentToCloud(openid)
            .then(() => {
              console.log('学生已写入云端:', newStudent.id);
            })
            .catch((cloudError) => {
              console.error('写入云端学生失败:', cloudError);
            });
        } else {
          wx.cloud.callFunction({
            name: 'login',
            data: {},
            config: {
              env: 'cloudbase-4gafzdch60ad597b'
            }
          }).then((res) => {
            const freshOpenId =
              (res && res.result && (res.result.openid || res.result.OPENID || res.result.openId)) || null;
            if (!freshOpenId) {
              console.warn('login 云函数未返回 openid，跳过云端写入:', res);
              return null;
            }
            wx.setStorageSync('openid', freshOpenId);
            // ★ openid 就绪，重试积压的同步任务
            try {
              const { retryPendingSyncs } = require('../../utils/cloud-sync.js');
              retryPendingSyncs();
            } catch (e) { /* 非阻塞 */ }
            return syncStudentToCloud(freshOpenId);
          }).then((result) => {
            if (result) {
              console.log('学生已写入云端:', newStudent.id);
            }
          }).catch((cloudError) => {
            console.error('写入云端学生失败:', cloudError);
          });
        }
      } else {
        console.warn('当前基础库不支持 wx.cloud，跳过云端写入');
      }

      // 显示成功提示
      wx.showToast({
        title: '添加成功',
        icon: 'success',
        duration: 1500
      });

      // 延迟返回上一页
      setTimeout(() => {
        wx.navigateBack({
          delta: 1
        });
      }, 1500);
    } catch (error) {
      console.error('添加学生失败:', error);
      wx.showToast({
        title: '添加失败，请重试',
        icon: 'none',
        duration: 1500
      });
    }
  },



  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})