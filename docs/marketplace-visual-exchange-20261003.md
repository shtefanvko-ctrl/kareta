# Marketplace increment — 2026-10-03

Base: release/reconcile-84.152, 4d969dbd9c779f4722a4afc4acf087f2eaba2948 (asset release 84.153).

## Changes

- Category browsing uses a two-column mobile image grid, expanding to four/six columns. All currently returned categories are reachable. Photos come from loaded products/private listings; existing reference assets and category icons cover missing photos.
- New-products shop links directly to #/parts/used?type=exchange. The used marketplace exposes browse-swap and offer-swap actions. Offer-swap opens the existing listing wizard with listingType=exchange; existing server validation, ownership and chat contracts are preserved.
- Main catalog now respects search/type/category/city filters. Opening a category preserves exchange type and current search/city.
- New controls have RU/KK/EN text attributes and render in the document language.
- CSS changes are present in the source stylesheet and the existing lazy route stylesheet; no eager assets, schema, native bridge or release metadata changes.

- Used shop has an explanatory welcome and sale/swap browsing scenarios. Categories and vehicle selection preserve the selected scenario.
- Product details expose price offers and swaps using the existing private chat API. A swap selects the buyer's active used listing; both listings are re-read before sending. A stable message/idempotency key is reused for identical retries. Proposals are chat messages, not accepted/reserved transactions.
- New product cards show the shop, address when returned, seller return duration when positive and a prompt to confirm warranty. Product detail no longer invents a 14-day duration when absent/zero.
- Saving and activating a used listing now share one publication validator. Status changes lock the owner-scoped row inside a transaction, exclude deleted listings, and return success for a repeated valid status without relying on MySQL changed-row count. Invalid publication rolls back before returning 422.

## Verification

- PASS locally: changed JS syntax; behavioral VM test for category images/escaping, all categories, search, exchange deep link/type/category filtering, RU/KK/EN and lazy CSS; offer validation rejects non-finite amounts, own/sold targets and foreign/draft offered listings; Geo platform core static contract; existing seller/storefront regression; boot bundle freshness; diff whitespace.
- NOT RUN locally: PHP-dependent asset URL and lazy-route checks (PHP executable unavailable).
- PASS locally on isolated PHP 8.3: syntax for changed PHP; 33 publication validation/control-flow cases including required fields, exchange conditions, repair defects, non-finite prices, persisted draft normalization, repeated status, foreign/deleted listing rejection and rollback on write failure. The real status handler runs against a PDO test double. InnoDB locking/concurrency and live MySQL behavior remain NOT RUN. CI uses PHP 8.2; exact-head CI has not run.
- Real browser/device layout, live MySQL read-after-write, camera and deployment: NOT RUN.
- New behavioral test is wired into Application gates. Exact-head CI results must be checked separately.

## Open scenario gaps

- Offer acceptance/rejection/counteroffer, reservation, completion, dispute and two-party confirmation do not yet have a dedicated transaction model. Sending a chat message does not sell or reserve a listing.
- Reproduced old compatibility false positives: Toyota Camry 2012 matched Honda Civic 2012 (year only) and Toyota Corolla (brand only). Removed any-token/description matching. Brand and model must now occur together in explicit vehicle/fitment data; UI marks this as a candidate, not guaranteed fit. OEM, year and engine verification still require a richer contract.
- Catalog requests are bounded. Pagination and server-filtered category browsing remain necessary for inventories beyond the currently loaded page.
- Category photos use available loaded inventory; missing photographs fall back to existing reference imagery or icons rather than invented product photographs.
- Existing page text is not fully localized; this increment supplies RU/KK/EN for new controls only.

## Remaining product work

1. City-scoped maps connected to STO/shop/profile cards, integrated with the existing Geo change lane.
2. Community quick questions: image choice, swipe cards and slider variants, with real persisted answers and server authorization.
3. Live-device shop/exchange publication, contact and warm-navigation smoke; then release acceptance and a complete archive.

Rollback: revert this increment. Existing routes/API actions remain unchanged; no migration recovery is required.

## Causal findings from current source

1. Original usedMarket.status activated drafts without the publish validation used in usedMarket.save. Chain: incomplete draft -> status=active update -> public list WHERE active -> incomplete storefront card. Source-confirmed; MySQL reproducer NOT RUN. Implemented shared publish validator and owner-scoped locked status transition; PHP syntax and 33 validation/control-flow cases PASS on PHP 8.3, live MySQL verification pending.
2. Catalog loads at most 100 new / 200 private listings and UI filtering runs on this page. Chain: desired item outside page -> local filter sees nothing -> false empty result. Fix next: pass filters to server and add real pagination/count semantics.
3. No dedicated used-item offer/deal state model exists in inspected marketplace handlers. Current offers are private chat messages. Chain: text agreement -> no atomic acceptance/reservation -> no proof of transfer/completion. Fix next: explicit offer/deal state machine with two-party confirmation, snapshot/version and audit.
4. Existing owner check before used listing INSERT ... ON DUPLICATE KEY UPDATE is not atomic with that write. A simultaneous arbitrary-ID collision is a potential authorization race; not reproduced. Fix next: separate create/update and enforce owner in the mutation itself.
5. Existing stock adjustments read quantity then update an absolute value. Simultaneous deltas can lose one change; concurrency is not yet reproduced. Checkout separately uses row locks and must not be conflated with this path.

The agent workflow now requires trigger -> call/data chain -> violated contract -> consequence -> reproducer -> fix -> regression evidence for every defect claim.
