# KARETA.KZ — Release Master Plan V3 — Stage 0003/2513

## Scope

`R188.5.5.6.84.109` — обновление `tools/test_project_audit_r188558410.js` без изменения runtime/API/DB.

## Изменение

Удалена жёсткая проверка релиза `188.5.5.6.84.14`. Тест теперь извлекает текущий `KARETA_ASSET_VERSION` как метаданные и проверяет стабильные проектные контракты: Home render/mount, runtime location/profile, masters catalog, empty/error/media fallback, service request prefill before request-window open, lazy `requestNew`, route-registry fallback, отсутствие локального bottom-nav CSS и минимальную DB migration contract.

Устаревшие строковые проверки старой реализации Home/Request заменены на актуальные контракты `84.109`, чтобы audit не давал ложные падения после снятия старого release-gate.

## Проверка DoD

- `node --check tools/test_project_audit_r188558410.js` → PASS.
- `node tools/test_project_audit_r188558410.js` → `PROJECT_AUDIT_CONTRACTS: OK (release 188.5.5.6.84.109)`.
- При временном `KARETA_ASSET_VERSION=188.5.5.6.84.999` тот же тест → `OK`.
- `inc/asset_version.php` восстановлен побайтно; SHA-256 до/после: `4d22da1a3436dad47bd2699cb8bd239f8fe4caf90cac2486fe0655eff50e1717`.
- `node tools/test_master_exchange_structure_84_109.js` → OK.
- `node tools/test_route_lazy_loader_84_66.js` → OK.
- `node tools/test_r1885585_route_session_preservation.js` → OK.
- PHP syntax `inc/asset_version.php`, `config.php` → OK.

## Staging CHECK

Результат сохранён в `docs/release-master-plan-v3/stage_0003_staging_check.json`.
С авторизованного ПК `https://s.kareta.kz/` доступен по сети, но возвращает `HTTP 403 Forbidden` на `2026-09-24T23:45:49.9157865Z`. Поэтому внешний запуск audit на staging не состоялся и честно отмечен как `BLOCKED_HTTP_403`, а не `PASS`.
