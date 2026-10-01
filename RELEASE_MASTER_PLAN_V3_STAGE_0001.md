> Historical 84.109 baseline. Current active engineering plan: `docs/engineering/CURRENT_PLAN.md`. Do not use this stage file as the current release state.

# KARETA.KZ — RELEASE MASTER PLAN V3 — STAGE 1/2516

## Stage
- Phase: `00 — BASELINE_ENVIRONMENT_AND_TEST_CORE`
- Source baseline: `R188.5.5.6.84.109`
- Task: зафиксировать релизный baseline 84.109
- Production code changes: **none**

## Baseline captured
- Original source files: **1009**
- Full SHA-256 inventory: `docs/release-baseline/188.5.5.6.84.109/file_hashes.sha256`
- Key runtime hashes: `docs/release-baseline/188.5.5.6.84.109/key_file_hashes.sha256`
- Routes: **67 route keys**, **39 legacy aliases**, **17 dynamic route forms**
- Asset plan: **56 lazy bundles**, all **67 route keys** covered by lazy asset plan
- Missing runtime CSS/JS/PHP referenced by registry: **0**
- Missing image files: **22**, expected for the supplied `NO_ASSETS` archive

## Staging check
External `https://s.kareta.kz/` is reachable from the verification channel, but it currently serves **UKHPC — Высший Политехнический колледж**, not KARETA.KZ. The required release identity `188.5.5.6.84.109` therefore cannot be confirmed on the configured staging URL. This is recorded as `FAIL_WRONG_APPLICATION`, not as an environment/network block.

A local staging-equivalent smoke check of the exact extracted baseline still passes: PHP server returns HTTP 200 for `/`, `runtime_boot_bundle.css`, `route_registry.js`, and `route_asset_loader.js`; generated HTML contains the `188.5.5.6.84.109` asset token. This proves the source baseline integrity only and does not substitute for the external staging CHECK.

## Regression / validation
- `python tools/test_release_baseline_84_109.py --integrity-only` — PASS
- `python tools/test_release_baseline_84_109.py` — EXPECTED FAIL until external staging serves KARETA.KZ release 188.5.5.6.84.109
- `node tools/test_master_exchange_structure_84_109.js` — PASS
- `node tools/test_route_lazy_runtime_84_67.js` — PASS
- `node tools/test_r1885585_route_session_preservation.js` — PASS

## DoD
A single immutable baseline exists and can be machine-compared against all later stages. Baseline integrity is PASS.

However, the stage-level CHECK remains **NOT_OK** for a concrete deployment reason: the configured staging host is reachable but serves UKHPC instead of KARETA.KZ. Correct the staging deployment/DNS/vhost so `https://s.kareta.kz/` serves KARETA.KZ release `188.5.5.6.84.109`, then update `staging_check.json` to `PASS` only after the external release token is verified and rerun `python3 tools/test_release_baseline_84_109.py`.

## Round 3 corrective package
The remaining fault has been isolated to the external hosting layer. A fail-closed Plesk repair utility is included as `tools/repair_staging_plesk_84_109.sh`, together with `tools/verify_staging_release_84_109.py` and `docs/release-baseline/188.5.5.6.84.109/STAGING_PLESK_REPAIR.md`.

These files do not mark staging as PASS. They are the executable correction for the server that currently serves the wrong vhost/document root. The repair must be run on the authorized Plesk host; after that the external verifier must return `KARETA_STAGING_84_109: OK` before `staging_check.json` can be changed to PASS.
