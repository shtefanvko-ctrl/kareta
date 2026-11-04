# KARETA DEVIL Developer Mode

DEVIL is an execution profile for KARETA developers and coding agents. It is not a second source of truth.

Invocation intent:

```text
/devil <task>
```

The command means: inspect the real project state, choose the correct change lane, implement the smallest coherent delta, verify it with existing evidence-producing checks, and report exact status.

## Authority

DEVIL always obeys, in order:

1. `AGENTS.md`;
2. the explicit current user/task decision;
3. `ai/CONTEXT_ROUTER.md`;
4. `ai/WORKFLOW.md`;
5. `ai/SURFACE_MAP.json` and the routed surface rules;
6. `ai/CHANGE_LANES.md`;
7. `MB_MONITORING.md` for verification, release, staging, deployment, DoD and status claims.

DEVIL must never override those files or create a parallel project canon.

## Mandatory boot sequence

For every non-trivial task:

1. Read `AGENTS.md`.
2. Read `ai/CONTEXT_ROUTER.md` and `ai/WORKFLOW.md`.
3. Resolve the affected surface through `ai/SURFACE_MAP.json`.
4. Load only the relevant routed rules.
5. Inspect the current implementation before proposing a replacement.
6. Inspect open PR/change-lane ownership when a shared contract can be touched.
7. State the intended delta, invariants, checks and rollback point.
8. Make the smallest coherent change.
9. Run the strongest relevant checks that actually exist.
10. Review the resulting diff for unrelated changes, duplicated ownership, debug output, secrets and generated/source drift.
11. Record exact branch/ref/SHA and actual verification evidence.
12. Use DONE only when the task's Definition of Done is actually satisfied.

## Project surface routing

### Web SPA

Use the `web_spa` ownership in `ai/SURFACE_MAP.json` and load `ai/rules/web-spa.md`.

Preserve route keys, lazy assets, release-scoped assets, warm navigation and Service Worker contracts. Do not fix a route problem by creating a second router, hidden fallback or duplicate bundle owner.

### PHP / API / DB

Use the `backend_api` ownership and load `ai/rules/backend-api.md`; also load `ai/rules/security.md` when identity, auth, permissions, uploads, destructive actions or sensitive data are involved.

Inspect existing request/response schemas and migrations before editing. Never invent an API field, table, migration number, success result or compatibility alias.

### Identity / permissions

Use the `identity` ownership and load both security and backend rules. Preserve capability boundaries and fail closed where the current contract requires it.

### Android / WebView

Use the `android_webview_bridge` ownership and load `ai/rules/android-webview.md`.

This repository does not automatically prove that native Android source is present. Treat `js/mobile_native_bridge.js` as the verified repository-side bridge entry point unless the active candidate proves additional native source. Do not claim physical-device, WebView, camera, geolocation, Bluetooth or release behavior without the required device/runtime evidence.

### ELM327 / OBD

When the active candidate contains `Анализ/elm327/**`, `tools/elm327/**` or `tools/validate_elm327_knowledge.mjs`, inspect those sources before editing or promoting diagnostic knowledge.

Use the existing ELM327 validation gate when present. If a change crosses into `api/obd.php`, vehicle identity, work orders or Android transport, also route through the backend/API and Android bridge contracts as applicable.

Do not turn model-name similarity, unsupported market data, forum anecdotes or reference-only evidence into an automatic repair instruction. Preserve VIN/platform/market applicability boundaries and evidence status.

### Geo, design, marketplace and release

Route through `ai/SURFACE_MAP.json` and the smallest relevant rule/document set. For release, staging, deployment, PASS/DONE or baseline claims, `MB_MONITORING.md` and `ai/rules/verification-release.md` are mandatory.

## Parallel developer protocol

Before a write, every DEVIL task must identify:

- base branch/ref and exact base SHA when available;
- primary change lane;
- shared contracts that can be affected;
- files expected to change;
- dependency PRs, if any.

Rules:

- One canonical implementation lane per shared contract.
- Do not open a competing implementation when another active PR already owns the same contract.
- Stack explicitly when there is a real dependency.
- Independent work may proceed in parallel only when ownership does not overlap.
- Generated bundles are outputs: change the canonical source first, then regenerate with the project's existing generator.
- Do not bury unrelated cleanup in a feature/fix commit.
- Do not merge to `main`, deploy, alter production data or execute destructive DB operations unless the task explicitly authorizes that action and required gates/evidence are satisfied.

## Verification discipline

DEVIL prefers verification in this order when the checks exist:

1. syntax/static checks;
2. focused contract/unit/module checks;
3. integration/API checks;
4. browser/runtime smoke;
5. staging/runtime evidence;
6. Android/WebView physical-device evidence;
7. real ELM327/Bluetooth hardware evidence;
8. deployment/provenance evidence.

A missing check is `NOT RUN`, never PASS.

Old PASS evidence is not evidence for a new HEAD. Verification must bind to the exact candidate when the task requires release-quality evidence.

## Developer handoff format

Every completed DEVIL run should report:

```text
DEVIL STATUS
Task:
Base:
Head:
Lane:
Changed:
Verified:
NOT RUN:
Blockers/Risks:
Next 3:
Verdict:
```

Allowed verdict vocabulary follows the project monitoring contract: `DESIRED`, `IMPLEMENTED`, `VERIFIED`, `DEPLOYED`, `BLOCKED`. Keep those states separate.

## Default behavior

DEVIL executes rather than merely restating a plan when the requested change is safe and sufficiently specified.

If a destructive, production, credential, permission or irreversible boundary lacks explicit authorization, stop before that boundary and report the exact approval/evidence required. For ordinary implementation ambiguity, inspect the repository and choose the smallest compatible solution instead of inventing missing architecture.
