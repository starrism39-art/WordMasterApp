'use strict';

const childProcess = require('child_process');
const path = require('path');

const projectPath = path.resolve(__dirname, '..');
const tests = [
  'test/page-contract.test.js',
  'test/record-display.test.js',
  'test/learning-context.test.js',
  'test/cross-client-context-restore.test.js',
  'test/learning-word-ids.test.js',
  'test/preview-completed-filter.test.js',
  'test/preview-start-learning-flow.test.js',
  'test/preview-session-boundary.test.js',
  'test/learning-progress.test.js',
  'test/app-learning-progress.test.js',
  'test/cloud-wordbook-loading.test.js',
  'test/cloud-read-only.test.js',
  'test/cloud-write-page-guards.test.js',
  'test/sync-merge.test.js',
  'test/cloud-mastery-merge-parity.test.js',
  'test/sync-mastery-atom.test.js',
  'test/mastery-atom-routing.test.js',
  'test/cloud-duplicate-merge.test.js',
  'test/cross-client-convergence.test.js',
  'test/cloud-learning-record-retry.test.js',
  'test/migration-marker-isolation.test.js',
  'test/cloud-migration-result.test.js',
  'test/data-backup-protection.test.js',
  'test/data-migration-protection.test.js',
  'test/backup-import-export.test.js',
  'test/app-upgrade-protection.test.js',
  'test/mastery-sync-selection.test.js',
  'test/cloud-sync-isolation.test.js',
  'test/account-session-isolation.test.js',
  'test/login-sync-order.test.js',
  'test/startup-navigation-coordination.test.js',
  'test/startup-splash-session.test.js',
  'test/startup-sync-notice.test.js',
  'test/homepage-realtime-stats-dedup.test.js',
  'test/homepage-mastery-listener-lifecycle.test.js',
  'test/stats-consistency.test.js',
  'test/cloud-pull-statistics.test.js',
  'test/cloud-pull-pagination.test.js',
  'test/cloud-pull-success-throttle.test.js',
  'test/cloud-pull-bounded-concurrency.test.js',
  'test/full-pull-single-flight.test.js',
  'test/full-pull-freshness.test.js',
  'test/page-stat-consistency.test.js',
  'test/student-list-display.test.js',
  'test/student-edit.test.js',
  'test/anti-forgetting-filter.test.js',
  'test/preview-anti-forgetting-source.test.js',
  'test/home-anti-forgetting-source.test.js',
  'test/preview-state-sync-order.test.js',
  'test/preview-state-clear.test.js',
  'test/review-merged-lifecycle.test.js',
  'test/review-page-generation.test.js',
  'test/review-word-resolution.test.js',
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
