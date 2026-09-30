# Backend / API Rules

Load for PHP endpoints, API actions, DB access, migrations, server-side contracts and runtime health.

## Invariants
- Inspect existing `api/db.php`, domain helpers and action contracts before creating another endpoint/action.
- Preserve parameterized DB access and server-side authorization/capability checks.
- Authentication and authorization are separate; UI visibility never replaces server permission checks.
- Retried writes preserve or add idempotency where the contract expects it.
- Schema changes require migration/compatibility and rollback/recovery consideration.
- Do not move runtime truth from MySQL into client JSON to simplify a feature.
- Do not weaken readiness, release, identity or data-integrity gates to make a change pass.

## Verification
Run PHP syntax for touched PHP, then focused API/runtime evidence and at least one relevant rejection path for protected operations.
