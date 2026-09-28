# KARETA.KZ — Release Master Plan — Stage 0004/2513

## Цель

Объединить syntax, migrations, auth, visual, API, PWA и smoke проверки в один release gate.

## Единая команда

`bash tools/release_checklist.sh`

Финальный контракт:
- exit code `0` + `RELEASE_CHECKLIST: PASS` — gate пройден;
- exit code `1` + `RELEASE_CHECKLIST: FAIL` — релиз блокируется.

## Секции

1. SYNTAX — PHP/Node syntax критичных runtime-файлов и project audit.
2. MIGRATIONS — authoritative `api/migration_manifest.php`, последовательность версий и SHA-256 checksums.
3. AUTH — master workplace auth guard.
4. VISUAL — детерминированный master mobile shell visual contract.
5. API — identity API / garage recovery contract.
6. PWA — parity `KARETA_ASSET_VERSION` ↔ service worker RELEASE, manifest contract, fallback regression.
7. SMOKE — project audit, route lazy loader, master exchange structure.

Исторические тесты с устаревшими ожиданиями и Playwright-тест без установленной зависимости сознательно не используются как release blockers.

## Проверка

`bash tools/release_checklist.sh`:
- 17/17 PASS;
- 0 FAIL;
- `RELEASE_CHECKLIST: PASS`;
- exit code 0;
- runtime ~22 s.

## Staging CHECK

С авторизованного ПК `https://s.kareta.kz/` проверен на `2026-09-24T23:52:54.2332005Z`.
Результат: `HTTP 403 Forbidden`.
Поэтому единый gate на внешнем staging не был выполнен и результат честно сохранён как `BLOCKED_HTTP_403`.
