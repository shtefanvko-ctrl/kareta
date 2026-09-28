# KARETA.KZ — Release Master Plan — Stage 0009/2513

## Scope

R188.5.5.6.84.109 — remove historical release markers from production runtime and move history to changelog/test metadata.

## Runtime changes

Historical release/test marker comments were removed from:
- `sw.js`
- `inc/asset_version.php`
- `js/next/core/realtime_client.js`
- `js/boot/runtime_ui_bundle.js`

Executable behavior was not changed.

Current runtime release data:
- `sw.js`: `const RELEASE = '188.5.5.6.84.109';`
- `inc/asset_version.php`: `const KARETA_ASSET_VERSION = '188.5.5.6.84.109';`
- realtime source/bundle read runtime release from `window.KARETA_NEXT_ASSET_VERSION`.

## History migration

Historical metadata is preserved outside runtime:
- `docs/changelog/runtime_release_history_84_109.json`
- `docs/changelog/runtime_release_history_84_109.md`

Preserved:
- full legacy marker chain: 3414 characters;
- realtime legacy marker chain: 749 characters;
- Community regression markers for 84.49/84.50.

Regression tests `test_community_social_platform_84_49.js` and `test_community_mobile_autoplay_84_50.js` now read historical markers from metadata instead of `inc/asset_version.php`.

## Automated contract

New test:
- `tools/test_runtime_release_metadata_84_109.js`

It verifies:
- sw/asset release parity = 188.5.5.6.84.109;
- no historical markers remain in the four runtime files;
- sw.js + asset_version.php contain only the current numeric release token;
- complete historical chains remain preserved in changelog metadata.

Results:
- runtime release metadata test: PASS;
- Community 84.49 regression: PASS;
- Community 84.50 regression: PASS;
- project audit: PASS;
- PWA release parity: PASS;
- unified release checklist: 20/20 PASS.

## Staging CHECK

Checked 2026-09-25T00:58Z from the authorized workstation:
- `https://s.kareta.kz/` → HTTP 403 Forbidden.
- `https://s.kareta.kz/sw.js` → HTTP 200, `application/javascript`, contains current `84.109`, but still contains historical markers.
- `https://s.kareta.kz/inc/asset_version.php` → HTTP 200 with empty response body because PHP executes server-side.

Therefore the local Stage 9 implementation is correct, but the cleaned `sw.js` has not yet been deployed to the external staging document root. Stage-level staging CHECK is not PASS.
