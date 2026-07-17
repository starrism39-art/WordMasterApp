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

function resolveCurrentWordbook(app, student) {
  const currentStudent = student || resolveCurrentStudent(app);
  const studentId = currentStudent && currentStudent.id;
  let scopedWordbook = null;

  if (studentId !== undefined && studentId !== null && studentId !== '') {
    const storedSettings = readStorage('studentSettings', {});
    const studentSettings = storedSettings && typeof storedSettings === 'object' && !Array.isArray(storedSettings)
      ? storedSettings
      : {};
    scopedWordbook = studentSettings[getStudentWordbookKey(studentId)] || null;

    if (!scopedWordbook) {
      const pageState = readStorage(`${studentId}_pageState`, null);
      scopedWordbook = pageState && pageState.currentWordbook;
    }
  }

  const globalData = app && app.globalData ? app.globalData : {};
  const candidates = [
    scopedWordbook,
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

  if (app && app.globalData) {
    app.globalData.currentWordbook = selection;
    app.globalData.selectedWordbook = selection;
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
  setCurrentWordbook,
  toWordbookSelection
};
