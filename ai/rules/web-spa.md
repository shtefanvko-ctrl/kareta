# Web SPA / Lazy Runtime Rules

Load for SPA routes, pages, CSS/JS bundles, service worker, cache or client payload work.

## Canonical entry points
Start from `ai/SURFACE_MAP.json`, then inspect `js/next/route_registry.js`, `js/next/route_asset_loader.js`, `asset_manifest.php` and only the target route/page files.

## Invariants
- Reuse the existing route registry and route asset loader; do not create a parallel router or loader.
- Preserve release-scoped asset URLs and release mismatch detection.
- Route-specific JS/CSS/data stays lazy unless startup genuinely needs it.
- Login/startup must not fetch store catalogs, master datasets or route payloads not required for the first visible state.
- Prefer bounded server queries and progressive JSON slices over downloading large arrays and filtering on the client.
- Warm second navigation should reuse loaded assets/data according to the existing cache contract.
- Missing asset, invalid JSON, wrong MIME/schema or release mismatch must stay visible as a failure.

## Change gate
Before adding a helper, search for an existing route/page/state/API abstraction. If shared runtime changes, verify the changed route and one representative unaffected route.
