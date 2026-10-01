# KARETA Verification Gate Catalog

This catalog maps AI completion/release claims to executable project evidence. It is loaded for verification/release work, not for ordinary implementation tasks.

`MB_MONITORING.md` remains authoritative for desired / implemented / verified / deployed state semantics and conflict priority.

## Gate classes

### G0 — Repository syntax gate
**GitHub Action:** `.github/workflows/php-syntax.yml`

Purpose: ensure repository-owned PHP remains parse-compatible with the project's explicit PHP 8.1+ runtime floor.

PASS means the workflow ran for the exact candidate and every scoped PHP file passed `php -l`. A skipped/not-run workflow is not PASS.

### G0.5 — Application contract gate
**GitHub Action:** .github/workflows/application-gates.yml

Purpose: execute existing repository-owned regression checks instead of inferring correctness from prose. The gate runs the existing release checklist, asset URL hygiene and provenance unit contract, then generates a provenance artifact bound to the exact GitHub candidate SHA.

Runtime/tooling is explicit in CI: PHP 8.2 and Node.js 22, matching the established verification workflow on the current release line. PHP 8.1 compatibility remains independently enforced by G0.

PASS means this workflow ran successfully for the exact candidate. The generated provenance artifact is build evidence only; it is not proof of deployment until the runtime endpoint reports the same SHA.
### G1 — Readiness/runtime gate
**Endpoint:** `GET /api/readiness.php`

Repository contract currently checks:
- PHP `>= 8.1`;
- PDO MySQL driver;
- database availability;
- expected core tables;
- DB migration version;
- readable/writable runtime storage;
- non-empty asset version;
- presence of deploy/release/version/post-deploy/maintenance/static/CSS/accessibility endpoints.

Without diagnostics authorization it returns a reduced safe summary; authorized diagnostics include runtime PHP version, migration/table/storage detail.

### G2 — Identity health gate
**Endpoint:** `GET /api/identity_health.php`

Purpose: identity schema/runtime health. It returns ready/degraded and fails with 503 when the DB is unavailable or the identity schema contract fails. Treat this as runtime/staging evidence because it requires the configured database.

### G3 — Static/UI quality gates
Existing repository endpoints:
- `GET /api/static_quality_check.php` — diagnostics authorization required; scans repository-owned PHP/JS/CSS/HTML for project-specific structural regressions and returns 503 on findings.
- `GET /api/css_quality_check.php`
- `GET /api/accessibility_check.php`
- `GET /api/data_integrity.php`

These are candidate gates only when executed against the intended candidate/runtime. Presence of the files alone is not PASS.

### G4 — Release server gate
**Endpoint:** `GET /api/release_check.php`

Diagnostics authorization required. Existing contract checks PHP 8.1+, PDO MySQL, DB, migrations, required files/directories, asset version and debug-disabled-by-default. Returns `release_server_ready` or `release_server_blocked`.

### G5 — Deployment/release evidence
Existing repository endpoints:
- `GET /api/deploy_check.php` — verifies required deploy files/directories and reports asset version.
- `GET /api/post_deploy_check.php` — verifies required files/directories, DB configuration and service-worker release consistency; returns per-file `sha1_12` evidence.
- `GET /api/release_status.php`
- `GET /api/version_check.php` — verifies service-worker release equals asset version and returns per-file `sha1_12` evidence.
- `GET /api/runtime_health.php`
- `GET /api/maintenance_check.php`

Existing post-deploy browser checks exposed by the project include:
- `window.KaretaNext.audit()`
- `await window.KaretaPostDeploy.run()`
- `await window.KaretaVersionCheck.run()`
- `await window.KaretaCacheReset.reload()`
- `await window.KaretaReleaseAcceptance.run()`

Use these only according to their endpoint/runtime contract and authorization requirements. For release-sensitive work, evidence must be bound to the exact candidate/release identity available from the endpoint/runtime. Do not substitute a response from a different candidate.

### G5.5 — Exact deployment provenance
**Runtime endpoint:** GET /api/provenance.php
**Generator:** tools/generate_deployment_manifest.php
**Post-deploy verifier:** tools/verify_runtime_provenance.py

The deployment manifest is generated from CI/deploy environment values for the exact candidate. Runtime validation fails closed when the manifest is missing, malformed, has an invalid Git SHA, or its asset version differs from the running asset version.

A GitHub Actions provenance artifact is candidate/build evidence. DEPLOYED evidence requires the actual deploy mechanism to install the generated manifest as storage/deployment_manifest.json and the runtime verifier to match the expected SHA.
## Provenance limitation
Legacy runtime gates provide asset/release identity and file-level hashes. The provenance endpoint exposes the deployed Git commit SHA only when the deploy mechanism has installed a generated deployment manifest. Therefore asset-version consistency alone must not be represented as proof that a specific Git SHA is deployed.

Until commit provenance is added, report separately:
- repository candidate SHA;
- runtime asset/release version;
- runtime file hash evidence;
- whether an independent deployment record proves the mapping between them.

If that mapping is absent, exact-SHA deployment evidence is **BLOCKED**, even when runtime consistency gates PASS.

## Required interpretation
- PASS — named gate ran and passed for the relevant candidate.
- FAIL — named gate ran and failed.
- NOT RUN — no execution evidence exists.
- BLOCKED — gate cannot execute or cannot prove its required claim because a concrete dependency/authorization/environment/provenance mapping is unavailable.

Never translate NOT RUN, endpoint existence, a PR description, an asset-version match, or a visually correct UI into a stronger PASS than the gate actually proves.

## Gate selection
- Documentation/AI-rule-only change: G0 for any PHP touched; AI governance workflow for AI context files.
- PHP implementation change: G0 plus focused runtime/API checks relevant to the changed surface.
- Identity/auth/capability change: G0 + G1 + G2 + relevant negative-path evidence.
- Shared UI/runtime change: G0 when PHP changed + relevant G3 gates + browser/runtime smoke.
- Release/deployment candidate: required lower gates + G4 + relevant G5 evidence + provenance mapping + any Android/WebView smoke required by the active DoD.

## Evidence record
For each claimed gate record:
1. gate name;
2. candidate branch/ref/SHA/release;
3. execution target (CI, local, staging, production as applicable);
4. result PASS/FAIL/NOT RUN/BLOCKED;
5. response/workflow run identifier or other reproducible evidence when available;
6. for deployed claims, the evidence that maps repository SHA to runtime release identity.
