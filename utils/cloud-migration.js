const DEFAULT_ENV = 'cloudbase-4gafzdch60ad597b';
const DEFAULT_TEACHER_NAME = 'Default Teacher';
const MAX_CONCURRENCY = 5;
// Mini Program client database queries return at most 20 documents per request.
// Keep the requested page size aligned with that cap so skip offsets stay contiguous.
const MAX_QUERY_LIMIT = 20;
const BATCH_DELAY_MS = 800;
const FULL_PULL_READ_CONCURRENCY = 2;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 带指数退避的重试包装器，用于处理 CloudBase 限流错误 (-405015)
 */
const withRetry = async (fn, label, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const errMsg = (error && (error.message || error.errMsg || '')) || '';
      const isRateLimit = errMsg.includes('exceed max client request count') ||
        errMsg.includes('-405015') ||
        errMsg.includes('rate limit');
      const backoff = isRateLimit ? 5000 * attempt : 1000 * attempt;
      console.warn(`[cloud-migration] ${label} 第${attempt}次重试，等待${backoff}ms:`, errMsg);
      await delay(backoff);
    }
  }
};

// ★ 委托 cloud-sync 统一写路径，确保文档 ID 一致
const {
  syncLearningRecord,
  syncWordMasteryBatch,
  syncLearningProgress
} = require('./cloud-sync.js');
const { reconcileLearningProgressMap } = require('./learning-progress.js');
const { createCloudReadOnlyResult, isCloudReadOnlyMode } = require('./cloud-mode.js');
const { restoreCurrentContextFromSyncedData } = require('./learning-context.js');
const {
  mergeById,
  mergeWordMasteryRecord,
  toTimestamp
} = require('./sync-merge.js');

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

const runBoundedReadTasks = async (tasks, concurrency = FULL_PULL_READ_CONCURRENCY) => {
  const results = {};
  let nextIndex = 0;
  let requiredReadFailed = false;
  const workerCount = Math.min(Math.max(1, concurrency), tasks.length);

  const worker = async () => {
    while (!requiredReadFailed && nextIndex < tasks.length) {
      const taskIndex = nextIndex;
      nextIndex += 1;
      const task = tasks[taskIndex];
      try {
        results[task.key] = {
          ok: true,
          value: await task.read()
        };
      } catch (error) {
        results[task.key] = {
          ok: false,
          error
        };
        if (task.required) {
          requiredReadFailed = true;
        }
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
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
    await Promise.all(batch.map(item => withRetry(() => worker(item), label)));
    processed += batch.length;
    console.log(`[cloud-migration] ${label}: ${processed}/${items.length}`);
    // 节流：每批之间延迟 BATCH_DELAY_MS，避免触发 CloudBase 请求限流
    if (i < batches.length - 1) {
      await delay(BATCH_DELAY_MS);
    }
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
  const countResult = await withRetry(
    () => collection.where({ teacher_id: openid }).count(),
    `${collectionName}.count`
  );
  const total = countResult && typeof countResult.total === 'number' ? countResult.total : 0;
  const items = [];

  for (let offset = 0; offset < total; offset += limit) {
    const batch = await withRetry(
      () => {
        const query = collection.where({ teacher_id: openid });
        const orderedQuery = query && typeof query.orderBy === 'function'
          ? query.orderBy('_id', 'asc')
          : query;
        return orderedQuery.skip(offset).limit(limit).get();
      },
      `${collectionName}.page`
    );
    if (batch && Array.isArray(batch.data)) {
      items.push(...batch.data);
    }
  }

  return items;
};

const compareCloudDocumentIdentity = (left, right) => {
  const leftId = String((left && left._id) || '');
  const rightId = String((right && right._id) || '');
  if (leftId < rightId) return -1;
  if (leftId > rightId) return 1;
  return 0;
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

  await teachersRef.add({
    data: {
      teacher_id: openid,
      openid: openid,
      name: DEFAULT_TEACHER_NAME,
      userRole: 'external',
      memberLevel: 'free',
      createdAt: db.serverDate ? db.serverDate() : new Date()
    }
  });

  return { created: true, userRole: 'external', memberLevel: 'free' };
};

const readTeacher = async (db, openid) => {
  const existing = await db.collection('teachers').where({
    teacher_id: openid
  }).limit(1).get();
  const teacherDoc = existing && Array.isArray(existing.data) ? existing.data[0] : null;
  return {
    created: false,
    userRole: (teacherDoc && teacherDoc.userRole) || 'external',
    memberLevel: (teacherDoc && teacherDoc.memberLevel) || 'free'
  };
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
  let duplicateCount = 0;
  (Array.isArray(docs) ? docs.slice().sort(compareCloudDocumentIdentity) : []).forEach((doc) => {
    const studentId = String(doc.student_id || doc.studentId || doc._id || '').trim();
    if (!studentId) {
      return;
    }
    const cleaned = stripMeta(doc, ['student_id', 'studentId']);
    const normalized = {
      ...cleaned,
      learnedWords: Number(cleaned.learnedWords || 0) || 0,
      totalWords: Number(cleaned.totalWords || 0) || 0,
      wordbooks: normalizeObject(cleaned.wordbooks)
    };
    if (!map[studentId]) {
      map[studentId] = normalized;
      return;
    }

    duplicateCount++;
    const existing = map[studentId];
    const existingWordbooks = normalizeObject(existing.wordbooks);
    const candidateWordbooks = normalizeObject(normalized.wordbooks);
    const mergedWordbooks = {};
    const wordbookIds = new Set([
      ...Object.keys(existingWordbooks),
      ...Object.keys(candidateWordbooks)
    ]);
    wordbookIds.forEach((wordbookId) => {
      const existingBook = existingWordbooks[wordbookId];
      const candidateBook = candidateWordbooks[wordbookId];
      if (existingBook && candidateBook) {
        mergedWordbooks[wordbookId] = mergeLearningProgressRecord(
          existingBook,
          candidateBook
        );
      } else {
        mergedWordbooks[wordbookId] = existingBook || candidateBook;
      }
    });

    const existingTime = toTimestamp(existing.updatedAt)
      || toTimestamp(existing.lastUpdated)
      || 0;
    const candidateTime = toTimestamp(normalized.updatedAt)
      || toTimestamp(normalized.lastUpdated)
      || 0;
    const winner = candidateTime >= existingTime ? normalized : existing;
    const loser = candidateTime >= existingTime ? existing : normalized;
    map[studentId] = {
      ...loser,
      ...winner,
      learnedWords: Math.max(
        Number(existing.learnedWords || 0) || 0,
        Number(normalized.learnedWords || 0) || 0
      ),
      totalWords: Math.max(
        Number(existing.totalWords || 0) || 0,
        Number(normalized.totalWords || 0) || 0
      ),
      wordbooks: mergedWordbooks
    };
  });
  if (duplicateCount > 0) {
    console.warn('[cloud-sync] merged duplicate learning_progress documents:', duplicateCount);
  }
  return map;
};

const buildWordMasteryMap = (docs) => {
  const map = {};
  let duplicateCount = 0;
  (Array.isArray(docs) ? docs.slice().sort(compareCloudDocumentIdentity) : []).forEach((doc) => {
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
    const normalized = mergeWordMasteryRecord({}, stripMeta(doc, [
      'student_id',
      'studentId',
      'wordbook_id',
      'wordbookId',
      'word_id',
      'wordId'
    ]));
    const existing = map[studentId][wordbookId][wordId];
    if (existing) {
      duplicateCount++;
      map[studentId][wordbookId][wordId] = mergeWordMasteryRecord(
        existing,
        normalized
      );
    } else {
      map[studentId][wordbookId][wordId] = normalized;
    }
  });
  if (duplicateCount > 0) {
    console.warn('[cloud-sync] merged duplicate word_mastery documents:', duplicateCount);
  }
  return map;
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

const performFullPull = async (openid, requestSession) => {
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

    const { isAccountSessionCurrent } = require('./account-session.js');
    const staleResult = () => ({
      success: false,
      stale: true,
      reason: 'account_session_changed'
    });

    const db = wx.cloud.database({ env: DEFAULT_ENV });

    // 开发者工具只读模式仅查询教师权限，不创建或升级真实云端记录。
    const teacherResult = isCloudReadOnlyMode()
      ? await readTeacher(db, openid)
      : await ensureTeacher(db, openid);
    if (!isAccountSessionCurrent(requestSession)) {
      console.warn('[cloud-migration] stale account session after teacher read; local commit skipped');
      return staleResult();
    }
    if (teacherResult.userRole) {
      try {
        const app = getApp();
        const normalizedUser = app.ensureUserPermissions({
          id: openid,
          username: openid,
          userRole: teacherResult.userRole,
          memberLevel: teacherResult.memberLevel
        });
        wx.setStorageSync('currentUser', normalizedUser);
        if (app.globalData) {
          app.globalData.currentUser = normalizedUser;
        }
        console.log('[Permission] syncDataFromCloud: 教师权限字段已同步到本地, userRole:', teacherResult.userRole);
      } catch (permSyncError) {
        console.warn('[Permission] syncDataFromCloud: 权限同步到本地失败（非阻塞）:', permSyncError);
      }
    }

    const readResults = await runBoundedReadTasks([
      { key: 'students', required: true, read: () => fetchAllByTeacher(db, 'students', openid) },
      { key: 'records', required: true, read: () => fetchAllByTeacher(db, 'learning_records', openid) },
      { key: 'progress', required: true, read: () => fetchAllByTeacher(db, 'learning_progress', openid) },
      { key: 'mastery', required: true, read: () => fetchAllByTeacher(db, 'word_mastery', openid) },
      { key: 'studentStats', read: () => fetchAllByTeacher(db, 'student_statistics', openid) },
      { key: 'wordbookStats', read: () => fetchAllByTeacher(db, 'wordbook_statistics', openid) }
    ]);

    const requireCoreRead = (key) => {
      const result = readResults[key];
      if (!result || !result.ok) {
        throw result && result.error ? result.error : new Error(`missing cloud read result: ${key}`);
      }
      return result.value;
    };

    const studentsDocs = requireCoreRead('students');
    const recordDocs = requireCoreRead('records');
    const progressDocs = requireCoreRead('progress');
    const masteryDocs = requireCoreRead('mastery');

    // ★ 拉取云端手动修正的统计数据（管理员可覆盖）
    const statsResult = readResults.studentStats;
    const statsFetchSucceeded = !!(statsResult && statsResult.ok);
    const statsDocs = statsFetchSucceeded ? statsResult.value : [];
    if (!statsFetchSucceeded) {
      console.warn('[cloud-sync] 拉取 student_statistics 失败（非阻塞）:', statsResult && statsResult.error);
    }

    const wordbookStatsResult = readResults.wordbookStats;
    const wordbookStatsFetchSucceeded = !!(wordbookStatsResult && wordbookStatsResult.ok);
    const wordbookStatsDocs = wordbookStatsFetchSucceeded ? wordbookStatsResult.value : [];
    if (!wordbookStatsFetchSucceeded) {
      console.warn(
        '[cloud-sync] 拉取 wordbook_statistics 失败（非阻塞）:',
        wordbookStatsResult && wordbookStatsResult.error
      );
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
      // 云查询已经按 teacher_id 严格隔离；恢复本地归属字段，供首页按当前教师筛选学生。
      cleaned.ownerId = String(openid);
      cleaned.ownerUsername = String(openid);
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

    // Cloud reads may finish naturally, but a request from an invalidated account
    // session must not observe or mutate the current account's local state.
    if (!isAccountSessionCurrent(requestSession)) {
      console.warn('[cloud-migration] stale account session after cloud pull; local commit skipped');
      return staleResult();
    }

    // ---- 智能合并：本地数据 + 云端数据，本地未同步的条目不丢失 ----
    const localStudents = Array.isArray(wx.getStorageSync('students')) ? wx.getStorageSync('students') : [];
    const localRecords = Array.isArray(wx.getStorageSync('learningRecords')) ? wx.getStorageSync('learningRecords') : [];
    const localProgress = wx.getStorageSync('learningProgress') || {};
    const localMastery = wx.getStorageSync('wordMastery') || {};

    // 【V2.1 状态安全合并】按整条记录版本选择状态，避免逐字段 max/or 拼出不存在的组合
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

    try {
      mergedProgress = reconcileLearningProgressMap(mergedProgress, mergedMastery, mergedRecords);
    } catch (e) {
      console.error('[cloud-sync] 根据原始明细重算学习进度失败，保留合并结果:', e);
    }

    console.log('[cloud-sync] 合并后: students=' + mergedStudents.length +
      ' | learning_records=' + mergedRecords.length +
      ' | progress=' + Object.keys(mergedProgress || {}).length +
      ' | mastery=' + Object.keys(mergedMastery || {}).length);

    // 安全日志：记录本次合入概况
    console.log('[cloud-sync] 语义合并完成 | students 本地' + localStudents.length + '→合并' + mergedStudents.length +
      ' | wordMastery 本地' + Object.keys(localMastery).length + '→合并' + Object.keys(mergedMastery).length +
      ' | 策略=原始记录语义合并，派生进度按单词去重重算');

    wx.setStorageSync('students', mergedStudents);
    wx.setStorageSync('learningRecords', mergedRecords);
    wx.setStorageSync('learningProgress', mergedProgress);
    wx.setStorageSync('wordMastery', mergedMastery);

    // 新客户端没有 currentStudent/currentWordbook 本地缓存。
    // 在云数据全部落地后，按最近一次有效学习活动只恢复本地上下文，绝不写云。
    let restoredContext = null;
    try {
      restoredContext = restoreCurrentContextFromSyncedData(getApp(), {
        students: mergedStudents,
        learningRecords: mergedRecords,
        learningProgress: mergedProgress,
        wordMastery: mergedMastery
      });
      console.log('[cloud-sync] 学习上下文恢复结果:', {
        restored: restoredContext.restored,
        reason: restoredContext.reason,
        studentId: restoredContext.student && restoredContext.student.id,
        wordbookId: restoredContext.wordbook && restoredContext.wordbook.id
      });
    } catch (contextError) {
      console.warn('[cloud-sync] 恢复学习上下文失败（非阻塞）:', contextError);
    }

    // ★ 统计缓存只由已合并的原始明细派生；云端仅提供显式管理员修正。
    try {
      const {
        applyManualStatsOverride,
        calculateStudentCoreStats,
        calculateWordbookStats
      } = require('./stats-engine.js');
      const allStudentIds = new Set();
      (mergedStudents || []).forEach(s => {
        const sid = String(s.id || s.student_id || '').trim();
        if (sid) allStudentIds.add(sid);
      });
      Object.keys(mergedMastery || {}).forEach(sid => allStudentIds.add(String(sid)));

      const selectStatsDocument = (existing, candidate) => {
        if (!existing) return candidate;
        const existingManual = existing.isManualOverride === true;
        const candidateManual = candidate.isManualOverride === true;
        if (candidateManual && !existingManual) return candidate;
        if (existingManual && !candidateManual) return existing;
        const existingTime = toTimestamp(existing.updatedAt) || toTimestamp(existing.calculatedAt);
        const candidateTime = toTimestamp(candidate.updatedAt) || toTimestamp(candidate.calculatedAt);
        return candidateTime >= existingTime ? candidate : existing;
      };

      const cloudStats = {};
      (statsDocs || []).forEach(doc => {
        const sid = String(doc.student_id || doc._id || '').trim();
        if (!sid) return;
        cloudStats[sid] = selectStatsDocument(cloudStats[sid], doc);
        allStudentIds.add(sid);
      });

      allStudentIds.forEach(sid => {
        const cloud = cloudStats[sid];
        const localKey = 'stats_' + sid;
        const local = wx.getStorageSync(localKey) || null;
        const rawStats = calculateStudentCoreStats(sid);
        // 云端有明确记录时以它决定是否保留/清除手动修正；无记录时保留本地旧修正。
        const override = cloud
          ? (cloud.isManualOverride === true ? cloud : null)
          : (local && local.isManualOverride === true ? local : null);
        const finalStats = applyManualStatsOverride(rawStats, override);
        const payload = {
          ...finalStats,
          calculatedAt: Date.now(),
          isManualOverride: !!override
        };
        if (override) {
          [
            'manualMasteredCount', 'manualNotMasteredCount', 'manualCheckinDays',
            'baseMasteredCount', 'baseNotMasteredCount', 'baseCheckinDays'
          ].forEach((field) => {
            if (override[field] !== undefined && Number.isFinite(Number(override[field]))) {
              payload[field] = Number(override[field]);
            }
          });
        }
        wx.setStorageSync(localKey, payload);

        // 同时清除旧版缓存
        try { wx.removeStorageSync(sid + '_stats'); } catch (e) { /* ignore */ }
      });

      const cloudWordbookStats = {};
      (wordbookStatsDocs || []).forEach((doc) => {
        const sid = String(doc.student_id || '').trim();
        const wid = String(doc.wordbook_id || '').trim();
        if (!sid || !wid) return;
        const key = `${sid}|${wid}`;
        cloudWordbookStats[key] = selectStatsDocument(cloudWordbookStats[key], doc);
      });
      Object.keys(cloudWordbookStats).forEach((scopeKey) => {
        const doc = cloudWordbookStats[scopeKey];
        const sid = String(doc.student_id);
        const wid = String(doc.wordbook_id);
        const localKey = `wordbook_stats_${sid}_${wid}`;
        if (doc.isManualOverride !== true) {
          wx.removeStorageSync(localKey);
          return;
        }
        const rawStats = calculateWordbookStats(sid, wid);
        const finalStats = applyManualStatsOverride(rawStats, doc);
        const payload = {
          ...finalStats,
          isManualOverride: true,
          calculatedAt: Date.now()
        };
        [
          'manualMasteredCount', 'manualNotMasteredCount', 'manualCheckinDays',
          'baseMasteredCount', 'baseNotMasteredCount', 'baseCheckinDays'
        ].forEach((field) => {
          if (doc[field] !== undefined && Number.isFinite(Number(doc[field]))) {
            payload[field] = Number(doc[field]);
          }
        });
        wx.setStorageSync(localKey, payload);
      });

      console.log('[cloud-sync] 统计数据同步完成:', {
        studentStatsFetchSucceeded: statsFetchSucceeded,
        studentStats: Object.keys(cloudStats).length,
        wordbookStatsFetchSucceeded,
        wordbookStats: Object.keys(cloudWordbookStats).length
      });
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
      },
      // 仅供本次启动判断“启动前本地缓存是否已经被云端覆盖”。
      // 返回的是当前教师查询得到的原始云端快照，不会落盘，也不会触发写入。
      cloudSnapshot: {
        students: cloudStudents,
        learningRecords: cloudRecords,
        learningProgress: cloudProgress,
        wordMastery: cloudMastery
      },
      context: restoredContext
        ? {
          restored: restoredContext.restored,
          reason: restoredContext.reason,
          studentId: restoredContext.student && restoredContext.student.id,
          wordbookId: restoredContext.wordbook && restoredContext.wordbook.id
        }
        : null
    };
  } catch (error) {
    console.error('[cloud-migration] pull failed:', error);
    return { error: error && error.message ? error.message : 'unknown_error' };
  }
};

// Only pending full pulls are shared. Successful results are removed
// immediately, so freshness remains a separate 4C-2 concern.
const fullPullFlights = new Map();

const syncDataFromCloud = (openid) => {
  const requestedAccountId = String(openid || '').trim();
  if (!requestedAccountId) {
    return performFullPull(requestedAccountId, null);
  }

  const { captureAccountSession } = require('./account-session.js');
  const requestSession = captureAccountSession(requestedAccountId);
  const flightKey = JSON.stringify([
    requestSession.accountId,
    requestSession.generation
  ]);
  const existingFlight = fullPullFlights.get(flightKey);
  if (existingFlight) {
    return existingFlight.promise;
  }

  const flight = {
    accountId: requestSession.accountId,
    generation: requestSession.generation,
    promise: null
  };
  flight.promise = Promise.resolve()
    .then(() => performFullPull(requestedAccountId, requestSession))
    .finally(() => {
      // An old generation may settle after a newer one was registered.
      // It may only remove its own still-current map entry.
      if (fullPullFlights.get(flightKey) === flight) {
        fullPullFlights.delete(flightKey);
      }
    });
  fullPullFlights.set(flightKey, flight);
  return flight.promise;
};

const getLocalOwnerId = (value) => String(
  (value && (value.teacher_id || value.teacherId || value.ownerId || value.ownerUsername)) || ''
).trim();

const getLocalStudentId = (value) => String(
  (value && (value.student_id || value.studentId || value.id)) || ''
).trim();

const selectLocalDataForMigration = (openid, source) => {
  const normalizedOpenId = String(openid || '').trim();
  const allStudents = Array.isArray(source.students) ? source.students : [];
  const students = allStudents.filter((student) => {
    const ownerId = getLocalOwnerId(student);
    return !ownerId || ownerId === normalizedOpenId;
  });
  const allowedStudentIds = new Set(students.map(getLocalStudentId).filter(Boolean));

  const learningRecords = (Array.isArray(source.learningRecords) ? source.learningRecords : [])
    .filter((record) => {
      const ownerId = getLocalOwnerId(record);
      if (ownerId && ownerId !== normalizedOpenId) return false;
      return allowedStudentIds.has(getLocalStudentId(record));
    });

  const filterStudentMap = (value) => {
    const result = {};
    const map = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    Object.keys(map).forEach((studentId) => {
      if (allowedStudentIds.has(String(studentId))) result[studentId] = map[studentId];
    });
    return result;
  };

  return {
    students,
    learningRecords,
    learningProgress: filterStudentMap(source.learningProgress),
    wordMastery: filterStudentMap(source.wordMastery),
    skippedForeignStudents: allStudents.length - students.length
  };
};

const migrateLocalDataToCloud = async (options = {}) => {
  const suppressToast = options && options.suppressToast === true;
  const requestedAccountId = String(options && options.accountId || '').trim();
  const accountSession = options && options.accountSession;
  const hasAccountScopedDecision = !!(
    requestedAccountId ||
    (accountSession && String(accountSession.accountId || '').trim())
  );
  const { isAccountSessionCurrent } = require('./account-session.js');
  const workflowIsCurrent = () => !accountSession || isAccountSessionCurrent(accountSession);
  if (isCloudReadOnlyMode()) {
    console.log('[cloud-migration] 只读模式：跳过本地数据上云');
    return createCloudReadOnlyResult('migrateLocalDataToCloud');
  }

  try {
    // Account-scoped callers have already made the migration decision. The
    // ownerless legacy boolean must not override that decision for another account.
    if (!hasAccountScopedDecision && wx.getStorageSync('hasMigratedToCloud')) {
      console.log('[cloud-migration] already migrated, skip');
      return { skipped: true };
    }

    if (!wx.cloud) {
      wx.showToast({
        title: 'wx.cloud unavailable',
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

    const openid = requestedAccountId || wx.getStorageSync('openid');
    if (!openid) {
      wx.showToast({
        title: 'Missing openid',
        icon: 'none'
      });
      return { error: 'missing_openid' };
    }
    if (!workflowIsCurrent()) {
      return { skipped: true, reason: 'account_session_changed' };
    }

    const db = wx.cloud.database({
      env: DEFAULT_ENV
    });

    await ensureTeacher(db, openid);
    if (!workflowIsCurrent()) {
      return { skipped: true, reason: 'account_session_changed' };
    }

    // 【权限基座-静默升级】迁移时同步教师权限字段到本地
    try {
      const teacherProfile = await db.collection('teachers').where({ teacher_id: openid }).limit(1).get();
      if (teacherProfile && Array.isArray(teacherProfile.data) && teacherProfile.data.length > 0) {
        if (!workflowIsCurrent()) return { skipped: true, reason: 'account_session_changed' };
        const cloudTeacher = teacherProfile.data[0];
        const app = getApp();
        const normalizedUser = app.ensureUserPermissions({
          id: openid,
          username: openid,
          name: cloudTeacher.name || '教师',
          userRole: cloudTeacher.userRole || 'external',
          memberLevel: cloudTeacher.memberLevel || 'free'
        });
        wx.setStorageSync('currentUser', normalizedUser);
        if (app.globalData) {
          app.globalData.currentUser = normalizedUser;
        }
        console.log('[Permission] migrateLocalDataToCloud: 教师权限字段已同步到本地');
      }
    } catch (permSyncError) {
      console.warn('[Permission] migrateLocalDataToCloud: 权限同步到本地失败（非阻塞）:', permSyncError);
    }
    if (!workflowIsCurrent()) {
      return { skipped: true, reason: 'account_session_changed' };
    }

    const selectedLocalData = selectLocalDataForMigration(openid, {
      students: wx.getStorageSync('students'),
      learningRecords: wx.getStorageSync('learningRecords'),
      learningProgress: wx.getStorageSync('learningProgress'),
      wordMastery: wx.getStorageSync('wordMastery')
    });
    const students = selectedLocalData.students;
    const learningRecords = selectedLocalData.learningRecords;
    const learningProgress = selectedLocalData.learningProgress;
    const wordMastery = selectedLocalData.wordMastery;
    if (selectedLocalData.skippedForeignStudents > 0) {
      console.warn('[cloud-migration] skipped foreign-owned local students:', selectedLocalData.skippedForeignStudents);
    }

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
          ...cleanedStudent,
          teacher_id: openid,
          student_id: studentId
        }
      };
    });

    const validStudentDocs = studentDocs.filter((doc) => !!doc.docId);
    let studentSynced = 0;
    let studentFailed = studentDocs.length - validStudentDocs.length;
    if (studentFailed > 0) {
      console.warn('[cloud-migration] 跳过缺少稳定 studentId 的学生记录:', studentFailed);
    }
    try {
      studentSynced = await runBatches(validStudentDocs, MAX_CONCURRENCY, async (doc) => {
        return db.collection('students').doc(doc.docId).set({ data: doc.data });
      }, 'students');
    } catch (error) {
      studentFailed += validStudentDocs.length;
      studentSynced = 0;
      console.warn('[cloud-migration] students 同步未完整完成，将保留迁移重试机会:', error);
    }

    // 2) learning_records：委托 syncLearningRecord（统一 scoped doc ID）
    let recordSynced = 0;
    let recordFailed = 0;
    for (let i = 0; i < learningRecords.length; i++) {
      try {
        if (!workflowIsCurrent()) return { skipped: true, reason: 'account_session_changed' };
        const result = await syncLearningRecord(learningRecords[i], { accountId: openid, accountSession });
        if (result && result.ok === true && !result.error) {
          recordSynced++;
        } else {
          recordFailed++;
          console.warn('[cloud-migration] learning_record 返回未成功:', i, result);
        }
      } catch (e) {
        recordFailed++;
        console.warn('[cloud-migration] learning_record 同步失败:', i, e);
      }
    }
    console.log('[cloud-migration] learning_records:', recordSynced, '/', learningRecords.length);

    // 3) learning_progress：委托 syncLearningProgress（统一 scoped doc ID）
    const progressStudentIds = Object.keys(learningProgress).filter(function(sid) {
      var sp = learningProgress[sid];
      return sp && typeof sp === 'object' && !Array.isArray(sp);
    });
    let progressSynced = 0;
    let progressFailed = 0;
    for (let i = 0; i < progressStudentIds.length; i++) {
      var sid = progressStudentIds[i];
      try {
        if (!workflowIsCurrent()) return { skipped: true, reason: 'account_session_changed' };
        const result = await syncLearningProgress(sid, learningProgress[sid], { accountId: openid, accountSession });
        if (result && result.ok === true && !result.error) {
          progressSynced++;
        } else {
          progressFailed++;
          console.warn('[cloud-migration] learning_progress 返回未成功:', sid, result);
        }
      } catch (e) {
        progressFailed++;
        console.warn('[cloud-migration] learning_progress 同步失败:', sid, e);
      }
    }
    console.log('[cloud-migration] learning_progress:', progressSynced, '/', progressStudentIds.length);

    // 4) word_mastery：委托 syncWordMasteryBatch（统一 scoped doc ID）
    const masteryStudentIds = Object.keys(wordMastery).filter(function(sid) {
      var sm = wordMastery[sid];
      return sm && typeof sm === 'object' && !Array.isArray(sm);
    });
    let masteryStudentsSynced = 0;
    let masteryWordsSynced = 0;
    let masteryWordsFailed = 0;
    let masteryWordsTotal = 0;
    for (let i = 0; i < masteryStudentIds.length; i++) {
      var msid = masteryStudentIds[i];
      var studentMastery = wordMastery[msid] || {};
      var wbIds = Object.keys(studentMastery).filter(function(wid) {
        return studentMastery[wid] && typeof studentMastery[wid] === 'object' && !Array.isArray(studentMastery[wid]);
      });
      let currentStudentFailed = 0;
      for (var j = 0; j < wbIds.length; j++) {
        var wbid = wbIds[j];
        const wordCount = Object.keys(studentMastery[wbid]).length;
        masteryWordsTotal += wordCount;
        try {
          if (!workflowIsCurrent()) return { skipped: true, reason: 'account_session_changed' };
          const result = await syncWordMasteryBatch(msid, wbid, studentMastery[wbid], { accountId: openid, accountSession });
          if (result && typeof result.failed === 'number') {
            const failedCount = Math.max(0, Math.min(wordCount, result.failed));
            masteryWordsFailed += failedCount;
            currentStudentFailed += failedCount;
            masteryWordsSynced += wordCount - failedCount;
          } else if (result && result.ok === true && !result.error) {
            masteryWordsSynced += wordCount;
          } else if (wordCount > 0) {
            masteryWordsFailed += wordCount;
            currentStudentFailed += wordCount;
            console.warn('[cloud-migration] word_mastery 返回未成功:', msid, wbid, result);
          }
        } catch (e) {
          masteryWordsFailed += wordCount;
          currentStudentFailed += wordCount;
          console.warn('[cloud-migration] word_mastery 同步失败:', msid, wbid, e);
        }
      }
      if (currentStudentFailed === 0) {
        masteryStudentsSynced++;
      }
    }
    console.log('[cloud-migration] word_mastery:', masteryWordsSynced, '/', masteryWordsTotal, 'words');

    const counts = {
      students: studentSynced,
      learningRecords: recordSynced,
      learningProgress: progressSynced,
      wordMastery: masteryStudentsSynced,
      wordMasteryWords: masteryWordsSynced
    };
    const totals = {
      students: studentDocs.length,
      learningRecords: learningRecords.length,
      learningProgress: progressStudentIds.length,
      wordMastery: masteryStudentIds.length,
      wordMasteryWords: masteryWordsTotal
    };
    const failures = {
      students: studentFailed,
      learningRecords: recordFailed,
      learningProgress: progressFailed,
      wordMasteryWords: masteryWordsFailed
    };
    const totalFailures = Object.keys(failures).reduce((sum, key) => sum + failures[key], 0);

    if (totalFailures > 0) {
      if (!suppressToast) {
        wx.showToast({
          title: '部分数据待同步',
          icon: 'none',
          duration: 2500
        });
      }
      return {
        success: false,
        partial: true,
        reason: 'partial_sync_failed',
        counts,
        totals,
        failures
      };
    }

    if (!workflowIsCurrent()) {
      return { skipped: true, reason: 'account_session_changed' };
    }
    wx.setStorageSync('hasMigratedToCloud', true);
    if (!suppressToast) {
      wx.showToast({
        title: '数据上云成功',
        icon: 'success',
        duration: 2000
      });
    }

    return {
      success: true,
      counts,
      totals,
      failures
    };
  } catch (error) {
    console.error('[cloud-migration] failed:', error);
    wx.showToast({
      title: 'Migration failed',
      icon: 'none'
    });
    return { error: error && error.message ? error.message : 'unknown_error' };
  }
};

module.exports = {
  migrateLocalDataToCloud,
  syncDataFromCloud,
  buildProgressMap,
  buildWordMasteryMap,
  // 导出语义合并工具，供 safe-merge-restore.js 等复用
  mergeObjectAtWordLevel,
  mergeWordMasteryRecord,
  mergeLearningProgressRecord,
  isWordMasteryRecord,
  isLearningProgressRecord
};
