# KARETA Harness

This directory is the machine-readable control plane for verification-first changes.

## Increment 1: Change Intelligence

`change-map.json` maps repository paths to subsystems, required checks, risk and protected boundaries.

`tools/harness_plan.js` classifies a list of changed files. It does not edit files, run deployments, execute migrations or modify Android.

Examples:

```bash
node tools/harness_plan.js js/next/geo_map.js
printf '%s\n' api/geo.php api/migrations/137_geo_platform_core.php | node tools/harness_plan.js
```

The output is an impact manifest:

- `subsystems` — affected areas;
- `checks` — checks that must be considered;
- `risk` — highest mapped risk;
- `requiresReview` — explicit human-review boundary;
- `flags` — protected contracts such as DB, native bridge, release/provenance or deployment.

Unmapped files fail safe to `unknown + verification-gate + requiresReview`.

## Status model

The Harness uses these verification states:

`PASS`, `FAIL`, `BLOCKED`, `NOT_RUN`, `NOT_REQUIRED`, `STALE`.

A previous PASS is not evidence for a newer SHA after a relevant file changes.

## Safety boundary

This increment is classification-only. It does not change product runtime, Android sources, database schema, migration execution or deployment.
