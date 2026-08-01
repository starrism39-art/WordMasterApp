# Release-safe legacy upgrade requirements

## Scope

The cross-client synchronization fixes and the legacy-data protection changes ship in one Mini Program release. The new client must protect old local data before any migration or cloud synchronization can mutate it.

## Requirements

### R1. Pre-upgrade snapshot

When a client has existing local learning data and its data version is missing or older than the current schema version, the application shall create and verify a complete local snapshot before changing data or starting cloud synchronization.

### R2. Complete recoverable data set

The snapshot shall include students, wordbooks, learning records, learning progress, word mastery, anti-forgetting data, current selections, complete preview/review/grid state, migration markers, and every pending synchronization queue.

### R3. Fail closed

If snapshot creation, snapshot verification, compatibility conversion, or post-conversion validation fails, the application shall keep the old data, mark upgrade protection as blocked, and prohibit cloud pull, migration, retry, and write operations until a later launch succeeds.

### R4. Non-destructive compatibility

When legacy data is valid but uses an older supported shape, the application shall normalize it without deleting newer fields or replacing recoverable records with empty arrays or objects.

### R5. Automatic rollback

If a write fails after compatibility conversion begins, the application shall attempt to restore the exact pre-upgrade local snapshot and shall remain cloud-read-only/blocked even when rollback succeeds.

### R6. Teacher isolation

When a backup is exported or imported, the application shall bind the backup to the current teacher identity. A backup explicitly owned by another teacher shall be rejected before any local data is changed.

### R7. Backward-compatible restore

The application shall accept both historical raw backup objects and the new versioned backup envelope, while generating only the new envelope format for future exports.

### R8. Import/export parity

When the application exports a backup and imports that same file under the same teacher identity, all supported data sections shall be recognized and safely merged without requiring manual JSON restructuring.

### R9. Release safety boundary

The protection flow shall not enumerate, modify, migrate, or delete CloudBase records belonging to other teachers. Verification writes shall use only students under teacher `张张张123`.

### R10. Joint release acceptance

Before upload, the combined client shall pass legacy-unversioned, versioned-upgrade, snapshot-failure, migration-failure, rollback, foreign-owner rejection, export/import round-trip, pending-queue preservation, normal cold-start synchronization, and cross-client page consistency tests.

## Non-goals

- No production-wide CloudBase batch migration.
- No deletion or cleanup of historical user data.
- No requirement for users to manually back up before receiving the release.
