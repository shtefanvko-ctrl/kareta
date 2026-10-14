# DEVIL-only experimental features on staging — decision 2026-10-14

Status: APPROVED POLICY; integration and authorization NOT YET VERIFIED/DEPLOYED.

Decision:
- Preserve and integrate stable **and experimental** KARETA changes into the candidate `integrate/all-features-staging-20261014`.
- Experimental operations are available initially **only to explicitly authorized testers** at `s.kareta.kz`; regular client, master, STO, and seller users keep stable flows.
- No production rollout, no public activation, and no branch deletion without independent release approval.
- The existing `/devil` documented in `ai/DEVIL.md` is an AI developer workflow, **not** a live web route, login, or permission. Do not rely on URL parameters, storage, hidden buttons, or client-reported roles for security.

Implementation contract:
- Establish a fail-closed server-side eligibility check: configured staging environment AND valid identity session AND explicit account ID allowlist from private configuration. Default-deny if any condition is absent, malformed or unavailable.
- Eligibility is **additional** to existing action-specific permissions, CSRF, ownership checks, and idempotency controls. Never bypass those controls.
- For each experimental API endpoint, enforce this check server-side before side effects; hide navigation only as an accompanying UI improvement.
- Do not expose configured tester identifiers to frontend payloads or logs.
- Use existing identity stack; no replacement authentication model.
- Keep all experimental code in the integration candidate; activate only a proven allowlisted subset. A feature not yet wrapped by server checks must not be advertised as protected.

Candidate baseline:
- PR #123 → PR #125 (migration 145) → PR #130 (migration 146).
- Outstanding source PRs: #124, #126, #127, #128, #129, #131, #132. They are not integrated merely by this policy.
- Record exact candidate SHA and verify after every change. Preserve old branches, backups and a rollback path.

Verification required before staging activation:
1. Authorized tester access with valid session.
2. Denials for ordinary users, anonymous sessions, altered client role/storage, invalid or expired sessions and **all production** requests.
3. Regression tests for unchanged primary roles/flows and affected API actions.
4. Exact-head CI and browser/runtime checks, plus Android/ELM hardware checks where applicable.
5. Staging backup, runtime readiness, version+SHA provenance and safe rollback. NOT RUN != PASS.

Next three steps:
1. Add and unit-test shared fail-closed staging tester eligibility helper.
2. Audit each experimental UI/API operation and wire the gate, preserving normal action permissions.
3. Reconcile changes serially, execute required checks, and then consider staging deployment.

This records the user's choice; the feature-level enforcement and deployment remain incomplete.
