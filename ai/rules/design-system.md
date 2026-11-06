# KARETA Design System / UI / SVG Rules

For every new or modified UI, auth/registration screen, map pin, icon, theme, graphic or visual QA, read:
1. `AGENTS.md` and this routed rule.
2. `docs/design/KARETA_BRANDBOOK_V3.md` (candidate semantic design guide).
3. `docs/design/color_tokens_v3.json`, `contrast_matrix_v3.csv`, `contrast_pairs_v3.csv`.
4. Existing owning CSS/JS, the authentic logo and the current live surface contract.

## Precedence / migration
- Use authentic logo `assets/logo/main/kareta_logo_full.png` (the landing uses a decoded copy); never recreate or recolor it.
- White landing canon is primary: #FC6606 brand mark / #474747 graphite / #FFFFFF white / #F7F7F5 soft.
- The brandbook v1 blue #2563EB is historical, NOT a new default brand CTA.
- The current `landing/styles.css`, `css/next/design_contract.css`, `css/next/icon_standard.css` differ in places. Treat this as design drift; do NOT bulk-swap tokens or rewrite current runtime without an independent reviewed migration.
- This file/doc is **reference introduced by a PR**; it becomes the agent default only after merge to main. It does not itself confirm browser QA, deployment or production behavior.

## Mandatory contrast and accessibility
- Verify **actual** sRGB foreground/background (including translucency) via the WCAG relative luminance method.
- Normal text ≥4.5:1; large text and meaningful UI/icon borders ≥3:1. Checked derived text tones target ≥5.25:1 on canonical white/dark card.
- Bright brand #FC6606 with white copy fails normal AA (~2.982:1). For light UI use derived dark-orange CTA and white text; for dark UI bright orange CTA with dark ink text can pass.
- Disabled/selected/focus/error state also has a label, shape or border; color never acts alone. Review RU/KK/EN, keyboard focus, 320/390/768/1440 widths and both themes.

## SVG canon
- Reuse existing `KaretaUIIcons` from `js/next/ui_icons.js` and 39 vendored Tabler 3.48.0 (MIT) in `assets/icons/tabler`, rather than creating duplicate IDs.
- New onboarding-category icons in `assets/icons/kareta/` are standalone SVG: 24x24, 1.9 outline, round joins/caps, fill none and stroke currentColor. No embedded JS, remote references or hardcoded semantic color.
- Preserve icon ID mappings, asset loading/manifest, logo provenance and existing licensing.

## Verification
- `node tools/test_kareta_brandbook_v3.js`: checks calculated AA/AAA-target pairs, known negative case, JSON source colors, SVG source rules. Separate manual/browser visual QA is still required.
- Mark PASS/FAIL/NOT RUN, and do not imply deploy or production until evidence exists.
