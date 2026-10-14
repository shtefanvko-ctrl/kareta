# DEVIL PR #133 — historical feature floor (2026-10-14)

## Reproduced static-gate defect
The former gate trusted the mutable baseline JSON as its sole source of protected routes and critical files. Replacing a route in both the registry and baseline, or substituting an existing file for a protected entry point, could satisfy the count-only floor and produce a false PASS.

## Fix
`tools/test_feature_preservation.py` anchors the originally reviewed 72 route keys/URLs and 19 critical paths independently of the extensible JSON baseline. Approved new routes and files may be added, but historical entries must remain unchanged. Self-test adds three negative substitutions and one positive extension case.

## Preservation / evidence
No product runtime files, URLs, translations, Android bridge, or business logic changed. Feature-preservation CI must pass on the new exact PR HEAD. Static PASS is not UI, device, server, or deployment evidence. Browser, Android/ELM, staging and production: NOT RUN. Keep PR #133 Draft / DO NOT MERGE.

## Rollback
Revert only this commit on the integration branch after reviewing why the floor failed. Do not modify `main` or deploy.
