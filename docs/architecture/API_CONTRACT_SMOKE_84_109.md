# KARETA.KZ — API Contract Smoke Suite 84.109

Baseline: `R188.5.5.6.84.109`
Stage: `13/2513`

## Command

Local release-gate smoke:

```bash
node tools/test_api_contract_smoke_84_109.js
```

Staging non-destructive HTTP smoke:

```bash
node tools/test_api_contract_smoke_84_109.js \
  --base-url https://s.kareta.kz \
  --json docs/release-master-plan/stage_0013_api_contract_staging.json
```

## Required matrix

| Domain | Happy smoke | Error smoke |
| --- | --- | --- |
| schema | `KaretaSchemaContract::contracts()` exposes required Identity Core tables/columns | schema/migration diagnostic metadata and classification |
| status | `GET /api/runtime_health.php` -> HTTP 200 + `ready/degraded` JSON contract | `POST /api/release_status.php` -> HTTP 405 + `METHOD_NOT_ALLOWED` |
| auth | `POST /api/auth_session.php {"action":"logout"}` -> HTTP 200 + `loggedOut=true` | unsupported method -> HTTP 405 + normalized error envelope |
| error | known `AUTH_REQUIRED` envelope includes message/httpStatus/requestId | fallback HTTP 500 becomes `HTTP_500` + errors/meta |
| idempotency | header key precedence + request hash ignores idempotency key | same key with different payload is rejected before replay with HTTP 409 `IDEMPOTENCY_CONFLICT` |

All 10 checks are mandatory in the unified release checklist.

## Safety

The local suite starts an ephemeral PHP built-in server bound to `127.0.0.1`; it does not write business records.

The staging mode only uses non-destructive HTTP probes. Idempotency replay/conflict behavior is verified locally because a remote idempotency mutation smoke would create business data.

## Defects found by Stage 13

1. Existing idempotency code computed `request_hash` but did not compare it before replay. Fixed: same key + changed payload now returns HTTP 409 `IDEMPOTENCY_CONFLICT`.
2. `Schema reconciliation incomplete` was classified as generic `database_error`. Fixed: it now maps to `schema_or_migration_failed`.
3. Legacy `tools/test_schema_contract_diagnostics_84_26.php` expected removed public-meta fields and emitted warnings. Updated to the current diagnostic contract.

## Release gate result

`API_CONTRACT_SMOKE_84_109: PASS checks=10/10 domains=5 happyError=5/5`

Unified release checklist after Stage 13: `24/24 PASS`.
