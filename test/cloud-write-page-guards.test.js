'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

const guardedFiles = [
  'pages/login/login.js',
  'pages/students/students.js',
  'subpages/add-student/add-student.js',
  'subpages/data-repair/data-repair.js',
  'subpages/records/records.js',
  'subpages/student-list/student-list.js'
];

guardedFiles.forEach((relativePath) => {
  const source = read(relativePath);
  assert(
    source.includes("require('../../utils/cloud-mode.js')"),
    `${relativePath} must import the shared cloud mode guard`
  );
  assert(
    source.includes('isCloudReadOnlyMode()'),
    `${relativePath} must check cloud read-only mode before direct writes`
  );
});

const loginSource = read('pages/login/login.js');
assert(
  /if \(isCloudReadOnlyMode\(\)\)[\s\S]*?skip createTeacherRecord[\s\S]*?return;[\s\S]*?teachersCollection\.add/.test(loginSource),
  'teacher creation must return before teachersCollection.add in read-only mode'
);

const studentsSource = read('pages/students/students.js');
assert(
  studentsSource.includes('openid && wx.cloud && !isCloudReadOnlyMode()'),
  'nickname cascade must require writable cloud mode'
);
assert(
  studentsSource.includes('backupJson.length < 800000 && !isCloudReadOnlyMode()'),
  'cloud backup must require writable cloud mode'
);

const addStudentSource = read('subpages/add-student/add-student.js');
assert(
  addStudentSource.includes('if (wx.cloud && !isCloudReadOnlyMode())'),
  'student creation must skip its cloud write in read-only mode'
);

const repairSource = read('subpages/data-repair/data-repair.js');
assert(
  /repairCloudStudentNames:[\s\S]*?if \(isCloudReadOnlyMode\(\)\)[\s\S]*?return;[\s\S]*?\.update\(/.test(repairSource),
  'cloud repair must return before its first update in read-only mode'
);

const recordsSource = read('subpages/records/records.js');
assert(
  /const hasCloud = !!\([\s\S]*?!isCloudReadOnlyMode\(\)[\s\S]*?\);[\s\S]*?if \(hasCloud\)[\s\S]*?\.remove\(/.test(recordsSource),
  'learning record deletion must gate cloud remove behind writable mode'
);

const studentListSource = read('subpages/student-list/student-list.js');
assert(
  /if \(openid && wx\.cloud && !isCloudReadOnlyMode\(\)\)[\s\S]*?\.remove\(/.test(studentListSource),
  'student deletion must gate cloud remove behind writable mode'
);

process.stdout.write('cloud-write-page-guards: PASS\n');
