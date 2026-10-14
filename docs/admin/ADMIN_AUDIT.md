# KARETA ADMIN — verified source audit (2026-10-15)

**Reference:** user-supplied 24-screen admin image; specification `KARETA_ADMIN_MASTER_PROMPT_v1.0.md` from conversation. The image contains DEMO values, not platform data.

**Scope and method:** read-only inspection of repository tree at PR #133 head `e496da0558dc29b4c82ecf5fd17693cd70a25ab2`, current source files, PR #133/#134 metadata. No authenticated browser session, SQL data sample or staging deployment was inspected. The classifications describe **source implementation**, not live operation.

**Branch ownership:** existing canonical draft PR #133 (`integrate/all-features-staging-20261014`), stacked on #130; #134 is skills-only stacked child. Do not fork a competing admin architecture, rewrite shared identity/router, merge, or deploy.

## Screen-to-source matrix

| # | Reference screen / state | Source evidence | Classification | Gap / safe next step |
|---|---|---|---|---|
| 01 | Dashboard home | `js/next/pages/admin_workspaces.js` monitoring; `js/next/dashboard_widgets.js` admin.metrics/admin.audit; `api/admin_operations.php?action=overview` | PARTIAL | Counts cover Identity, not verified six business KPIs/7-day charts; admin default landing must be checked in authoritative navigation. |
| 02 | Users and filters | `#/admin/users`, `admin_operations.php?action=users` | PARTIAL | Only name/phone search and 100-result cap; no server paging/city/status/role segmentation. |
| 03 | User profile | `accountDetail` and Identity detail dialog, contexts/sessions | PARTIAL | No admin-specific document verification, privacy-scoped activity/history or masked PII policy. |
| 04 | Orders | Existing `js/next/pages/orders.js` is a product route, not an admin control route | ABSENT | Define read-only admin query and role-safe detail. |
| 05 | Service map | `api/geo.php`, `js/next/geo_map.js` | ABSENT | No verified admin points/filter/moderation view; reuse Geo privacy and city ID contracts. |
| 06 | Content management | Catalog/content migrations exist; no dedicated admin content screen in adminWorkspaces | ABSENT | Audit actual publishing/translation APIs before adding UI. |
| 07 | Masters | User profiles exist; `adminUsers` shows generic account/profile | PARTIAL | Missing specialized master verification, categories, and equipment review. |
| 08 | STO | `#/admin/organizations`, `organizations` GET, setOrganizationStatus POST | PARTIAL | Generic organization cards, no scheduling/docs/geo/employee detail. |
| 09 | Stores | Same organizations data, `api/seller_shop.php` exists | PARTIAL | No store-type split, new/used inventory or shop moderation UI. |
| 10 | Products & services | Marketplace/domain APIs exist; admin does not own a dedicated route | ABSENT | Read-only, bounded catalog admin list first. |
| 11 | Finance | Existing `api/operational_finance.php`, `js/next/pages/finance.js` are not verified admin-specific | ABSENT | Commission vs GMV accounting, access, export and real reconciliation required. |
| 12 | Charts / finance analytics | `api/migrations/070_crm_analytics.php` exists; no dedicated admin analytics route | ABSENT | Define approved sources and exact denominators/period. |
| 13 | System settings | `#/admin/management` and tariff controls exist | PARTIAL | No full configuration/permission/integration/backup control plane. |
| 14 | Secondary analytical view | Admin KPI/operation audit widgets exist | PARTIAL | No dedicated deep reports/segmentation view. |
| 15 | Add user modal | Existing Identity detail dialog does not create accounts | ABSENT | Invitation-first flow only after authenticated permission and server API audit. |
| 16 | Add service modal | General service management exists, no admin create-service dialog | ABSENT | Reuse category/service owners; no duplicate DB model. |
| 17 | Invite master modal | No verified admin invitation action | ABSENT | Design non-privilege-escalating invitation state. |
| 18 | Document verification | Identity stores profile metadata; admin review dialog not found | ABSENT | Authorization, private file access, evidence retention. |
| 19 | City/region settings | `js/next/geo/kz_city_catalog.js` exists | ABSENT | Single city ID and safe administrative edit governance. |
| 20 | Role/permission settings | Context membership status action exists, `js/rbac.js` legacy client registry | PARTIAL | No audited admin capability grant UI; legacy registry cannot authorize server. |
| 21 | Send notification | `js/next/pages/notifications.js` exists for notifications | ABSENT | No confirmed admin bulk-send with preview/outbox/rate limits. |
| 22 | Confirmation dialog | Existing `data-admin-action-dialog` asks for mandatory reason | PARTIAL | Missing explicit per-action scope/impact and high-risk step-up. |
| 23 | Success dialog | Existing action UX has success toast/API result, no separate accessible state | PARTIAL | Render only after server-confirmed success. |
| 24 | Error dialog | Existing `data-admin-dialog-error` / API exceptions | PARTIAL | Better retry/request-id focus and error classification. |

Classification: EXISTS means a concrete specialized source; PARTIAL means a subset with verified code; ABSENT means no verified dedicated admin workflow; CONFLICT reserved for proven incompatible contracts. Lack of evidence is not proof that product-wide functionality is missing.

## Source inventory / route ownership

- Existing admin routes: `#/admin/users`, `#/admin/organizations`, `#/admin/monitoring`, `#/admin/management`, `#/admin/identity-migration`; keep hashes and lazy registration in `inc/asset_registry.php`.
- Source: `js/next/pages/admin_workspaces.js`, `css/next/workspace_admin.css`, `api/admin_operations.php`, `js/next/dashboard_widgets.js`.
- Admin API: GET overview/users/accountDetail/organizations/moderation; POST setAccountStatus/revokeSessions/revokeSession/setProfileStatus/setContextStatus/setOrganizationStatus/setMembershipStatus/createModerationCase/resolveModerationCase.
- Migration 095 defines `admin_operation_audit` and `moderation_cases`; existing dashboard layout storage is versioned separately.
- Admin viewport must reuse `KaretaPageUI.pageShell` and shared Back/inner header; only home gets full logo.
- No fake values from screenshots. For unavailable aggregates, show a clear unavailable state rather than zero.

## Risks requiring independent tests before expansion

1. `api/admin_operations.php::ao_admin` attempts `kareta_authorize($pdo, '*')`, with a legacy admin/owner role fallback for some Identity exceptions. Review whether this is truly session-bound and compatible. It is **not a demonstrated bypass** from source reading alone.
2. `api/identity_migration_admin.php` catches broad `Throwable` around authorization and can fall back to legacy role. Audit exception-to-denial behavior before touching migration operations.
3. `js/rbac.js` contains local seeded accounts/client-side role ranking. Never treat it as an administrative security authority; audit any consumers.
4. Admin mutations require CSRF, capability-scoped GET/POST, negative authorization tests, transactional change+audit where necessary, self/last-owner protection, and idempotency analysis. Existing wrappers and actual identity flows must be inspected before claiming coverage.
5. Admin list queries are capped at 100 but not cursor-paginated. Avoid client downloading all accounts/PII.
6. Do not change CI/server checks, production, DNS, SMS/OTP security or DB migrations as part of UI work. `/devil` tester-only access in PR #133 does not grant admin privileges.

## Work sequence and evidence

1. **P0 visual shell**: adapt *existing* admin route layout to reference sidebar/compact mobile tabs without changing routes, auth, API or logo. Validate source parse and routes. This is only an incremental visual change.
2. **P0 authorization audit and tests**: separate targeted PR increment for privileged GET and POST denial/allowed paths; no sweeping legacy rewrite.
3. **P1 data-driven screens**: admin dashboard exact KPIs with real source, filtered/paginated users/organizations, then orders/geo/catalog read-only. Each API must have documented capability, pagination, privacy and negatives.
4. P2 content, finance, analytics, notifications, settings only after domain owner/security checks.

### Evidence / DoD at this audit snapshot

DESIRED: all 24 reference screens integrated into canonical admin.
IMPLEMENTED: only the above source-confirmed subset, not the complete reference.
VERIFIED: source inventory/read-only route mapping; no browser E2E or authenticated server-side tests.
DEPLOYED: **not asserted** for any new admin changes. PR #133 is Draft/DO NOT MERGE.
