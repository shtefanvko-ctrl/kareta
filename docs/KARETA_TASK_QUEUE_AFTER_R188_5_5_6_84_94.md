# KARETA.KZ — consolidated task queue after R188.5.5.6.84.94

This queue combines the active mobile audit with the first master-onboarding audit batch dated 17 September 2026.

## Active mobile cleanup

1. `.84.95`: keep chat/orders FABs out of Parts, Masters, and Garage content; suppress zero badges.
2. `.84.96`: Parts word wrapping, deterministic categories, zero cart count, and the `Запчасти` mobile-nav label.

## Master onboarding domain block

Work strictly in this order and stop on a red gate:

1. Establish a green baseline: reconcile the protected `index.php` hash, restore critical `.84.18` and `.84.29` contracts to the mandatory release gate, and verify migration numbering/manifest integrity.
2. Enforce one Account/Person with CLIENT and MASTER contexts; block every master workplace layer until onboarding completion and return `MASTER_ONBOARDING_REQUIRED` for direct access.
3. Replace `mobileOrigin + radius` with the canonical city/zones model. A mobile-only master must never submit or retain address, origin, latitude, longitude, or radius.
4. Rebuild onboarding steps 3–4 from one normalized work-location object. Matrix: mobile = city + zones; fixed = city + confirmed workshop address; both = address + zones, without a separate origin.
5. Align client and server validation, persist zones for matching/search, restrict public address exposure, and clean old mobile-only coordinates through a controlled dry-run migration.
6. Restore onboarding resilience: catalog retry/skeleton, revisioned cross-tab draft synchronization, offline reconciliation, idempotency, and the agreed avatar lifecycle.
7. Make `Мои услуги` snapshot-driven with explicit loading/clean/dirty/saving/saved/partial-error states, atomic or row-result saving, and route-owned CSS.
8. Isolate the mobile exchange route CSS, keep search/tabs readable at 320–430 px, protect empty states from FABs, and provide `Настроить услуги` when appropriate.
9. Split boot failure reasons by stage/resource, preserve valid cache on retry, and add a correlation ID to client error logging.
10. Run the full account-context/onboarding/API/cold-route/boot regression matrix with PHP checks, migrations, protected hashes, and a clean full-ZIP smoke test.

## Fixed product rules

- One account may own CLIENT and MASTER contexts; no duplicate phone/account.
- `mobile`: city plus zones or whole city; no exact point or address stored.
- `fixed`: city plus confirmed workshop address; no service-area zones.
- `both`: confirmed workshop address plus zones; no separate start point.
- Switching mode clears irrelevant hidden fields before review, draft persistence, analytics, logging, and API submission.
- Onboarding functionality is not changed until its release-gate baseline is green.

## R188.5.5.6.84.97 audit result — 24 September 2026

Baseline code recovery implemented: .84.18/.84.29 gates restored, behavioral .84.97 added, original index hash reconciled, PHP/JSON manifests pinned to actual 129, gate/auth/draft/catalog/avatar defects fixed. Full runtime baseline remains BLOCKED: this execution environment has neither PHP nor Chromium. See MASTER_RECOVERY_R188_5_5_6_84_97.md for exact verification and pending scope. Do not mark the entire master domain complete or start location-model rollout until the required runtime gate is green.
