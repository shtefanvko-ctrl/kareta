# Design System v4 — phased rollout and evidence ledger

**Date:** 2026-10-15
**Candidate line:** PR #133 `integrate/all-features-staging-20261014`.
**Status:** Governance and repository regression automation IN IMPLEMENTATION; runtime screenshots and APK are NOT RUN. No new design source or visual baseline is claimed approved by this document.

## Existing owners; do not duplicate
- Shared tokens: `css/next/design_contract.css` (existing implementation is v2).
- Existing design policy: `docs/harness/DESIGN_SYSTEM_POLICY_V1.md`.
- Current Android-derived visual invariant: `ai/rules/visual-canon-v3.md`.
- New v4 governance: `ai/rules/design-system-v4.md`.
- Static coverage: `ai/DESIGN_CANON_V4.json` and `tools/test_design_system_v4_contract.js`; verification workflow `.github/workflows/design-system-v4.yml`.

## Initial 12 screen families (acceptance matrix TO FILL, not fake screenshot tests)
| Family | Existing entry point to inspect | Required manual states |
| --- | --- | --- |
| 1. Client home | `js/next/pages/core.js` | Genuine logo, action order, ECU direct entry |
| 2. Inner shell | `js/next/mobile_back.js` | Compact title/Back, no brand, overlays and history |
| 3. ECU diagnostics | `js/next/pages/diagnostics.js` | No car / selected car / disconnected / unsupported |
| 4. Garage | `js/next/pages/vehicle.js` | Real car selection and creation handoff |
| 5. Document scanner | `js/next/pages/scanner.js` | Front/back, gallery, review, manual fallback |
| 6. Parts catalog | `js/next/pages/parts.js` | Accurate categories and loaded/empty/error data |
| 7. Seller workplace | `js/next/pages/seller.js` | Real stock, permissions, missing images |
| 8. Community | `js/next/pages/community.js` | Feed, question draft, empty and moderation |
| 9. Master workplace | `js/next/pages/master_onboarding.js` | Role menus, service/equipment and form states |
| 10. STO workplace | Existing STO route owner (verify in route registry) | Schedule, orders, visibility by context |
| 11. Chat/notifications | Existing message and notification owners (verify) | Loading, read/unread, denial and retry |
| 12. Admin workplace | `js/next/pages/admin_workspaces.js` | Mobile role-safe navigation, lists, no fake KPI |

## Required independent proof for a changed family
Record exact candidate HEAD, chosen official reference image, viewport 320/360/375/390/412/430 CSS px, role and server-authorized context, each of RU/KK/EN, all three themes, cold/warm navigation, visible loading/error/empty states, screenshots before/after with visual-diff tolerance, Back/modals/safe-area reachability, and relevant Android/WebView two-pass smoke.

Source unit tests and generated CSS parity run in CI, but cannot prove visual appearance, real API response, native capability, actual installed APK or live deployed SHA.

## Release/no-feature-loss boundary
72 route / 19 critical path / RU/KK/EN preservation is the existing static floor, not UX completion. Keep PR Draft / DO NOT MERGE until domain contracts and required verification are resolved. No staging, production, migration, SMS override, or server-test changes are part of this design increment.

## Next increments
1. Map approved reference screenshots to exact existing route/state + current component and generated CSS source.
2. Verify and repair the first reproducible P0 logo, inner header, Back and ECU entry regressions; collect genuine mobile evidence.
3. Validate scanner/catalog states, role-specific permissions and RU/KK/EN/three-theme visual regression, then reconfirm exact-head gates.
