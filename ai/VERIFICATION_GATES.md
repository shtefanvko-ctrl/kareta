# KARETA Verification Gate Catalog

This catalog maps AI completion/release claims to executable project evidence. It is loaded for verification/release work, not for ordinary implementation tasks.

`MB_MONITORING.md` remains authoritative for desired / implemented / verified / deployed state semantics and conflict priority.

## Gate classes

### G0 — Repository syntax gate
**GitHub Action:** `.github/workflows/php-syntax.yml`

Purpose: ensure repository-owned PHP remains parse-compatible with the project's explicit PHP 8.1+ runtime floor.

PASS means the workflow ran for the exact candidate and every scoped PHP file passed `php -l`. A skipped/not-run workflow is not PASS.

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
- `GET /api/deploy_check.php`
- `GET /api/post_deploy_check.php`
- `GET /api/release_status.php`
- `GET /api/version_check.php`
- `GET /api/runtime_health.php`
- `GET /api/maintenance_check.php`

Use these only according to their endpoint contract and authorization requirements. For release-sensitive work, evidence must be bound to the exact candidate/release identity available from the endpoint/runtime. Do not substitute a response from a different candidate.

## Required interpretation
- PASS — named gate ran and passed for the relevant candidate.
- FAIL — named gate ran and failed.
- NOT RUN — no execution evidence exists.
- BLOCKED — gate cannot execute because a concrete dependency/authorization/environment is unavailable.

Never translate NOT RUN, endpoint existence, a PR description, or a visually correct UI into PASS.

## Gate selection
- Documentation/AI-rule-only change: G0 for any PHP touched; AI governance workflow for AI context files.
- PHP implementation change: G0 plus focused runtime/API checks relevant to the changed surface.
- Identity/auth/capability change: G0 + G1 + G2 + relevant negative-path evidence.
- Shared UI/runtime change: G0 when PHP changed + relevant G3 gates + browser/runtime smoke.
- Release/deployment candidate: required lower gates + G4 + relevant G5 evidence + any Android/WebView smoke required by the active DoD.

## Evidence record
For each claimed gate record:
1. gate name;
2. candidate branch/ref/SHA/release;
3. execution target (CI, local, staging, production as applicable);
4. result PASS/FAIL/NOT RUN/BLOCKED;
5. response/workflow run identifier or other reproducible evidence when available.
