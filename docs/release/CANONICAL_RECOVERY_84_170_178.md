# Canonical recovery lineage — 84.170 to 84.178

Status: recovery candidate, not production DoD.

## Immutable anchor
- base main SHA: 673826b9c4559b5f1dda22d1e79a6a7a19b302e0
- public asset version: 188.5.5.6.84.178
- Service Worker release: 188.5.5.6.84.178

## Canonical preservation rule
This recovery line MUST preserve post-84.171 product work already present in the anchor. It MUST NOT restore an older file over a newer implementation merely because that file existed in 84.170/84.171.

Protected functional lines include Electrician Assistant, Master Equipment, Scanner/VIN/QR, Parts, Community, Services, Orders, Schedule, Notifications, Chats, Landing, Geo runtime, Android/WebView integration, and current master/client UI ownership.

## DB reconciliation
The repository contains canonical migrations through 144 and config.php declares KARETA_DB_VERSION=144. The recovery manifest therefore targets DB 144. Migrations 138-144 are preserved in place; no migration is rewritten or renumbered.

## Release and provenance contract
inc/asset_version.php and sw.js remain on 188.5.5.6.84.178.

Deployment provenance is generated from the exact candidate by tools/generate_deployment_manifest.php using the CI/deploy environment (GITHUB_SHA/GITHUB_REF/GITHUB_RUN_ID or KARETA_DEPLOY_* overrides). The generated storage/deployment_manifest.json is deployment evidence and MUST describe the exact deployed candidate. A stale/static manifest MUST NOT be treated as proof for another SHA.

Application gates must validate provenance and generate the exact-candidate deployment-provenance artifact.

## Reconciled and deferred lines
Geo backend/runtime from the PR #97 line is reconciled into this recovery candidate. Static Geo core, client-home nearby integration and map-runtime contracts are owned by the dedicated Geo runtime workflow; browser/mobile acceptance remains required by the Definition of Done.

Geo consumer follow-up remains explicit and executable in `tools/test_geo_platform_consumers.js`: master onboarding point persistence, seller warehouse/pickup publication, STO location management, Parts nearby shops and Masters nearby provider ranking are not claimed by PR #100. That diagnostic is intentionally not a merge gate for the recovery core.

PR #98/#99 design source ownership is reconciled into this candidate where the canonical source/generated files match. Their historical branch-only test differences are not merge evidence for this HEAD.

ELM327 research/tooling is integrated as isolated recovery content. Upstream imported knowledge remains staging-only where RU verification is incomplete. Landing polish or other branches based on older bases still require separate reconciliation.

## Definition of Done
A release is not DONE until all required evidence belongs to the exact candidate/deployed SHA:
1. PHP/Application/Geo/Scanner gates PASS.
2. Migration manifest and runtime DB version agree.
3. Asset version and Service Worker release agree.
4. Exact-candidate provenance artifact exists and matches SHA/ref/version.
5. Package/release verification is recorded.
6. Host/Plesk browser acceptance passes, including second navigation circle and no mixed-release assets.
7. Android/WebView acceptance passes.
8. No new PHP/nginx/MySQL regressions are observed.

Old CI from another SHA is not evidence for a new HEAD.
