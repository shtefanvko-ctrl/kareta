# /services root group cards — additive illustration pass

Source base: PR #192 (Landing Canon v2 addendum), no API/router/identity changes.

| Route | Existing behavior | New optional artwork | Verify |
|---|---|---|---|
| `#/services` | 7 group cards, service counts and group href | 7 filled 52×52 SVGs from 120-icon light sprite | Root cards still navigate, 320/390/768/1366/1440/1920, zoom 200% |
| `#/services/group/*` | leaf category icons via `referenceServiceIcon` | unchanged | Test group and back |
| `#/services/category/*` | leaf/service cards | unchanged | Test cards, select, price |
| Client/Master/STO navigation | existing outline icon IDs | unchanged | No menu or CSS regression |

Icon provenance: `assets/icons/kareta-client-120/manifest_canon.json`, CC BY 4.0 Font Awesome filled art. External SVG `use` is same-origin, per existing Tabler sprite mechanism. Browser rendering/CSP/accessibility/Android need QA. Do not treat absence of CSS/JS compile errors as a visual PASS. Dark-themed card variant NOT wired because /services canonical surface is light and its runtime dark theme is unverified.

New CSS limited to `.k-services-reference-layout .k-services-ref-grid--groups` subtree; no changes to header/bottom nav/route loader/asset registry, no new API calls or extra page route. The icon is decorative (`aria-hidden`), title remains the link's accessible name.

Local contract test: `node tools/test_services_group_120_icons.js`. No deployment.

## Local isolated QA evidence — 2026-11-07

- Exact parent SHA `6c30729eb25ceb2be77a2c0c05fa1d4e62991ac0` extracted from official GitHub tarball into an isolated /tmp directory on Teacher-Boot, no website API or production connections. The CSS reflow rule was first applied and visually tested there.
- Node: `node --check js/next/pages/services.js` PASS; `node tools/test_services_group_120_icons.js` PASS; `node tools/test_kareta_client_120_canon.js` PASS; `node tools/test_kareta_brandbook_addendum.js` PASS.
- Local Firefox headless static harness used exact `referenceGroupCard` renderer extracted from source, exact CSS and actual external same-origin sprite. Firefox requested HTML/CSS/SVG with HTTP 200. All 7 icons visible at CSS widths 320/390/768/1440; document scrollWidth equalled clientWidth after fixing a **fixture-only** padding/box-sizing mistake.
- At effective CSS width 195 (emulating 200% zoom on 390px), existing 2-column cards overlapped Russian headings, with `scrollWidth===clientWidth` despite visual text overlap. Adding the scoped <=270px single-column reflow fixed it; checked 195 and 390 screenshots before/after. Normal 320/390 two columns preserved.
- Note: headless Firefox screenshot at 195 is an **effective viewport simulation**, not a verified interactive browser-zoom or WebView run. Route click-through with real auth/catalog, full CI exact new SHA, keyboard/screen-reader and Android E2E remain NOT RUN.
- Baseline unrelated failure: `node tools/test_services_reference_rewrite_84_35.js` FAILS because it expects `k-community-reference-composer k-services-reference-composer` in services.js; this exact string was **already absent in PR #192 parent**, verified by comparing parent vs PR #195 source. Not caused by this icon PR; do not fudge obsolete test to PASS.
