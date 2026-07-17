/**
 * utils/stats-engine.js
 * 统一核心统计引擎
 * 
 * 计算口径：
 *   已学   = wordMastery 中 mastered===true 或 difficult===true 的单词总数
 *   未掌握 = wordMastery 中 difficult===true 的单词总数
 *   打卡天数 = learning_records 中不重复的日期数
 *
 * 存储：
 *   本地: stats_{studentId}
 *   云端: student_statistics 集合 (doc._id = studentId)
 */
'use strict';

const DEFAULT_ENV = 'cloudbase-4gafzdch60ad597b';
const { getWordbookMasterySummary } = require('./learning-progress.js');

// ===== 云端推送工具 =====
const syncStudentStatsToCloud = async (studentId, stats) => {
  const openid = (() => {
    try { return wx.getStorageSync('openid') || null; } catch (e) { return null; }
  })();

  if (!openid || !wx.cloud || !studentId || !stats) {
    console.warn('[stats-engine] syncStudentStatsToCloud 跳过: openid=', !!openid, 'cloud=', !!wx.cloud);
    return;
  }

  // ★ V1.0.1 附加可视化姓名标签（容错处理）
  let studentName = '';
  let teacherName = '';
  try {
    const currentStudent = wx.getStorageSync('currentStudent') || {};
    studentName = currentStudent.name || '';
    teacherName = currentStudent.teacher_name || '';
  } catch (e) { /* 静默忽略 */ }
  if (!teacherName) {
    try {
      const currentUser = wx.getStorageSync('currentUser') || {};
      teacherName = currentUser.name || '';
    } catch (e) { teacherName = ''; }
  }

  try {
    const db = wx.cloud.database({ env: DEFAULT_ENV });
    const payload = {
      teacher_id: openid,
      student_id: String(studentId),
      ...(studentName ? { student_name: studentName } : {}),
      ...(teacherName ? { teacher_name: teacherName } : {}),
      masteredCount: Number(stats.masteredCount || 0),
      notMasteredCount: Number(stats.notMasteredCount || 0),
      checkinDays: Number(stats.checkinDays || 0),
      calculatedAt: Date.now(),
      updatedAt: db.serverDate ? db.serverDate() : new Date()
    };

    if (stats && stats.isManualOverride) {
      payload.isManualOverride = true;
      if (Number.isFinite(Number(stats.manualMasteredCount))) {
        payload.manualMasteredCount = Number(stats.manualMasteredCount);
      }
      if (Number.isFinite(Number(stats.manualNotMasteredCount))) {
        payload.manualNotMasteredCount = Number(stats.manualNotMasteredCount);
      }
      if (Number.isFinite(Number(stats.manualCheckinDays))) {
        payload.manualCheckinDays = Number(stats.manualCheckinDays);
      }
      if (Number.isFinite(Number(stats.baseMasteredCount))) {
        payload.baseMasteredCount = Number(stats.baseMasteredCount);
      }
      if (Number.isFinite(Number(stats.baseNotMasteredCount))) {
        payload.baseNotMasteredCount = Number(stats.baseNotMasteredCount);
      }
      if (Number.isFinite(Number(stats.baseCheckinDays))) {
        payload.baseCheckinDays = Number(stats.baseCheckinDays);
      }
    }

    await db.collection('student_statistics')
      .doc(String(studentId))
      .set({ data: payload });
    console.log('[stats-engine] 云端统计已同步, studentId:', studentId);
  } catch (error) {
    console.warn('[stats-engine] 云端统计同步失败（非阻塞）:', error);
  }
};

// ===== 核心计算：从 wordMastery + learningRecords 中提取三指标（按词书隔离） =====
const calculateWordbookStats = (studentId, wordbookId) => {
  if (!studentId || !wordbookId) {
    return { masteredCount: 0, notMasteredCount: 0, checkinDays: 0 };
  }

  try {
    const wordMastery = wx.getStorageSync('wordMastery') || {};
    const studentMastery = wordMastery[studentId] || {};
    const wordbookMastery = studentMastery[wordbookId] || {};
    const masterySummary = getWordbookMasterySummary(wordbookId, wordbookMastery);
    const masteredCount = masterySummary.learnedCount;
    const notMasteredCount = masterySummary.unmasteredCount;

    // 打卡天数：只统计当前词书的记录
    const learningRecords = (() => {
      try { return wx.getStorageSync('learningRecords') || []; } catch (e) { return []; }
    })();

    const uniqueDates = new Set();
    (Array.isArray(learningRecords) ? learningRecords : []).forEach((record) => {
      if (!record || record.studentId !== studentId) return;
      if (record.wordbookId && record.wordbookId !== wordbookId) return;
      const dateStr = record.studyDate || record.learningDate || record.date || '';
      if (!dateStr) return;
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        uniqueDates.add(`${y}-${m}-${day}`);
      } catch (e) { /* skip */ }
    });

    const checkinDays = uniqueDates.size;

    console.log('[stats-engine] 词书级统计:', {
      studentId, wordbookId,
      masteredCount, notMasteredCount, checkinDays
    });

    return { masteredCount, notMasteredCount, checkinDays };
  } catch (error) {
    console.error('[stats-engine] 词书级统计失败:', error);
    return { masteredCount: 0, notMasteredCount: 0, checkinDays: 0 };
  }
};

// ===== 核心计算：从 wordMastery + learningRecords 中提取三指标（全词书汇总）=====
const calculateStudentCoreStats = (studentId) => {
  if (!studentId) {
    return { masteredCount: 0, notMasteredCount: 0, checkinDays: 0 };
  }

  try {
    const wordMastery = wx.getStorageSync('wordMastery') || {};
    const studentMastery = wordMastery[studentId] || {};

    // 遍历该学生下所有词书的 wordMastery 记录
    let masteredCount = 0;
    let notMasteredCount = 0;

    Object.keys(studentMastery).forEach((wordbookId) => {
      const wordbookMastery = studentMastery[wordbookId] || {};
      const summary = getWordbookMasterySummary(wordbookId, wordbookMastery);
      masteredCount += summary.learnedCount;
      notMasteredCount += summary.unmasteredCount;
    });

    // 打卡天数 = learning_records 中不重复的日期数
    const learningRecords = (() => {
      try { return wx.getStorageSync('learningRecords') || []; } catch (e) { return []; }
    })();

    const uniqueDates = new Set();
    (Array.isArray(learningRecords) ? learningRecords : []).forEach((record) => {
      if (!record || record.studentId !== studentId) return;
      const dateStr = record.studyDate || record.learningDate || record.date || '';
      if (!dateStr) return;
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return;
        // 归一化到 YYYY-MM-DD
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        uniqueDates.add(`${y}-${m}-${day}`);
      } catch (e) { /* skip */ }
    });

    const checkinDays = uniqueDates.size;

    console.log('[stats-engine] 核心统计计算完成:', {
      studentId,
      masteredCount,
      notMasteredCount,
      checkinDays
    });

    return { masteredCount, notMasteredCount, checkinDays };
  } catch (error) {
    console.error('[stats-engine] 核心统计计算失败:', error);
    return { masteredCount: 0, notMasteredCount: 0, checkinDays: 0 };
  }
};

// ===== 保存到本地 + 云端 =====
// 策略：
//   1. 从 wordMastery 计算当前真实值
//   2. 如果有管理员手动修正（isManualOverride），取 max(云端修正, 当前计算)
//   3. 新数据在较大值基础上累加，保证"只进不退"
//   4. 推送到云端时保留 isManualOverride 标记和基准值
const saveStudentStats = async (studentId, stats) => {
  if (!studentId || !stats) return;

  const statsKey = `stats_${studentId}`;
  const currentMastered = Number(stats.masteredCount || 0);
  const currentNotMastered = Number(stats.notMasteredCount || 0);
  const currentCheckin = Number(stats.checkinDays || 0);

  const readNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  // ★ 读取已有的缓存（可能是管理员修正值）
  let existing = null;
  try {
    existing = wx.getStorageSync(statsKey) || null;
  } catch (e) { /* ignore */ }

  let finalMastered = currentMastered;
  let finalNotMastered = currentNotMastered;
  let finalCheckin = currentCheckin;
  let isManualOverride = false;
  let manualMastered = null;
  let manualNotMastered = null;
  let manualCheckin = null;
  let baseMastered = null;
  let baseNotMastered = null;
  let baseCheckin = null;

  if (existing && existing.isManualOverride) {
    manualMastered = readNumber(existing.manualMasteredCount);
    if (manualMastered === null) manualMastered = readNumber(existing.masteredCount) || 0;

    manualNotMastered = readNumber(existing.manualNotMasteredCount);
    if (manualNotMastered === null) manualNotMastered = readNumber(existing.notMasteredCount) || 0;

    manualCheckin = readNumber(existing.manualCheckinDays);
    if (manualCheckin === null) manualCheckin = readNumber(existing.checkinDays) || 0;

    baseMastered = readNumber(existing.baseMasteredCount);
    baseNotMastered = readNumber(existing.baseNotMasteredCount);
    baseCheckin = readNumber(existing.baseCheckinDays);

    const hasBase = baseMastered !== null && baseNotMastered !== null && baseCheckin !== null;

    if (hasBase) {
      finalMastered = manualMastered + Math.max(0, currentMastered - baseMastered);
      finalNotMastered = manualNotMastered + Math.max(0, currentNotMastered - baseNotMastered);
      finalCheckin = manualCheckin + Math.max(0, currentCheckin - baseCheckin);
    } else {
      // 兼容旧版手动修正：取 max(修正值, 当前计算值)，保证只进不退
      finalMastered = Math.max(manualMastered, currentMastered);
      finalNotMastered = Math.max(manualNotMastered, currentNotMastered);
      finalCheckin = Math.max(manualCheckin, currentCheckin);
    }

    isManualOverride = true;

    if (finalMastered !== manualMastered || finalNotMastered !== manualNotMastered) {
      console.log('[stats-engine] 在管理员修正值基础上累加:',
        '已学', manualMastered, '→', finalMastered,
        '未掌握', manualNotMastered, '→', finalNotMastered);
    }
  } else if (existing) {
    // 普通缓存：同样取 max，保证不退化
    finalMastered = Math.max(Number(existing.masteredCount || 0), currentMastered);
    finalNotMastered = Math.max(Number(existing.notMasteredCount || 0), currentNotMastered);
    finalCheckin = Math.max(Number(existing.checkinDays || 0), currentCheckin);
  }

  const payload = {
    masteredCount: finalMastered,
    notMasteredCount: finalNotMastered,
    checkinDays: finalCheckin,
    calculatedAt: Date.now(),
    isManualOverride: isManualOverride
  };

  if (isManualOverride) {
    payload.manualMasteredCount = manualMastered;
    payload.manualNotMasteredCount = manualNotMastered;
    payload.manualCheckinDays = manualCheckin;
    if (baseMastered !== null && baseNotMastered !== null && baseCheckin !== null) {
      payload.baseMasteredCount = baseMastered;
      payload.baseNotMasteredCount = baseNotMastered;
      payload.baseCheckinDays = baseCheckin;
    }
  }

  try {
    wx.setStorageSync(statsKey, payload);
    console.log('[stats-engine] 本地统计已保存:', statsKey, payload);
  } catch (e) {
    console.warn('[stats-engine] 本地统计保存失败:', e);
  }

  // 异步推送到云端（不阻塞）
  syncStudentStatsToCloud(studentId, payload).catch((e) => {
    console.warn('[stats-engine] 云端统计推送失败（非阻塞）:', e);
  });

  return payload;
};

// ===== 刷新：重算 + 保存 + 返回最新统计 =====
const refreshStudentStats = async (studentId) => {
  const stats = calculateStudentCoreStats(studentId);
  return saveStudentStats(studentId, stats);
};

// ===== 读取缓存统计（若缓存为空或过期则静默重算） =====
const getStudentStats = async (studentId, options = {}) => {
  const { forceRecalculate = false, maxAgeMs = 30 * 1000 } = options;

  if (!studentId) {
    return { masteredCount: 0, notMasteredCount: 0, checkinDays: 0 };
  }

  const statsKey = `stats_${studentId}`;
  let cached = null;
  try {
    cached = wx.getStorageSync(statsKey) || null;
  } catch (e) { /* ignore */ }

  const isStale = !cached ||
    !cached.calculatedAt ||
    (Date.now() - cached.calculatedAt > maxAgeMs);

  if (forceRecalculate || isStale) {
    console.log('[stats-engine] 统计' + (cached ? '已过期' : '不存在') + '，静默重算...');
    return refreshStudentStats(studentId);
  }

  return {
    masteredCount: Number(cached.masteredCount || 0),
    notMasteredCount: Number(cached.notMasteredCount || 0),
    checkinDays: Number(cached.checkinDays || 0)
  };
};

module.exports = {
  calculateStudentCoreStats,
  calculateWordbookStats,
  saveStudentStats,
  refreshStudentStats,
  getStudentStats,
  syncStudentStatsToCloud
};
