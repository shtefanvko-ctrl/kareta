# KARETA.KZ 188.5.5.6.84.147

## Changed

- Static JS/CSS/images/fonts now use cache-first reads inside the Service Worker's release-scoped cache.
- Re-entering an already loaded route no longer forces a network fetch for the same static asset during the same release.
- A new release token creates a new cache namespace, so changed assets are fetched immediately after the new release becomes authoritative.
- Missing static resources now return HTTP 404 instead of falling through to the SPA HTML document.
- Added release-contract checks for the static cache strategy and missing-static guard.

## Why

Android WebView screenshots showed route CSS/JS load failures even though the referenced files exist in Git. The previous Service Worker performed a network-first no-store request for every static asset, so route revisits repeatedly depended on the network/deployment state. Missing assets could also be rewritten to index.php and rejected by WebView because HTML was returned for a CSS/JS request.

## Verification status

Repository verification is wired into the existing `verification-gate`. External staging remains **NOT VERIFIED** until `tools/verify_staging_current.py --base-url https://s.kareta.kz` passes after deployment.
