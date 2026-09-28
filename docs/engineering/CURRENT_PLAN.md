# KARETA.KZ — Current engineering plan

Current web/runtime release: **188.5.5.6.84.146**  
Working branch: `import/kareta-current-84.142`  
Merge target: `main`

## Current branch reality

The branches are diverged. At the 84.146 audit point the working branch is **61 commits ahead** and **3 commits behind** `main`, with merge base `1732058c6bda6a5b4e1e703c2b9d965e69449a61`.

The commits present only on `main` include the newer Android/Native API integration. The working branch contains the later web UI/runtime hardening. Neither branch alone is currently the complete release source of truth. Reconciliation must preserve both lines before merge.

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

### P1 — staging verification

Old release-numbered staging artifacts remain historical evidence only. Current verification entry point:

```bash
python3 tools/verify_staging_current.py --base-url https://s.kareta.kz
```

84.146 is **not marked staging PASS until that deployed check succeeds**.

### P4 — legacy authorization

The historical capability-migration budget remains enforced by `tools/test_legacy_role_budget_84_109.js`. Remaining direct role gates are technical debt, not an authorization pattern for new work. No new direct role gate is allowed.

### P4 — issues / changelog / plan

This file and `docs/release/current.json` supersede the 84.109 release-master-plan documents for current work. Historical stage reports remain immutable evidence.

## UI contract

- `#k-page-outlet` owns viewport space and outer gutters.
- The first route root has one desktop content frame instead of per-route 1180/1200/1240/... outer widths.
- Unknown hashes render a first-class KARETA 404 surface and retain the invalid URL.
- Master shell remains role-specific but follows the same geometry discipline as Client.
- Route modules may control internal grids, but may not redefine the application's outer desktop frame.

## Definition of Done for merge to main

1. `verification-gate` passes.
2. Working branch is reconciled with the 3 main-only commits without dropping Android Native API changes.
3. Staging verifier passes against the intended KARETA staging host.
4. No active migration exists outside canonical manifest 1..129 until the pending migration promotion is explicitly approved.
5. 404, Client and Master routes retain the same outer desktop alignment at representative widths.
6. Changelog and `docs/release/current.json` match the merged commit.
