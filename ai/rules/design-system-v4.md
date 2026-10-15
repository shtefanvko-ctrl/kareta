# KARETA Design System v4 — non-destructive adoption contract

Status: **RULES + REGRESSION HARNESS**, not a UI redesign or screenshot acceptance. This document extends the existing `ai/rules/visual-canon-v3.md` and `docs/harness/DESIGN_SYSTEM_POLICY_V1.md`; it does not replace them or claim production readiness.

## Sources and ownership
- Keep `css/next/design_contract.css` as the single canonical owner of shared design tokens. Do not re-declare canonical tokens in role/page CSS, and do not edit generated bundles as the source.
- Shared components own reusable buttons, fields, lists, modals, cards, focus/disabled/loading/error states; role CSS owns scoped differences; page CSS owns layout only.
- Preserve the actual shell/route ownership from `ai/SURFACE_MAP.json`. Do not add a second router, Back handler, modal manager, design-token store or duplicated car-entry wizard.
- Preserve established token values, shared component semantics, existing three themes and visual assets unless an approved migration deliberately changes them.
- The existing v2 token *implementation* remains authoritative until changed independently and verified. "v4" here names the governance and acceptance contract, **not** a silently shipped CSS v4.

## Visual invariants
1. Home shows the original full KARETA PNG logo and the home actions. Interior pages show only a compact contextual header with one reliable Back handler, title, proper safe areas and an unoccluded bottom navigation where applicable.
2. The ECU diagnostics entry stays on home **without requiring a garage car**. Garage diagnostics pass the explicitly selected vehicle; never auto-bind a previous car.
3. Document scanning retains front/back camera, gallery, retake, optional OCR with explicit uncertainty, manual fallback and review before car creation. Do not display demo OCR as user data.
4. Client/master/STO/seller/admin screens reuse design tokens and shared components with role-specific navigation and server-validated actions. UI hiding never becomes authorization.
5. Marketplace categories, stores, prices and stock use real catalog identities and existing APIs. No incorrect lock icon from group-name guessing; no fabricated offer or availability.
6. Community, messaging, orders, booking, notifications and finance retain their current owners and persisted data; empty/loading/error/success states must be truthful.
7. Floating controls must not cover the Back action, form fields, modal actions, bottom navigation or scanner controls. Do not re-introduce a universal interior brand header.
8. Maintain RU/KK/EN without a full page re-render that resets state, the three themes, visible focus, touch-target/accessibility semantics, and consistent navigation for narrow screens.
9. Phone validation widths: 320, 360, 375, 390, 412, 430 CSS pixels; also verify tablet and desktop at the existing 767/768/1199/1200 breakpoint boundaries.

## Safe implementation sequence
- Record the screen/role/state defect and **reproduce it** on a named candidate before attributing its cause.
- Find actual component, CSS source, lazy-loader registration, boot bundle, SW and CDN version relationships; change the smallest owning source.
- Verify the changed route, one unaffected route, the generated asset parity, native/WebView where applicable, and RU/KK/EN. Source-level checks do not replace a browser screenshot comparison.
- Compare to the approved image/reference for every changed state, including missing data, denied access, offline, load, form validation and modal transitions. Capture viewport, role, theme, language and exact SHA.
- Avoid large-scale CSS deletion while selectors remain UNKNOWN. Do not weaken old gates or substitute mocks for missing genuine data.
- For a visual fix, mark **VERIFIED** only if required focused source checks **and** actual browser/device evidence pass on the same candidate. **DEPLOYED** requires release/provenance proof; do not infer from HTTP 200 or green CI.

## Executable and manual evidence
- `ai/DESIGN_CANON_V4.json` stores a **test configuration**, not route/data truth; route URLs remain owned by the existing registry.
- `tools/test_design_system_v4_contract.js` validates invariant references and does an explicit negative-path fixture check.
- `.github/workflows/design-system-v4.yml` runs the v4 manifest validation together with the existing v1/v3 token, shell, Back, logo, scanner and route regressions for the exact PR head. These are **repository-only** checks.
- Genuine comparative screenshots, Android/ELM, live API/DB, authenticated roles, Cloudflare and staging checks are **NOT RUN** by this harness, even when it passes.
- Do not merge or deploy as a side effect of design governance. Rollback is reverting the docs/manifest/test/workflow changes; no UI runtime is mutated here.

## Next implementation increments
1. Map 12 approved reference screens to existing route/component owners, and record state coverage (roles, themes, languages, widths, real data).
2. Run real mobile/browser screenshot comparison, fix reproducible P0 logo/header/Back/ECU regressions first, then scanner and marketplace.
3. Consolidate duplicated active CSS selectors only after proving unchanged computed style and bundle output.
