# KARETA.KZ — Release Master Plan — Stage 0013/2513

## Task

Создать API contract smoke suite для ключевых domains: schema/status/auth/error/idempotency. Каждый domain должен иметь happy/error smoke перед релизом.

## Result

Created:
- `tools/test_api_contract_smoke_84_109.js`
- `docs/architecture/API_CONTRACT_SMOKE_84_109.md`

Updated:
- `api/bootstrap.php`
- `tools/test_schema_contract_diagnostics_84_26.php`
- `tools/release_checklist.sh`

## Smoke matrix

Five domains, two mandatory scenarios each:

- schema: happy + error
- status: happy + error
- auth: happy + error
- error envelope: happy + fallback/error
- idempotency: happy + conflict/error

Local result:
`API_CONTRACT_SMOKE_84_109: PASS checks=10/10 domains=5 happyError=5/5`

Unified release checklist:
- 24/24 PASS
- 0 failed
- `RELEASE_CHECKLIST: PASS`

## Defects found and fixed

### Idempotency replay conflict

Before Stage 13, `kareta_idempotency_begin()` calculated `request_hash` but replayed a completed row for the same idempotency key even when the incoming payload differed.

Fixed:
- stored/incoming request hashes are compared before replay;
- same key + changed payload returns HTTP 409;
- stable code: `IDEMPOTENCY_CONFLICT`;
- conflict check executes before `X-Idempotency-Replayed: 1`.

### Schema reconciliation classification

`Schema reconciliation incomplete` previously fell through to `database_error`.

Fixed:
- `schema reconciliation` is classified as `schema_or_migration_failed`;
- recovery path remains `repair_database_migrations`.

### Stale schema diagnostic test

`tools/test_schema_contract_diagnostics_84_26.php` expected public-meta fields no longer present in the current runtime contract.

Fixed:
- test now validates current `failureCategory/failureStage/failedMigrationVersion/failedMigrationFile/diagnosticCode/failureSqlState/failureDriverCode`;
- both schema-contract and schema-reconciliation error paths are covered;
- result: 15/15 PASS.

## Staging CHECK

Non-destructive staging smoke executed against `https://s.kareta.kz`.

Result:
- 5/6 HTTP probes PASS;
- schema.happy FAIL: `GET /api/schema_health.php` -> HTTP 503 `DATABASE_UNAVAILABLE`;
- status.happy PASS;
- status.error PASS;
- auth.happy PASS;
- auth.error PASS;
- error.happy PASS.

Additional environment evidence:
- `https://s.kareta.kz/` -> HTTP 403 Forbidden;
- `https://s.kareta.kz/api/db.php?action=ping` -> HTTP 200;
- release token -> `188.5.5.6.84.109`;
- `dbReady=false`;
- `databaseState=configuration_missing`;
- `recoveryAction=configure_private_database_settings`;
- diagnostic code `84650804048629ff`.

Therefore the API contract suite and release gate are complete locally, while full staging PASS remains blocked by the existing staging document-root/private-DB configuration issue.
