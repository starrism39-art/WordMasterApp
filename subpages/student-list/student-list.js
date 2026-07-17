// pages/student-list/student-list.js
const { syncDataFromCloud } = require('../../utils/cloud-migration.js');

const ACTION_BUTTON_WIDTH_RPX = 140;
const ACTION_TOTAL_RPX = ACTION_BUTTON_WIDTH_RPX * 2;

const normalizeStudent = (student) => {
  if (!student) return null;
  const id = student.id || student.student_id;
  if (!id) return null;
  const name = String(student.name || '').trim();
  if (!name) return null;
  return {
    ...student,
    id,
    name
  };
};

Page({
  data: {
    students: [],
    filteredStudents: [],
    searchKey: '',
    selectMode: false,
    currentStudentId: '',
    swipeXById: {},
    actionTotalPx: 0
  },

  _swipeRuntime: {},
  
  onLoad: function(options) {
    // 检查是否是选择模式
    this.setData({
      selectMode: options && options.selectMode === 'true'
    });
    
    // 检查全局选择模式标志
    const app = getApp();
    if (app.globalData.studentSelectMode) {
      this.setData({
        selectMode: true
      });
      // 清除选择模式标志，避免重复设置
      app.globalData.studentSelectMode = false;
    }
    
    // 初始化滑动按钮宽度（px）
    try {
      const systemInfo = wx.getSystemInfoSync();
      const actionTotalPx = Math.round((systemInfo.windowWidth || 375) * ACTION_TOTAL_RPX / 750);
      this.setData({ actionTotalPx });
    } catch (error) {
      this.setData({ actionTotalPx: 0 });
    }

    // 加载学生数据
    this.loadStudents();
  },
  
  onShow: function() {
    // 重新加载数据
    this.loadStudents();
  },

  sanitizeStudents: function(list) {
    const normalized = (Array.isArray(list) ? list : [])
      .map(normalizeStudent)
      .filter(Boolean);
    const deduped = [];
    const seen = new Set();
    normalized.forEach((student) => {
      const key = String(student.id);
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push(student);
    });
    return deduped;
  },

  buildSwipeState: function(students) {
    const swipeXById = {};
    (students || []).forEach((student) => {
      swipeXById[String(student.id)] = 0;
    });
    return swipeXById;
  },

  applySearch: function(list, searchKey) {
    const key = String(searchKey || '').trim().toLowerCase();
    if (!key) return list;
    return (list || []).filter(student =>
      (student.name && student.name.toLowerCase().includes(key)) ||
      (student.grade && student.grade.toLowerCase().includes(key)) ||
      (student.class && student.class.toLowerCase().includes(key))
    );
  },
  
  // 加载学生列表
  loadStudents: async function() {
    try {
      // ★ 第一步：从云端强制拉取最新学生数据（双向合并+增量补传）
      const openid = wx.getStorageSync('openid');
      if (openid && wx.cloud) {
        await syncDataFromCloud(openid);
      }

      // ★ 第二步：从本地存储读取（已被云端同步刷新）
      const allStudents = wx.getStorageSync('students') || [];
      const students = this.sanitizeStudents(allStudents);
      const currentStudent = wx.getStorageSync('currentStudent') || {};
      let currentStudentId = currentStudent.id || currentStudent.student_id || '';

      if (currentStudentId && !students.some(s => String(s.id) === String(currentStudentId))) {
        const app = getApp();
        if (app && app.globalData) {
          app.globalData.currentStudent = null;
        }
        wx.removeStorageSync('currentStudent');
        currentStudentId = '';
      }

      wx.setStorageSync('students', students);

      const filteredStudents = this.applySearch(students, this.data.searchKey);

      this.setData({
        students,
        filteredStudents,
        currentStudentId,
        swipeXById: this.buildSwipeState(students)
      });
    } catch (error) {
      console.error('加载学生数据失败:', error);
      // 降级：直接用本地缓存
      const allStudents = wx.getStorageSync('students') || [];
      const students = this.sanitizeStudents(allStudents);
      this.setData({
        students,
        filteredStudents: this.applySearch(students, this.data.searchKey),
        swipeXById: this.buildSwipeState(students)
      });
    }
  },
  
  // 搜索学生
  onSearch: function(e) {
    const searchKey = (e.detail.value || '').trim();
    this.setData({ searchKey });
    const filteredStudents = this.applySearch(this.data.students, searchKey);
    this.setData({
      filteredStudents,
      swipeXById: this.buildSwipeState(filteredStudents)
    });
  },

  // 清空搜索
  clearSearch: function() {
    this.setData({
      searchKey: '',
      filteredStudents: this.data.students,
      swipeXById: this.buildSwipeState(this.data.students)
    });
  },
  
  // 选择或查看学生
  selectStudent: function(e) {
    const studentId = e.currentTarget.dataset.id;
    const student = this.data.students.find(s => s.id === studentId);
    
    if (!student) {
      wx.showToast({
        title: '未找到学生信息',
        icon: 'none'
      });
      return;
    }
    
    this.closeAllSwipes();
    
    // 选择学生并保存到全局和本地存储
    const app = getApp();
    app.globalData.currentStudent = student;
    wx.setStorageSync('currentStudent', student);
    this.setData({ currentStudentId: student.id });
    
    // 显示成功提示
    wx.showToast({
      title: '已选择学生: ' + student.name,
      icon: 'success',
      duration: 1000
    });
    
    // 如果是选择模式，直接返回首页
    if (this.data.selectMode) {
      setTimeout(() => {
        console.log('切换学生后自动返回首页');
        // 清除来源页面标志
        if (app.globalData) {
          app.globalData.fromPage = '';
        }
        // 返回到首页
        wx.switchTab({
          url: '/pages/index/index',
          success: () => {
            console.log('成功返回到首页');
          },
          fail: (err) => {
            console.error('返回到首页失败:', err);
          }
        });
      }, 1000);
    }
  },
  
  // 添加新学生
  addStudent: function() {
    wx.navigateTo({
      url: '/subpages/add-student/add-student'
    });
  },

  // 编辑学生
  editStudent: function(e) {
    const studentId = e.currentTarget.dataset.id;
    if (!studentId) return;
    this.closeAllSwipes();
    wx.navigateTo({
      url: `/subpages/add-student/add-student?id=${encodeURIComponent(studentId)}`
    });
  },

  // 手势开始时关闭其他滑动项
  onSwipeStart: function(e) {
    const studentId = e.currentTarget.dataset.id;
    if (!studentId) return;
    this.closeOtherSwipes(studentId);
  },

  // 记录滑动过程中的 x
  onSwipeChange: function(e) {
    const studentId = e.currentTarget.dataset.id;
    if (!studentId) return;
    const rawX = Number(e.detail && e.detail.x) || 0;
    const minX = -Math.abs(this.data.actionTotalPx || 0);
    const clampedX = Math.max(minX, Math.min(0, rawX));
    this._swipeRuntime[String(studentId)] = clampedX;
  },

  // 滑动结束后归位或展开
  onSwipeEnd: function(e) {
    const studentId = e.currentTarget.dataset.id;
    if (!studentId) return;
    const currentX = this._swipeRuntime[String(studentId)] || 0;
    const threshold = -Math.abs(this.data.actionTotalPx || 0) / 2;
    const targetX = currentX < threshold ? -Math.abs(this.data.actionTotalPx || 0) : 0;
    const swipeXById = { ...this.data.swipeXById, [String(studentId)]: targetX };
    this.setData({ swipeXById });
    this._swipeRuntime[String(studentId)] = targetX;
  },

  closeOtherSwipes: function(activeId) {
    const swipeXById = { ...this.data.swipeXById };
    let changed = false;
    Object.keys(swipeXById).forEach((id) => {
      if (id !== String(activeId) && swipeXById[id] !== 0) {
        swipeXById[id] = 0;
        changed = true;
      }
    });
    if (changed) {
      this.setData({ swipeXById });
    }
  },

  closeAllSwipes: function() {
    const swipeXById = { ...this.data.swipeXById };
    let changed = false;
    Object.keys(swipeXById).forEach((id) => {
      if (swipeXById[id] !== 0) {
        swipeXById[id] = 0;
        changed = true;
      }
    });
    if (changed) {
      this.setData({ swipeXById });
    }
  },
  
  // 删除学生
  deleteStudent: function(e) {
    const studentId = e.currentTarget.dataset.id;
    const student = this.data.students.find(s => s.id === studentId);
    
    if (!student) {
      wx.showToast({
        title: '未找到学生信息',
        icon: 'none'
      });
      return;
    }
    
    // 弹出确认对话框
    wx.showModal({
      title: '确认删除',
      content: '确定要删除学生 "' + student.name + '" 吗？此操作不可恢复。',
      success: async (res) => {
        if (!res.confirm) return;

        wx.showLoading({ title: '删除中...', mask: true });
        this.closeAllSwipes();

        try {
          const openid = wx.getStorageSync('openid');

          // ★ 第一步：先删除云端（阻塞等待结果）
          if (openid && wx.cloud) {
            const db = wx.cloud.database({ env: 'cloudbase-4gafzdch60ad597b' });

            // 尝试按 _id（即 student.id）删除
            try {
              await db.collection('students').doc(studentId).remove();
              console.log('[Delete] 云端学生已删除 (by _id):', studentId);
            } catch (docRemoveError) {
              // 兜底：按 student_id 字段查询后删除
              console.warn('[Delete] 按 _id 删除失败，尝试按 student_id 字段删除:', docRemoveError);
              const queryRes = await db.collection('students')
                .where({ student_id: studentId, teacher_id: openid })
                .limit(1)
                .get();

              if (queryRes && Array.isArray(queryRes.data) && queryRes.data.length > 0) {
                await db.collection('students').doc(queryRes.data[0]._id).remove();
                console.log('[Delete] 云端学生已删除 (by student_id query):', studentId);
              } else {
                console.warn('[Delete] 云端未找到对应学生，可能已被删除:', studentId);
              }
            }
          } else if (!openid) {
            console.warn('[Delete] 缺少 openid，跳过云端删除');
          }

          // ★ 第二步：云端删除确认成功后，再更新本地存储
          const allStudents = wx.getStorageSync('students') || [];
          const updatedStudents = this.sanitizeStudents(allStudents)
            .filter(s => String(s.id) !== String(studentId));
          wx.setStorageSync('students', updatedStudents);

          // ★ 第三步：更新视图
          const visibleStudents = this.data.students.filter(s => String(s.id) !== String(studentId));
          this.setData({
            students: visibleStudents,
            filteredStudents: this.data.searchKey ? 
              this.applySearch(visibleStudents, this.data.searchKey) : visibleStudents,
            swipeXById: this.buildSwipeState(visibleStudents)
          });

          // ★ 第四步：清理关联的当前学生选择
          const app = getApp();
          if (app.globalData.currentStudent && app.globalData.currentStudent.id === studentId) {
            app.globalData.currentStudent = null;
            wx.removeStorageSync('currentStudent');
          }

          wx.hideLoading();
          wx.showToast({ title: '删除成功', icon: 'success' });

        } catch (error) {
          console.error('[Delete] 删除学生失败:', error);
          wx.hideLoading();
          wx.showToast({ title: '删除失败，请检查网络后重试', icon: 'none' });
          // 本地不做任何变更，保持与云端一致
        }
      }
    });
  }
});