# Security Rules

Load this file for auth, identity, permissions/capabilities, sessions/cookies, secrets, sensitive data, uploads, payment-related work, database-destructive actions, or production operations.

## Never weaken a boundary to make a test pass
Do not bypass authentication, authorization, capability checks, CSRF/session validation, rate limits, ownership checks, or production safety controls as a convenience fix.

## Identity and authorization
- Authentication answers who the actor is; authorization answers what the actor may do. Do not conflate them.
- Enforce authorization server-side for protected actions even if UI controls also hide them.
- Prefer explicit capabilities/permissions over client-controlled role claims.
- Treat cookies, local storage, query parameters, and request bodies as untrusted input unless cryptographically/server validated.

## Secrets
Never commit or echo passwords, API keys, tokens, OTP bypasses, private keys, session identifiers, database credentials, or tunnel credentials. Use placeholders in documentation and repository-safe configuration patterns.

## Data and destructive changes
For schema mutation, deletion, bulk update, migration, or irreversible production operation:
1. identify affected data and compatibility risk;
2. define backup/restore or rollback strategy;
3. prefer reversible/idempotent migration steps;
4. verify on the safest available target before production;
5. do not call the change DONE without the required evidence.

## Input/output safety
Validate and normalize untrusted input at trust boundaries. Escape/encode output for its context. Preserve parameterized DB access. Do not expose internal stack traces, secrets, or sensitive records to clients.

## Security completion gate
A security-sensitive task is not verified merely because the happy path works. Test at least one relevant rejection/negative path when an executable test path exists, and record missing evidence explicitly when it does not.
