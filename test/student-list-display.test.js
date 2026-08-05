'use strict';

const assert = require('assert');

let pageDefinition = null;
const storage = {};

global.Page = function(definition) {
  pageDefinition = definition;
};

global.getApp = function() {
  return { globalData: {} };
};

global.wx = {
  cloud: null,
  getStorageSync(key) {
    return storage[key];
  },
  setStorageSync(key, value) {
    storage[key] = value;
  },
  removeStorageSync(key) {
    delete storage[key];
  },
  getSystemInfoSync() {
    return { windowWidth: 375 };
  }
};

require('../subpages/student-list/student-list.js');

function makeStudent(index, overrides = {}) {
  return {
    id: `student-${index}`,
    name: `学生${index}`,
    grade: `年级${index}`,
    ...overrides
  };
}

function createPage() {
  return {
    ...pageDefinition,
    data: JSON.parse(JSON.stringify(pageDefinition.data)),
    setData(update) {
      this.data = {
        ...this.data,
        ...update
      };
    }
  };
}

const students = Array.from({ length: 35 }, (_, index) => makeStudent(index + 1));
students[0] = makeStudent(1, { name: '张三', grade: '一年级' });
students[1] = makeStudent(2, { name: '李四', grade: '张三年级' });
students[2] = makeStudent(3, { name: '张小明', grade: '二年级' });
storage.students = students;
storage.currentStudent = students[0];

const page = createPage();
page.loadStudents();

assert.strictEqual(page.data.students.length, 35);
assert.strictEqual(page.data.filteredStudents.length, 0, 'default view should not render every student');
assert.strictEqual(page.data.matchedStudentCount, 0);
assert.strictEqual(page.data.currentStudentId, 'student-1');

page.onSearch({ detail: { value: '张' } });
assert.deepStrictEqual(
  page.data.filteredStudents.map(student => student.name),
  ['张三', '张小明'],
  'search should match student names only'
);
assert.strictEqual(page.data.matchedStudentCount, 2);
assert.strictEqual(page.data.hasMoreStudents, false);

page.clearSearch();
assert.strictEqual(page.data.searchKey, '');
assert.strictEqual(page.data.showAllStudents, false);
assert.strictEqual(page.data.filteredStudents.length, 0);

page.showAllStudentsList();
assert.strictEqual(page.data.showAllStudents, true);
assert.strictEqual(page.data.filteredStudents.length, 30);
assert.strictEqual(page.data.matchedStudentCount, 35);
assert.strictEqual(page.data.hasMoreStudents, true);

page.loadMoreStudents();
assert.strictEqual(page.data.filteredStudents.length, 35);
assert.strictEqual(page.data.hasMoreStudents, false);

console.log('student-list-display: PASS');
