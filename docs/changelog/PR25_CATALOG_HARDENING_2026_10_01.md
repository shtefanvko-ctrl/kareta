# PR #25: Garage demand-catalog recovery and delivery verification

The existing catalog schema fix (`b4d1032`) and the parallel canonical release,
cabinet-settings, executable CI and provenance work were retained. The PR now
contains the canonical cabinet branch through Git ancestry; the catalog changes
remain in the existing progressive-catalog lane.

## Result

- App/module initialization and Garage entry do not fetch the JSON catalog.
  The first service-map open fetches it; subsequent opens reuse validated data.
- Fresh, cached and shared requests enforce each caller's schema. Only JSON MIME
  types are accepted; requests abort after 15 seconds. Failed requests can retry.
- Garage validates the catalog identity, unique IDs, system references, text,
  numeric intervals and mode. Invalid data is evicted; Retry also reloads the HTTP
  cache. Catalog text is escaped and transport details are replaced with readable
  product copy. Late success/failure cannot replace a closed dialog.
- Service Worker keeps catalog requests network-first, preserves the versioned
  URL and rejects invalid-MIME cache entries. CSS/JS retain their existing policy.
- The server inventories demand catalogs separately from boot scripts. The
  existing staging verifier checks inventory completeness, HTTP/MIME, release URL,
  schema/identity and the exact catalog SHA-256 against the local candidate.
- Existing verification CI and release gate run the added catalog regressions.
  Cabinet session isolation executes the actual loader without fetching catalogs.
- Messaging's existing regression now checks the ordered lazy dependency chain
  rather than requiring adjacency between messaging and the cabinet page.

## Evidence before commit

- JSON loader: 19/19 runtime cases PASS.
- Garage: 18/18 HTTP/DOM boundary cases PASS.
- Service Worker: 9/9 Fetch/Cache boundary cases PASS, including unchanged JS caching.
- Staging verifier: 6 unittest methods PASS with happy and negative paths.
- Existing cabinet/session, first-vehicle/account isolation, logout/Garage,
  current-release, reconciliation, master UI and generated-bundle checks PASS.
- New Garage and Service Worker regressions fail on the preceding remote head
  `fd947bbf16728f75e7a3e6d4ef35e2fc8c39e9df` and pass with this change.
- Local legacy lazy-route probes cannot run because PHP CLI is absent. PHP syntax,
  the real manifest subprocess test and PHP/API checks require exact-candidate CI.

## Remaining acceptance gates

CI evidence must be read for the final head/tested merge, after dependency branches
settle. This changelog is not evidence of deployment. Stage HTTP/MIME and full lazy
asset walk, exact runtime provenance, cold/warm/offline browser behavior and the
Garage save/reload flow must be checked on the delivered candidate. Keep release
tokens unique to the deployed bytes; never replace an already-served immutable
manifest inside the same release. Merge order remains #22 -> #24 -> #25.

No Android native sources, native bridge or database migrations are changed by
this catalog-hardening delta.
