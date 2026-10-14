# DEVIL PR #133 — Feature preservation exact-HEAD checkout (2026-10-14)

## Defect and scope
The `pull_request` event defaults `actions/checkout@v4` to the synthetic merge ref. A PASS on that ref is not proof that the exact PR head was checked. No product code, routes, files, translations, Android bridge, or business rules are changed.

## Fix
- `.github/workflows/feature-preservation.yml`: checkout explicit PR head SHA (workflow_dispatch falls back to github.sha), assert `git rev-parse HEAD` matches, run autonomous regression.
- `ai/tests/test_feature_preservation_checkout.py`: fail closed if checkout loses exact-head ref; three negative cases (merge/default ref, missing ref, duplicate checkout).

## Verification boundary
Static route/file/RU-KK-EN preservation and mobile Back bundle tests remain unchanged. CI must be checked for the new exact SHA after GitHub runs; previous runs are not reused. Browser/Android/ELM/production/staging/server checks: NOT RUN. PR remains Draft / DO NOT MERGE.

## Rollback
Revert this single commit in PR #133 if the contract causes unexpected CI failures; never merge or deploy automatically.

