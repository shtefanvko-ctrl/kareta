# Pending and historical database migrations

The canonical production migration chain now ends at **135**.

## Canonical compatibility bridge

Versions **130–134** are intentionally side-effect-free compatibility slots. Historical parallel branches reused those numbers for different operations, and production databases can already contain one of those version markers with an incompatible checksum.

The migration runner preserves an already-applied version and records checksum conflicts instead of replaying it. Therefore versions 130–134 must never contain required schema/data transformations.

Real canonical schema work resumes at:

- **135** — `obd_diagnostic_sessions` for Android Native API 6.

This guarantees that OBD schema creation still runs even on a database carrying any historical 130–134 marker.

## Historical source material

The original conflicting files are preserved under:

`api/migrations_pending/historical/`

They are source material only. They are not runtime migrations and must not be copied back to `api/migrations/` under their historical version numbers.

Any still-required behavior from those files must be re-authored as a new idempotent migration starting at **136**, with explicit compatibility checks against production-like database snapshots.

## Promotion Definition of Done

1. Assign a new monotonic version >= 136.
2. Make the operation idempotent.
3. Account for databases that may already contain historical 130–134 audit markers/checksums.
4. Update both migration manifests and `KARETA_DB_VERSION` atomically.
5. Run:
   - `php tools/test_migration_contract.php`
   - `php tools/test_release_migration_manifest.php`
   - `php tools/test_migration_collision_bridge_84_149.php`
6. Validate against a production-like DB snapshot before enabling a migration window.
