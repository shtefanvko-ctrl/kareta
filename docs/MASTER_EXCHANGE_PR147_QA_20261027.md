# KARETA master exchange — scoped follow-up to PR #147

Date: 2026-10-27 (Asia/Almaty).

## Base and isolation
- Parent PR: #147, exact base head `4a79642aaf8a87f8bc4d7ebf73e7b757498af81e`.
- This is a stacked follow-up, not a replacement for a newer live staging tree.
- Worktree: `/home/karetadmin/kareta-audit/pr147-followup-20261027/checkout`. Neither the existing dirty `main` checkout nor staging content was edited.
- Observed local staging origin: `http://127.0.0.1:9091/` returned HTTP 200; staged source asset version `188.5.5.6.84.178.102`. Presence of newer staging does not prove the PR's files are deployed.

## Confirmed defects on #147
1. **P0 request reordering**: when a user changes a filter during an in-flight fetch, a later completion of the previous request can repaint outdated offers under the newly selected filter. The new hermetic test failed on the original source and passes after version-gating every async response.
2. **P0 lifecycle/identity isolation**: late responses could repaint after leaving the page; identity-ready/context-changed only triggered reload for an authenticated master, so loss of role did not invalidate/clear the previous master's view. The revised code invalidates on unmount, clears role-bound data on invalid identity, and guards the identity retry.
3. **P1 fallback tab mismatch**: the older workplace fallback used mutable `exchangeState.tab` after its request began; it now uses the triggering request's immutable `params.tab`, and the fallback response cannot supersede a newer request.
4. **P1 touch targets**: rendered master scope buttons were 36–39 CSS px high; tabs were 35–37 CSS px. Existing scoped CSS values were changed to 44px, including mobile overrides.

## Evidence
- Hermetic Node test `node tools/test_master_exchange_request_sequence_20261027.js`: PASS (older response, logout/context switch, unmount, delayed fallback).
- `node --check js/next/pages/work_feed.js`: PASS.
- Existing `node tools/test_r1885601_master_exchange_failsoft.js`: PASS.
- Existing `node tools/test_r1885594_exchange_mobile_cards.js`: PASS.
- `git diff --check`: PASS.
- Local Chromium fixture (mock master identity and mock offers, **not live API**): width 320, 390, 430, 768, 1440 — cards rendered, document overflow 0, major tabs/scope/response targets measured 44 CSS px. Screenshots in `/home/karetadmin/kareta-audit/pr147-followup-20261027/exchange-fixture-*.png`.
- Parent #147 GitHub Actions on its exact head: Application gates, PHP syntax, GEO, Home scanner navigation all SUCCESS. These checks are **parent** evidence, not this follow-up's CI.

## Remaining gates
- NOT RUN: GitHub Actions for follow-up head until branch is published.
- NOT RUN: authorized staging master E2E and real order/response; test uses no production data, real orders, DB writes, or WhatsApp.
- NOT RUN: Android WebView, real role-shell/nav/safe-area and pixel comparison with approved UI reference.
- VISUAL_REVIEW_PENDING: screenshots show the isolated master-exchange fixture, not owner-approved 99% visual parity.
- DEFER: reducing legacy `!important` CSS across the role shell requires an ownership audit and regression coverage of adjacent routes, not blind removal.
- Explicitly DO NOT MERGE/DEPLOY until parent #147 and newer staging source differences are reconciled and Regression Guard/Definition of Done pass.

Rollback: revert only this follow-up commit from its stacked branch. No DB, prod or staging deployment mutations.
