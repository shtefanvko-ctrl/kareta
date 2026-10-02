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


## Increment 2: Exact-head Impact Evidence

`tools/harness_evidence.js` computes the changed-file list from the real Git range `base...head`, passes it through the change map, and writes `kareta.harness.impact-evidence.v1`.

For pull requests, `.github/workflows/harness-impact.yml`:

1. checks out the exact PR head;
2. fetches full history needed for the merge-base diff;
3. builds the impact manifest from the PR base SHA and head SHA;
4. validates that the artifact is bound to those exact SHAs;
5. uploads `harness-impact-<head-sha>` for 30 days.

Required checks in the impact artifact start as `NOT_RUN`. A planning artifact is not itself verification evidence and must never be interpreted as PASS.
