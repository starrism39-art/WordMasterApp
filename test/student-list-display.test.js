'use strict';

const assert = require('assert');

let pageDefinition = null;
const storage = {};
const app = { globalData: {} };
let resolveCloudRefresh = null;
const cloudRefreshPromise = new Promise(resolve => {
  resolveCloudRefresh = resolve;
});

global.Page = function(definition) {
  pageDefinition = definition;
};

global.getApp = function() {
  return app;
};

global.wx = {
  cloud: {},
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
  },
  showToast() {},
  switchTab() {}
};

function makeStudent(index, overrides = {}) {
  return {
    id: `student-${index}`,
    name: `学生${index}`,
    grade: `年级${index}`,
    ...overrides
  };
}

const cloudMigrationPath = require.resolve('../utils/cloud-migration.js');
require.cache[cloudMigrationPath] = {
  id: cloudMigrationPath,
  filename: cloudMigrationPath,
  loaded: true,
  exports: {
    async syncDataFromCloud() {
      await cloudRefreshPromise;
      storage.students = [
        makeStudent(3, { name: '张小明' }),
        makeStudent(2, { name: '李四' }),
        makeStudent(1, { name: '张三云端更新' })
      ];
    }
  }
};

require('../subpages/student-list/student-list.js');

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

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

async function run() {
  const students = Array.from({ length: 35 }, (_, index) => makeStudent(index + 1));
  students[0] = makeStudent(1, { name: '张三', grade: '一年级' });
  students[1] = makeStudent(2, { name: '李四', grade: '张三年级' });
  students[2] = makeStudent(3, { name: '张小明', grade: '二年级' });
  storage.students = students;
  storage.currentStudent = students[0];
  storage.openid = 'teacher-openid';

  const page = createPage();
  page.loadStudents();

  assert.strictEqual(page.data.students.length, 35);
  assert.strictEqual(page.data.filteredStudents.length, 0, 'default view should not render every student');
  assert.strictEqual(page.data.matchedStudentCount, 0);
  assert.strictEqual(page.data.currentStudentId, 'student-1');
  assert.strictEqual(page.data.isRefreshingStudents, true, 'cloud refresh should run behind the opened page');

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

  page.selectStudent({ currentTarget: { dataset: { id: 'student-3' } } });
  assert.strictEqual(storage.currentStudent.id, 'student-3');
  assert.strictEqual(storage.selectedStudent.id, 'student-3');
  assert.strictEqual(app.globalData.currentStudent.id, 'student-3');
  assert.strictEqual(page.data.currentStudentId, 'student-3');

  resolveCloudRefresh();
  await flushPromises();

  assert.strictEqual(page.data.isRefreshingStudents, false);
  assert.strictEqual(storage.currentStudent.id, 'student-3', 'cloud refresh must not overwrite the selected student');
  assert.strictEqual(storage.selectedStudent.id, 'student-3', 'selected student should remain stable after refresh');
  assert.strictEqual(app.globalData.currentStudent.id, 'student-3');
  assert.strictEqual(page.data.currentStudentId, 'student-3');

  const learningRecord = {
    studentId: storage.currentStudent.id,
    studentName: storage.currentStudent.name
  };
  assert.strictEqual(learningRecord.studentId, 'student-3', 'learning operations should write to the selected student id');

  console.log('student-list-display: PASS');
}

run().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
