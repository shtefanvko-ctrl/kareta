# KARETA DATA Core — migration provenance guard, 2026-10-28

**Scope:** isolated branch, source files and CI only. No live DB connection, SQL, staging deployment or production cutover.

## What the guard checks
`php tools/check_data_core_migrations.php` compares the configured `KARETA_DB_VERSION`, the runtime PHP manifest, the JSON manifest, file names and checksums, versions, gaps and extra unlisted migrations. Prints machine-readable JSON and returns exit status 1 on any inconsistency.

`php tools/test_data_core_migration_guard.php` uses disposable fixtures to exercise a passing baseline and five failure paths (JSON drift, configured-version drift, unlisted migration, duplicate version, changed migration content). No DB access or schema bootstrap.

## Corrected mismatch (source-only)
The JSON manifest contained four stale hashes: 007, 020, 033 and 048. The checked-in runtime PHP manifest, actual migration files, and recorded Git versions agree on the canonical bytes for each. The JSON entries were updated to match; migration content and runtime PHP manifest were not modified. No assertion is made about what may have already executed in a live database.

## Release blockers remaining
- The configured version in `origin/main` is **144**, while the PHP and JSON manifests both list **137** migrations.
- Files **138 through 144** exist, but are not in the runtime manifest.
- The runtime migration runner discovers only files listed in the PHP release manifest; a developer must verify actual database version, migration history, existing schema and restore capability before proposing activation of 138–144.
- Do **not** blindly extend runtime manifest from 137 to 144. This can activate schema changes upon the next request because normal DB initialization may run migration/maintenance routines.

## Execution / status
`php tools/test_data_core_migration_guard.php`: PASS (isolated fixtures).
`php tools/test_release_migration_manifest.php`: verifies only the 137 active PHP-listed entries, not version parity with config.
`php tools/check_data_core_migrations.php`: expected FAIL until source version parity is reviewed and repaired safely. CI intentionally blocks merge/deployment rather than silencing this problem.
Live schema / production backup verification: NOT RUN. Do not mark cutover ready.

## Follow-up gate
A restricted, independently authorized and read-only schema inspection with no runtime bootstrap/autoheal, a verified backup/restore rehearsal, and source-to-deployed integrity comparison are required before activating missing migrations or splitting data ownership among client/work/works/shop applications.


## Next stage: explicit read-only migration history audit (QA, no live DB yet)
- Offline: php tools/check_data_core_db_history.php --snapshot=/path/metadata.json. Analyze an authorized metadata-only snapshot of db_migrations containing only migrations:[{version:int,checksum:string}]. Do not include account, order, phone or other private records.
- MySQL: php tools/check_data_core_db_history.php --mysql. Connects only when KARETA_MIGRATION_AUDIT_DSN, KARETA_MIGRATION_AUDIT_USER and KARETA_MIGRATION_AUDIT_PASSWORD are explicitly supplied by an authorized operator. Use a restricted SELECT-only database identity. The script uses START TRANSACTION READ ONLY, selects only version and checksum, and rolls back. It never loads KARETA bootstrap or executes migrations. Do not store connection credentials in Git or QA artifacts.
- Test: php tools/test_data_core_db_history.php. Ten offline synthetic checks including missing/duplicate versions, mismatched/empty hashes, malformed input, unlisted 138 and unrecognized 145. Incorporated into the existing DB canon CI lane.
- HistoryStatus PASS means only that inspected metadata matches registered checksums; releaseReady stays false even after PASS. Real schema inventory, migration 140 replay analysis, migration 142 non-idempotence, verified backup/restore rehearsal and staging E2E are independently required before 138-146 activation.
- Actual MySQL, staging and production were NOT contacted during this QA increment. No changes to PHP release manifest, config.php, migrations, DB contents or autoheal behavior.

- Hardening: audit rejects MySQL users whose SHOW GRANTS includes write/DDL privilege, global SELECT, role inheritance, or grant delegation. It accepts only direct SELECT grants restricted to db_migrations or its exact schema. Grant statements are never printed.



## Isolated MySQL 8.0 rehearsal — 2026-11-04

Reproducible command: KARETA_ALLOW_ISOLATED_DOCKER_TEST=1 bash tools/test_data_core_mysql_isolated_rehearsal.sh.
The command launches a disposable mysql:8.0.46 container, with network none, no host ports, capped CPU/RAM, and a new temporary Docker volume. Only synthetic schema and migration-history fixtures are loaded. The tool requires an explicit opt-in and cleans up the container, volume and temporary files.

Executed on KaretaMeneger against the exact local PR #185 candidate:
- PASS MySQL 8.0.46 + PHP PDO actual SELECT-only db_migrations access using an audit user limited to that table; 137 synthetic recorded rows; releaseReady=false.
- PASS actual MySQL identity with SELECT+INSERT is rejected before metadata SELECT.
- PASS mysqldump from synthetic DB restored into an independent synthetic DB with identical 137-row migration history hash.
- PASS (risk reproduced) original migration 142 changed synthetic pending steps from 1:3,2:4,3:4(completed) to 1:2,2:3,3:3, and on replay to 1:1,2:2,3:3. Migration 142 is not idempotent and must not be replayed against real users without an independently reviewed recovery strategy.
- PASS negative grant checks in offline PHP fixture suite (19/19) and zero production or shared-QA database access.
- Code fix: the audit program previously called PDO rollBack() after a raw SQL START TRANSACTION READ ONLY; PDO cannot reliably recognize this as a driver-started transaction. The tool now issues SQL ROLLBACK inside finally, ensuring the read-only transaction closes in real PDO/MySQL tests.

The GitHub workflow syntax-checks the optional Docker rehearsal script, but intentionally does not start MySQL on every PR. This is a manual isolated integration test, not evidence of a production DB backup/restore. The actual service DB version/history/schema and backup recoverability remain NOT VERIFIED. No runtime manifest changes, live migrations, production grant changes, or deployment approvals are included.
