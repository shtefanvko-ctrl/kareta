# Pending database migrations

The canonical production migration chain currently ends at **129**.

Files in this directory are preserved engineering work from parallel branches. They are **not executable migrations** and are intentionally excluded from `api/migration_manifest.php`, `api/migration_manifest.json`, and `KARETA_DB_VERSION`.

Why this quarantine exists:

- historical branches produced duplicate versions 130, 131 and 132;
- production databases can contain audit markers from those parallel histories;
- some pending transforms are not safe to replay blindly (for example onboarding step normalization);
- promoting them by filename alone can mark one colliding migration as applied while silently skipping another.

Promotion Definition of Done:

1. Reconcile the pending operations into one strictly monotonic, idempotent sequence beginning at 130.
2. Add explicit compatibility guards for databases that already contain historical 130+ markers/checksums.
3. Update both migration manifests and `KARETA_DB_VERSION` in the same change.
4. Run `php tools/test_migration_contract.php` and `php tools/test_release_migration_manifest.php`.
5. Validate against a production-like database snapshot before enabling the migration window.
6. Never copy a file from this directory back into `api/migrations/` without assigning its canonical version and checksum.

The active runtime must treat this directory as documentation/source material only.
