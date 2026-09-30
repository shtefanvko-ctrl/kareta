# KARETA.KZ — Current engineering plan

Current web/runtime release: **188.5.5.6.84.152**  
Working branch: `release/reconcile-84.152`  
Merge target: `main`

## Current branch reality

84.152 reconciles the complete 84.146–84.151 web/runtime line with the current `main`.

- reconciliation merge: `a7df986cee0d1e05895bbb93290dbc03111b9dac`;
- current main at reconciliation: `d2873bbde16ec985ad14e8ff892df5ccbd7cf3b4`;
- 84.151 candidate: `6685ad9e02531dfa653aacd1f1eaf1c7c5a4cecc`;
- common merge base: `5d333d5e67857d91a44a653e725fb2924eef2004`;
- current main is the first parent and 84.151 is the second parent;
- the only path changed on both sides since the merge base was `index.php`;
- the resolution preserves the 84.151 runtime/bootstrap/404 behavior and the newer city-calm preloader from current main;
- all unrelated current-main social/print/assets changes remain present;
- staging remains **NOT VERIFIED** until this 84.152 candidate is deployed and the external staging verifier passes.

Android Native API 6 remains preserved: structured bridge errors, durable `offlineAcknowledge`, separate adapter-connected/ECU-ready state, and migration-owned OBD schema at DB 135.

## Priority state

### P0 — migration numbering / manifest divergence — CLOSED IN 84.149

Historical branches reused migration numbers 130–134 for incompatible operations. The migration runner preserves an already-applied version even when its checksum differs, so assigning new required work to one of those numbers would be unsafe.

84.149 establishes a deterministic compatibility boundary:
- active `api/migrations/` is now a strict canonical chain **1..135**;
- versions **130–134** are deliberate side-effect-free collision bridges;
- original conflicting sources are preserved under `api/migrations_pending/historical/` and are never executed;
- version **135** owns `obd_diagnostic_sessions` for Android Native API 6;
- PHP manifest, JSON manifest and `KARETA_DB_VERSION` are all **135**;
- CI verifies manifest checksums, bridge no-side-effects, historical archive presence and OBD schema ownership.

Any still-required behavior from historical 130–134 files must be re-authored as a new idempotent migration beginning at **136**.

### P0 — GitHub CI verification gate

`.github/workflows/verify.yml` now runs on pull requests and pushes to `main` and the working branch. It verifies PHP/JS syntax, migration contracts and the current release contract.

Repository branch protection must require the `verification-gate` status before merge. That GitHub repository setting is outside the writable connector available in this engineering session, so the workflow exists but the branch-protection requirement must still be enabled in GitHub Settings.

### P1 — release/version metadata

`inc/asset_version.php` and `sw.js` are synchronized at 84.149. `docs/release/current.json` is the human/machine release snapshot; `tools/test_current_release_84_149.js` fails on release or DB-contract drift.


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

84.152 is **not marked staging PASS until that deployed check succeeds for this exact candidate**. The verifier now walks every lazy route CSS/JS asset and requires HTTP 200, correct MIME and the current release token.

### P1 — Master/WebView visual consistency

84.150 removes five structural UI causes recorded as WV-07..WV-11:

- Master outer content width inherits the canonical 1280px route frame instead of competing with a 1420px role-local frame;
- Smart Action Hub / `Ещё` has one visual active state instead of showing the current route and More as simultaneously active;
- Master Chat/Orders FABs are a horizontal quick rail with reserved scroll clearance and disappear under navigation overlays;
- route asset failures no longer expose internal asset filenames or raw loader exceptions in the UI;
- the public Masters filter rail is full-bleed and scroll-padded on narrow WebView widths.

Code regression is gated by `tools/test_master_ui_contract_84_150.js`. WV-07..WV-11 remain evidence-open until narrow-WebView before/after screenshots are collected.

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
4. Canonical migration chain remains 1..135; historical collision sources stay non-executable and any future migration starts at 136.
5. 404, Client and Master routes retain the same outer desktop alignment at representative widths.
6. Changelog and `docs/release/current.json` match the merged commit.
