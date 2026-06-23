const DEFAULT_ENV = 'cloudbase-4gafzdch60ad597b';
const MAX_CONCURRENCY = 20;
const MAX_QUERY_LIMIT = 20;

// ★ 委托 cloud-sync 统一写路径，确保文档 ID 一致
const {
  syncLearningRecord,
  syncWordMasteryBatch,
  syncLearningProgress
} = require('./cloud-sync.js');

const chunkArray = (items, size) => {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const normalizeObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value;
};

const runBatches = async (items, batchSize, worker, label) => {
  if (!Array.isArray(items) || items.length === 0) {
    console.log(`[cloud-migration] ${label}: 0`);
    return 0;
  }

  const batches = chunkArray(items, batchSize);
  let processed = 0;

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    await Promise.all(batch.map(worker));
    processed += batch.length;
    console.log(`[cloud-migration] ${label}: ${processed}/${items.length}`);
  }

  return processed;
};

const stripMeta = (doc, extraKeys = []) => {
  const base = doc && typeof doc === 'object' ? { ...doc } : {};
  delete base.teacher_id;
  delete base._openid;
  delete base.ownerId;
  delete base.ownerUsername;
  delete base.currentUser;
  delete base._id;
  extraKeys.forEach((key) => {
    delete base[key];
  });
  return base;
};

const normalizeStudentForMerge = (student) => {
  const cleaned = student && typeof student === 'object' ? { ...student } : {};
  const studentId = String(cleaned.student_id || cleaned.id || cleaned._id || '').trim();
  if (studentId) {
    cleaned.student_id = studentId;
    cleaned.id = studentId;
  }
  return cleaned;
};

const fetchAllByTeacher = async (db, collectionName, openid, limit = MAX_QUERY_LIMIT) => {
  const collection = db.collection(collectionName);
  const countResult = await collection.where({ teacher_id: openid }).count();
  const total = countResult && typeof countResult.total === 'number' ? countResult.total : 0;
  const items = [];

  for (let offset = 0; offset < total; offset += limit) {
    const batch = await collection
      .where({ teacher_id: openid })
      .skip(offset)
      .limit(limit)
      .get();
    if (batch && Array.isArray(batch.data)) {
      items.push(...batch.data);
    }
  }

  return items;
};

const ensureTeacher = async (db, openid) => {
  const teachersRef = db.collection('teachers');
  const existing = await teachersRef.where({
    teacher_id: openid
  }).limit(1).get();

  if (existing && Array.isArray(existing.data) && existing.data.length > 0) {
    // 【权限基座-静默升级】检查老记录是否缺少权限字段，自动补齐
    const teacherDoc = existing.data[0];
    const needsUpgrade = !teacherDoc.userRole || !teacherDoc.memberLevel;
    if (needsUpgrade) {
      try {
        await teachersRef.doc(teacherDoc._id).update({
          data: {
            userRole: teacherDoc.userRole || 'external',
            memberLevel: teacherDoc.memberLevel || 'free'
          }
        });
        console.log('[Permission] 静默升级: 云端教师记录已补齐权限字段, _id:', teacherDoc._id);
      } catch (updateError) {
        console.warn('[Permission] 静默升级云端教师记录失败（非阻塞）:', updateError);
      }
    }
    // 返回云端记录中的权限字段，供上层同步到本地
    return {
      created: false,
      userRole: teacherDoc.userRole || 'external',
      memberLevel: teacherDoc.memberLevel || 'free'
    };
  }

  // 生成带时间戳的默认教师名（不用 count() 避免权限问题）
  const defaultName = '教师' + String(Date.now()).slice(-4);

  await teachersRef.add({
    data: {
      teacher_id: openid,
      openid: openid,
      name: defaultName,
      userRole: 'external',
      memberLevel: 'free',
      createdAt: db.serverDate ? db.serverDate() : new Date()
    }
  });

  return { created: true, userRole: 'external', memberLevel: 'free' };
};

const buildProgressDocs = (learningProgress, openid) => {
  const docs = [];
  const progressRoot = normalizeObject(learningProgress);

  Object.keys(progressRoot).forEach((studentId) => {
    if (!studentId) {
      return;
    }

    const studentProgress = normalizeObject(progressRoot[studentId]);
    docs.push({
      studentId: String(studentId),
      data: {
        teacher_id: openid,
        student_id: String(studentId),
        learnedWords: Number(studentProgress.learnedWords || 0) || 0,
        totalWords: Number(studentProgress.totalWords || 0) || 0,
        wordbooks: normalizeObject(studentProgress.wordbooks)
      }
    });
  });

  return docs;
};

const buildWordMasteryDocs = (wordMastery, openid) => {
  const docs = [];
  const masteryRoot = normalizeObject(wordMastery);

  Object.keys(masteryRoot).forEach((studentId) => {
    const studentMastery = normalizeObject(masteryRoot[studentId]);
    Object.keys(studentMastery).forEach((wordbookId) => {
      const wordbookMastery = normalizeObject(studentMastery[wordbookId]);
      Object.keys(wordbookMastery).forEach((wordId) => {
        const record = wordbookMastery[wordId];
        const normalizedRecord =
          record && typeof record === 'object' && !Array.isArray(record)
            ? record
            : { legacyStatus: record };

        docs.push({
          data: {
            teacher_id: openid,
            student_id: String(studentId),
            wordbook_id: String(wordbookId),
            word_id: String(wordId),
            ...normalizedRecord
          }
        });
      });
    });
  });

  return docs;
};

const buildProgressMap = (docs) => {
  const map = {};
  (docs || []).forEach((doc) => {
    const studentId = String(doc.student_id || doc.studentId || doc._id || '').trim();
    if (!studentId) {
      return;
    }
    const cleaned = stripMeta(doc, ['student_id', 'studentId']);
    map[studentId] = {
      ...cleaned,
      learnedWords: Number(cleaned.learnedWords || 0) || 0,
      totalWords: Number(cleaned.totalWords || 0) || 0,
      wordbooks: normalizeObject(cleaned.wordbooks)
    };
  });
  return map;
};

const buildWordMasteryMap = (docs) => {
  const map = {};
  (docs || []).forEach((doc) => {
    const studentId = String(doc.student_id || doc.studentId || '').trim();
    const wordbookId = String(doc.wordbook_id || doc.wordbookId || '').trim();
    const wordId = String(doc.word_id || doc.wordId || '').trim();
    if (!studentId || !wordbookId || !wordId) {
      return;
    }
    if (!map[studentId]) {
      map[studentId] = {};
    }
    if (!map[studentId][wordbookId]) {
      map[studentId][wordbookId] = {};
    }
    map[studentId][wordbookId][wordId] = stripMeta(doc, [
      'student_id',
      'studentId',
      'wordbook_id',
      'wordbookId',
      'word_id',
      'wordId'
    ]);
  });
  return map;
};

const mergeById = (localArr, cloudArr, idKey) => {
  const map = new Map();
  // 先放本地
  (localArr || []).forEach((item) => {
    if (item && item[idKey] !== undefined && item[idKey] !== null) {
      map.set(String(item[idKey]), item);
    }
  });
  // 云端补充：本地没有的直接加；本地有的按 updatedAt 时间戳比较，谁更新用谁
  (cloudArr || []).forEach((item) => {
    if (!item) return;
    const id = item[idKey] !== undefined && item[idKey] !== null ? String(item[idKey]) : null;
    if (!id) return;
    const localItem = map.get(id);
    if (!localItem) {
      // 本地没有，直接用云端
      map.set(id, item);
    } else {
      // 两边都有，比较 updatedAt，取时间戳更大的
      const localTime = typeof localItem.updatedAt === 'number' ? localItem.updatedAt : 0;
      const cloudTime = typeof item.updatedAt === 'number' ? item.updatedAt : 0;
      if (cloudTime > localTime) {
        // 云端更新，云端覆盖本地（但保留本地独有字段）
        map.set(id, { ...localItem, ...item });
      }
      // 否则保留本地，不覆盖
    }
  });
  return Array.from(map.values());
};

/**
 * 判断一个对象是否为单词掌握记录（包含 reviewCount 或 mastered 字段）
 */
const isWordMasteryRecord = (obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  return 'reviewCount' in obj || 'mastered' in obj || 'firstMasteryTime' in obj || 'nextReviewTime' in obj;
};

/**
 * 判断一个对象是否为学习进度记录（包含 completedCount 或 learnedWords）
 */
const isLearningProgressRecord = (obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  // 必须有 completedCount 或 learnedWords 且值为数字，同时不能含 wordbooks（那是上级对象）
  const hasNumericCompleted = typeof obj.completedCount === 'number';
  const hasNumericLearned = typeof obj.learnedWords === 'number';
  return (hasNumericCompleted || hasNumericLearned) && 'wordbooks' in obj === false;
};

/**
 * 语义合并单词掌握记录（word-level）：用字段语义决定合并策略
 * 核心原则：进度只进不退
 */
const mergeWordMasteryRecord = (localRecord, cloudRecord) => {
  const local = localRecord || {};
  const cloud = cloudRecord || {};

  // 以双方所有字段为基底（local 优先保留未知字段），再覆盖语义合并的关键字段
  const result = { ...cloud, ...local };

  // reviewCount: 取最大值（更多复习=更先进）
  result.reviewCount = Math.max(
    typeof local.reviewCount === 'number' ? local.reviewCount : 0,
    typeof cloud.reviewCount === 'number' ? cloud.reviewCount : 0
  );

  // lastReviewTime: 取最大值（更晚=更新）
  result.lastReviewTime = Math.max(
    typeof local.lastReviewTime === 'number' ? local.lastReviewTime : 0,
    typeof cloud.lastReviewTime === 'number' ? cloud.lastReviewTime : 0
  );

  // nextReviewTime: 取最大值（更晚=进度更靠后）
  result.nextReviewTime = Math.max(
    typeof local.nextReviewTime === 'number' ? local.nextReviewTime : 0,
    typeof cloud.nextReviewTime === 'number' ? cloud.nextReviewTime : 0
  );

  // firstMasteryTime: 取最小值（最早学习时间）
  const localFirst = typeof local.firstMasteryTime === 'number' ? local.firstMasteryTime : Infinity;
  const cloudFirst = typeof cloud.firstMasteryTime === 'number' ? cloud.firstMasteryTime : Infinity;
  result.firstMasteryTime = Math.min(localFirst, cloudFirst) === Infinity ? (result.lastReviewTime || Date.now()) : Math.min(localFirst, cloudFirst);

  // mastered: 逻辑或（任一方标记掌握即为掌握）
  result.mastered = !!(local.mastered || cloud.mastered);

  // difficult: 以 lastReviewTime 更晚者为准（最新评估）
  const localLR = typeof local.lastReviewTime === 'number' ? local.lastReviewTime : 0;
  const cloudLR = typeof cloud.lastReviewTime === 'number' ? cloud.lastReviewTime : 0;
  result.difficult = cloudLR > localLR ? !!cloud.difficult : !!local.difficult;

  // antiForgettingSeed: 逻辑或
  result.antiForgettingSeed = !!(local.antiForgettingSeed || cloud.antiForgettingSeed);

  // isLearned: 逻辑或（任一方标记已学即为已学）
  // 如果两端都没有 isLearned，但有 mastered/difficult 标记，也视为已学
  result.isLearned = !!(local.isLearned || cloud.isLearned || local.mastered || cloud.mastered || local.difficult || cloud.difficult);

  // reviewTimeline: 合并数组，按 time+reviewCount+status 去重
  const localTimeline = Array.isArray(local.reviewTimeline) ? local.reviewTimeline : [];
  const cloudTimeline = Array.isArray(cloud.reviewTimeline) ? cloud.reviewTimeline : [];
  const timelineMap = new Map();
  localTimeline.forEach((entry) => {
    if (entry && typeof entry.time === 'number') {
      const dedupeKey = `${entry.time}_${entry.reviewCount || 0}_${entry.status || ''}`;
      timelineMap.set(dedupeKey, entry);
    }
  });
  cloudTimeline.forEach((entry) => {
    if (entry && typeof entry.time === 'number') {
      const dedupeKey = `${entry.time}_${entry.reviewCount || 0}_${entry.status || ''}`;
      if (!timelineMap.has(dedupeKey)) {
        timelineMap.set(dedupeKey, entry);
      }
    }
  });
  result.reviewTimeline = Array.from(timelineMap.values()).sort((a, b) => (a.time || 0) - (b.time || 0));

  return result;
};

/**
 * 语义合并学习进度记录（wordbook-level）：累计值取最大
 */
const mergeLearningProgressRecord = (localRecord, cloudRecord) => {
  const local = localRecord || {};
  const cloud = cloudRecord || {};

  // 以双方所有字段为基底，再覆盖语义合并的关键字段
  const result = { ...cloud, ...local };

  result.completedCount = Math.max(
    typeof local.completedCount === 'number' ? local.completedCount : 0,
    typeof cloud.completedCount === 'number' ? cloud.completedCount : 0,
    typeof local.learnedWords === 'number' ? local.learnedWords : 0,
    typeof cloud.learnedWords === 'number' ? cloud.learnedWords : 0
  );
  result.learnedWords = result.completedCount;

  result.totalCount = Math.max(
    typeof local.totalCount === 'number' ? local.totalCount : 0,
    typeof cloud.totalCount === 'number' ? cloud.totalCount : 0
  );

  // lastStudyTime: 取字典序最大值（ISO日期字符串）
  result.lastStudyTime = [local.lastStudyTime, local.lastStudied, cloud.lastStudyTime, cloud.lastStudied]
    .filter(Boolean)
    .sort()
    .pop() || '';
  result.lastStudied = result.lastStudyTime;

  return result;
};

/**
 * 智能深度合并（语义级）：根据数据层级自动选择合并策略
 * - 单词记录级别 → 语义合并（取最大/逻辑或）
 * - 学习进度记录级别 → 语义合并（取最大）
 * - 中间层级（student/wordbook）→ 递归
 * - 新 key → 直接添加
 */
const mergeObjectAtWordLevel = (localObj, cloudObj) => {
  // 防御：处理 null/undefined 输入
  if (!localObj || typeof localObj !== 'object' || Array.isArray(localObj)) localObj = {};
  if (!cloudObj || typeof cloudObj !== 'object' || Array.isArray(cloudObj)) cloudObj = {};
  
  const result = { ...localObj };
  Object.keys(cloudObj).forEach((key) => {
    if (!(key in result)) {
      // 本地没有这个 key，直接添加云端数据
      result[key] = cloudObj[key];
      return;
    }

    const localVal = result[key];
    const cloudVal = cloudObj[key];

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

    // 双方都是普通对象（中间层级如 studentId/wordbookId）：递归
    if (
      typeof localVal === 'object' && localVal !== null && !Array.isArray(localVal) &&
      typeof cloudVal === 'object' && cloudVal !== null && !Array.isArray(cloudVal)
    ) {
      result[key] = mergeObjectAtWordLevel(localVal, cloudVal);
      return;
    }

    // 已知的进度数字字段：取最大值（覆盖 student/wordbook 各级的 learnedWords 等）
    if (
      typeof localVal === 'number' && typeof cloudVal === 'number' &&
      (key === 'learnedWords' || key === 'totalWords' || key === 'completedCount' || key === 'totalCount')
    ) {
      result[key] = Math.max(localVal, cloudVal);
      return;
    }

    // 其他情况（基本类型、数组）：保留本地值
  });
  return result;
};

const syncDataFromCloud = async (openid) => {
  try {
    // 【云环境就绪保护】确保 wx.cloud.init() 已执行后才调用云 API
    if (!wx.cloud) {
      console.warn('[cloud-migration] wx.cloud 不可用，跳过同步');
      return { error: 'wx_cloud_unavailable' };
    }

    // 兜底 init：若 app.js 中 init 因时序问题未完成，此处安全重放（idempotent）
    try {
      wx.cloud.init({
        env: DEFAULT_ENV,
        traceUser: true
      });
    } catch (reinitError) {
      console.warn('[cloud-migration] wx.cloud.init() 兜底调用失败（非阻塞）:', reinitError);
    }

    if (!openid) {
      return { error: 'missing_openid' };
    }

    const db = wx.cloud.database({ env: DEFAULT_ENV });

    // 【权限基座-静默升级】同步前先拉取/补齐教师权限字段
    const teacherResult = await ensureTeacher(db, openid);
    if (teacherResult.userRole) {
      try {
        const app = getApp();
        const normalizedUser = (typeof app.ensureUserPermissions === 'function')
          ? app.ensureUserPermissions({
              id: openid,
              username: openid,
              userRole: teacherResult.userRole,
              memberLevel: teacherResult.memberLevel
            })
          : {
              id: openid,
              username: openid,
              userRole: teacherResult.userRole,
              memberLevel: teacherResult.memberLevel || 'free',
              name: '教师'
            };
        wx.setStorageSync('currentUser', normalizedUser);
        if (app.globalData) {
          app.globalData.currentUser = normalizedUser;
        }
        console.log('[Permission] syncDataFromCloud: 教师权限字段已同步到本地, userRole:', teacherResult.userRole);
      } catch (permSyncError) {
        console.warn('[Permission] syncDataFromCloud: 权限同步到本地失败（非阻塞）:', permSyncError);
      }
    }

    const studentsDocs = await fetchAllByTeacher(db, 'students', openid);
    const recordDocs = await fetchAllByTeacher(db, 'learning_records', openid);
    const progressDocs = await fetchAllByTeacher(db, 'learning_progress', openid);
    const masteryDocs = await fetchAllByTeacher(db, 'word_mastery', openid);
    // ★ 拉取云端手动修正的统计数据（管理员可覆盖）
    let statsDocs = [];
    try {
      statsDocs = await fetchAllByTeacher(db, 'student_statistics', openid);
    } catch (e) {
      console.warn('[cloud-sync] 拉取 student_statistics 失败（非阻塞）:', e);
    }

    const cloudStudents = (studentsDocs || []).map((doc) => {
      const cleaned = stripMeta(doc);
      const fallbackId = doc.student_id || doc._id || '';
      if (!cleaned.id && fallbackId) {
        cleaned.id = String(fallbackId);
      }
      if (!cleaned.student_id && fallbackId) {
        cleaned.student_id = String(fallbackId);
      }
      return cleaned;
    });

    const cloudRecords = (recordDocs || []).map((doc) => {
      const cleaned = stripMeta(doc);
      if (!cleaned.id && doc._id) {
        cleaned.id = String(doc._id);
      }
      return cleaned;
    });

    const cloudProgress = buildProgressMap(progressDocs);
    const cloudMastery = buildWordMasteryMap(masteryDocs);

    // ---- 智能合并：本地数据 + 云端数据，本地未同步的条目不丢失 ----
    const localStudents = Array.isArray(wx.getStorageSync('students')) ? wx.getStorageSync('students') : [];
    const localRecords = Array.isArray(wx.getStorageSync('learningRecords')) ? wx.getStorageSync('learningRecords') : [];
    const localProgress = wx.getStorageSync('learningProgress') || {};
    const localMastery = wx.getStorageSync('wordMastery') || {};

    // 【V2.0 语义级智能合并】逐字段比较：reviewCount取最大、lastReviewTime取最新、mastered逻辑或等
    const normalizedLocalStudents = (localStudents || []).map(normalizeStudentForMerge);
    const normalizedCloudStudents = (cloudStudents || []).map(normalizeStudentForMerge);

    const mergedStudents = mergeById(normalizedLocalStudents, normalizedCloudStudents, 'student_id');
    const mergedRecords = mergeById(localRecords, cloudRecords, 'id');

    console.log('[cloud-sync] 拉取详情: students 云端=' + cloudStudents.length + ' 本地=' + localStudents.length +
      ' | learning_records 云端=' + cloudRecords.length + ' 本地=' + localRecords.length +
      ' | progress 云端=' + Object.keys(cloudProgress).length + ' 本地=' + Object.keys(localProgress).length +
      ' | mastery 云端=' + Object.keys(cloudMastery).length + ' 本地=' + Object.keys(localMastery).length);

    let mergedProgress, mergedMastery;
    try {
      mergedProgress = mergeObjectAtWordLevel(localProgress, cloudProgress);
    } catch (e) {
      console.error('[cloud-sync] mergeProgress 失败:', e);
      mergedProgress = localProgress;
    }
    try {
      mergedMastery = mergeObjectAtWordLevel(localMastery, cloudMastery);
    } catch (e) {
      console.error('[cloud-sync] mergeMastery 失败:', e);
      mergedMastery = localMastery;
    }

    console.log('[cloud-sync] 合并后: students=' + mergedStudents.length +
      ' | learning_records=' + mergedRecords.length +
      ' | progress=' + Object.keys(mergedProgress || {}).length +
      ' | mastery=' + Object.keys(mergedMastery || {}).length);

    // 安全日志：记录本次合入概况
    console.log('[cloud-sync] 语义合并完成 | students 本地' + localStudents.length + '→合并' + mergedStudents.length +
      ' | wordMastery 本地' + Object.keys(localMastery).length + '→合并' + Object.keys(mergedMastery).length +
      ' | 策略=语义级（进度只进不退）');

    wx.setStorageSync('students', mergedStudents);
    wx.setStorageSync('learningRecords', mergedRecords);
    wx.setStorageSync('learningProgress', mergedProgress);
    wx.setStorageSync('wordMastery', mergedMastery);

    // ★ 处理云端统计数据（管理员修正 + 自动计算）
    // 策略：云端值 > 本地值时采用云端值，否则保留本地（保证只进不退）
    try {
      const allStudentIds = new Set();
      (mergedStudents || []).forEach(s => {
        const sid = String(s.id || s.student_id || '').trim();
        if (sid) allStudentIds.add(sid);
      });
      Object.keys(mergedMastery || {}).forEach(sid => allStudentIds.add(String(sid)));

      // 收集云端统计（含手动修正和自动计算）
      const cloudStats = {};
      (statsDocs || []).forEach(doc => {
        const sid = String(doc.student_id || doc._id || '').trim();
        if (!sid) return;
        cloudStats[sid] = {
          masteredCount: Number(doc.masteredCount || 0),
          notMasteredCount: Number(doc.notMasteredCount || 0),
          checkinDays: Number(doc.checkinDays || 0),
          calculatedAt: doc.calculatedAt || Date.now(),
          isManualOverride: doc.isManualOverride === true
        };
      });

      allStudentIds.forEach(sid => {
        const cloud = cloudStats[sid];
        if (!cloud) {
          // 云端无数据 → 清除本地缓存，从 wordMastery 重新计算
          try { wx.removeStorageSync(sid + '_stats'); } catch (e) { /* ignore */ }
          try { wx.removeStorageSync('stats_' + sid); } catch (e) { /* ignore */ }
          return;
        }

        // 云端有数据 → 与本地取 max（保证只进不退）
        const localKey = 'stats_' + sid;
        let local = null;
        try { local = wx.getStorageSync(localKey) || null; } catch (e) { /* ignore */ }

        const finalMastered = local
          ? Math.max(Number(local.masteredCount || 0), cloud.masteredCount)
          : cloud.masteredCount;
        const finalNotMastered = local
          ? Math.max(Number(local.notMasteredCount || 0), cloud.notMasteredCount)
          : cloud.notMasteredCount;
        const finalCheckin = local
          ? Math.max(Number(local.checkinDays || 0), cloud.checkinDays)
          : cloud.checkinDays;

        // 保留 isManualOverride 标记（云端或本地任一为 true 则保留）
        const isManual = cloud.isManualOverride || (local && local.isManualOverride);

        wx.setStorageSync(localKey, {
          masteredCount: finalMastered,
          notMasteredCount: finalNotMastered,
          checkinDays: finalCheckin,
          calculatedAt: Date.now(),
          isManualOverride: isManual
        });

        // 同时清除旧版缓存
        try { wx.removeStorageSync(sid + '_stats'); } catch (e) { /* ignore */ }
      });

      console.log('[cloud-sync] 统计数据同步完成, 云端记录:', Object.keys(cloudStats).length,
        '个学生, 手动修正:', Object.values(cloudStats).filter(s => s.isManualOverride).length, '个');
    } catch (statsError) {
      console.warn('[cloud-sync] 处理云端统计失败:', statsError);
    }

    // 触发全局事件，通知所有页面数据已更新
    try {
      const app = getApp();
      if (app && app.emit) {
        app.emit('wordMasteryUpdated');
        app.emit('learningRecordAdded');
      }
    } catch (emitError) {
      // ignore
    }

    return {
      success: true,
      counts: {
        students: mergedStudents.length,
        learningRecords: mergedRecords.length,
        learningProgress: Object.keys(mergedProgress).length,
        wordMastery: Object.keys(mergedMastery).length
      }
    };
  } catch (error) {
    console.error('[cloud-migration] pull failed:', error);
    return { error: error && error.message ? error.message : 'unknown_error' };
  }
};

const migrateLocalDataToCloud = async (options = {}) => {
  try {
    if (!options.force && wx.getStorageSync('hasMigratedToCloud')) {
      console.log('[cloud-migration] already migrated, skip');
      return { skipped: true };
    }

    if (!wx.cloud) {
      wx.showToast({
        title: '云环境不可用',
        icon: 'none'
      });
      return { error: 'wx_cloud_unavailable' };
    }

    // 兜底 init：确保云环境已就绪（idempotent）
    try {
      wx.cloud.init({
        env: DEFAULT_ENV,
        traceUser: true
      });
    } catch (reinitError) {
      console.warn('[cloud-migration] migrate: wx.cloud.init() 兜底调用失败（非阻塞）:', reinitError);
    }

    const openid = wx.getStorageSync('openid');
    if (!openid) {
      wx.showToast({
        title: '缺少用户标识',
        icon: 'none'
      });
      return { error: 'missing_openid' };
    }

    const db = wx.cloud.database({
      env: DEFAULT_ENV
    });

    await ensureTeacher(db, openid);

    // 【权限基座-静默升级】迁移时同步教师权限字段到本地
    try {
      const teacherProfile = await db.collection('teachers').where({ teacher_id: openid }).limit(1).get();
      if (teacherProfile && Array.isArray(teacherProfile.data) && teacherProfile.data.length > 0) {
        const cloudTeacher = teacherProfile.data[0];
        const app = getApp();
        const normalizedUser = (typeof app.ensureUserPermissions === 'function')
          ? app.ensureUserPermissions({
              id: openid,
              username: openid,
              name: cloudTeacher.name || '教师',
              userRole: cloudTeacher.userRole || 'external',
              memberLevel: cloudTeacher.memberLevel || 'free'
            })
          : {
              id: openid,
              username: openid,
              name: cloudTeacher.name || '教师',
              userRole: cloudTeacher.userRole || 'external',
              memberLevel: cloudTeacher.memberLevel || 'free'
            };
        wx.setStorageSync('currentUser', normalizedUser);
        if (app.globalData) {
          app.globalData.currentUser = normalizedUser;
        }
        console.log('[Permission] migrateLocalDataToCloud: 教师权限字段已同步到本地');
      }
    } catch (permSyncError) {
      console.warn('[Permission] migrateLocalDataToCloud: 权限同步到本地失败（非阻塞）:', permSyncError);
    }

    const students = Array.isArray(wx.getStorageSync('students'))
      ? wx.getStorageSync('students')
      : [];
    const learningRecords = Array.isArray(wx.getStorageSync('learningRecords'))
      ? wx.getStorageSync('learningRecords')
      : [];
    const learningProgress = wx.getStorageSync('learningProgress') || {};
    const wordMastery = wx.getStorageSync('wordMastery') || {};

    // ★ 委托 cloud-sync 统一写路径，确保文档 ID 与增量同步一致

    // 1) students：保持原逻辑（无独立 sync 函数，但 doc ID 与 add-student.js 一致）
    const studentDocs = students.map((student) => {
      const studentId = student && student.id !== undefined && student.id !== null
        ? String(student.id)
        : '';
        const cleanedStudent = stripMeta(student);

      return {
        docId: studentId,
        data: {
          teacher_id: openid,
          student_id: studentId,
            ...cleanedStudent
        }
      };
    });

    await runBatches(studentDocs, MAX_CONCURRENCY, async (doc) => {
      const collection = db.collection('students');
      if (doc.docId) {
        return collection.doc(doc.docId).set({ data: doc.data });
      }
      return collection.add({ data: doc.data });
    }, 'students');

    // 2) learning_records：委托 syncLearningRecord（统一 scoped doc ID）
    let recordSynced = 0;
    for (let i = 0; i < learningRecords.length; i++) {
      try {
        await syncLearningRecord(learningRecords[i]);
        recordSynced++;
      } catch (e) {
        console.warn('[cloud-migration] learning_record 同步失败:', i, e);
      }
    }
    console.log('[cloud-migration] learning_records:', recordSynced, '/', learningRecords.length);

    // 3) learning_progress：委托 syncLearningProgress（统一 scoped doc ID）
    const progressStudentIds = Object.keys(learningProgress).filter(function(sid) {
      var sp = learningProgress[sid];
      return sp && typeof sp === 'object' && !Array.isArray(sp);
    });
    for (let i = 0; i < progressStudentIds.length; i++) {
      var sid = progressStudentIds[i];
      try {
        await syncLearningProgress(sid, learningProgress[sid]);
      } catch (e) {
        console.warn('[cloud-migration] learning_progress 同步失败:', sid, e);
      }
    }
    console.log('[cloud-migration] learning_progress:', progressStudentIds.length);

    // 4) word_mastery：委托 syncWordMasteryBatch（统一 scoped doc ID）
    const masteryStudentIds = Object.keys(wordMastery).filter(function(sid) {
      var sm = wordMastery[sid];
      return sm && typeof sm === 'object' && !Array.isArray(sm);
    });
    for (let i = 0; i < masteryStudentIds.length; i++) {
      var msid = masteryStudentIds[i];
      var studentMastery = wordMastery[msid] || {};
      var wbIds = Object.keys(studentMastery).filter(function(wid) {
        return studentMastery[wid] && typeof studentMastery[wid] === 'object' && !Array.isArray(studentMastery[wid]);
      });
      for (var j = 0; j < wbIds.length; j++) {
        var wbid = wbIds[j];
        try {
          await syncWordMasteryBatch(msid, wbid, studentMastery[wbid]);
        } catch (e) {
          console.warn('[cloud-migration] word_mastery 同步失败:', msid, wbid, e);
        }
      }
    }
    console.log('[cloud-migration] word_mastery:', masteryStudentIds.length, 'students');

    wx.setStorageSync('hasMigratedToCloud', true);
    wx.showToast({
      title: '数据上云成功',
      icon: 'success',
      duration: 2000
    });

    return {
      success: true,
      counts: {
        students: studentDocs.length,
        learningRecords: learningRecords.length,
        learningProgress: progressStudentIds.length,
        wordMastery: masteryStudentIds.length
      }
    };
  } catch (error) {
    console.error('[cloud-migration] failed:', error);
    wx.showToast({
      title: '数据迁移失败',
      icon: 'none'
    });
    return { error: error && error.message ? error.message : 'unknown_error' };
  }
};

module.exports = {
  migrateLocalDataToCloud,
  syncDataFromCloud,
  // 导出语义合并工具，供 safe-merge-restore.js 等复用
  mergeObjectAtWordLevel,
  mergeWordMasteryRecord,
  mergeLearningProgressRecord,
  isWordMasteryRecord,
  isLearningProgressRecord
};