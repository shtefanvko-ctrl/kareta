# KARETA.KZ — Release Master Plan — Stage 0015/2513

## Task

Сократить legacy role JS checks. `role` оставить для UI; security decisions — только server/capabilities.

## Result

В active production runtime:
- `js/next/role_access.js`: добавлены `uiCanAccess()`, `authorizationSource()`, `rolePolicy: ui-only`;
- Identity route access остаётся через `KaretaDynamicNavigation.canAccess()` и `KaretaIdentity.has()`;
- legacy role fallback фильтрует только UI и не объявляется источником authorization;
- `js/next/pages/request.js`: privileged service-offer data path переведён с `master/sto role` на capability `services.manage`;
- `js/boot/runtime_identity_bundle.js` пересобран из текущего source graph.

В legacy compatibility runtime:
- `js/rbac.js`: role-level policy вынесена в `uiCan/uiAtLeast`, mutation preflight — capability/server;
- `setRole/setActive` меняют локальное состояние только после успешного server response;
- `js/security.js`: убран target role hierarchy как security deny;
- `js/order_lifecycle.js`: role metadata переименована в `uiRoles`, authorization source — server/capabilities;
- `js/orders.js` и `js/modules.js`: PII visibility следует server flag `dispatchLocked`;
- `api/db.php`: formatted order отдаёт `dispatchLocked`.

## Regression gate
Добавлен `tools/test_frontend_role_authorization_84_109.js` и включён в `tools/release_checklist.sh`.

Финальная локальная проверка:
- `FRONTEND_ROLE_AUTHORIZATION_84_109: PASS`;
- `LEGACY_ROLE_BUDGET_84_109: PASS total=68/68 db=50/50`;
- `DB_MONOLITH_DECOMPOSITION_84_109: PASS bytes=672086/675028`;
- `boot JS bundles fresh: 5`;
- 15/15 независимых Node regression gates: PASS;
- PHP syntax: `index.php`, `config.php`, `inc/asset_registry.php`, `api/identity_session.php`, `api/db.php` — PASS.

Полный long-running WSL checklist нельзя считать выполненным в этом раунде: Windows WSL launcher периодически завершает команды с `Wsl/Service/0x80072746` / пустым exit 1 до запуска теста. Это отмечено как infrastructure execution issue, а не как assertion failure.

## Staging CHECK

Проверено 2026-09-25T03:08:50Z:
- `https://s.kareta.kz/` → HTTP 403;
- `/api/db.php?action=ping` → HTTP 200, release `188.5.5.6.84.109`;
- `dbReady=false`, `databaseState=configuration_missing`;
- `recoveryAction=configure_private_database_settings`;
- diagnostic code `84650804048629ff`;
- `/api/identity_session.php` → HTTP 503 `DATABASE_UNAVAILABLE`.

Raw probe: `docs/release-master-plan/stage_0015_staging_probe_raw.txt`.

## DoD
- Frontend role не является authorization source в active Identity runtime: PASS.
- Legacy role сохранён для UI/fallback presentation: PASS.
- Privileged active request data path использует capability: PASS.
- PII display follows server masking contract: PASS.
- Regression gate добавлен: PASS.
- Staging end-to-end authorization verification: BLOCKED_ENVIRONMENT из-за существующей конфигурации staging DB/root.
- DB schema changes: none.
- Route registry changes: none.
