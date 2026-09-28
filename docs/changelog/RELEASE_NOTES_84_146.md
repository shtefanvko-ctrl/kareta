# KARETA.KZ 188.5.5.6.84.146

## Changed

- Added a first-class SPA 404 route instead of resolving unknown hashes to another accessible/default route.
- Added a production 404 surface consistent with the current KARETA visual language.
- Added a canonical desktop route content frame so direct children of `#k-page-outlet` no longer compete with route-specific 1180/1200/1240/1280 outer widths.
- Kept Master shell ownership separate while aligning its content geometry with the shared route frame.
- Quarantined unpromoted colliding migrations 130+ outside the active migration directory. Canonical DB remains 129.
- Added GitHub Actions verification workflow and current staging verification workflow/script.
- Added current release metadata and current engineering plan.

## Verification status

Code-level verification is enforced by `.github/workflows/verify.yml`.

External staging is intentionally **NOT VERIFIED** until `tools/verify_staging_current.py` passes against the deployed staging host.

## Branch note

The working web branch and `main` are diverged. 84.146 must not be merged by replacing `main`; the main-only Android Native API commits must be reconciled first.
