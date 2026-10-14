# Staging Git integration: 84.178.3 → 84.178.4

Current staging source snapshot 7438bffb516e2906515386922cfb633a28ee3f57 is retained. PR129 head 9cbb2207a1ad43d6439e4f7eacff6ab71c478326 is integrated in this release lane; main and the canonical PR133 development branch are not changed.

## Changes
- Preserve local source, role flows, GEO, API/schema, logo assets and existing paths.
- Integrate Home-only brand masthead, contextual internal headings, one Back control with nested route titles, ECU entries on Home and Services, and marketplace action CSS from PR129.
- Keep asset version and Service Worker at 188.5.5.6.84.178.4.
- Repair DESIGN_CANON_V1's stale historical comment binding. Require all phone/tablet/desktop breakpoints in the actual 2026-10-04 geometry block; retain ownership, layer and bundle checks.
- Add staging-only incremental updater with explicit base/target SHA, shared deploy lock, live-byte drift guards, source-file backups, atomic file replacement and automatic conditional rollback. Include storage/deployment_manifest.json in the same backup/readback/rollback transaction.
- Allow bounded health retries for PHP cache timestamp revalidation; require exact runtime provenance after deployment. Never migrate DB, replace private config or overwrite uploads.

## Verification before deployment
- 611 repository PHP/JS syntax checks and 28 application-gate commands: 639/639 PASS locally on the integrated source. 
- Updated deploy/rollback and canonical-geometry suite: 15/15 PASS, including missing CSS block/breakpoint rejection, partial failure, concurrent edits, wrong provenance and bounded cache retries.
- PR129 upstream CI (9cbb220): Application gates, Home scanner navigation and Geo runtime reconcile SUCCESS. This is not final release-head CI evidence.
- Final release-head GitHub CI: NOT RUN here; local gates and runtime provenance are recorded separately.
- Browser baseline: guest welcome and Home open successfully on existing 84.178.3.

## Deployment acceptance
Record the actual final commit, backup directory, 14-file readback, origin/public provenance and health, lazy JS/CSS MIME checks and browser routes in the deployment evidence. Do not mark production/Android acceptance complete from these local checks.

## Next
1. Complete staging runtime/browser acceptance against the deployed SHA.
2. Check mobile visual widths 320/360/390/430 and physical Android Back/ELM327.
3. Continue canonical PR133 integration separately; do not deploy its unfinished experimental access primitive implicitly.
