# KARETA.KZ clean assembly — 2026-09-25

Canonical runtime project: `/home/karetakz/sites/kareta.kz`.

Integrated into the canonical project without overwriting newer 84.110 core files:
- missing runtime assets from the older Desktop copy, including GlobalTuning product images, Manrope font files, onboarding/service/vehicle assets and the 403 background manifest;
- missing architecture, QA, changelog and release-master-plan evidence;
- missing reusable release/QA tests under `tools/`;
- Stage 4–18 reports under `docs/release-master-plan/reports/`;
- responsive Stage 1 evidence under `docs/responsive-baseline/188.5.5.6.84.110/stage_0001/`;
- reusable responsive capture harness under `tools/responsive/capture_baseline_windows.js`.
- Stage 12–15 one-shot helper scripts archived under `tools/archive/release-master-plan/84_109/stage-work/` and marked historical/non-runtime.

Not merged into current core:
- `api/domains/capability_dispatch.php`, `api/domains/identity_admin.php`, `api/domains/runtime_config.php` from the older Desktop branch, because current 84.110 `api/db.php` does not require them;
- nested old `kareta.kz.zip` from the Desktop project.

Removed as build junk:
- root `stage18-backup-20260925-120157/`;
- accidental root file beginning with `t --upgradable`.

Historical 84.109 tests remain historical. Current assembly verification uses release-neutral asset checks plus current 84.110 syntax/boot/runtime checks.
