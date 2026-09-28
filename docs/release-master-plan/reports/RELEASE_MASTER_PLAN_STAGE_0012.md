# KARETA.KZ — Release Master Plan — Stage 0012/2513

## Task

Начать декомпозицию `api/db.php`: новые actions не добавлять в 687 KB monolith, критические domains вынести.

## Result

Applied strangler decomposition without changing the public endpoint `/api/db.php`.

### Monolith

- before: 687448 bytes;
- after: 675028 bytes;
- reduction: 12420 bytes;
- detected router actions before: 291;
- router actions remaining in monolith: 281;
- extracted critical actions: 10.

### Extracted domains

`api/domains/identity_admin.php`:
- auth.sendOtp
- auth.verifyOtp
- users.getAll
- users.setRole
- users.setActive
- users.upsert
- users.upsertAdmin
- profile.updateMine

`api/domains/runtime_config.php`:
- config.get
- config.save

The corresponding handlers were physically removed from `api/db.php`. The extracted domain dispatchers run before the legacy switch.

## Monolith non-growth gate

Added:
- `tools/contracts/db_monolith_84_109.json`
- `tools/test_db_monolith_decomposition_84_109.js`
- `docs/architecture/API_DB_DECOMPOSITION_84_109.md`

The gate fails when:
- `api/db.php` grows beyond 675028 bytes;
- a new action-router entry appears in the monolith;
- an extracted action returns to the monolith;
- a domain file/require/dispatcher disappears.

Future action removals from the monolith are allowed.

## Compatibility

No action names changed.
No frontend routes changed.
No DB migration was added.
No intended request/response schema change.
Existing auth/role/capability/audit logic was moved byte-for-byte where practical and remains called through the same `/api/db.php` entrypoint.

## Verification

- PHP syntax: `api/db.php`, `api/domains/identity_admin.php`, `api/domains/runtime_config.php` — PASS.
- extracted action cases in `api/db.php`: 0.
- domain action cases: 10/10.
- `DB_MONOLITH_DECOMPOSITION_84_109: PASS bytes=675028/675028 monolithActions=281/281 extracted=10 newMonolithActions=0`.
- commissioning OTP regression — PASS.
- role E2E recovery — PASS.
- role/context regression — PASS.
- profile legacy ID/mobile navigation regression — PASS.
- unified release checklist — **23/23 PASS**, 0 failed.

A local `http://localhost` endpoint was not used as Stage proof because it currently reports release token `84.110`, not the scoped `84.109` source tree.

## Staging CHECK

Checked 2026-09-25T01:55Z:
- `https://s.kareta.kz/` -> HTTP 403 Forbidden;
- `https://s.kareta.kz/api/db.php?action=ping` -> HTTP 200 JSON;
- staging release token -> `188.5.5.6.84.109`;
- `dbReady=false`;
- `databaseState=configuration_missing`;
- `recoveryAction=configure_private_database_settings`;
- diagnostic code `84650804048629ff`.

Therefore the architecture/code DOD is locally satisfied, but end-to-end staging verification remains blocked by the existing staging document-root/private-DB configuration problem.
