# Implementation plan

- [x] 1. Confirm rollback point and baseline
  - Preserve `980d6f3` and unrelated workspace changes.
  - Confirm all 34 existing checks pass.
  - _Requirements: R9, R10_

- [x] 2. Audit existing backup and startup ordering
  - Confirm version initialization precedes splash cloud synchronization.
  - Inventory fixed, dynamic, and pending-sync storage keys.
  - Record existing import/export and fail-open defects.
  - _Requirements: R1, R2, R3, R8_

- [x] 3. Add upgrade-protection regression tests
  - Cover unversioned legacy data, complete snapshot, checksum verification, owner isolation, rollback, and export/import parity.
  - _Requirements: R1-R8, R10_

- [x] 4. Implement the backup service and fail-closed migration
  - Add verified persistent snapshots and legacy-envelope compatibility.
  - Convert migration to validate before commit and rollback on write failure.
  - Block cloud startup when protection is not complete.
  - _Requirements: R1-R7_

- [x] 5. Unify the backup page with the protected import/export path
  - Export the new envelope and import both new and historical formats.
  - Report actual student, record, mastery, progress, anti-forgetting, preview, and pending counts.
  - _Requirements: R2, R6-R8_

- [x] 6. Run combined release regression
  - Run Node, syntax, compile, page, cold-start, isolation, and real-device checks.
  - Confirm no writes outside `张张张123` test students.
  - Node 38/38, page contract 19/19, modified-file syntax checks, and `git diff --check` pass.
  - WeChat DevTools native preview compile passes with main package 1,541,225 bytes and total package 1,774,769 bytes.
  - Real-device cold-start preview confirmed: initial cloud pull can briefly show no selectable student, then test student data appears; the backup prompt was one-time and did not recur after reinstall/rescan.
  - _Requirements: R9, R10_

- [ ] 7. Commit, push, and prepare one combined release candidate
  - Keep the sync and upgrade-protection fixes in the same release lineage.
  - Do not upload until all gates pass.
  - _Requirements: R10_
