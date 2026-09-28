# KARETA.KZ — Responsive baseline — Stage 1/539

- Plan stage: AUTO_STAGE 1/539 — responsive baseline.
- Runtime under test: `http://localhost/` only.
- Actual local release: `188.5.5.6.84.110`.
- Browser: Chrome 153.0.8010.53, headless capture.
- Representative viewports: 390x844, 768x1024, 1440x900.
- Role set: client, master, sto, seller, admin, owner.
- Evidence naming: `route__role__viewport__browser__state.png`.

## Evidence

The folder contains 18 PNG screenshots plus:
- `evidence.json` — URL, role, viewport, browser, route, geometry, console/network evidence.
- `known_defects.json` — reproducible baseline discrepancies.
- `coverage_notes.json` — limitations of session fixtures.
- `summary.json` — machine-readable totals.

Automated baseline result: 0 page-level horizontal overflows and 0 empty outlets.
Three admin-monitoring captures resolve to `home` in the legacy session fixture and are retained as a known baseline route mismatch.
## Authentication coverage

Role screenshots use a synthetic legacy-session response before application boot.
This preserves the normal runtime role-policy and route initialization without creating or modifying user records.
It is not an authenticated Identity session.
Protected role APIs can therefore return 401/403; those responses are recorded as `fixture_auth_boundary` and are not treated as responsive failures.
Master/STO protected surfaces may consequently show their current permission/error state rather than populated production data.

## Local environment repairs required before baseline

No responsive layout code was changed to obtain this baseline.
The existing Docker Desktop engine was restarted so the existing `kareta-mariadb` container could serve `127.0.0.1:3306`.
Database verification after recovery: PDO OK, migrations 129/129.
The live nginx document root is `/home/karetakz/sites/kareta.kz`.
Its missing `assets` directory was restored from the complete local project copy, and the original welcome-background `manifest.json` was restored.
After this repair the application boot audit is OK and the prior `KRT-BOOT-1009 / logo_missing` condition is gone.

## Stage conclusion

The pre-adaptation state is now reproducible and preserved as evidence.
Known baseline defects/coverage limitations are separated from future responsive regressions.
Do not use `s.kareta.kz` for this plan; all later responsive stages continue against localhost.

## Capture harness

Reproducible capture tool: `tools/responsive/capture_baseline_windows.js`.
