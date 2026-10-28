# DATA Core v1.3 — independent pre-activation risk review

Date: 2026-10-28. Evidence source: code in repo. Database was **not** read or altered.

## Findings for unlisted migrations 138–144

| Version | Area | Severity | Actual code effect | Required verification |
|---|---|---|---|---|
| 138 | Identity | HIGH | Creates account type membership, backfills role/status from legacy data and updates master publication/verification JSON | Validate identities, canonical membership and statuses; preserve archived/suspended assignments; compare before/after counts and sampled synthetic cases |
| 139 | Client | MEDIUM | Adds daily-prompt columns and prompt-state table | Schema/index compatibility, timezone retention and client onboarding regression |
| 140 | Identity | CRITICAL | Directly **replays** migration closures 72, 128, 129, 138; 128 and 129 include population-wide backfills | Verify existing onboarding state, status and account-type snapshots; demonstrate repeat safety on isolated copy; validate zero unexpected overwrites |
| 141 | Specialist | MEDIUM | Normalizes master onboarding step/view and draft JSON | Compare drafts, completion states, revisions and correct displayed step |
| 142 | Client | HIGH | Mutates unfinished client onboarding steps via `4→3`, `3→2`, `2→1` | **Not idempotent:** on another execution `4→3→2` and `3→2→1`; verify exact applied history and only-once semantics |
| 143 | Specialist | HIGH | Adds `services.manage` and `profile.read` allows to a capability set | Re-test authorization of revoked/suspended/other-tenant accounts, deny paths and role isolation |
| 144 | Client | HIGH | Creates three catalog tables, upserts seed data and backfills `client_vehicles` IDs based on names | Validate seed collisions, existing custom vehicle names, stable IDs, orphan count and rollback of backfill |

The `db_migrations` history records previously applied versions and checksums. Historical checksum collisions are deliberately tolerated by the runner, so simply seeing a version number is not proof that the **same** SQL/data changes were applied. Check actual schema and data separately before any rollout.

## What was actually implemented
- `docs/data_core_migration_risks.json` pins SHA-256, owner, risk class and affected tables for each pending migration.
- `tools/check_data_core_migration_risks.php --check` verifies the pending-files inventory against the pinned review registry. New/unexpected files, hash changes and missing risk entries fail the gate. It reports `releaseReady: false` regardless of successful source verification.
- `tools/test_data_core_migration_risks.php` executes six positive/negative filesystem-fixture tests without a DB or runtime bootstrap.
- CI runs the regression and inventory check **before** the already-blocking migration version parity check.

## Next authorization-dependent verification
A separately authorized, read-only DB administrator should attest database environment and restoration evidence, applied version and checksum records, `information_schema` table/column presence, and counts of accounts/persons/memberships, onboarding states and vehicle catalog links, without returning personal records or credentials. The review is **NOT RUN** until such evidence is supplied. Source audits are never substituted for live evidence.

## Release decision
- Source risk classification: PASS (reconciled inventory, not execution safety).
- Existing 137/144 manifest vs runtime drift: FAIL.
- Actual database version, per-row ownership, backup restore and auth cross-domain: NOT RUN.
- Activation of 138–144, deployment and domain split: BLOCKED.

No existing migration file or runtime auto-migration behavior was modified.
