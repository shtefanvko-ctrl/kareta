# KARETA design — continuation of approved Landing Canon v2

For any visual/UI task (including auth, registration, CSS, icons, mobile, map, light/dark):
1. Read AGENTS.md and ai/CONTEXT_ROUTER.md.
2. Read the literal approved 12-slide original transcript: docs/design/LANDING_CANON_V2_SOURCE.md.
3. Read ONLY the appended extension: docs/design/LANDING_CANON_V2_ADDENDUM.md.
4. Read numeric reference: docs/design/canon_v2_addendum_tokens.json, contrast_matrix_v2_addendum.csv, contrast_pairs_v2_addendum.csv and hue_compatibility_v2_addendum.csv.
5. Inspect actual owner files, existing UI and verified references; do not redraw source brandbook or claim production changed.

## Single canon, not a new brandbook
- Landing Canon v2 is authoritative: the authentic KARETA logo, #FC6606 orange, #474747 graphite, #FFFFFF white and #F7F7F5 soft.
- The source presentation's first 12 slides remain untouched; its 15-slide addition (slides 13-27) exists in the project Library at /kareta.kz/docs/design/KARETA_KZ_brandbook_landing_canon_v2_EXTENDED.pptx.
- Historic v1 blue #2563EB is NOT a primary brand CTA.
- Do not add another canonical deck, palette or CSS layer. The old parallel v3 draft was archived and replaced by this additive correction.

## Root regression problem
- CSS color drift: landing/styles.css #ff6500, css/next/icon_standard.css #ff6b00 fallback, design_contract.css #111827 text / #f5f6f8 page vs brand references.
- Geometry drift: multiple overrides of shell/header/bottom nav/z-index/fixed/overflow create repeat mobile overlaps, horizontal scroll and icon disappearance.
- Correct the actual owner module, not the symptom with another global CSS override or new router; preserve active role headers/nav, Identity, API and existing verified behavior.
- New visual changes require responsive checks 320/390/768/1366/1440/1920 and states default/selected/focus/disabled/empty/error, plus RU/KK/EN and 200% zoom.

## WCAG 2.2
- Ordinary text >=4.5:1; large text or necessary nontext indicators >=3:1. Actual composited background, not merely the design token, must be used.
- #FC6606 with white copy is 2.982:1 and fails normal AA; do not change the logo (logotypes are exempt). Use computed dark #B84902 + white on light CTA; use #FC6606 + #0B1220 for dark CTA.
- WCAG 2.5.8 target minimum 24x24 CSS px WITH exceptions; KARETA mobile product target 44-48 px (preferred, not mandatory by WCAG).
- No color-only statuses. No semantic status color applied as a competing brand accent.

## Icons and review
- Reuse js/next/ui_icons.js and assets/icons/tabler/ Tabler v3.48.0 MIT. The four independent optional SVG under assets/icons/kareta/ are only category supplements, NOT connected to runtime.
- New SMALL outline SVG: 24x24 viewBox, currentColor stroke, fill none, stroke-width 1.9, round caps/joins; preserve icon IDs, license and real project logo.
- Existing KARETA_CLIENT_120_HQ_SVG_PNG.zip has 120 Font Awesome Free filled glyphs (CC BY 4.0). Its unchanged original + light/dark supplemental variants are documented at `assets/icons/kareta-client-120/README.md` with `manifest_canon.json` and monochrome sprite. **These solid glyphs are NOT canonical 1.9 outline**: large cards/illustrations >=48px only; NEVER drop-in replace small navigation/controls with them. Do not remove upstream attribution.
- Offline contracts: node tools/test_kareta_brandbook_addendum.js and node tools/test_kareta_client_120_canon.js; structural XML, browser visual, contrast against image backgrounds, CI and production remain separately verified.
- No merge/deploy claims without evidence. This rule becomes default-branch accessible only after the PR merges; until then it is visible on this branch and project Library.
