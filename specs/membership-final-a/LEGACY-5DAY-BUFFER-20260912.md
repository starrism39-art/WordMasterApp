# LEGACY_5DAY_BUFFER_PASS — isolated development acceptance

Branch: codex/legacy-5day-buffer. Baseline: 267f512f37e0ddca75d5a090126b21e7f20389d9.
The assigned detached baseline 2baff47 had no membership implementation; this independent checkout was moved to the existing complete baseline without changing other tasks.

## Automatic eligibility

The existing teachers collection is the registration master used by utils/login-service.js ensureTeacherRecord and utils/cloud-migration.js. Enumerate every document in stable _id order, deduplicate teacher_id, and reject contradictory openid/_openid ownership. Do not use role, payment, student count, or client-written registration dates. No manual list is required.

A server-native administrator can invoke captureLegacyEligibility with an empty request. It requires allTeachersEnabled=false and the explicit server release gate MEMBERSHIP_LEGACY_CAPTURE=registration_quiesced. No client-provided teacher list or timestamp is accepted.

The sealed SHA256 identity set resides in the existing server-protected membership_migration_evidence collection under legacy_eligibility_release_v1. Only this document is written by capture: no teacher, student, ledger, access, grant, account, or timer writes. Publication is one atomic transaction. Concurrent/repeated calls return the winning immutable seal without adding later registrations. Failed commits leave no partially eligible cohort.

Production first-open eligibility reads this seal inside the ledger transaction. Missing/corrupt seals fail closed; the old ordinary-candidate roster and client timestamps are not runtime eligibility sources. The roster helper remains only for legacy offline preview compatibility.

Every eligible teacher records an idempotent personal transitionStartedAt on first native open, including already initialized historical/internal/gift members. Existing recorded starts and grants survive. Source evidence can take over through the existing protected identity-override flow. New teachers outside the seal receive no historical buffer. Multi-student access and expiry/retained selection remain in the existing access policy.

## Release execution contract (not executed here)

Capture immediately before release while teacher registration writes are quiesced. The release operator must actually pause registration writes before asserting the gate: the environment flag is an operational attestation, not a registration lock. Two matching complete enumerations detect a changing source, but do not substitute for that pause. Keep registration paused until the sealed boundary is accepted, then disable the capture gate and resume registrations as post-snapshot users. Verify the existing evidence collection is server-only before release. No ACL changes are part of this patch.

The complete cohort is stored atomically in one bounded document. The existing repository enforces a 512000-byte document limit; enumeration fails at 10000 documents. Capacity/identity/source errors fail before sealing, never truncate or silently exclude teachers. Deployment packaging copies the complete membership-business directory, including the new module.

## Directed local validation

Run only:
node --test test/membership-final-a/legacy-eligibility.test.js test/membership-final-a/personal-transition.test.js test/membership-final-a/runtime.test.js

27/27 passed. Covers automatic ordinary/historical/internal/gift eligibility; duplicate master records; post-snapshot exclusion; no timer on capture; first-open timer; concurrent capture and repeated device opens; unchanged grants and historical data; multi-student access within five days; exact expiry and retained-one selection; failed-commit retry; missing/corrupt snapshot; source changes and identity conflicts; pagination; native admin and release gates; rejection of caller identity lists/timestamps.

Original eight cases: ordinary old first open PASS; historical takeover PASS; internal takeover PASS; new no-buffer PASS; repeat/device idempotency PASS; existing multi-student access PASS; expiry/retention PASS; historical data preserved PASS.

Evidence level: synthetic local SDK and backend entry points, not real device/cloud smoke. No real teachers/students were read or written this turn. No real eligibility snapshot, rollout, deployment, payment edits, purchase opening, or Release RC action occurred. Prior Android/refund/Stage2–5/Final-A–D/sync PASS suites were not rerun. No P0/P1 found within the implemented capability and stated release contract.

Git Seal includes only the two business modules, new eligibility module, three directed test files and this report. .task-backups and any temporary evidence remain excluded. Commit/push do not authorize or imply deployment.
