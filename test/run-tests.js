'use strict';

const childProcess = require('child_process');
const path = require('path');

const projectPath = path.resolve(__dirname, '..');
const tests = [
  'test/page-contract.test.js',
  'test/record-display.test.js',
  'test/learning-context.test.js',
  'test/learning-progress.test.js',
  'test/app-learning-progress.test.js',
  'test/cloud-wordbook-loading.test.js',
  'test/cloud-read-only.test.js',
  'test/sync-merge.test.js',
  'test/cloud-learning-record-retry.test.js',
  'test/cloud-sync-isolation.test.js',
  'test/login-sync-order.test.js',
  'test/stats-consistency.test.js',
  'test/cloud-pull-statistics.test.js',
  'test/page-stat-consistency.test.js',
  'test/anti-forgetting-filter.test.js',
  'test/preview-anti-forgetting-source.test.js',
  'test/home-anti-forgetting-source.test.js',
  'test/review-page-generation.test.js',
  'test/review-result-persistence.test.js',
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
