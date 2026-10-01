> Historical 84.109 measurement. Current branch budget is `docs/architecture/LEGACY_ROLE_BUDGET_CURRENT.json`; current 84.146 inventory is 108 total / 96 in `api/db.php`.

# KARETA.KZ — Legacy Role Authorization Budget 84.109

Baseline: `R188.5.5.6.84.109`
Stage: `14/2513`

## Rule

Business authorization must use capabilities. Direct `kareta_require_role()` / `kareta_require_any_role()` calls are legacy debt and must not increase.

Authentication/onboarding role selection is not counted as a business permission migration target.

## Budget

Before Stage 14:
- all `api/**/*.php`: 108 direct role gates;
- `api/db.php`: 90 direct role gates.

After Stage 14:
- all `api/**/*.php`: 68 direct role gates;
- `api/db.php`: 50 direct role gates.

Hard budget:
- total <= 68;
- `api/db.php` <= 50.

Automated gate:
```bash
node tools/test_legacy_role_budget_84_109.js
```

Current result:
`LEGACY_ROLE_BUDGET_84_109: PASS total=68/68 baseline=108 db=50/50 baselineDb=90 migrated=40 files=10`

## Migrated capability groups

- client request lifecycle -> `requests.update`;
- master request response -> `requests.respond`;
- master work-order lifecycle -> `work_orders.update` / `work_orders.update_status`;
- STO assignment/capacity/exchange -> `work_orders.assign` / `work_orders.read`;
- chat creation/support -> `chats.use`;
- vehicle issue mutation -> `vehicles.update`;
- master profile/wall/posts/news -> `profile.read` / `profile.manage`.

40 direct authorization call-sites were migrated. Policy is centralized in `api/domains/capability_dispatch.php`, keeping `api/db.php` below its Stage 12 no-growth limit.

## Capability normalization

Historical `profile.edit_own` is now canonicalized to `profile.manage`. This makes migration-74 MASTER capability rows compatible with the current runtime authorization vocabulary without a schema migration.

## Remaining debt

The remaining budget is concentrated in:
- global admin/owner operations that do not yet have a defined capability contract;
- legacy compatibility bridge fallback;
- older account-tariff/data-integrity/work-post/session endpoints.

These are intentionally left in budget rather than mapped to unrelated capabilities.
