---
name: kareta-runtime-contracts
description: Change KARETA shared runtime contracts across SPA, PHP API, domain ownership, identity, DB, and release-sensitive surfaces.
version: 1.0.0
---
# Required analysis
Map producer -> consumers -> persisted state -> compatibility path -> tests.

# Invariants
- One mutable business entity converges on one owner.
- Cross-context writes use owner contracts.
- Do not add a third source of truth.
- Preserve RU/KK/EN and existing routes.
- For DB work, preserve canonical migration chain and use only the next safe migration number.
- For SPA work, preserve route keys, lazy bundles, MIME/404 behavior, and release-scoped assets.
- For auth/security, retain server-side capability and ownership checks.
