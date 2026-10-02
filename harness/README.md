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


## Increment 3: Exact-SHA Staleness Policy

`harness/status-policy.json` defines the canonical Harness states:

`PASS`, `FAIL`, `BLOCKED`, `NOT_RUN`, `NOT_REQUIRED`, `STALE`.

`tools/harness_verdict.js` accepts an impact artifact plus check receipts. A receipt can satisfy a required check only when its `subjectSha` equals the impact artifact's current `headSha`.

Therefore:

- PASS from an older SHA becomes `STALE`;
- missing current-head evidence becomes `NOT_RUN`;
- `STALE`, `NOT_RUN` or `BLOCKED` prevents an overall PASS;
- an exact-head FAIL makes the verdict FAIL;
- only exact-head `PASS` or `NOT_REQUIRED` can satisfy a required check.

The regression test explicitly proves that an old PASS cannot satisfy a new PR head.


## Increment 6: Agent Permission Matrix

`harness/permission-matrix.json` defines five explicit execution roles. Missing or unknown roles fail closed.

| Role | Purpose | Write boundary |
| --- | --- | --- |
| `observer` | Read/inspect only | No writes |
| `analyst` | Plans, evidence, architecture notes | `docs/**` and `harness/README.md` only |
| `fixer` | Product repair | App/API/tools/docs, but not Harness/CI and never protected boundaries |
| `verifier` | Tests, Harness and CI maintenance | Fixer scope + `harness/**` + `.github/workflows/**`, but not protected boundaries |
| `release` | Release-level operations | Repository-wide, but protected boundaries require explicit approval |

Protected boundaries remain:

- `database-contract`
- `native-bridge-contract`
- `release-provenance`
- `deployment-sensitive`

Examples:

```bash
node tools/harness_authorize.js \
  --role fixer \
  --action write \
  --file js/next/pages/core.js

node tools/harness_authorize.js \
  --role release \
  --action write \
  --file api/migrations/137_geo_platform_core.php \
  --approved-boundary database-contract
```

Authorization is fail closed:

- no role -> `observer`;
- unknown role -> denied;
- an unlisted action -> denied;
- a write without file paths -> denied;
- a file outside the role's write scope -> denied;
- Fixer/Verifier touching a protected boundary -> denied even if they claim approval;
- Release touching a protected boundary -> denied until the matching boundary approval is supplied.

This is the repository-side policy engine. Absolute prevention of an authenticated administrator bypassing CI still requires GitHub repository rules/branch protection; the current connector does not expose administration writes for that setting.


## Exact-SHA PR Comment Approvals

When `workflow_dispatch` is unavailable, protected-boundary approval can be supplied by an authorized GitHub actor in the affected pull request.

The syntax is strict and one approval is scoped to one boundary and one exact 40-character SHA:

```text
HARNESS_APPROVE database-contract <exact-head-sha> Migration chain and manifest reviewed
HARNESS_APPROVE native-bridge-contract <exact-head-sha> Native bridge contract reviewed
HARNESS_APPROVE release-provenance <exact-head-sha> Release and provenance contract reviewed
HARNESS_APPROVE deployment-sensitive <exact-head-sha> Deployment-sensitive paths reviewed
```

The collector accepts a comment only when:

- comment approvals are enabled in `harness/approval-policy.json`;
- the comment author is in `authorizedActors`;
- boundary exactly matches the required `approval:<boundary>`;
- SHA exactly matches the current Harness head SHA;
- the reason contains at least five characters.

An approval for an older SHA is unusable after the head changes. Unauthorized authors, wrong boundaries, malformed lines and wrong SHAs are ignored.
