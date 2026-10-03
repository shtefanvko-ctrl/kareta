# Dispatch constraints — first increment

## Scope and plan
Adapt scheduling-by-constraints to existing KARETA dispatch rather than introducing a second planner.
Base: d2e3f900058d306e4b8d2cc363a430f3c408a4fb, marketplace implementation lane.
Branch: fix/dispatch-service-constraints-20261003.
Open PRs were inspected through GitHub; no separate dispatch-service-coverage lane was identified.
Uncommitted new-shop pagination work remains in its original worktree and is not part of this candidate.

1. Require complete verified service coverage before automatic recommendation/ranking.
2. Verify behavior, quota compatibility and neighboring geo privacy; wire regression into verify.
3. Next increments: city/work-mode eligibility, schedule/resource validation, transactional reservation.

## Executed cause-and-effect reproduction
Trigger: order requires oil and brakes; a high-rated master offers only oil.
Call chain: rank_order -> score_master_for_order -> service_match -> eligible.
Old boundary: eligible = serviceMatch > 0; incomplete coverage qualified. Missing offers schema and missing requirements also returned invented positive match fractions (0.65 / 0.70).
Consequence: ranking and its automatic reassignment consumer could choose a master without all requested services.
Reproduction: new SQLite-backed regression failed on original production code at the partial-coverage eligibility assertion.

## Change and invariants
Eligibility now requires serviceMatch === 1.0; diagnostic percentage remains available.
Requirements must be a nonempty JSON list of nonblank string/integer service IDs; duplicates are normalized.
Missing schema, absent/invalid requirements and no approved available offers establish no verified coverage.
Additive eligibilityReason: services_covered / services_incomplete / services_unverified.
Existing active-master and tariff checks remain; existing-assignment tariff exception remains.
Service offer filters, API paths, manual assignment and Exchange browsing are retained.
This is recommendation eligibility, not a universal authorization or scheduling validator.
No DB migrations, production writes, Android changes or deployment.
Rollback: revert this increment; no stored-data transformation is needed.

## Verification
Local PHP 8.3.6, Node 24.19.0.
- PASS: 22 behavioral checks using actual dispatch/scoring/ranking code against SQLite fixtures (BINARY comparison syntax translated; GREATEST registered). Not evidence of live MySQL or concurrent transactions.
- PASS: PHP syntax for both touched PHP files.
- PASS: tools/test_r1885583_production_dispatch_exchange.js.
- PASS: tools/test_exchange_request_geo_privacy.php.
- PASS: git diff --check.
- BLOCKED: four historical JS checks test_r1885625/26/27/28 terminate because assets/onboarding/kareta_logo_full.png is absent. Same failure reproduced on the original worktree; this delta does not supply or replace a logo.
- NOT RUN: complete CI workflow, browser, live MySQL, concurrent reservation, staging/deployment.

## Remaining design work
City/zone, work mode, shift bounds, equipment, travel buffer and authoritative interval checks are not implemented by this increment.
Existing top-60 rating candidate cap and all-backlog load/ETA need separate review; a dispatch ETA is not proof of an available slot.
Manual assignment and alternative master/bay pairs use different admission rules; consolidate deliberately after reviewing their contracts.
Protect confirmed appointments during auto reassignment and revalidate candidates under transaction locks before accepting writes.
The full ZIP is a source snapshot of this branch, not a verified hosting release.

## Second increment — city and work-mode admission

Source findings: orders_create persists field_service but its INSERT does not persist the request city; client forms generate a `Город:` line in notes. saveGeo uses shop/mobile/hybrid while master onboarding persists shop/mobile/both. Dispatch originally preferred a mobile origin for both but did not recognize hybrid consistently.

Executed reproduction: run the new location regression with the 8cbd9d1 production_dispatch.php implementation and updated fixtures. Service checks PASS, then the complete-service / wrong-city rejection assertion FAILS. This is an executed SQLite reproduction, not an observed production incident.

Implemented:
- Same normalized request/master city is required for automatic recommendation. Structured city and the existing generated city line are supported; absent or conflicting values fail closed. No city inference from addresses, GPS or the current viewer context.
- A stationary request requires shop/hybrid/both. A mobile request requires mobile/hybrid/both.
- Mobile admission requires an explicit positive finite service radius and valid master/request coordinates within it. The ranking preference radius is not evidence of a permitted service zone.
- Full precision straight-line distance is used for admission; UI retains its rounded distance. This is not a road route or travel-time promise.
- Mobile orders prefer active mobile_origin points for hybrid/both; stationary origin prefers service. Non-numeric coordinates do not become zero through casting.
- locationEligibilityReason is additive; the existing eligibilityReason identifies location rejection when services are complete. Ranking and automatic reassignment inherit the same score boundary.
- Existing requests with no reliable city are excluded from automatic recommendation, but browsing/manual assignment remain available. Confirmed appointments are not cancelled by this change.

Verification: 22 service + 30 location checks PASS using SQLite fixtures; PHP syntax for three touched PHP files PASS; dispatch JS regression, geo privacy PHP regression and diff whitespace PASS. Regression added to verify with explicit mbstring/pdo_sqlite. Exact-head CI, live MySQL, concurrent reservation, browser and deployment NOT RUN.

Limitations / next three increments:
1. Canonical city IDs and persisted request city: case/space/dash normalization is implemented; multilingual aliases such as Өскемен versus Усть-Каменогорск are not inferred. Cross-city mobile coverage remains excluded by city scope even within a nominal radius. Requests tied to a destination STO need an explicit destination-city contract rather than guessed profile location.
2. Authoritative interval/resource validation and protection of confirmed plans. Manual assignment/alternative-pair exceptions still need deliberate consolidation. Existing top-60 cap and backlog ETA remain unchanged.
3. Transactional reservation and repeat/concurrency handling with MySQL evidence. No migration execution or live DB changes in this increment.

Rollback: revert the second increment to return to the first service-coverage boundary. No data transformation.
