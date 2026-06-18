/**
 * utils/safe-merge-restore.js
 * 安全合并恢复工具 —— 所有恢复入口的统一公共函数
 *
 * 核心原则：只追加不覆盖、不删除、单项隔离、返回详细报告
 *
 * 使用方式:
 *   const { safeMergeRestore } = require('../../utils/safe-merge-restore.js');
 *   const result = safeMergeRestore(backupData, options);
 *   // result -> { students: {backup:3, added:1, skipped:2, skippedReasons:[...]}, ... }
 */

'use strict';

// 【V2.0】引入语义级合并工具，确保备份恢复也使用与云同步一致的合并策略
const {
  mergeObjectAtWordLevel,
  mergeWordMasteryRecord,
  mergeLearningProgressRecord,
  isWordMasteryRecord,
  isLearningProgressRecord
} = require('./cloud-migration.js');

/**
 * 提取学生的唯一标识集合（id + student_id + 姓名年级组合）
 */
const buildStudentMatchKeys = (student) => {
  if (!student || typeof student !== 'object') return [];
  const keys = [];
  const id = String(student.id || '').trim();
  const sid = String(student.student_id || '').trim();
  const name = String(student.name || '').trim();
  const grade = String(student.grade || '').trim();

  if (id) keys.push('id:' + id);
  if (sid && sid !== id) keys.push('sid:' + sid);
  // 兜底：同名同年级视为同一人
  if (name && grade) keys.push('nameGrade:' + name + '|' + grade);
  else if (name) keys.push('name:' + name);

  return keys;
};

/**
 * 合并数组 —— 按对象的多个匹配键去重（只追加，不覆盖）
 * @returns {{ merged: Array, added: number, skipped: number, skippedReasons: string[] }}
 */
const mergeArrayByIdentity = (existing, incoming, buildKeysFn) => {
  const result = Array.isArray(existing) ? [...existing] : [];
  const added = [];
  const skipped = [];
  const skippedReasons = [];

  // 构建已有集合的匹配键索引
  const existingKeys = new Set();
  result.forEach((item) => {
    const keys = buildKeysFn(item);
    keys.forEach((k) => existingKeys.add(k));
  });

  (incoming || []).forEach((item) => {
    if (!item || typeof item !== 'object') return;

    const incomingKeys = buildKeysFn(item);
    if (incomingKeys.length === 0) {
      skipped.push(item);
      skippedReasons.push('no_match_keys');
      return;
    }

    const isDuplicate = incomingKeys.some((k) => existingKeys.has(k));
    if (isDuplicate) {
      skipped.push(item);
      skippedReasons.push('duplicate:' + incomingKeys[0]);
      return;
    }

    // 添加到结果并记录键
    incomingKeys.forEach((k) => existingKeys.add(k));
    added.push(item);
    result.push(item);
  });

  return {
    merged: result,
    added: added.length,
    skipped: skipped.length,
    skippedReasons
  };
};

/**
 * 深度合并对象（语义级）：自动检测单词记录和学习进度记录，采用字段级智能合并
 * - 单词记录（含 reviewCount/mastered）→ 语义合并（取最大/逻辑或）
 * - 学习进度记录（含 completedCount/learnedWords）→ 语义合并（取最大）
 * - 其他对象 → 递归
 * - 基本类型 → 保留本地已有值
 */
const mergeObjectDeep = (existing, incoming) => {
  const result = { ...(existing || {}) };
  Object.keys(incoming || {}).forEach((key) => {
    if (!(key in result)) {
      result[key] = incoming[key];
      return;
    }

    const localVal = result[key];
    const cloudVal = incoming[key];

    // 单词掌握记录级别：语义合并
    if (isWordMasteryRecord(localVal) && isWordMasteryRecord(cloudVal)) {
      result[key] = mergeWordMasteryRecord(localVal, cloudVal);
      return;
    }

    // 学习进度记录级别（wordbook 级别）：语义合并
    if (isLearningProgressRecord(localVal) && isLearningProgressRecord(cloudVal)) {
      result[key] = mergeLearningProgressRecord(localVal, cloudVal);
      return;
    }

    // 双方都是普通对象：递归
    if (
      typeof localVal === 'object' && localVal !== null && !Array.isArray(localVal) &&
      typeof cloudVal === 'object' && cloudVal !== null && !Array.isArray(cloudVal)
    ) {
      result[key] = mergeObjectDeep(localVal, cloudVal);
      return;
    }

    // 已知的进度数字字段：取最大值
    if (
      typeof localVal === 'number' && typeof cloudVal === 'number' &&
      (key === 'learnedWords' || key === 'totalWords' || key === 'completedCount' || key === 'totalCount')
    ) {
      result[key] = Math.max(localVal, cloudVal);
      return;
    }

    // 否则保留本地已有值
  });
  return result;
};

/**
 * 按 id 简单合并记录数组
 */
const mergeRecordsById = (existing, incoming) => {
  const existingIds = new Set();
  (existing || []).forEach((r) => {
    if (r && (r.id || r._id)) {
      existingIds.add(String(r.id || r._id));
    }
  });

  let added = 0;
  let skipped = 0;
  const result = [...(existing || [])];

  (incoming || []).forEach((r) => {
    if (!r) return;
    const rid = String(r.id || r._id || '');
    if (!rid || existingIds.has(rid)) {
      skipped++;
      return;
    }
    existingIds.add(rid);
    result.push(r);
    added++;
  });

  return { merged: result, added, skipped };
};

/**
 * 主入口：安全合并恢复
 *
 * @param {object} backupData  备份数据对象
 * @param {object} [options]   可选配置
 * @param {boolean} [options.dryRun=false]  仅预览，不实际写入
 * @returns {object} 合并报告
 */
const safeMergeRestore = (backupData, options = {}) => {
  const { dryRun = false } = options || {};
  const report = {};

  // ===== 1. students =====
  try {
    const existing = wx.getStorageSync('students') || [];
    const incoming = backupData.students || [];
    const mr = mergeArrayByIdentity(existing, incoming, buildStudentMatchKeys);
    if (!dryRun && mr.added > 0) {
      wx.setStorageSync('students', mr.merged);
    }
    report.students = {
      backup: Array.isArray(incoming) ? incoming.length : 0,
      added: mr.added,
      skipped: mr.skipped,
      skippedReasons: mr.skippedReasons.slice(0, 10) // 只保留前10条避免过长
    };
  } catch (e) {
    report.students = { error: e.message || 'merge_students_failed' };
  }

  // ===== 2. wordbooks =====
  try {
    const existing = wx.getStorageSync('wordbooks') || [];
    const incoming = backupData.wordbooks || [];
    const buildBookKeys = (b) => {
      const keys = [];
      const id = String(b.id || '').trim();
      if (id) keys.push('id:' + id);
      return keys;
    };
    const mr = mergeArrayByIdentity(existing, incoming, buildBookKeys);
    if (!dryRun && mr.added > 0) {
      wx.setStorageSync('wordbooks', mr.merged);
    }
    report.wordbooks = {
      backup: Array.isArray(incoming) ? incoming.length : 0,
      added: mr.added,
      skipped: mr.skipped
    };
  } catch (e) {
    report.wordbooks = { error: e.message || 'merge_wordbooks_failed' };
  }

  // ===== 3. wordMastery（三层深度合并）=====
  try {
    const existing = wx.getStorageSync('wordMastery') || {};
    const incoming = backupData.wordMastery || {};
    let wordAdded = 0;
    let wordSkipped = 0;
    const merged = mergeObjectDeep(existing, incoming);

    // 统计
    Object.keys(incoming).forEach((sid) => {
      Object.keys(incoming[sid] || {}).forEach((wbId) => {
        Object.keys(incoming[sid][wbId] || {}).forEach((wid) => {
          if (
            existing[sid] && existing[sid][wbId] &&
            existing[sid][wbId][wid] !== undefined
          ) {
            wordSkipped++;
          } else {
            wordAdded++;
          }
        });
      });
    });

    if (!dryRun && wordAdded > 0) {
      wx.setStorageSync('wordMastery', merged);
    }
    report.wordMastery = {
      backupWords: wordAdded + wordSkipped,
      added: wordAdded,
      skipped: wordSkipped
    };
  } catch (e) {
    report.wordMastery = { error: e.message || 'merge_wordMastery_failed' };
  }

  // ===== 4. learningProgress（两层深度合并）=====
  try {
    const existing = wx.getStorageSync('learningProgress') || {};
    const incoming = backupData.learningProgress || {};
    let progressAdded = 0;
    let progressSkipped = 0;
    const merged = mergeObjectDeep(existing, incoming);

    Object.keys(incoming).forEach((sid) => {
      if (!existing[sid]) {
        progressAdded++;
      } else {
        // 统计 wordbook 级别的新增
        Object.keys(incoming[sid].wordbooks || {}).forEach((wbId) => {
          if (
            !existing[sid].wordbooks ||
            !existing[sid].wordbooks[wbId]
          ) {
            progressAdded++;
          } else {
            progressSkipped++;
          }
        });
      }
    });

    if (!dryRun && progressAdded > 0) {
      wx.setStorageSync('learningProgress', merged);
    }
    report.learningProgress = {
      backupStudents: Object.keys(incoming).length,
      added: progressAdded,
      skipped: progressSkipped
    };
  } catch (e) {
    report.learningProgress = { error: e.message || 'merge_learningProgress_failed' };
  }

  // ===== 5. learningRecords =====
  try {
    const existing = wx.getStorageSync('learningRecords') || [];
    const incoming = backupData.learningRecords || [];
    const mr = mergeRecordsById(existing, incoming);
    if (!dryRun && mr.added > 0) {
      wx.setStorageSync('learningRecords', mr.merged);
    }
    report.learningRecords = {
      backup: Array.isArray(incoming) ? incoming.length : 0,
      added: mr.added,
      skipped: mr.skipped
    };
  } catch (e) {
    report.learningRecords = { error: e.message || 'merge_learningRecords_failed' };
  }

  // ===== 6. antiForgettingRecords =====
  try {
    const existing = wx.getStorageSync('antiForgettingRecords') || [];
    const incoming = backupData.antiForgettingRecords || [];
    const buildAfKeys = (r) => {
      const keys = [];
      const wordId = String(r.wordId || r.word_id || '').trim();
      const studentId = String(r.studentId || r.student_id || '').trim();
      if (wordId) keys.push('wordId:' + wordId);
      if (wordId && studentId) keys.push('af:' + studentId + '|' + wordId);
      return keys;
    };
    const mr = mergeArrayByIdentity(existing, incoming, buildAfKeys);
    if (!dryRun && mr.added > 0) {
      wx.setStorageSync('antiForgettingRecords', mr.merged);
    }
    report.antiForgettingRecords = {
      backup: Array.isArray(incoming) ? incoming.length : 0,
      added: mr.added,
      skipped: mr.skipped
    };
  } catch (e) {
    report.antiForgettingRecords = { error: e.message || 'merge_antiForgettingRecords_failed' };
  }

  // ===== 7. preview data（预习/复习/九宫格标记等本地状态）=====
  try {
    const previewKeyPrefixes = [
      'previewMastery_',
      'previewWordOrder_',
      'previewExcludedWordIds_',
      'reviewMastery_',
      'gridMastery_',
      'preview_phonetic_mode_enabled'
    ];
    let previewRestored = 0;
    let previewSkipped = 0;

    Object.keys(backupData).forEach(function(key) {
      const isPreviewKey = previewKeyPrefixes.some(function(prefix) {
        return key === prefix || key.startsWith(prefix);
      });
      if (!isPreviewKey) return;

      const existing = wx.getStorageSync(key);
      // 仅当本地不存在或为空时才从备份恢复（不覆盖已有数据）
      if (existing === undefined || existing === null || existing === '') {
        if (!dryRun) {
          wx.setStorageSync(key, backupData[key]);
        }
        previewRestored++;
      } else if (typeof existing === 'object' && Object.keys(existing).length === 0) {
        if (!dryRun && backupData[key] && Object.keys(backupData[key]).length > 0) {
          wx.setStorageSync(key, backupData[key]);
        }
        previewRestored++;
      } else {
        previewSkipped++;
      }
    });

    report.previewData = {
      restored: previewRestored,
      skipped: previewSkipped
    };
  } catch (e) {
    report.previewData = { error: e.message || 'merge_previewData_failed' };
  }

  // ===== 汇总 =====
  report.summary = {
    totalAdded:
      (report.students.added || 0) +
      (report.wordbooks.added || 0) +
      (report.wordMastery.added || 0) +
      (report.learningProgress.added || 0) +
      (report.learningRecords.added || 0) +
      (report.antiForgettingRecords.added || 0) +
      (report.previewData.restored || 0),
    totalSkipped:
      (report.students.skipped || 0) +
      (report.wordbooks.skipped || 0) +
      (report.wordMastery.skipped || 0) +
      (report.learningProgress.skipped || 0) +
      (report.learningRecords.skipped || 0) +
      (report.antiForgettingRecords.skipped || 0) +
      (report.previewData.skipped || 0),
    errors: Object.keys(report).filter((k) => k !== 'summary' && report[k].error).length
  };

  // ★ 清除所有学生的缓存统计数据，强制下次访问时从 wordMastery 重新计算
  if (!dryRun && (report.wordMastery.added > 0 || report.learningProgress.added > 0)) {
    try {
      const allStudentIds = new Set();
      const students = wx.getStorageSync('students') || [];
      students.forEach(s => {
        const sid = String(s.id || s.student_id || '').trim();
        if (sid) allStudentIds.add(sid);
      });
      const wordMastery = wx.getStorageSync('wordMastery') || {};
      Object.keys(wordMastery).forEach(sid => allStudentIds.add(String(sid)));
      allStudentIds.forEach(sid => {
        try { wx.removeStorageSync(sid + '_stats'); } catch (e) { /* ignore */ }
        try { wx.removeStorageSync('stats_' + sid); } catch (e) { /* ignore */ }
      });
      console.log('[safe-merge-restore] 已清除', allStudentIds.size, '个学生的缓存统计数据');
    } catch (clearError) {
      console.warn('[safe-merge-restore] 清除缓存统计失败:', clearError);
    }
  }

  console.log('[safe-merge-restore] 合并完成:', JSON.stringify(report.summary));
  return report;
};

module.exports = {
  safeMergeRestore,
  mergeArrayByIdentity,
  mergeObjectDeep,
  mergeRecordsById,
  buildStudentMatchKeys
};
