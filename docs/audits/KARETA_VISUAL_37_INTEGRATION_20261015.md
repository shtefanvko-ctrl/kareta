# KARETA.KZ — Integration of 37 visual reference screens

Date: 2026-10-15. Design reference: three user-supplied collages (12 master/STO setup, 13 marketplace, 12 STO workspace screens). User approved implementation after visual prototype review. This document records implementation state, not a claim that 37 production screens are complete.

## Source-of-truth and operating constraints

- Canonical development lane: PR #133, branch `integrate/all-features-staging-20261014`; confirm HEAD before each edit. No alternative source of truth, router, catalog or onboarding.
- Read `AGENTS.md`, `ai/CONTEXT_ROUTER.md`, `ai/SURFACE_MAP.json`, `ai/CHANGE_LANES.md`, `docs/KARETA_UI_LOCK_RULES.md` and target-page code.
- Latest product instruction: brand/wordmark on home; internal pages have consistent Back + specific heading. Existing shell layout is locked; reconcile before any shared-shell change. Never silently remove a navigation function.
- Shared visual tokens: `css/next/design_contract.css`; canonical brand asset: `assets/logo/main/kareta_logo_full.png`.
- Preserve identity, capabilities, RU/KK/EN, three themes, all protected routes, garage/first vehicle, native ELM327, QR/document scanner, orders, chats, community, client shop, seller contracts.
- No fake status, product stock, prices, supplier affiliation or bookings. Existing server API is authoritative.
- Prior instruction to leave server checks alone remains respected. No staging/production deploy on failing/incomplete exact-head gates.

## Implementation record: P0-A (source change only)

Changed in this lane:
- `js/next/pages/master_onboarding.js`: remove stale `/assets/onboarding/kareta_logo_full.png` reference from **internal** onboarding header. Keep existing `data-kmo-back` behavior; introduce compact master setup title with accessible Back label for RU/KK/EN and a bounded language-only DOM observer, disconnected on unmount. Add presentation-only modal discriminator.
- `css/next/master_onboarding.css`: use `--k-accent`; two-column grid for existing specialization choices only; semantic inner heading; keep shell brand hidden while internal master onboarding is open at desktop widths.
- `tools/test_master_onboarding_visual_canon_20261015.js`: focused static contract checks, no new CI workflow or server changes.

The authorization/session flow, draft persistence, service catalog, price API, route registry and lazy loader were not replaced.

Evidence obtained: updated JS syntax compiled; source contract assertions passed against fetched HEAD blobs; the isolated local WSL clone ran `node --check js/next/pages/master_onboarding.js` successfully on a descendant including P0-A. Browser/Android/device/role and full CI acceptance are NOT yet verified. GitHub branch remains draft / DO NOT MERGE / DO NOT DEPLOY until all required gates are green and released separately.

## Remaining screen groups

| Ref group | Screen families | Source owner | Next change |
| --- | --- | --- | --- |
| A01–A12 | Master/STO role, specialization, services, prices, inventory, preview | `master_onboarding.js`, `service_management.js`, existing STO pages/API | Verify role-specific business objects, complete ONLY missing UI without duplicate onboarding |
| B01–B14 | Marketplace, stores, product cards, new/used listing, cart, ordering | `parts.js`, `seller.js`, existing catalog and seller API | Verify category/city/product identity/stock ownership and checkout end-to-end; no made-up seller affiliations |
| C01–C12 | STO home, orders, scheduling, masters, finance, parts, reviews, community, chats | existing `#/sto`, `#/orders`, `#/finance`, `#/chats` and related modules | Audit resource/employee permissions; do not imply server-side bay booking exists without verification |

The collages contain overlapping functional pages; do not create 37 duplicate routes.

## Next three implementation increments

1. **P0-B**: inventory current shell/back ownership and existing `docs/KARETA_UI_LOCK_RULES.md` conflict; use route-scoped existing headers, test Android back/forward and dialog dismissal, avoid editing shared shell until ownership is clear.
2. **P1-A**: inspect live `master_onboarding.js` → `service_management.js` → PHP contract; improve role-specific category/service/price presentation and draft reopening; document 3-language coverage (not yet globally complete).
3. **P2/P3-A**: audit equipment, service packages, bays, staff and supplier data/API for master/STO/seller; implement missing CRUD/preview only after authoritative object/ownership checks, with negative cases.

## Required completion gates

- Exact-head PASS for affected source checks, compatibility and preservation tests, plus meaningful browser snapshots at 320/360/390/412/768/1280 and three themes.
- RU/KK/EN switching without losing form state, accessibility, safe-area/nav overlap, one Back stack.
- API contract and unauthorized-owner negative tests before any business-state changes.
- No regression in garage, diagnostics without garage, scanner/OCR, QR, orders, marketplace/seller, notifications, chat, community.
- Explicit staging release decision and proven deploy SHA before shipping; production is out of scope.
