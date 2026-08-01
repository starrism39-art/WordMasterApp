# Release-safe legacy upgrade design

## Startup sequence

1. Detect whether meaningful local data exists.
2. If the stored schema version is missing or old, collect the complete protected key set.
3. Write a versioned backup envelope to the Mini Program persistent file area and read it back.
4. Verify schema, owner metadata, section manifest, and checksum.
5. Normalize supported legacy structures in memory and validate the result.
6. Apply the validated local changes; on any write failure, restore the exact snapshot.
7. Set the new data version only after every step succeeds.
8. Only then allow splash login and cloud synchronization.

## Components

- `utils/data-backup-service.js`: snapshot collection, dynamic-key discovery, stable checksum, persistent-file write/read, envelope normalization, owner validation, and exact local rollback.
- `utils/data-migration.js`: schema-version orchestration and compatibility conversion using the verified snapshot.
- `app.js`: converts protection errors into a global fail-closed flag and cloud read-only mode.
- `utils/login-service.js`: refuses to start cloud synchronization while upgrade protection is blocked.
- `subpages/data-backup/data-backup.js`: uses the same envelope parser and import path as automatic protection.

## Backup envelope

The generated envelope contains:

- `format`: stable format identifier.
- `schemaVersion`: backup-envelope version.
- `ownerId`: current teacher OPENID when available.
- `sourceDataVersion` and `targetDataVersion`.
- `createdAt` and `reason`.
- `manifest`: protected key names and per-section counts.
- `checksum`: checksum of the canonical serialized payload.
- `data`: exact protected local values.

Historical raw backup objects remain readable through an adapter.

## Failure behavior

- Snapshot failure: no local migration and no cloud login/sync.
- Conversion validation failure: no writes and no cloud login/sync.
- Partial local write failure: exact rollback attempt, then remain blocked.
- Foreign-owner import: reject before merge.
- Block state is retried on the next launch; success clears it.

## Data isolation

Automatic upgrade snapshots remain local to the device and never write CloudBase. Export/import checks explicit owner metadata. Existing cloud synchronization ownership guards remain the only path for later cloud writes.

## Testing

- Pure Node tests with mocked storage and file APIs cover all failure stages and legacy shapes.
- Existing sync and merge suites must remain green.
- WeChat DevTools validates cold start, backup page, current student/wordbook, pending queues, and page consistency.
- Real-device verification remains limited to `张张张123` test students.
