'use strict';

const assert = require('assert');

let pageDefinition = null;
const storage = {};
const app = { globalData: {} };
const cloudOps = [];
const toastTitles = [];
let navigateBackCount = 0;
const originalSetTimeout = global.setTimeout;

global.setTimeout = (fn) => {
  fn();
  return 0;
};

global.Page = function(definition) {
  pageDefinition = definition;
};

global.getApp = function() {
  return app;
};

function makeCollection(name) {
  return {
    doc(id) {
      return {
        async update(payload) {
          cloudOps.push({ type: 'update', collection: name, id, data: payload && payload.data });
          return { updated: 1 };
        },
        async set(payload) {
          cloudOps.push({ type: 'set', collection: name, id, data: payload && payload.data });
          return { _id: id };
        }
      };
    },
    where(query) {
      return {
        _limit: 20,
        _skip: 0,
        limit(value) {
          this._limit = value;
          return this;
        },
        skip(value) {
          this._skip = value;
          return this;
        },
        async get() {
          if (name === 'teachers') {
            return { data: [] };
          }
          if (name === 'students') {
            return { data: [] };
          }
          if (query.teacher_id === 'teacher-openid' && query.student_id === 'student456' && this._skip === 0) {
            return { data: [{ _id: `${name}-doc-1` }] };
          }
          return { data: [] };
        }
      };
    }
  };
}

global.wx = {
  cloud: {
    database() {
      return {
        collection: makeCollection
      };
    }
  },
  getStorageSync(key) {
    return storage[key];
  },
  setStorageSync(key, value) {
    storage[key] = value;
  },
  removeStorageSync(key) {
    delete storage[key];
  },
  showToast(options) {
    toastTitles.push(options && options.title);
  },
  showLoading() {},
  hideLoading() {},
  navigateBack() {
    navigateBackCount++;
  }
};

const cloudModePath = require.resolve('../utils/cloud-mode.js');
require.cache[cloudModePath] = {
  id: cloudModePath,
  filename: cloudModePath,
  loaded: true,
  exports: {
    isCloudReadOnlyMode: () => false
  }
};

require('../subpages/add-student/add-student.js');

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
  const originalStudent = {
    id: 'student456',
    student_id: 'student456',
    name: '张三',
    grade: '高一',
    joinDate: '2026-01-02',
    teacher_id: 'teacher-openid',
    createdAt: '2026-01-02T00:00:00.000Z'
  };
  const otherStudent = {
    id: 'student789',
    name: '王五',
    grade: '初一',
    teacher_id: 'teacher-openid'
  };
  storage.openid = 'teacher-openid';
  storage.students = [originalStudent, otherStudent];
  storage.currentStudent = originalStudent;
  storage.selectedStudent = originalStudent;
  app.globalData.currentStudent = originalStudent;

  const page = createPage();
  page.onLoad({ id: 'student456' });
  await flushPromises();

  assert.strictEqual(page.data.editMode, true);
  assert.strictEqual(page.data.editingStudentId, 'student456');
  assert.strictEqual(page.data.name, '张三');
  assert.strictEqual(page.data.grade, '高一');

  page.inputName({ detail: { value: '李雷' } });
  page.changeGrade({ detail: { value: 10 } });
  await page.addStudent();

  const updatedStudent = storage.students.find(student => student.id === 'student456');
  assert.strictEqual(updatedStudent.name, '李雷');
  assert.strictEqual(updatedStudent.grade, '高二');
  assert.strictEqual(updatedStudent.student_id, 'student456');
  assert.strictEqual(storage.currentStudent.name, '李雷');
  assert.strictEqual(storage.selectedStudent.grade, '高二');
  assert.strictEqual(app.globalData.currentStudent.name, '李雷');

  const primaryUpdate = cloudOps.find(op => op.collection === 'students' && op.id === 'student456');
  assert(primaryUpdate, 'student edit must update the cloud students document');
  assert.deepStrictEqual(
    {
      name: primaryUpdate.data.name,
      grade: primaryUpdate.data.grade,
      teacher_id: primaryUpdate.data.teacher_id,
      student_id: primaryUpdate.data.student_id
    },
    {
      name: '李雷',
      grade: '高二',
      teacher_id: 'teacher-openid',
      student_id: 'student456'
    }
  );

  ['word_mastery', 'learning_records', 'learning_progress', 'student_statistics'].forEach((collection) => {
    const cascadeUpdate = cloudOps.find(op => op.collection === collection);
    assert(cascadeUpdate, `${collection} should receive student_name cascade`);
    assert.strictEqual(cascadeUpdate.data.student_name, '李雷');
  });

  assert(toastTitles.includes('保存成功'));
  assert.strictEqual(navigateBackCount, 1);
  assert.strictEqual(
    cloudOps.filter(op => op.collection === 'students' && op.type === 'set').length,
    0,
    'existing cloud student should be updated without creating a replacement document'
  );

  global.setTimeout = originalSetTimeout;
  console.log('student-edit: PASS');
}

run().catch(error => {
  global.setTimeout = originalSetTimeout;
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
