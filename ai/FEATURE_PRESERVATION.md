# KARETA — Feature Preservation Contract (GitHub PR only)

Baseline source: PR #133 at commit `1f75fd746c7cedfe141b0659780dce9febbfc7ab`. Scope: protect current app capabilities during incremental GitHub PR development, **not** claim full runtime acceptance.

## Mandatory checks before and after every PR change
- Identify the canonical owner PR, its base and exact HEAD SHA. Compare it with current `main` and all overlapping PRs. Never overwrite another agent's changes or create a competing branch for the same contract.
- Record **existing features** affected, plus expected additions, removals or compatibility changes. Unapproved deletions, route renames, feature hiding, CSS/layout regressions and contract breakage block approval.
- Preserve user roles: client, master, STO, parts seller/admin where applicable. Preserve their existing entry points, menus, orders, garage, search, booking, work/exchange, schedules, catalogs, community, messages, notifications and permissions.
- Preserve SPA routes and browser history/back navigation, responsive layout on mobile/tablet/desktop, three themes, RU/KK/EN and WebView bridge Native API 6. Keep GEO, QR/scanner, ELM327/OBD and offline flows in scope when related.
- For changed shared contracts, require regression proof for both changed and one representative unaffected route/role. New functionality must not silently remove or disable previously available functionality.
- Inspect deleted/renamed files, route/path changes, request/response schema, registration/loading dependencies and service-worker cache compatibility. Record conflicts as BLOCKED rather than guessing.
- A patch must be minimal and reversible. Stop when evidence for an affected feature is missing. **No merge/deploy to main without separate approval.**

## Automated repository-only guard
- Source of truth for current static baseline: `ai/FEATURE_PRESERVATION_BASELINE.json` (**72 routes**, **19 critical paths**, **RU/KK/EN**).
- Runner: `python3 tools/test_feature_preservation.py --self-test`.
- CI: `.github/workflows/feature-preservation.yml` runs on GitHub pull requests using only the checkout and local Python stdlib. It does **not** check staging, production, DNS, HTTP endpoints, readiness, deployment provenance, WSL, live databases or any user's server.
- **Static PASS is only evidence that protected route URLs, critical files and landing translations remain present.** It does not prove complete UI, themes, native hardware, server behavior or end-to-end functionality. These remain NOT RUN until separately authorized and actually tested.
- The gate protects PRs containing the gate. Until its workflow is adopted in the canonical base, other branches do not inherit it automatically. The hourly GitHub agent must use this checklist manually for any other open PR.
- Adding routes requires updating the reviewed inventory without removing existing entries. Deliberate feature retirement requires a new explicit user decision and baseline-review evidence.

## PR review matrix (fill for each affected area)
| Area | Preserved or changed? | Evidence on exact SHA |
| --- | --- | --- |
| Client, master, STO and seller navigation/roles | | PASS / FAIL / NOT RUN |
| Orders, booking, garage, schedules | | PASS / FAIL / NOT RUN |
| Parts, STO, services, community and chat | | PASS / FAIL / NOT RUN |
| GEO/cities/maps, QR, ELM327/Native API | | PASS / FAIL / NOT RUN |
| RU/KK/EN, three themes, responsive UI, back | | PASS / FAIL / NOT RUN |
| Routes, files, translations (static gate) | | PASS / FAIL / NOT RUN |

**Decision:** if any affected established feature is missing or unverified, keep draft/DO NOT MERGE. Do not confuse implementation, static verification, runtime verification, or deployment.

**Resource cost:** no extra hosting, server account, database or paid test service is needed. A PR update may consume GitHub Actions runner minutes and API calls. The hourly ChatGPT automation consumes scheduled task/tool usage. Neither implies a validated live server.
