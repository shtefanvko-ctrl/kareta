# KARETA 188.5.5.6.84.157

## Scope

Canonical UI recovery after the live 84.154 visual audit.

## Confirmed defects addressed

- burger menu rendered icon slots without visible SVGs;
- full-logo runtime owner and asset registry used different paths;
- guest/profile drawer lacked the same deterministic avatar fallback already used by the More surface;
- location pin existed in markup but required a stronger shell visibility contract;
- lazy route CSS could fail a route on a delayed/missed load event and had no controlled retry;
- shell/menu radius and glass styling had no explicit canonical token layer.

## Canonical ownership

Full logo:

`assets/logo/main/kareta_logo_full.png`

Icon system:

`js/next/ui_icons.js` / `KaretaUIIcons`

Shell/menu canonical layer:

`css/next/canonical_ui_84_157.css`

Canonical shell radius tokens:

- small: 5px
- medium: 10px
- large: 18px

## Burger menu

`shell_menu.js` now treats `KaretaUIIcons` as a required runtime dependency.

Every route item receives a deterministic SVG. If a mapping is unexpectedly absent, a visible warning SVG is used instead of an empty icon slot.

The drawer profile area always renders either:

- the account avatar; or
- deterministic initials.

## Location control

The existing inline location SVG remains the source of truth. The canonical shell layer explicitly protects its size, visibility, stroke, and opacity from late CSS overrides.

## Lazy CSS

Route stylesheet loading now:

1. checks whether the stylesheet has already been applied through `link.sheet` before declaring a timeout;
2. performs one controlled cache-bypass retry after a genuine timeout/load error;
3. fails after that retry instead of retrying indefinitely.

This directly covers the observed `route_style_timeout:css/next/work_feed.css` failure mode without hiding persistent missing assets.

## Verification

`tools/test_canonical_ui_84_157.js` enforces:

- zero stale full-logo references in runtime owners;
- canonical full-logo registration;
- eager canonical UI layer;
- icon registry dependency for burger menu;
- deterministic burger icon fallback;
- avatar fallback;
- canonical 5/10/18 radius tokens;
- visible menu/location SVG contract;
- lazy CSS applied-sheet detection and exactly bounded retry;
- declared and existing `work_feed.css`.

The test runs in both `verify` and `Application gates`.

## Boundaries

- no DB migration;
- DB canonical version remains 137;
- 84.155 safe DB auto-upgrade remains intact;
- 84.156 Plesk runtime-pressure recovery remains intact;
- no Android changes;
- no data reset or reseed.

## Acceptance

This candidate is not `CANONICAL UI PASS` until exact-head CI passes and the Plesk candidate is visually re-tested on the major Client/Master/STO/Seller surfaces.
