# KARETA.KZ — Visual System Rules

Release baseline: 188.5.5.6.84.135

## Icons
- Single runtime source: `window.KaretaUIIcons` from `js/next/ui_icons.js`.
- Do not create page-local icon dictionaries for entities already present in KaretaUIIcons.
- Do not use emoji as production navigation/category icons when a semantic SVG exists.
- One semantic action/entity keeps the same icon in header, mobile nav, right rail, cards, dialogs and pages.
- Base visual contract is defined in `css/next/icon_standard.css`: currentColor, no fill by default, rounded stroke, one common stroke weight.
- Orange is the service/action accent; inactive icons use current text/muted color.
- The generic UI key `filter` is reserved for filtering controls. Automotive air filter uses `airFilter` / `air_filter`.

Core semantic keys:
`menu bell search services location parts calendar chats masters home orders plus oil diagnostics battery brakes tires suspension paint grid airFilter sparkPlug serviceStation`.

## Visual automotive assets
- Single runtime registry: `window.KaretaVisualAssets` from `js/next/visual_assets.js`.
- Assets live under `/assets/reference/automotive/` and `/assets/reference/brands/`.
- Pages should resolve standard fallback imagery through KaretaVisualAssets instead of duplicating literal paths.
- User/uploaded entity images always take priority over reference fallbacks.
- Reference vehicle fallback currently covers Toyota, Lexus, Kia and Hyundai.
- Parts use category-aware fallback images only when the product/listing has no image.
- STO cards may use the common service-station fallback only when no logo/avatar exists.

## Vehicle brands
- Brand logo registry contains the approved supplied set and is addressed by normalized brand key.
- Use `KaretaVisualAssets.brandLogo(brand)`; do not duplicate brand-to-path maps.
- Brand logos are supporting identity visuals, not replacements for textual brand/model labels.

## Responsive shell
- <600px: legacy mobile header + bottom navigation.
- 600–1023px: right-side compact vertical navigation rail.
- >=1024px: right-side expanded vertical navigation rail.
- Header keeps back, KARETA logo and shell actions; desktop navigation must not return to the top row.

## Home
- Home visibility/width safety is eager CSS.
- Detailed tablet/desktop home grids are route-lazy.
- Never hide or detach `.k-home-reference--app` at 600px+.
