// 云函数：updateStudentStats
// 功能：手动修正学生统计数据（已学/未掌握/打卡天数）
// 权限：所有已登录用户均可调用
// 存储：直接写入 student_statistics 集合，doc._id = studentId

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { action, studentId, stats } = event || {};

  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;

    if (!openid) {
      return { success: false, error: '未登录' };
    }

    if (!studentId) {
      return { success: false, error: '缺少 studentId' };
    }

    switch (action) {
      // ===== 修正统计 =====
      case 'set': {
        if (!stats || typeof stats !== 'object') {
          return { success: false, error: '缺少 stats 参数' };
        }

        const payload = {
          teacher_id: openid,
          student_id: String(studentId),
          updatedAt: db.serverDate(),
          updatedBy: openid,
          isManualOverride: true  // 标记为手动修正
        };

        // 只更新传入的字段
        if (typeof stats.masteredCount === 'number') {
          payload.masteredCount = stats.masteredCount;
          payload.manualMasteredCount = stats.masteredCount;
        }
        if (typeof stats.notMasteredCount === 'number') {
          payload.notMasteredCount = stats.notMasteredCount;
          payload.manualNotMasteredCount = stats.notMasteredCount;
        }
        if (typeof stats.checkinDays === 'number') {
          payload.checkinDays = stats.checkinDays;
          payload.manualCheckinDays = stats.checkinDays;
        }

        if (typeof stats.baseMasteredCount === 'number') {
          payload.baseMasteredCount = stats.baseMasteredCount;
        }
        if (typeof stats.baseNotMasteredCount === 'number') {
          payload.baseNotMasteredCount = stats.baseNotMasteredCount;
        }
        if (typeof stats.baseCheckinDays === 'number') {
          payload.baseCheckinDays = stats.baseCheckinDays;
        }

        await db.collection('student_statistics')
          .doc(String(studentId))
          .set({ data: payload });

        console.log('[updateStudentStats] 管理员修正统计:', studentId, payload);
        return { success: true, action: 'set', studentId };
      }

      // ===== 修正词书统计 =====
      case 'setWordbook': {
        if (!stats || typeof stats !== 'object') {
          return { success: false, error: '缺少 stats 参数' };
        }
        const wordbookId = event.wordbookId;
        if (!wordbookId) {
          return { success: false, error: '缺少 wordbookId' };
        }

        const payload = {
          teacher_id: openid,
          student_id: String(studentId),
          wordbook_id: String(wordbookId),
          updatedAt: db.serverDate(),
          updatedBy: openid,
          isManualOverride: true
        };

        if (typeof stats.masteredCount === 'number') {
          payload.masteredCount = stats.masteredCount;
          payload.manualMasteredCount = stats.masteredCount;
        }
        if (typeof stats.notMasteredCount === 'number') {
          payload.notMasteredCount = stats.notMasteredCount;
          payload.manualNotMasteredCount = stats.notMasteredCount;
        }
        if (typeof stats.checkinDays === 'number') {
          payload.checkinDays = stats.checkinDays;
          payload.manualCheckinDays = stats.checkinDays;
        }
        if (typeof stats.baseMasteredCount === 'number') {
          payload.baseMasteredCount = stats.baseMasteredCount;
        }
        if (typeof stats.baseNotMasteredCount === 'number') {
          payload.baseNotMasteredCount = stats.baseNotMasteredCount;
        }
        if (typeof stats.baseCheckinDays === 'number') {
          payload.baseCheckinDays = stats.baseCheckinDays;
        }

        const docId = `${studentId}_${wordbookId}`;
        await db.collection('wordbook_statistics')
          .doc(String(docId))
          .set({ data: payload });

        console.log('[updateStudentStats] 修正词书统计:', studentId, wordbookId, payload);
        return { success: true, action: 'setWordbook', studentId, wordbookId };
      }

      // ===== 清除手动修正（恢复自动计算） =====
      case 'reset': {
        // 删除 isManualOverride 标记，下次本地计算后会自动覆盖
        await db.collection('student_statistics')
          .doc(String(studentId))
          .update({
            data: {
              isManualOverride: _.remove(),
              manualMasteredCount: _.remove(),
              manualNotMasteredCount: _.remove(),
              manualCheckinDays: _.remove(),
              baseMasteredCount: _.remove(),
              baseNotMasteredCount: _.remove(),
              baseCheckinDays: _.remove(),
              updatedBy: _.remove(),
              updatedAt: db.serverDate()
            }
          });

        console.log('[updateStudentStats] 管理员重置统计:', studentId);
        return { success: true, action: 'reset', studentId };
      }

      case 'resetWordbook': {
        const wordbookId = event.wordbookId;
        if (!wordbookId) {
          return { success: false, error: '缺少 wordbookId' };
        }
        const docId = `${studentId}_${wordbookId}`;
        await db.collection('wordbook_statistics')
          .doc(String(docId))
          .update({
            data: {
              isManualOverride: _.remove(),
              manualMasteredCount: _.remove(),
              manualNotMasteredCount: _.remove(),
              manualCheckinDays: _.remove(),
              baseMasteredCount: _.remove(),
              baseNotMasteredCount: _.remove(),
              baseCheckinDays: _.remove(),
              updatedBy: _.remove(),
              updatedAt: db.serverDate()
            }
          });

        console.log('[updateStudentStats] 重置词书统计:', studentId, wordbookId);
        return { success: true, action: 'resetWordbook', studentId, wordbookId };
      }

      // ===== 查询当前统计 =====
      case 'get': {
        const res = await db.collection('student_statistics')
          .doc(String(studentId))
          .get();
        const data = (res && res.data) ? res.data : null;
        return { success: true, action: 'get', data };
      }

      case 'getWordbook': {
        const wordbookId = event.wordbookId;
        if (!wordbookId) {
          return { success: false, error: '缺少 wordbookId' };
        }
        const docId = `${studentId}_${wordbookId}`;
        const res = await db.collection('wordbook_statistics')
          .doc(String(docId))
          .get();
        const data = (res && res.data) ? res.data : null;
        return { success: true, action: 'getWordbook', data };
      }

      default:
        return { success: false, error: '未知 action: ' + action };
    }
  } catch (error) {
    console.error('[updateStudentStats] 执行失败:', error);
    return {
      success: false,
      error: error.message || 'unknown_error'
    };
  }
};
