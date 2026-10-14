# PR #133 — integration inventory, 2026-10-14

Audit candidate: `d9abd323ebb2dabdcdc09eec581470f0d787b6b7` on `integrate/all-features-staging-20261014`.
Source of truth for complete source/base SHAs, branches, net paths, blob identities
and evidence: [PR133_INTEGRATION_INVENTORY_20261014.json](PR133_INTEGRATION_INVENTORY_20261014.json).
This snapshot describes its audit SHA, not an automatically refreshed status.

## Result

| Source PR | Source head | Net files | Integration status |
| --- | --- | ---: | --- |
| #124 | `386331ef` | 17 | требует проверки |
| #125 | `0d5f62af` | 8 | уже перенесено |
| #126 | `d8679672` | 13 | отсутствует |
| #127 | `defe6040` | 2 | уже перенесено |
| #128 | `7cbfbb3a` | 6 | отсутствует |
| #129 | `9cbb2207` | 11 | перенесено частично |
| #130 | `ffee7891` | 5 | уже перенесено |
| #131 | `e15ac20c` | 7 | уже перенесено |
| #132 | `28ed0857` | 8 | перенесено частично |

### PR #124: Recovery: notification bridge, idempotency, health and booking service boundaries

Base: `integrate/landing-v3-on-121-20261008` at `f4edfbb11a6aed7d0f4d72c1963c601db12671c2`.

Seven source-added files are absent, including five contract tests and backfill tool; all ten modified source files differ. Recovery additions are not matched verbatim. Require contract-by-contract reconciliation; do not infer semantic absence from blob inequality.

### PR #125: Migration 145: STO order_assignments readiness

Base: `integrate/landing-v3-on-121-20261008` at `f4edfbb11a6aed7d0f4d72c1963c601db12671c2`.

Source head is an ancestor of candidate; migration 145 and its tests/workflows remain. Manifest/config advance to 146 through #130, so whole-file inequality versus #125 is expected.

### PR #126: Client booking handoff, explicit service and guarded slots

Base: `main` at `673826b9c4559b5f1dda22d1e79a6a7a19b302e0`.

Recovery test and report are absent. Client request delegation and modal cleanup source additions are not present; slot/transaction changes also do not match. Delta is absent as an integration, not a claim that existing booking has no functionality.

### PR #127: AI surface-map path gate

Base: `integrate/landing-v3-on-121-20261008` at `f4edfbb11a6aed7d0f4d72c1963c601db12671c2`.

Both net changed files have identical Git blob SHAs.

### PR #128: Universal ELM transports and accepted-only offline acknowledgment

Base: `main` at `5862c845c6262f22844fc13fcdb998aae2d1058f`.

New workflow/test are absent; BLE/Wi-Fi bridge methods, capability controls and accepted-only acknowledgment additions are absent. Existing OBD functionality remains.

### PR #129: Home-only logo, contextual shell, Back and ECU entries

Base: `main` at `5862c845c6262f22844fc13fcdb998aae2d1058f`.

mobile_back.js is byte-identical; shell bundle contains all six meaningful added blocks. Canonical header/ECU CSS and home/services ECU entries are absent; dedicated regression test/CI step absent. Do not replace the whole older runtime bundles.

### PR #130: Migration 146: parts_request_offers readiness

Base: `fix/pr123-order-assignments-readiness-20261010` at `0d5f62aff257b466233f93c74e403ca11d7ba23f`.

All five net files have identical Git blobs; source head is an ancestor. DB version 146 present in source only; no deployed-state claim.

### PR #131: SW manifest, city filter, notifications and stale-response guards

Base: `main` at `5862c845c6262f22844fc13fcdb998aae2d1058f`.

Six of seven files are byte-identical. Parts file differs, but the sole source addition if(!cityMatch(product,'store'))return is present in storeDirectory. Autonomous source regression passes. Async guards are checked as source markers only, not runtime race tests.

### PR #132: Provenance preflight and offline file inventory

Base: `main` at `5862c845c6262f22844fc13fcdb998aae2d1058f`.

Provenance CLI, both PHP tests and release checklist are byte-identical. Inventory script/tests have evolved and differ; source inventory CI step and report absent. Review replacement semantics before calling full source PR integrated.

## Verification

- Exact audit HEAD CI: 9/9 completed/success. Feature-preservation run 38611260104;
  Application gates 38611259911; AI governance 38611260049. These are GitHub CI results,
  not evidence for live staging or hardware.
- Local feature-preservation self-test: PASS (72 routes, 19 files, RU/KK/EN).
  All 21 inputs (critical files, baseline and gate) match the candidate Git blobs.
- Existing #131 test: PASS (five SW and two city scenarios). Notifications, schedule
  and exchange checks here assert source markers; authenticated/race runtime remains NOT RUN.
- Python/Node checks run on local fixtures only. PHP binary absent: local PHP tests NOT RUN.
- Blob equality proves matching source bytes only. Different bytes do not prove a
  conflict, regression or lost feature. No conflict is asserted without a reproducer.
- No server, HTTP, DB, migration application, deployment, merge or APK action performed.

## Increment and rollback

This increment adds only this report and its JSON snapshot. Product code, generated
bundles, baselines, workflows and migrations are unchanged. Coverage is N/A for this
report-only change. Revert the two added files to roll back the inventory.
New commit CI must be recorded separately; do not inherit a previous head's green status.

## Next three increments

1. Reconcile #129 missing source CSS, home/services ECU entries and focused regression
   wiring; preserve the already identical Back implementation and regenerate bundles
   using their actual source/build pipeline. Include RU/KK/EN and mobile/menu/city checks.
2. Reconcile #128 transports and accepted-only offline sync, with negative-path tests;
   hardware remains NOT RUN.
3. Reconcile #126 booking and #124 recovery serially, avoiding shared API/DB contract
   overwrites; verify #132 inventory-tool replacement and CI wiring before full acceptance.

Keep PR Draft / DO NOT MERGE. The full integration is not complete.
