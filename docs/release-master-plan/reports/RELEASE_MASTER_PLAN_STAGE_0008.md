# KARETA.KZ — Release Master Plan — Stage 0008/2513

## Production feature matrix

Baseline: R188.5.5.6.84.109

Canonical scope: all 67 keys from `js/next/route_registry.js`.

Status totals:
- READY: 35
- BETA: 19
- DISABLED: 1
- INTERNAL: 12

## Policy

- READY — may be presented as production-ready.
- BETA — implemented, but must remain explicitly beta/controlled until its evidence gap is closed.
- DISABLED — must not be exposed as an active standalone production feature.
- INTERNAL — admin/engine/compatibility surface; must not be marketed as a public feature.

Every route key has exactly one status. Deep-link fallback routes are prohibited from READY by the contract test.

## BETA

platform, calendarBooking, finance, market, crm,
masterNews, masterNewsCreate, masterNewsEdit,
stoDashboard, parts, usedParts,
seller, sellerProducts, sellerOrders,
cabinetPromos, assistant, lawyer, towTruck, productDetail.

Important reasons:
- Parts/Product Detail stay BETA because the prior FULL-assets staging check found missing mandatory assets.
- Seller/STO/Finance/Market/CRM stay BETA until role/data/permission E2E is complete on staging.
- Assistant is rule-based preliminary guidance, not a model-backed AI diagnostic system.
- Lawyer/Tow Truck currently hand off through the generic support-chat channel; dedicated provider dispatch/routing is not yet proven on staging.
- Master News remains BETA while public news is consolidated into Community.

## DISABLED

- news (#/news) — standalone module is intentionally replaced by Community/Works and aliases to #/works.

## INTERNAL

corePlatform, identityMigration, adminUsers, adminOrganizations,
adminMonitoring, adminManagement, workflow, notifications,
cabinetData, cabinetDocuments, cabinetTariff, cabinetSettings.

These are architecture/admin/engine or compatibility/deep-link surfaces, not independent public production features.

## Automation

Generated files:
- `docs/qa/production_feature_matrix_84_109.json`
- `docs/qa/production_feature_matrix_84_109.md`

Generator:
- `tools/build_production_feature_matrix_84_109.js`

Contract test:
- `tools/test_production_feature_matrix_84_109.js`

The unified release checklist now includes the matrix contract.

Checks:
- matrix build: PASS, 67/67 covered;
- matrix contract: PASS;
- release checklist: 19/19 PASS.

## Staging CHECK

Checked from the authorized workstation:
- `https://s.kareta.kz/` → HTTP 403 Forbidden;
- `https://s.kareta.kz/docs/qa/production_feature_matrix_84_109.json` → HTTP 403 Forbidden.

Because staging blocks the application before boot, the feature-status exposure cannot yet be verified on the external staging UI. The matrix itself is complete and testable locally, but the stage-level staging CHECK remains blocked by the same server/vhost problem.
