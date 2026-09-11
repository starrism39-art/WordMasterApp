// pages/add-student/add-student.js
const membershipBusiness = require('../../utils/membership-business-client');
const { captureAccountSession, isAccountSessionCurrent } = require('../../utils/account-session');
const CLOUD_ENV_ID = 'cloudbase-4gafzdch60ad597b';
const STUDENT_NAME_CASCADE_COLLECTIONS = [
  'word_mastery',
  'learning_records',
  'learning_progress',
  'student_statistics'
];
const { isCloudReadOnlyMode } = require('../../utils/cloud-mode.js');
const {
  ENTITY_TYPES,
  isEntityTombstoned
} = require('../../utils/sync-tombstones.js');

Page({

  /**
   * 页面的初始数据
   */
  data: {
    name: '',
    grade: '',
    gradeIndex: 0,
    joinDate: '',
    gradeOptions: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '初一', '初二', '初三', '高一', '高二', '高三'],
    showDatePicker: false,
    editMode: false,
    editingStudentId: '',
    originalStudent: null,
    isSubmitting: false
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
    
    const nextData = {
      joinDate: currentDate
    };

    const editingStudentId = options && options.id
      ? decodeURIComponent(options.id)
      : '';
    if (editingStudentId) {
      const editingStudent = this.findLocalStudentById(editingStudentId);
      if (editingStudent) {
        const editingGrade = editingStudent.grade || '';
        Object.assign(nextData, {
          editMode: true,
          editingStudentId: String(editingStudentId),
          originalStudent: editingStudent,
          name: editingStudent.name || '',
          grade: editingGrade,
          gradeIndex: this.findGradeIndex(editingGrade),
          joinDate: editingStudent.joinDate || currentDate
        });
      } else {
        wx.showToast({
          title: '未找到学生信息',
          icon: 'none',
          duration: 1500
        });
      }
    }

    this.setData(nextData);

    // 【权限热刷新】每次进入页面时从云端拉取最新权限，无需重新登录
    this._permissionRefreshPromise = this.refreshPermissionFromCloud();
  },

  getStudentId(student) {
    return String(student && (student.id || student.student_id || student._id || '') || '').trim();
  },

  findLocalStudentById(studentId) {
    const targetId = String(studentId || '').trim();
    if (!targetId) return null;
    const students = wx.getStorageSync('students') || [];
    return (Array.isArray(students) ? students : []).find((student) =>
      this.getStudentId(student) === targetId
    ) || null;
  },

  findGradeIndex(grade) {
    const index = this.data.gradeOptions.indexOf(grade);
    return index >= 0 ? index : 0;
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
    const index = Number(e.detail.value) || 0;
    this.setData({
      grade: this.data.gradeOptions[index],
      gradeIndex: index
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
    if (this.data.editMode && this.data.originalStudent) {
      const original = this.data.originalStudent;
      const originalGrade = original.grade || '';
      this.setData({
        name: original.name || '',
        grade: originalGrade,
        gradeIndex: this.findGradeIndex(originalGrade),
        joinDate: original.joinDate || this.data.joinDate
      });
      return;
    }

    // 重置为初始状态
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const currentDate = `${year}-${month}-${day}`;
    
    this.setData({
      name: '',
      grade: '',
      gradeIndex: 0,
      joinDate: currentDate
    });
  },

  buildUpdatedStudent(originalStudent) {
    const studentId = this.getStudentId(originalStudent) || this.data.editingStudentId;
    const nowTs = Date.now();
    return {
      ...(originalStudent || {}),
      id: String(studentId),
      student_id: String(studentId),
      name: (this.data.name || '').trim(),
      grade: this.data.grade,
      joinDate: this.data.joinDate,
      updatedAt: nowTs
    };
  },

  updateLocalStudentCaches(updatedStudent) {
    const studentId = this.getStudentId(updatedStudent);
    const students = wx.getStorageSync('students') || [];
    const updatedStudents = (Array.isArray(students) ? students : []).map((student) => {
      if (this.getStudentId(student) !== studentId) return student;
      return {
        ...student,
        ...updatedStudent
      };
    });
    wx.setStorageSync('students', updatedStudents);

    const app = getApp();
    const updateStoredStudent = (key) => {
      const storedStudent = wx.getStorageSync(key);
      if (this.getStudentId(storedStudent) !== studentId) return;
      const nextStudent = {
        ...storedStudent,
        ...updatedStudent
      };
      wx.setStorageSync(key, nextStudent);
      if (key === 'currentStudent' && app.globalData) {
        app.globalData.currentStudent = nextStudent;
      }
    };

    updateStoredStudent('currentStudent');
    updateStoredStudent('selectedStudent');

    if (app.globalData && this.getStudentId(app.globalData.currentStudent) === studentId) {
      app.globalData.currentStudent = {
        ...app.globalData.currentStudent,
        ...updatedStudent
      };
    }
  },

  cascadeStudentNameToCloud: async function(db, openid, studentId, studentName, updatedAt) {
    if (!studentId || !studentName) return;
    for (const collectionName of STUDENT_NAME_CASCADE_COLLECTIONS) {
      try {
        const collection = db.collection(collectionName);
        let processed = 0;
        let offset = 0;
        const limit = 100;
        while (true) {
          const res = await collection
            .where({ teacher_id: openid, student_id: String(studentId) })
            .limit(limit)
            .skip(offset)
            .get();
          const docs = res && Array.isArray(res.data) ? res.data : [];
          if (docs.length === 0) break;

          await Promise.all(docs.map((doc) =>
            collection.doc(doc._id).update({
              data: {
                student_name: studentName,
                updatedAt
              }
            })
          ));

          processed += docs.length;
          offset += limit;
          if (docs.length < limit) break;
        }
        console.log('[StudentEdit] 级联更新完成:', collectionName, processed);
      } catch (cascadeError) {
        console.error('[StudentEdit] 级联更新失败（非阻塞）:', collectionName, cascadeError);
      }
    }
  },

  updateStudent: async function() {
    if (this.data.isSubmitting) return;
    const accountSession = captureAccountSession();

    const studentId = this.data.editingStudentId;
    const originalStudent = this.data.originalStudent || this.findLocalStudentById(studentId);
    if (!studentId || !originalStudent) {
      wx.showToast({
        title: '未找到学生信息',
        icon: 'none',
        duration: 1500
      });
      return;
    }

    const openid = wx.getStorageSync('openid');
    if (!openid) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 1500
      });
      return;
    }

    const updatedStudent = this.buildUpdatedStudent(originalStudent);

    wx.showLoading({ title: '保存中...', mask: true });
    this.setData({ isSubmitting: true });

    try {
      const profile = { studentId: String(studentId), name: this.data.name, grade: this.data.grade, joinDate: this.data.joinDate,
        reason: 'Teacher submitted profile correction', intent: 'correction' };
      const fingerprint = JSON.stringify(profile);
      if (!this._profileRequest || this._profileRequest.fingerprint !== fingerprint) {
        this._profileRequest = { fingerprint, requestId: membershipBusiness.requestId() };
      }
      const result = await membershipBusiness.call('correctProfile', { ...profile, requestId: this._profileRequest.requestId });
      if (result.reviewRequired || !result.studentId) {
        throw new Error(result.reasonCode || 'PROFILE_REVIEW_REQUIRED');
      }
      updatedStudent.name = result.name;
      updatedStudent.grade = result.grade;
      updatedStudent.joinDate = result.joinDate || originalStudent.joinDate;
      if (String(originalStudent.name || '') !== String(updatedStudent.name || '')) {
        const db = wx.cloud.database({ env: CLOUD_ENV_ID });
        await this.cascadeStudentNameToCloud(db, openid, this.getStudentId(updatedStudent), updatedStudent.name, updatedStudent.updatedAt);
      }

      if (!isAccountSessionCurrent(accountSession)) throw new Error('ACCOUNT_SESSION_CHANGED');
      this.updateLocalStudentCaches(updatedStudent);
      this.setData({
        originalStudent: updatedStudent,
        isSubmitting: false
      });

      wx.hideLoading();
      wx.showToast({
        title: '保存成功',
        icon: 'success',
        duration: 1200
      });

      setTimeout(() => {
        if (isAccountSessionCurrent(accountSession)) wx.navigateBack({ delta: 1 });
      }, 1200);
    } catch (error) {
      console.error('[StudentEdit] 保存学生信息失败:', error);
      wx.hideLoading();
      this.setData({ isSubmitting: false });
      wx.showToast({
        title: membershipBusiness.message(error),
        icon: 'none',
        duration: 1800
      });
    }
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

    if (this.data.editMode) {
      await this.updateStudent();
      return;
    }

    if (this.data.isSubmitting) return;
    const accountSession = captureAccountSession();
    this.setData({ isSubmitting: true });
    try {
      const profile = { name: this.data.name, grade: this.data.grade, joinDate: this.data.joinDate };
      const fingerprint = JSON.stringify(profile);
      // Retain the request after transport failure: a committed creation must
      // never consume a second slot when the user retries.
      if (!this._addRequest || this._addRequest.fingerprint !== fingerprint) {
        this._addRequest = { fingerprint, requestId: membershipBusiness.requestId() };
      }
      const result = await membershipBusiness.call('addStudent', { ...profile, requestId: this._addRequest.requestId });
      const students = wx.getStorageSync('students') || [];
      const newStudent = { id: result.studentId, student_id: result.studentId, teacher_id: result.teacherId,
        name: result.name, grade: result.grade, joinDate: result.joinDate };
      if (!students.some(s => String(s.id || s.student_id) === result.studentId)) students.push(newStudent);
      wx.setStorageSync('students', students);
      wx.showToast({ title: '添加成功', icon: 'success', duration: 1200 });
      setTimeout(() => { if (isAccountSessionCurrent(accountSession)) wx.navigateBack({ delta: 1 }); }, 1200);
    } catch (error) {
      wx.showToast({ title: membershipBusiness.message(error), icon: 'none', duration: 2500 });
    } finally {
      this.setData({ isSubmitting: false });
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
