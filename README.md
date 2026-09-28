# KARETA.KZ

KARETA.KZ is the application repository for the automotive service platform.

> Repository bootstrap status: the production/stage source tree is not yet synchronized. Do not treat this repository as the deployment source until KAR-5 is completed.

## Delivery rules

- Changes go through pull requests.
- Secrets, dumps, logs and backup archives must never be committed.
- DONE requires verification and regression evidence, not only a code change.
- CI gates will be enabled after the real PHP/JS source tree is synchronized.

See:
- `SECURITY.md`
- `docs/VERIFICATION.md`

## Current bootstrap tasks

- KAR-5 — synchronize the real KARETA.KZ code without secrets.
- KAR-6 — protect `main` and require PR workflow.
- KAR-7 — introduce PHP/JS/security/regression CI gates.
- KAR-8 — integrate PostHog SDK and event taxonomy.
- KAR-9 — configure source maps and release/version metadata.
