# KARETA.KZ — Current engineering plan

Current web/runtime release: **188.5.5.6.84.148**  
Working branch: `import/kareta-current-84.142`  
Merge target: `main`

## Current branch reality

The Native API reconciliation is now committed. The working branch is **0 behind** `main`; `main` head `5d333d5e67857d91a44a653e725fb2924eef2004` is an ancestor of the working branch. Ahead-by may continue to increase as verification/planning commits are added.

Merge commit `d0660fa1f9c562e826c5f8e81707f837368075cf` reconciled the Android Native API 6 delta with the 84.148 web/runtime line. The three Native API files were unchanged on the web branch since the previous main merge, so the main versions were transplanted without dropping later web/runtime work.

## Priority state

### P0 — migration numbering / manifest divergence

Repository cause: canonical runtime is intentionally DB **129**, while parallel work had left duplicate active filenames for 130, 131 and 132 plus 133/134.

Correction in 84.146:
- active `api/migrations/` is the canonical 1..129 chain;
- unpromoted 130+ work is quarantined under `api/migrations_pending/`;
- PHP manifest, JSON manifest and `KARETA_DB_VERSION` remain 129;
- migration verification now enforces the same boundary.

Do not bump the database version until pending operations are reconciled into an idempotent monotonic sequence against a production-like DB snapshot.

### P0 — GitHub CI verification gate

`.github/workflows/verify.yml` now runs on pull requests and pushes to `main` and the working branch. It verifies PHP/JS syntax, migration contracts and the current release contract.

Repository branch protection must require the `verification-gate` status before merge. That GitHub repository setting is outside the writable connector available in this engineering session, so the workflow exists but the branch-protection requirement must still be enabled in GitHub Settings.

### P1 — release/version metadata

`inc/asset_version.php` and `sw.js` are synchronized at 84.146. `docs/release/current.json` is the human/machine release snapshot; `tools/test_current_release_84_146.js` fails on release drift.


### P1 — WebView/static cache without stale releases

84.147 changes static JS/CSS/image/font loading to **cache-first inside a release-scoped Service Worker cache**. A route asset is fetched once per release and reused on later route visits. A new `KARETA_ASSET_VERSION` creates a new cache namespace, so changed assets are fetched under the new release instead of being pinned indefinitely.

Missing static files must return a real HTTP 404; they must never fall through to `index.php` as HTML because WebView will reject that response for CSS/JS and surface `route_*_load_failed`.

This layer is intentionally separate from API/content caching. API reads keep their own freshness/revalidation contract so user data is not treated as immutable static content.


### P1 — App-like content reuse / stale-while-revalidate

84.148 separates **render freshness** from **network freshness**. Services, Masters and Community keep usable content on screen when the user revisits a route. Expired data is refreshed in the background; the DOM is repainted only when the returned content signature changes.

Refresh triggers are TTL expiry, network recovery, app/WebView resume for mounted surfaces, and relevant `kareta:realtime:event` events. Services and Masters keep release-scoped `sessionStorage` snapshots, so same-tab WebView reloads do not immediately fall back to skeletons. Community remains server-authoritative and memory-only, but route revisits no longer blank its feed during revalidation.

The cache is not an alternate database: server/API remains authoritative, mutations and realtime changes force revalidation, and a release bump changes cache namespaces.

### P1 — staging verification

Old release-numbered staging artifacts remain historical evidence only. Current verification entry point:

```bash
python3 tools/verify_staging_current.py --base-url https://s.kareta.kz
```

84.148 is **not marked staging PASS until that deployed check succeeds**. The verifier now walks every lazy route CSS/JS asset and requires HTTP 200, correct MIME and the current release token.

### P4 — legacy authorization

The current 84.146 inventory is **108 direct role gates across 8 files**, including **96 in `api/db.php`**. This is a regression from the historical 84.109 stage report (68/50). `tools/audit_legacy_role_authorization_current.js` now enforces a measured per-file no-growth ceiling from `docs/architecture/LEGACY_ROLE_BUDGET_CURRENT.json`. Remaining direct role gates are technical debt, not an authorization pattern for new work.

### P4 — issues / changelog / plan

This file and `docs/release/current.json` supersede the 84.109 release-master-plan documents for current work. Historical stage reports remain immutable evidence.

## UI contract

- `#k-page-outlet` owns viewport space and outer gutters.
- The first route root has one desktop content frame instead of per-route 1180/1200/1240/... outer widths.
- Unknown hashes render a first-class KARETA 404 surface and retain the invalid URL.
- Master shell remains role-specific but follows the same geometry discipline as Client.
- Route modules may control internal grids, but may not redefine the application's outer desktop frame.

## Android WebView defect program

The screenshot-driven defect inventory, technical ownership, remediation order and two-pass acceptance route are tracked in:

`docs/engineering/ANDROID_WEBVIEW_DEFECT_PLAN_84_148.md`

This document is normative for the current Android WebView stabilization cycle. In particular, raw route loader failures, empty API surfaces, repeated route skeletons and navigation/layout overlap are release blockers for the Android shell even when desktop/browser verification passes.

## Definition of Done for merge to main

1. `verification-gate` passes.
2. Android Native API 6 reconciliation contract passes and `main` remains an ancestor of the working branch.
3. Staging verifier passes against the intended KARETA staging host.
4. No active migration exists outside canonical manifest 1..129 until the pending migration promotion is explicitly approved.
5. 404, Client and Master routes retain the same outer desktop alignment at representative widths.
6. Changelog and `docs/release/current.json` match the merged commit.
