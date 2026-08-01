'use strict';

function readStorage(key, fallbackValue) {
  try {
    const value = wx.getStorageSync(key);
    return value === undefined || value === null || value === '' ? fallbackValue : value;
  } catch (error) {
    console.warn(`[learning-context] 读取 ${key} 失败:`, error);
    return fallbackValue;
  }
}

function getStudentWordbookKey(studentId) {
  return `student_${String(studentId || '')}_wordbook`;
}

function toWordbookSelection(wordbook) {
  if (!wordbook || typeof wordbook !== 'object' || !wordbook.id) return null;
  const { words, ...metadata } = wordbook;
  return {
    ...metadata,
    id: String(wordbook.id),
    title: wordbook.title || wordbook.name || '未命名词书'
  };
}

function resolveCurrentStudent(app) {
  const globalStudent = app && app.globalData && app.globalData.currentStudent;
  return globalStudent || readStorage('currentStudent', null) || readStorage('selectedStudent', null);
}

function resolveScopedWordbook(studentId) {
  if (studentId !== undefined && studentId !== null && studentId !== '') {
    const storedSettings = readStorage('studentSettings', {});
    const studentSettings = storedSettings && typeof storedSettings === 'object' && !Array.isArray(storedSettings)
      ? storedSettings
      : {};
    let scopedWordbook = studentSettings[getStudentWordbookKey(studentId)] || null;

    if (!scopedWordbook) {
      const pageState = readStorage(`${studentId}_pageState`, null);
      scopedWordbook = pageState && pageState.currentWordbook;
    }
    return toWordbookSelection(scopedWordbook);
  }
  return null;
}

function resolveCurrentWordbook(app, student) {
  const currentStudent = student || resolveCurrentStudent(app);
  const studentId = currentStudent && (currentStudent.id || currentStudent.student_id);
  const scopedWordbook = resolveScopedWordbook(studentId);
  if (scopedWordbook) return scopedWordbook;

  const globalData = app && app.globalData ? app.globalData : {};
  const ownerStudentId = globalData.currentWordbookStudentId ||
    readStorage('currentWordbookStudentId', '');
  const allowLegacyFallback = !studentId ||
    !ownerStudentId ||
    String(ownerStudentId) === String(studentId);
  if (!allowLegacyFallback) return null;

  const candidates = [
    globalData.currentWordbook,
    globalData.selectedWordbook,
    readStorage('currentWordbook', null),
    readStorage('selectedWordbook', null)
  ];

  for (const candidate of candidates) {
    const selection = toWordbookSelection(candidate);
    if (selection) return selection;
  }

  return null;
}

function setCurrentStudent(app, student, options) {
  if (!student || typeof student !== 'object') return null;
  const rawStudentId = student.id || student.student_id;
  if (rawStudentId === undefined || rawStudentId === null || rawStudentId === '') return null;

  const normalizedStudent = {
    ...student,
    id: String(rawStudentId)
  };
  wx.setStorageSync('currentStudent', normalizedStudent);
  wx.setStorageSync('selectedStudent', normalizedStudent);
  if (app && app.globalData) {
    app.globalData.currentStudent = normalizedStudent;
  }

  const scopedWordbook = resolveScopedWordbook(normalizedStudent.id);
  let selectedWordbook = null;
  if (scopedWordbook) {
    selectedWordbook = setCurrentWordbook(app, normalizedStudent, scopedWordbook, { emit: false });
  } else {
    // 保留旧全局缓存以兼容旧数据，但通过归属标记阻止它泄漏给新学生。
    const noSelectionOwner = `__none__:${normalizedStudent.id}`;
    wx.setStorageSync('currentWordbookStudentId', noSelectionOwner);
    if (app && app.globalData) {
      app.globalData.currentWordbook = null;
      app.globalData.selectedWordbook = null;
      app.globalData.currentWordbookStudentId = noSelectionOwner;
    }
  }

  const shouldEmit = !options || options.emit !== false;
  if (shouldEmit && app && typeof app.emit === 'function') {
    app.emit('currentStudentChanged', {
      studentId: normalizedStudent.id,
      student: normalizedStudent
    });
    app.emit('currentWordbookChanged', {
      studentId: normalizedStudent.id,
      wordbookId: selectedWordbook ? selectedWordbook.id : '',
      wordbook: selectedWordbook
    });
  }
  return normalizedStudent;
}

function setCurrentWordbook(app, student, wordbook, options) {
  const currentStudent = student || resolveCurrentStudent(app);
  const selection = toWordbookSelection(wordbook);
  if (!currentStudent || currentStudent.id === undefined || currentStudent.id === null || !selection) {
    return null;
  }

  const storedSettings = readStorage('studentSettings', {});
  const settings = storedSettings && typeof storedSettings === 'object' && !Array.isArray(storedSettings)
    ? { ...storedSettings }
    : {};
  settings[getStudentWordbookKey(currentStudent.id)] = selection;

  const pageStateKey = `${currentStudent.id}_pageState`;
  const storedPageState = readStorage(pageStateKey, {});
  const previousPageState = storedPageState && typeof storedPageState === 'object' && !Array.isArray(storedPageState)
    ? storedPageState
    : {};
  const nextPageState = {
    ...previousPageState,
    currentWordbook: selection,
    timestamp: Date.now()
  };

  wx.setStorageSync('studentSettings', settings);
  wx.setStorageSync(pageStateKey, nextPageState);
  wx.setStorageSync('selectedWordbook', selection);
  wx.setStorageSync('currentWordbook', selection);
  wx.setStorageSync('currentWordbookStudentId', String(currentStudent.id));

  if (app && app.globalData) {
    app.globalData.currentWordbook = selection;
    app.globalData.selectedWordbook = selection;
    app.globalData.currentWordbookStudentId = String(currentStudent.id);
  }

  const shouldEmit = !options || options.emit !== false;
  if (shouldEmit && app && typeof app.emit === 'function') {
    app.emit('currentWordbookChanged', {
      studentId: String(currentStudent.id),
      wordbookId: selection.id,
      wordbook: selection
    });
  }

  return selection;
}

function toActivityTimestamp(value) {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getRecordActivityTimestamp(record) {
  if (!record || typeof record !== 'object') return 0;
  const candidates = [
    record.timestamp,
    record.updatedAt,
    record.studyDate,
    record.createdAt,
    record.date,
    record.id
  ];
  for (const value of candidates) {
    const timestamp = toActivityTimestamp(value);
    if (timestamp > 0) return timestamp;
  }
  return 0;
}

function getRecordStudentId(record) {
  return String((record && (record.studentId || record.student_id)) || '').trim();
}

function getRecordWordbookId(record) {
  return String((record && (record.wordbookId || record.wordbook_id)) || '').trim();
}

function buildRecordWordbook(record) {
  const wordbookId = getRecordWordbookId(record);
  if (!wordbookId) return null;
  return {
    id: wordbookId,
    title: record.wordbookTitle || record.wordbookName || record.bookName || wordbookId
  };
}

/**
 * 新客户端完成云拉取后恢复本地学习上下文。
 *
 * 安全规则：
 * 1. 已存在且仍属于当前教师学生列表的选择必须保留；
 * 2. 仅在学生/词书缺失时，才按最近一条有效学习记录补齐；
 * 3. 只写当前客户端本地缓存，不写云端，也不修改同步下来的原始记录。
 */
function restoreCurrentContextFromSyncedData(app, options) {
  const source = options && typeof options === 'object' ? options : {};
  const students = Array.isArray(source.students) ? source.students.filter(Boolean) : [];
  const learningRecords = Array.isArray(source.learningRecords) ? source.learningRecords.filter(Boolean) : [];
  const studentsById = new Map();

  students.forEach((student) => {
    const studentId = String(student.id || student.student_id || '').trim();
    if (studentId) studentsById.set(studentId, { ...student, id: studentId });
  });

  const validRecords = learningRecords
    .map((record, index) => ({
      record,
      index,
      studentId: getRecordStudentId(record),
      wordbookId: getRecordWordbookId(record),
      timestamp: getRecordActivityTimestamp(record)
    }))
    .filter((entry) => (
      entry.studentId &&
      entry.wordbookId &&
      studentsById.has(entry.studentId)
    ))
    .sort((left, right) => (
      right.timestamp - left.timestamp ||
      right.index - left.index
    ));

  const existingStudent = resolveCurrentStudent(app);
  const existingStudentId = String(
    (existingStudent && (existingStudent.id || existingStudent.student_id)) || ''
  ).trim();
  const hasValidExistingStudent = !!(existingStudentId && studentsById.has(existingStudentId));
  const existingWordbook = hasValidExistingStudent
    ? resolveCurrentWordbook(app, existingStudent)
    : null;
  const latestRecord = validRecords[0] || null;

  let currentStudent = hasValidExistingStudent
    ? studentsById.get(existingStudentId)
    : (latestRecord ? studentsById.get(latestRecord.studentId) : null);

  if (!currentStudent && students.length === 1) {
    const onlyStudentId = String(students[0].id || students[0].student_id || '').trim();
    currentStudent = studentsById.get(onlyStudentId) || null;
  }

  if (!currentStudent) {
    return {
      restored: false,
      reason: 'no_unambiguous_student',
      student: null,
      wordbook: null
    };
  }

  const selectedStudent = setCurrentStudent(app, currentStudent, { emit: false });
  let currentWordbook = existingWordbook
    ? setCurrentWordbook(app, selectedStudent, existingWordbook, { emit: false })
    : null;

  if (!currentWordbook) {
    const studentRecord = validRecords.find((entry) => (
      entry.studentId === String(selectedStudent.id)
    ));
    if (studentRecord) {
      currentWordbook = setCurrentWordbook(
        app,
        selectedStudent,
        buildRecordWordbook(studentRecord.record),
        { emit: false }
      );
    }
  }

  return {
    restored: !hasValidExistingStudent || !existingWordbook,
    reason: hasValidExistingStudent
      ? (existingWordbook ? 'preserved_existing_context' : 'filled_missing_wordbook')
      : 'restored_from_recent_activity',
    student: selectedStudent,
    wordbook: currentWordbook || null
  };
}

function createLearningContextKey(student, wordbook) {
  const studentId = student && student.id !== undefined && student.id !== null ? String(student.id) : '';
  const wordbookId = wordbook && wordbook.id !== undefined && wordbook.id !== null ? String(wordbook.id) : '';
  return studentId && wordbookId ? `${studentId}|${wordbookId}` : '';
}

module.exports = {
  createLearningContextKey,
  getStudentWordbookKey,
  resolveCurrentStudent,
  resolveCurrentWordbook,
  restoreCurrentContextFromSyncedData,
  setCurrentStudent,
  setCurrentWordbook,
  toWordbookSelection
};
