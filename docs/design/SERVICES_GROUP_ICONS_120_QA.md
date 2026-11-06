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
