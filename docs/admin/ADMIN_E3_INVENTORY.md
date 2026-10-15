# KARETA Admin E3 — bounded identity / organization inventories

Date: 2026-10-15. Canonical lane: Draft PR #133 `integrate/all-features-staging-20261014`. This is source development, NOT a staging deployment.

## Contract: existing `GET /api/admin_operations.php`

The existing `ao_admin($pdo)` server-side administrative gate still runs before all these actions. **The Identity / legacy fallback requires a separate security audit and authenticated rejection test before release.** The UI itself provides no authorization.

### `action=users`

Optional query parameters: `q` (phone/name, <=120 chars), `role` (`client|master|seller`), `status` (`active|blocked|deleted`), `before` (positive numeric account ID), `limit` (1..50, default 24).

The `client` segment is **defined as accounts without master or seller `person_profiles`**; the canonical personal.client context is not stored as a `client` profile. Thus it is not a claim that every personal client account is excluded from other roles. `master` and `seller` segments match profile existence independent of profile status; account status filter is separate. An organization-only account may appear in this client segment — the correct business-role categorization is reserved for a domain identity contract review.

Order: `accounts.id DESC` (keyset). SQL values are parameter-bound, while limit is validated/clamped and appended as a bounded integer. Existing account card payload is preserved.

### `action=organizations`

Optional parameters: `q` (name/ID), `type` (`service_station|parts_store`), `status` (`active|inactive|blocked|archived`), `city` (exact string, <=120 chars), `before` (organization ID made of safe stable characters, max 128), `limit` (1..50, default 24).

Order: `organizations.id DESC` as a stable lexicographic keyset. These are canonical organization types established by context materialization; **do not confuse this list with all legacy STO/seller records**. Geolocation/city IDs are not migrated here: the current organization uses a city text field. City normalization requires the unified geo contract separately.

### New response shape (backward-compatible)

```json
{
  "ok": true,
  "items": [],
  "page": {"limit": 24, "hasMore": false, "nextCursor": null}
}
```

`items` retains the original field names. At most `limit` items are returned. `hasMore` comes from fetching `limit+1`; the cursor is the last *visible* row key. No unbounded totals, arbitrary SQL ordering, N+1 queries per response from application code, or client-side download of all records.

### Fail-closed parameters

Unknown `role/type/status` and malformed cursors reject with HTTP 422 via the existing JSON response. Search and city text longer than 120 characters reject. All GETs retain the existing administrative guard; there are no new POST actions, bulk mutations, privilege grants, DB migrations, or changes to PHP verification infrastructure.

## UI contract

Existing routes: `#/admin/users` and `#/admin/organizations`; no extra router/lazy loading or mobile bottom bar. Filters are API-backed, with explicit Apply, Clear, Refresh; keyboard Enter on search resets the cursor. Previous/Next uses a local stack of visited cursor positions. Switching filters resets history to avoid mixed-result paging. New labels/options and pagination buttons use RU/KK/EN and update text in-place on language change. Responsive width and touch targets use shared KARETA CSS tokens.

## Evidence and remaining risk

Source/render checks: `tools/test_admin_inventories_e3_20261015.js` covers nine focused cases, including three languages, actual route markup, stable keyset clauses and ordering of authorization before the GET handlers. A source contract is **not** proof of permitted/denied server access, PII authorization, SQL performance, browser behavior, or an end-to-end result.

Release blockers: authenticated allowed/denied tests across admin/owner/master/client/seller/STO, CSRF/session review for sensitive POST, live MariaDB/MySQL SQL execution with >50 records and duplicate/no-gap cursor assertions, dynamic role/context changes, RU/KK/EN live DOM switching, mobile 320/360/390/430 browser smoke, service-worker/asset freshness, staging exact-SHA provenance, Android WebView acceptance.

## Next planned changes (one increment at a time)

1. E3.1: authorization negative-path baseline against real sessions; eliminate any demonstrably unsafe fallback with targeted compatibility tests. Do not weaken or bypass identity to satisfy UI.
2. E4: read-only orders and catalog inventories with scoped permissions and pagination, after their authoritative domain APIs are located and documented.
3. E5: moderation/document verification and safe form workflows; no admin batch change without transactional audit/recovery.

Rollback: revert the E3 changes in `api/admin_operations.php`, `js/next/pages/admin_workspaces.js`, `css/next/workspace_admin.css` and focused test; keep the earlier E1/E2 admin shell/dashboard intact.
