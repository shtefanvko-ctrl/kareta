# KARETA.KZ — Release Master Plan — Stage 0006/2513

## Scope

R188.5.5.6.84.109 FULL package assets QA. Runtime/API/DB business code was not changed.

## Local FULL package

- assets/: 682 files (~57 MiB).
- registry images: 23 = 2 logos + 12 onboarding welcome backgrounds + 8 error-403 backgrounds + 1 media background.
- `php tools/test_full_assets_static_84_109.php` → `FULL_ASSET_STATIC_84_109: PASS`.
- `bash tools/test_full_assets_http_84_109.sh` → `FULL_ASSET_HTTP_84_109: PASS`.
- HTTP checked assets: 49.
- local 404: 0.
- local MIME errors: 0.
- `bash tools/release_checklist.sh` → 17/17 PASS.

## External staging

Full registry-image probe against `https://s.kareta.kz/`:
- mandatory images: 23;
- PASS: 1;
- FAIL: 22;
- HTTP 404: 22;
- MIME errors among served assets: 0.

Only `media/kareta_create_request_vehicle_background_r188_5_5_6_84_31.png` returns HTTP 200 / image/png.
Both logos, all 12 onboarding backgrounds and all 8 error-403 backgrounds return HTTP 404.
Both welcome/error manifest URLs return HTTP 404.

Stage-level DOD is not satisfied on external staging until the FULL assets tree/manifests are deployed to the actual staging document root and the probes return 200 with correct MIME.
