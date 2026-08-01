'use strict';

const assert = require('assert');

const storage = {};
global.wx = {
  getStorageSync(key) {
    return storage[key];
  },
  setStorageSync(key, value) {
    storage[key] = value;
  }
};

const emitted = [];
const app = {
  globalData: {},
  emit(name, payload) {
    emitted.push({ name, payload });
  }
};

const {
  restoreCurrentContextFromSyncedData,
  setCurrentStudent,
  setCurrentWordbook
} = require('../utils/learning-context.js');

function clearContext() {
  Object.keys(storage).forEach((key) => delete storage[key]);
  Object.keys(app.globalData).forEach((key) => delete app.globalData[key]);
  emitted.length = 0;
}

const students = [
  { id: 'student-old', student_id: 'student-old', name: '旧学生' },
  {
    id: 'student_1785337316821',
    student_id: 'student_1785337316821',
    name: 'E2E-CROSS-CLIENT-ONLY'
  }
];
const records = [
  {
    id: '1000',
    studentId: 'student-old',
    wordbookId: 'junior_textbook_real',
    wordbookTitle: '初中统编版英语词书',
    timestamp: 1000
  },
  {
    id: '1785338395652',
    studentId: 'student_1785337316821',
    wordbookId: 'senior_textbook_real',
    wordbookTitle: '高中统编版英语词书',
    timestamp: 1785338395733
  }
];

clearContext();
const restored = restoreCurrentContextFromSyncedData(app, {
  students,
  learningRecords: records
});

assert.strictEqual(restored.restored, true);
assert.strictEqual(restored.reason, 'restored_from_recent_activity');
assert.strictEqual(restored.student.id, 'student_1785337316821');
assert.strictEqual(restored.wordbook.id, 'senior_textbook_real');
assert.strictEqual(restored.wordbook.title, '高中统编版英语词书');
assert.strictEqual(storage.currentStudent.id, 'student_1785337316821');
assert.strictEqual(storage.selectedStudent.id, 'student_1785337316821');
assert.strictEqual(storage.currentWordbook.id, 'senior_textbook_real');
assert.strictEqual(storage.selectedWordbook.id, 'senior_textbook_real');
assert.strictEqual(storage.currentWordbookStudentId, 'student_1785337316821');
assert.strictEqual(
  storage.studentSettings.student_student_1785337316821_wordbook.id,
  'senior_textbook_real'
);
assert.strictEqual(emitted.length, 0, '云拉取恢复上下文不能触发用户操作型事件');

clearContext();
const existingStudent = setCurrentStudent(app, students[0], { emit: false });
setCurrentWordbook(app, existingStudent, {
  id: 'junior_textbook_real',
  title: '初中统编版英语词书'
}, { emit: false });

const preserved = restoreCurrentContextFromSyncedData(app, {
  students,
  learningRecords: records
});

assert.strictEqual(preserved.restored, false);
assert.strictEqual(preserved.student.id, 'student-old');
assert.strictEqual(preserved.wordbook.id, 'junior_textbook_real');
assert.strictEqual(storage.currentStudent.id, 'student-old');
assert.strictEqual(storage.currentWordbook.id, 'junior_textbook_real');

clearContext();
storage.currentStudent = { id: 'removed-student', name: '已删除学生' };
storage.selectedStudent = storage.currentStudent;
app.globalData.currentStudent = storage.currentStudent;

const staleReplaced = restoreCurrentContextFromSyncedData(app, {
  students,
  learningRecords: records
});

assert.strictEqual(staleReplaced.restored, true);
assert.strictEqual(staleReplaced.student.id, 'student_1785337316821');
assert.strictEqual(staleReplaced.wordbook.id, 'senior_textbook_real');

process.stdout.write('cross-client-context-restore: PASS\n');
