# 120 KARETA client icons — opt-in addendum to Landing Canon v2

This repository directory is the **readable agent reference** for the project's existing 120-icon Font Awesome Free solid package. It is NOT a replacement for `js/next/ui_icons.js`, `assets/icons/tabler/` or the live icon asset manifest.

- The **original** ZIP, its 120 SVG + 120 PNG, 8 cutting sheets in SVG/PNG, and their stable IDs are preserved.
- `manifest_canon.json`: 120 mappings with legacy source SVG/PNG, new light/dark variants and sprite symbol IDs. The `canon_v2` colored variant files themselves are delivered as part of the updated ZIP stored in ChatGPT project Library `/kareta.kz/docs/design/KARETA_CLIENT_120_HQ_SVG_PNG_CANON_V2_ADDON.zip`.
- `kareta-client-120-mono-sprite.svg`: **120 currentColor filled symbols**. `kareta-client-120-light-sprite.svg` and `kareta-client-120-dark-sprite.svg` contain the same 120 symbols with audited color variants, so code-only GitHub agents can reference the corresponding theme without the full ZIP. Example opt-in `<svg viewBox="0 0 512 512" role="img" aria-label="Главная"><use href="/assets/icons/kareta-client-120/kareta-client-120-mono-sprite.svg#k120-001"/></svg>`. Do not inject unvetted `<use>` into protected runtime or assume all CSP/cache policies support this without a separate QA.
- License: Font Awesome Free icons CC BY 4.0. Keep attribution and reference https://fontawesome.com/license/free . 120 source glyphs are NOT newly authored 1.9px outline icons by KARETA. Derived recolor is not an ownership transfer.

## Visual usage rules

**Allowed:** large service/category cards, feature illustrations, documentation; min recommended visible glyph 48 CSS px, white light or dark card, visible caption.

**Not drop-in allowed:** small navbar/action icons. Use current `KaretaUIIcons` and 39 Tabler 3.48.0 outline glyphs for 16/18/22/28px (1.9 stroke). If the concept is missing, create a dedicated small-outline SVG and get it approved, do not use the filled silhouette as if it were outline.

Light: glyph #474747 / accent band #B84902 on white: contrast 9.291:1 and 5.261:1. Dark: glyph #F7F7F5 / orange band #FC6606 on #1B1F26: 15.408:1 and 5.543:1. No white body text on #FC6606.

Check source integrity and the full variant ZIP before any future import. No live JS/CSS imports in this documentation PR. Production NOT CHANGED.

Read `docs/design/LANDING_CANON_V2_ADDENDUM.md` and `ai/rules/design-system.md` before changing these assets.