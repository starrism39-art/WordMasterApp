'use strict';

const childProcess = require('child_process');
const path = require('path');

const projectPath = path.resolve(__dirname, '..');
const tests = [
  'test/page-contract.test.js',
  'test/record-display.test.js',
  'test/learning-progress.test.js',
  'test/app-learning-progress.test.js',
  'test/cloud-wordbook-loading.test.js',
  'test/test-cloud-sync.js'
];

for (const test of tests) {
  process.stdout.write(`\n> ${test}\n`);
  const result = childProcess.spawnSync(process.execPath, [test], {
    cwd: projectPath,
    stdio: 'inherit',
    windowsHide: true
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

process.stdout.write(`\nAll ${tests.length} local checks passed.\n`);
