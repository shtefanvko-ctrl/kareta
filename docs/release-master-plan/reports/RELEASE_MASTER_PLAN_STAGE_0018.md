# RELEASE MASTER PLAN — STAGE 0018

Baseline: `R188.5.5.6.84.109`

Task: unified lazy-route loading state.

Implemented:
- system loading surface in `app_next.js`;
- ARIA progressbar and visible loading phase;
- per-asset progress callback from `route_asset_loader.js`;
- route load start/progress/end/error/cancel events;
- stale-route token guard;
- responsive skeleton in eager app shell CSS;
- reduced-motion fallback;
- generated JS/CSS boot bundles synchronized.
Local validation:
- JS syntax: PASS.
- `ROUTE_LOADING_STATE_84_109`: PASS.
- route lazy 84.66: PASS.
- route lazy 84.67: PASS.
- route lazy 84.68: PASS.
- critical CSS split 84.81: PASS.
- boot JS bundles fresh: PASS.

Expected result: a lazy route immediately occupies the outlet with system skeleton + progress, so slow loading no longer presents a blank white content area.
Staging CHECK:
- `https://s.kareta.kz/api/runtime_health.php`: HTTP 200.
- runtime release: `188.5.5.6.84.109`.
- live `app_next.js`: Stage 18 progress marker absent.
- live `runtime_shell_bundle.js`: Stage 18 progress reporter absent.
- live `runtime_boot_bundle.css`: Stage 18 loading CSS absent.

Status: `FAIL_NOT_DEPLOYED_OR_STALE`.
Evidence: `docs/release-master-plan/stage_0018_staging_check.json`.

DOD is satisfied in the local project tree, but not yet confirmed on staging. Deploy the Stage 18 files and repeat the saved staging check.
