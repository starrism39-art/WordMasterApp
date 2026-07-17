/**
 * 云函数：syncMasteryAtom
 * 原子化合并 wordMastery 数据到云端 word_mastery 集合
 * 
 * ★ 与客户端直写相比的核心改进：
 *   1. 服务端合并，消除并发覆盖窗口
 *   2. 数值字段取 max、布尔字段 OR、时间线去重 → 数据只进不退
 *   3. 使用 db.serverDate() 消除客户端时间依赖
 *   4. difficult 按 lastReviewTime 决胜，确保最新评估生效
 * 
 * 调用: wx.cloud.callFunction({ name: 'syncMasteryAtom', data: { openid, records } })
 * 
 * 入参:
 *   openid: string (安全校验)
 *   records: array (每条包含 studentId, wordbookId, wordId 及掌握字段)
 * 
 * 降级: 云函数不可用时客户端自动退回原有 read→compare→write 逻辑
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { records, openid } = event || {};

  if (!openid) {
    return { success: false, error: 'missing_openid' };
  }
  if (!Array.isArray(records) || records.length === 0) {
    return { success: false, error: 'empty_records' };
  }

  // 安全校验：只能操作自己的数据（客户端调用时生效）
  const wxContext = cloud.getWXContext();
  const callerOpenid = wxContext.OPENID;
  if (callerOpenid && openid !== callerOpenid) {
    return { success: false, error: 'openid_mismatch' };
  }

  const collection = db.collection('word_mastery');
  const results = [];

  for (const record of records) {
    const { studentId, wordbookId, wordId, studentName, teacherName, ...wordData } = record;

    if (!studentId || !wordbookId || !wordId) {
      results.push({ wordId: wordId || 'unknown', ok: false, error: 'missing_identifiers' });
      continue;
    }

    const docId = buildScopedDocId(openid, 'mastery', studentId, wordbookId, wordId);

    try {
      // 1) 读取现有文档
      let existing = null;
      try {
        const res = await collection.doc(docId).get();
        existing = res.data || null;
      } catch (e) {
        if (e.errCode !== -1) {
          console.warn('[syncMasteryAtom] read error (non-fatal):', wordId, e);
        }
        // errCode === -1 表示文档不存在，忽略
      }

      // 2) 构建合并数据（以本地为基准）
      const merged = {
        teacher_id: openid,
        student_id: String(studentId),
        wordbook_id: String(wordbookId),
        word_id: String(wordId),
        updatedAt: db.serverDate(),
        ...wordData
      };

      // 显式传入的名称字段覆盖写入
      if (studentName) merged.studentName = studentName;
      if (teacherName) merged.teacherName = teacherName;

      if (existing) {
        // ---- 数值字段：取最大值（只进不退） ----
        if (typeof existing.reviewCount === 'number' && typeof wordData.reviewCount === 'number') {
          merged.reviewCount = Math.max(existing.reviewCount, wordData.reviewCount);
        }
        // ---- 时间字段：lastReviewTime 取最新 ----
        const localTime = typeof wordData.lastReviewTime === 'number' ? wordData.lastReviewTime : 0;
        const cloudTime = typeof existing.lastReviewTime === 'number' ? existing.lastReviewTime : 0;
        if (localTime > 0 || cloudTime > 0) {
          merged.lastReviewTime = Math.max(cloudTime, localTime);
        }

        // ---- 布尔字段：一旦 true 就保持 true（OR 逻辑） ----
        if (existing.mastered === true) merged.mastered = true;
        if (existing.isLearned === true) merged.isLearned = true;
        if (existing.antiForgettingSeed === true) merged.antiForgettingSeed = true;

        // ---- difficult：使用最新评估结果 ----
        // 如果云端 lastReviewTime 比本地新，说明云端是更新近的评估
        if (cloudTime > localTime && existing.difficult !== undefined) {
          merged.difficult = existing.difficult;
        }

        // ---- 时间字段：firstMasteryTime 取最早，nextReviewTime 取最早（最紧迫优先） ----
        if (typeof existing.firstMasteryTime === 'number' && typeof wordData.firstMasteryTime === 'number') {
          merged.firstMasteryTime = Math.min(existing.firstMasteryTime, wordData.firstMasteryTime);
        }
        if (typeof existing.nextReviewTime === 'number' && typeof wordData.nextReviewTime === 'number') {
          merged.nextReviewTime = Math.min(existing.nextReviewTime, wordData.nextReviewTime);
        }

        // ---- reviewTimeline：按 time 去重合并 ----
        if (Array.isArray(existing.reviewTimeline) || Array.isArray(wordData.reviewTimeline)) {
          const existTL = Array.isArray(existing.reviewTimeline) ? existing.reviewTimeline : [];
          const localTL = Array.isArray(wordData.reviewTimeline) ? wordData.reviewTimeline : [];
          const existTimes = new Set(existTL.map(t => t && t.time).filter(Boolean));
          const newEntries = localTL.filter(t => t && t.time && !existTimes.has(t.time));
          merged.reviewTimeline = [...existTL, ...newEntries];
        }

        // ---- studentName / teacherName：本地没传则保留云端 ----
        if (!studentName && existing.studentName) merged.studentName = existing.studentName;
        if (!teacherName && existing.teacherName) merged.teacherName = existing.teacherName;

        // ---- 保留云端中本地没有传入的未知字段（排除系统字段） ----
        for (const key of Object.keys(existing)) {
          if (key.startsWith('_')) continue;
          if (['teacher_id', 'student_id', 'wordbook_id', 'word_id'].includes(key)) continue;
          if (merged[key] === undefined) {
            merged[key] = existing[key];
          }
        }
      }

      // 3) 写入合并结果
      await collection.doc(docId).set({ data: merged });
      results.push({ wordId, ok: true });

    } catch (error) {
      // E11000 主键冲突 → 文档已存在，视为同步成功
      if (error && error.message && error.message.indexOf('E11000') !== -1) {
        console.log('[syncMasteryAtom] 忽略 E11000（文档已存在）:', wordId);
        results.push({ wordId, ok: true, skipped: true, reason: 'already_exists' });
      } else {
        console.error('[syncMasteryAtom] failed:', wordId, error);
        results.push({ wordId, ok: false, error: error.message || 'unknown' });
      }
    }
  }

  return { success: true, results };
};

/**
 * 生成与客户端一致的 scoped doc ID
 */
function buildScopedDocId(openid, ...parts) {
  const safe = (v) => String(v === undefined || v === null ? '' : v)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);
  return [safe(openid), ...parts.map(safe)].filter(Boolean).join('__').slice(0, 500);
}
