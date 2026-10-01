# Admin / Control Plane Rules

Load for admin users, organizations, monitoring, management, migrations or privileged operational actions.

## Invariants
- Admin UI is not an authorization boundary; protected operations require server-side capability checks.
- Prefer explicit capabilities over client-controlled role names.
- Destructive/bulk/migration actions require scope, recovery strategy and evidence from the safest target before production.
- Monitoring endpoints must not expose secrets, session material, credentials or sensitive traces.
- Do not combine control-plane changes with unrelated client UI refactors.

## Verification
Check a permitted and denied path. For destructive/migration work, record candidate/ref, affected data, rollback and verification target.
