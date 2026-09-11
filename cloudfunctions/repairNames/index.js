// 云函数：repairNames
// 功能：从 students / teachers 集合获取正确姓名，补齐到所有缺名字的记录
// 修复范围：word_mastery, learning_records, learning_progress, student_statistics

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const BATCH_LIMIT = 100;

// Protected function configuration only. Missing/malformed configuration disables
// repair. Deploy this entry for native mini-program invocation only, never HTTP.
const REPAIR_COLLECTIONS = Object.freeze([
  'word_mastery', 'learning_records', 'learning_progress', 'student_statistics'
]);
// Native invocation includes these two metadata fields. Accept their presence
// but never read their contents for identity, collection selection or updates.
// Authorization remains exclusively based on getWXContext and protected config.
const REPAIR_REQUEST_FIELDS = Object.freeze([
  'collection', 'skip', 'maxRecords', 'tcbContext', 'userInfo'
]);
function authorizeRepair(event) {
  const caller = cloud.getWXContext();
  let admins;
  try { admins = JSON.parse(process.env.REPAIR_NAMES_ADMIN_OPENIDS || 'null'); }
  catch (_) { throw new Error('ADMIN_REQUIRED'); }
  if (!caller || caller.APPID !== 'wx930eccb9442dc8f3' ||
      typeof caller.OPENID !== 'string' || !caller.OPENID ||
      !Array.isArray(admins) || !admins.length ||
      !admins.every(id => typeof id === 'string' && id.trim() === id && id.length > 0) ||
      !admins.includes(caller.OPENID)) throw new Error('ADMIN_REQUIRED');
  const input = event === undefined ? {} : event;
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !REPAIR_REQUEST_FIELDS.includes(key))) {
    const error = new Error('INVALID_REPAIR_REQUEST');
    // Only reached after trusted administrator authentication. Bounded field
    // labels aid transport diagnosis; never return values or trust metadata.
    const isObject = input !== null && typeof input === 'object' && !Array.isArray(input);
    error.requestShape = {
      type: input === null ? 'null' : Array.isArray(input) ? 'array' : typeof input,
      hasUserInfo: isObject && Object.prototype.hasOwnProperty.call(input, 'userInfo'),
      unexpectedFieldCount: isObject
        ? Object.keys(input).filter(key => !REPAIR_REQUEST_FIELDS.includes(key)).length : 0,
      unexpectedFieldNames: isObject
        ? Object.keys(input).filter(key => !REPAIR_REQUEST_FIELDS.includes(key)).slice(0, 8)
          .map(key => /^[A-Za-z_$][A-Za-z0-9_$]{0,47}$/.test(key) &&
            !/openid|token|secret|password|credential|key/i.test(key) &&
            !/^o[A-Za-z0-9_-]{27}$/.test(key) ? key : '[redacted]') : []
    };
    throw error;
  }
  const collection = input.collection === undefined ? 'word_mastery' : input.collection;
  if (typeof collection !== 'string' || !REPAIR_COLLECTIONS.includes(collection)) {
    throw new Error('REPAIR_COLLECTION_NOT_ALLOWED');
  }
  for (const key of ['skip', 'maxRecords']) {
    if (input[key] !== undefined && (!Number.isSafeInteger(input[key]) || input[key] < 0)) {
      throw new Error('INVALID_REPAIR_REQUEST');
    }
  }
  return collection;
}

// ===== 分页获取全量 =====
async function fetchAll(collectionName, whereClause) {
  const all = [];
  let offset = 0;
  while (true) {
    const res = await db.collection(collectionName)
      .where(whereClause || {})
      .skip(offset)
      .limit(BATCH_LIMIT)
      .get();
    if (!res.data || res.data.length === 0) break;
    all.push(...res.data);
    if (res.data.length < BATCH_LIMIT) break;
    offset += BATCH_LIMIT;
  }
  return all;
}

// ===== 缺失检查（JS 侧判断，避免云数据库算子差异） =====
function isMissing(val) {
  return val === undefined || val === null || String(val).trim() === '';
}

// ===== 构建 student_id → student_name 映射 =====
async function buildStudentNameMap() {
  const students = await fetchAll('students');
  const map = {};
  students.forEach(function(s) {
    const sid = String(s.student_id || s._id || '').trim();
    if (sid && s.name && String(s.name).trim()) {
      map[sid] = String(s.name).trim();
    }
  });
  return map;
}

// ===== 构建 teacher_id → teacher_name 映射 =====
async function buildTeacherNameMap() {
  // 1) teachers 表里的名字
  const teachers = await fetchAll('teachers');
  const map = {};
  teachers.forEach(function(t) {
    const tid = String(t.teacher_id || t._id || '').trim();
    if (tid && t.name && String(t.name).trim()) {
      map[tid] = String(t.name).trim();
    }
  });

  // 2) students 表里的 teacher_name 兜底
  const students = await fetchAll('students');
  students.forEach(function(s) {
    const tid = String(s.teacher_id || '').trim();
    if (tid && s.teacher_name && String(s.teacher_name).trim() && !map[tid]) {
      map[tid] = String(s.teacher_name).trim();
    }
  });

  return map;
}

// ===== 主入口 =====
// 参数（可选）：
//   collection: 只修指定集合，不传则修全部
//   maxRecords: 单次最多处理多少条（默认 300，防止超时）
//   skip: 跳过前 N 条（用于分批续跑）
exports.main = async function(event, context) {
  let authorizedCollection;
  try { authorizedCollection = authorizeRepair(event); }
  catch (error) {
    return { success: false, error: error.message, results: {},
      ...(error.requestShape ? { requestShape: error.requestShape } : {}) };
  }
  const startTime = Date.now();
  const results = {};
  const MAX_PER_RUN = (event && event.maxRecords) || 50;
  const SKIP = (event && event.skip) || 0;

  try {
    console.log('===== repairNames 开始 (max=' + MAX_PER_RUN + ', skip=' + SKIP + ') =====');

    console.log('>>> 构建学生名映射...');
    const studentNameMap = await buildStudentNameMap();
    console.log('学生映射:', Object.keys(studentNameMap).length);

    console.log('>>> 构建老师名映射...');
    const teacherNameMap = await buildTeacherNameMap();
    console.log('老师映射:', Object.keys(teacherNameMap).length);

    // 确定要修的集合（默认只修 word_mastery，避免超时）
    var collections = [authorizedCollection];

    var totalFixed = 0;
    var nextInfo = {};

    for (var ci = 0; ci < collections.length; ci++) {
      // 检查剩余时间，不足 1 秒则跳过
      if (Date.now() - startTime > 2000) {
        console.log('>>> 剩余时间不足，跳过后续集合');
        break;
      }

      var col = collections[ci];
      console.log('>>> 修复 ' + col + ' ...');
      try {
        var res = await repairCollectionChunk(col, studentNameMap, teacherNameMap, 50, SKIP);
        results[col] = res;
        totalFixed += res.fixed;
        nextInfo[col] = { remaining: res.remaining, nextSkip: res.nextSkip };
        console.log('[' + col + '] 完成:', JSON.stringify(res));
      } catch (e) {
        results[col] = { error: e.message };
        console.error('[' + col + '] 异常:', e.message);
      }
    }

    var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('===== 本轮完成, 耗时', elapsed, 's, 修复', totalFixed, '条 =====');

    var response = {
      success: true,
      elapsed: elapsed + 's',
      totalFixed: totalFixed,
      results: results
    };

    // 给出续跑指引
    var hints = [];
    Object.keys(nextInfo).forEach(function(c) {
      if (nextInfo[c].remaining > 0) {
        hints.push(c + ': skip=' + nextInfo[c].nextSkip);
      }
    });
    if (hints.length > 0) {
      response.hint = '续跑参数: ' + hints.join('; ');
      response.nextSteps = hints;
    }

    return response;
  } catch (e) {
    return { success: false, error: e.message, results };
  }
};

// ===== 分段修复（自动循环，在超时前尽可能多跑） =====
async function repairCollectionChunk(collectionName, studentNameMap, teacherNameMap, limit, skip) {
  // 只查缺名字的记录
  var whereClause = db.command.or([
    { student_name: db.command.exists(false) },
    { student_name: '' },
    { student_name: null },
    { teacher_name: db.command.exists(false) },
    { teacher_name: '' },
    { teacher_name: null }
  ]);

  var allRecords;
  try {
    allRecords = await fetchAll(collectionName, whereClause);
  } catch (e) {
    console.warn('[' + collectionName + '] 条件查询失败，降级全量扫描:', e.message);
    allRecords = await fetchAll(collectionName);
  }

  console.log('[' + collectionName + '] 总量:', allRecords.length);

  var fixed = 0;
  var errors = 0;
  var skipped = 0;
  var processed = 0;
  var BATCH = 10;
  var DEADLINE = Date.now() + 2500; // 2.5 秒后必须退出

  // 自动循环，直到处理完或接近超时
  var idx = skip;
  while (idx < allRecords.length && Date.now() < DEADLINE) {
    var batchEnd = Math.min(idx + BATCH, allRecords.length);
    var batch = allRecords.slice(idx, batchEnd);

    var tasks = batch.map(function(rec) {
      var sid = String(rec.student_id || rec.studentId || '').trim();
      var tid = String(rec.teacher_id || '').trim();
      var updateData = {};

      if (sid && studentNameMap[sid] && isMissing(rec.student_name)) {
        updateData.student_name = studentNameMap[sid];
      }
      if (tid && teacherNameMap[tid] && isMissing(rec.teacher_name)) {
        updateData.teacher_name = teacherNameMap[tid];
      }

      if (Object.keys(updateData).length === 0) {
        skipped++;
        return Promise.resolve(0);
      }

      return db.collection(collectionName).doc(rec._id).update({ data: updateData })
        .then(function() { fixed++; return 1; })
        .catch(function(err) { errors++; console.warn('更新失败:', rec._id, err.message); return 0; });
    });

    await Promise.all(tasks);
    processed += batch.length;
    idx = batchEnd;

    if (processed % 100 === 0) {
      console.log('[' + collectionName + '] 已处理:', processed);
    }
  }

  var remaining = Math.max(0, allRecords.length - idx);
  var nextSkip = idx;
  console.log('[' + collectionName + '] 本段处理:', processed, '修复:', fixed, '剩余:', remaining, '下次skip:', nextSkip);

  return { total: allRecords.length, processed: processed, fixed: fixed, errors: errors, skipped: skipped, remaining: remaining, nextSkip: nextSkip };
}
