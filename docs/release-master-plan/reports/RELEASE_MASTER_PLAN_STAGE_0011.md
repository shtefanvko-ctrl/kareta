# KARETA.KZ — Release Master Plan — Stage 0011/2513

## Task

Убрать direct `fetch` к `api/db.php` из `js/app.js`, `js/modules.js`, `js/rbac.js`, `js/master_modals.js` и провести DB calls через единый `KaretaApiClient`.

## Changes

### Unified DB API client

`js/next/api_client.js`:
- добавлен `dbGet(action, params, options)`;
- добавлен `dbPost(action, payload, options)`;
- оба метода экспортированы через `window.KaretaApiClient`;
- auth/session credentials продолжают централизованно задаваться `credentials='same-origin'`;
- error payload normalization и `requestId` остаются в одном `request()/normalizePayload()` слое;
- GET к `api/db.php` продолжает использовать централизованный 429 retry/backoff;
- POST mutations не replay-ятся автоматически: `dbPost` использует `dedupe:false`.

### Legacy callers migrated

`js/app.js`:
- `auth.verifyOtp` -> `api.dbPost`;
- `ping` / `health` -> `api.dbGet`;
- owner DB health panel -> `api.dbGet`;
- `config.save` -> `api.dbPost`.

`js/modules.js`:
- `users.getAll` -> `api.dbPost`;
- удалены дублирующие `users.setRole/users.setActive` mutations. Эти записи уже выполняются внутри RBAC persistence.

`js/rbac.js`:
- `users.setRole` -> `api.dbPost`;
- `users.setActive` -> `api.dbPost`.

`js/master_modals.js`:
- `master.saveProfile` -> `api.dbPost`;
- availability save -> `api.dbPost`;
- удалён fallback через прямой `fetch('/api/db.php')` и обходной `window.DB._api` для этого action.

### Runtime bundle

`js/boot/runtime_ui_bundle.js` пересобран через `node tools/build_boot_js_bundles.js`.
Остальные четыре boot bundles после пересборки остались byte-identical.

### Regression

Добавлен:
- `tools/test_direct_db_api_client_84_109.js`.

Release checklist расширен новым API gate.

## Verification

- Direct `fetch(...api/db.php...)` в четырёх целевых файлах: **0**.
- `node --check` для `api_client.js/app.js/modules.js/rbac.js/master_modals.js`: PASS.
- Boot bundle freshness: **5/5 fresh**.
- `DIRECT_DB_API_CLIENT_84_109: PASS targets=4 directFetch=0 auth=central error=central retry=get429 requestId=central duplicateRoleWrites=0`.
- Unified release checklist: **22/22 PASS**, 0 failed.
- Commissioning OTP executable regression: PASS.
- Role E2E recovery: PASS.
- Role-context scenarios: PASS.

## Staging CHECK

Checked from authorized workstation on 2026-09-25 UTC:

- `https://s.kareta.kz/` -> **HTTP 403 Forbidden**.
- `https://s.kareta.kz/api/db.php?action=ping` -> **HTTP 200 JSON**.
- staging API release token -> `188.5.5.6.84.109`.
- `dbReady=false`.
- `databaseState=configuration_missing`.
- `recoveryAction=configure_private_database_settings`.
- `diagnosticCode=84650804048629ff`.

Therefore source/runtime architecture is locally verified, but end-to-end staging validation of auth/error/retry/requestId cannot be marked PASS until the staging document root/private DB configuration is repaired.

## DoD status

- One API layer for targeted DB calls: PASS.
- Auth/error/requestId centralized: PASS.
- GET retry/backoff centralized: PASS.
- Duplicate role mutations removed: PASS.
- Syntax/runtime regression gate: PASS.
- Staging end-to-end verification: BLOCKED by staging environment (403 root + database configuration missing).
