# KARETA 188.5.5.6.84.153

## Scope

Cache-safe hotfix for the first-class SPA 404 route.

## Confirmed defect

`notFound` was declared in the route asset registry with `js/next/pages/not_found.js` and global `KaretaNotFoundPages`, but it was missing from `KNOWN_LAZY_ROUTE_KEYS` in `js/next/route_asset_loader.js`.

As a result, `ensureRoute('notFound')` returned as a non-lazy route and `app_next.js` attempted to render before `KaretaNotFoundPages` was loaded.

Observed boot error:

`KaretaNotFoundPages is unavailable for route notFound`

## Fix

- add `notFound` to the lazy route key contract;
- add a regression assertion to `tools/test_route_lazy_runtime_84_68.js`;
- advance runtime/service-worker release token to `188.5.5.6.84.153` so clients do not reuse the broken 84.152 asset cache.

## Out of scope

No Android, database schema, migrations, PHP API behavior, or deployment target changes.
