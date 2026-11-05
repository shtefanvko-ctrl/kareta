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
