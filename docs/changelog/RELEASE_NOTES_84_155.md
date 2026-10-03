# KARETA 188.5.5.6.84.155

## Scope

Safe automatic database upgrade support for Plesk/staging deployments.

## Goal

A Plesk upload should not require a separate manual database installer every time a
future KARETA release adds canonical migrations. After the new code is deployed, the
runtime may bring an older staging database forward automatically when needed.

## Behavior

For `staging`, `development` and `test` environments:

- `db_auto_upgrade` defaults to `true`;
- KARETA first checks `db_meta.schema_version` and the canonical `db_migrations` prefix;
- if the database already matches `KARETA_DB_VERSION`, no schema mutation occurs;
- if it is behind, schema work is serialized with the existing MySQL advisory lock;
- only missing manifest migrations are applied;
- migration file checksums and sequence are validated;
- the post-migration schema contract must pass;
- the resulting schema version must equal the runtime target;
- START/PASS/FAIL events are written to `db_upgrade.log` without DB credentials.

For `production`:

- automatic upgrade defaults to OFF;
- setting `db_auto_upgrade=true` alone is not sufficient;
- `KARETA_DB_RUNTIME_MIGRATION_WINDOW=1` must also be present for an approved
  maintenance window.

## Failure behavior

An upgrade failure is fail-closed. The runtime does not continue against an incompatible
schema. Existing DB diagnostics retain the exact bootstrap/migration failure stage and
migration version, and the auto-upgrade log records FAIL.

No destructive reset, drop-all, reseed, or replacement of user data is introduced.

## Configuration

Staging/Plesk template:

```php
'environment' => 'staging',
'db_auto_create' => false,
'db_auto_upgrade' => true,
'db_auto_migrate' => false,
```

Production template keeps:

```php
'environment' => 'production',
'db_auto_upgrade' => false,
'db_auto_migrate' => false,
```

## Diagnostics

`/api/runtime_diagnostics.php` now exposes non-secret fields:

- `dbAutoUpgrade`;
- `dbAutoMigrate`;
- `dbTargetVersion`.

## Verification

`tools/test_db_auto_upgrade_84_155.js` executes four configuration scenarios:

1. staging default -> auto-upgrade ON;
2. staging explicit OFF -> OFF;
3. production requested without maintenance window -> blocked;
4. production explicitly enabled with maintenance window -> ON.

The test is included in both `verify` and `Application gates`.

## Database boundary

Canonical DB version remains **137**. This release changes upgrade orchestration, not the
database schema itself.

## Out of scope

- no Android changes;
- no new migration;
- no reset/reseed of existing data;
- no automatic production maintenance window.
