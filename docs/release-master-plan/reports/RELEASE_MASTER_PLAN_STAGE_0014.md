# KARETA.KZ — Release Master Plan — Stage 0014/2513

## Task

Сократить legacy role PHP checks. Мигрировать бизнес-разрешения на capabilities.

## Result

Implemented:
- centralized policy: `api/domains/capability_dispatch.php`;
- 40 direct role authorization call-sites migrated to capability checks;
- legacy role debt reduced from 108 to 68;
- `api/db.php` role debt reduced from 90 to 50;
- hard budget added: `tools/test_legacy_role_budget_84_109.js`;
- `profile.edit_own -> profile.manage` canonical alias added;
- budget test added to `tools/release_checklist.sh`.

No DB schema migration was added. No frontend route, UI or business-data format changed.

## Stage 12 regression prevention

The first implementation increased `api/db.php` above the Stage 12 no-growth limit. It was corrected by moving capability policy into `api/domains/capability_dispatch.php`.

Final:
- `api/db.php`: 673303 bytes;
- allowed maximum: 675028 bytes;
- `DB_MONOLITH_DECOMPOSITION_84_109: PASS`.

## Checks

- PHP syntax: PASS;
- legacy role budget: PASS;
- DB monolith no-growth: PASS;
- API contract smoke: PASS 10/10;
- full release checklist: PASS 25/25.

## Staging CHECK

Checked at 2026-09-25T02:37:00.7232760Z.

- `https://s.kareta.kz/` -> HTTP 403;
- `/api/runtime_health.php` -> HTTP 200, `degraded`, release `188.5.5.6.84.109`;
- `/api/db.php?action=ping` -> HTTP 200, `dbReady=false`, `databaseState=configuration_missing`;
- recovery action: `configure_private_database_settings`;
- diagnostic code: `84650804048629ff`;
- `/api/db.php?action=news.mine` -> HTTP 503 `DB_UNAVAILABLE`.

Therefore capability behavior cannot be validated end-to-end on staging until the existing staging private DB configuration/document-root issue is fixed.

## DOD

Local code/runtime debt reduction: satisfied.
Budget: satisfied and enforced.
Staging verification: blocked by environment, not marked PASS.
