---
name: kareta-spa-contract
description: Change KARETA SPA routes, lazy assets, navigation, caching or page-shell contracts.
version: 1.0.0
---
Map route key -> registry -> lazy JS/CSS -> page entry -> navigation consumers.
Preserve route compatibility, real 404/MIME behavior, release-scoped static assets and warm-navigation semantics.
Do not fix one page by duplicating the router, loader, shell or global state.
Verify the changed route and a representative unaffected route.
