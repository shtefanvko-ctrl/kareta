# KARETA ADMIN E3.1 — platform actor authorization hardening
Date: 2026-10-15. Canonical draft lane: PR #133 `integrate/all-features-staging-20261014`.
This is a narrowly scoped SECURITY SOURCE increment; no migration applied, no server setup, production or staging deployment.

## Why the change is required
Previously `api/admin_operations.php` treated `kareta_authorize($pdo, '*')` as sufficient, or accepted a session-supplied legacy admin/owner role after particular Identity resolver failures. `api/identity_migration_admin.php` additionally caught **all** exceptions and fell back to a legacy role.

In KARETA an `organization.owner` may have wildcard capabilities *within the organization*. Thus wildcard alone must NOT certify **platform** admin/owner authority. Legacy session role cannot replace current DB authority.

The patch makes platform administrator status a **second, database-backed requirement**, independent of the capability pipeline:
- With a valid Identity capability decision, resolve the account's current `users.role` by the existing `accounts.phone = users.phone` relationship and require `admin` or `owner`; require `users.active=1` and `accounts.status='active'`.
- For compatibility with genuine server-side PHP sessions, the prior resolver fallback remains **only** for `session_required` or `identity_account_unavailable`; retrieve the actual `users` row by session user ID and verify the current DB role, `active=1`, and normalized session phone equals the current DB phone. The caller supplies `kareta_current_user()`, not a request parameter/cookie.
- All other authorization exceptions are denied; infrastructure exceptions fail as internal errors rather than falling back to privileges.
- `api/identity_migration_admin.php` now uses the same guard and no longer exposes raw exception text to the caller. Migration apply/dry-run data paths have **not** changed.

A cap-set `'*'` and role `owner` in a **business organization** are not sufficient unless the authoritative **platform** `users.role` is admin/owner. Legacy admin compatibility is retained only if the database still confirms identity and role.

## Changed files
- `api/identity/admin_actor_gate.php` — the reusable, isolated DB role gate. No caller-controlled role flags or new privilege grant.
- `api/admin_operations.php` — use guard for ALL existing GET/POST control-plane actions. Existing `ao_audit`, actions and SQL left intact.
- `api/identity_migration_admin.php` — narrowed exception fallback and gated DB actor resolution; generic request ID on internal errors.
- `tools/test_admin_actor_gate_20261015.php` — 15 offline fake-PDO cases: allowed platform admin/owner, authenticated legacy compatibility, org owner/client denial, inactive/blocked records, forgery/mismatched phone/invalid session/no DB record.

## Security decision matrix
| Actor/situation | Expected |
|---|---|
| Valid Identity decision + active DB platform `admin` | ALLOW |
| Valid Identity decision + active DB platform `owner` | ALLOW |
| Organization owner with wildcard but `users.role=sto` | DENY |
| Customer/master/seller with wildcard capability or forged JS role | DENY (if not a DB platform role) |
| Blocked user or blocked account | DENY |
| Legacy PHP admin/owner + DB-confirmed user ID, role, active, normalized phone | ALLOW (compatibility) |
| Legacy PHP session with stale/forged role or wrong phone | DENY |
| No valid Identity decision and no matching server-side PHP session | DENY |
| Resolver error other than explicit compatibility cases | DENY/INTERNAL ERROR; never privilege fallback |
| Unexpected DB error | 500; no authorization bypass |

## Verification and limitations
- Local `php -l` for helper/test **PASS** (PHP 8.4). Local `php tools/test_admin_actor_gate_20261015.php` with fake PDO **15/15 PASS**. These tests do not use production data.
- Repository CI G0/PHP and other existing gates must be checked for the **exact** head after this change; do not carry forward old SHA PASS to a newer candidate.
- This does **not** prove an authenticated end-to-end allowed/denied test on real sessions, current SQL schema compatibility, cookie lifetime behavior or full privilege safety of all endpoints.
- This step intentionally does not change `api/identity/authorization_pipeline.php`, global Identity, server CI workflows, migrations, permissions grants, SMS/OTP, staging or production.
- Existing global bootstrap protection checks Origin/Referer **when present**. Missing Origin/Referer and dedicated CSRF tokens remain a separate review item for state-changing operations.
- Status of `users.role` and its exact DB normalization must be confirmed on a safe DB target before release. The shared guard deliberately **fails closed** on missing links; Identity-only admins without a synchronized `users` record may require explicit onboarding migration, not an authorization bypass.

## Definition of Done for release (NOT MET)
1. PHP 8.1 and 8.2 syntax + offline actor matrix pass at exact candidate.
2. Real restricted role matrix: admin, platform owner positive; client, master, seller, STO and organization-owner negative; session mismatch and expired/revoked negative for both GET and POST.
3. Confirm migration-admin negative path and audit trail; owner lockout prevention and CSRF review before production exposure.
4. Staging provenance, browser and Android smoke bound to candidate SHA. Production changes need separate explicit approval.

## Next increments
1. E3.2: real-session authorization tests + authenticated CSRF and self/last-platform-owner protection; avoid changing global auth to make this pass.
2. E4: read-only admin order inventory with safe role/domain scoped data and cursor paging after domain contract audit.
3. E4.1: catalog/moderation inventory, keeping legacy marketplace owner APIs intact.

**Rollback:** revert the above three PHP files and test; previous PR #133 UI, data and navigation contracts stay unchanged.
