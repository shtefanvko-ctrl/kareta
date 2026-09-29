# KARETA.KZ — engineering guide for coding agents

Applies to the web repository. Read this before changing PHP, JavaScript, CSS, API contracts, migrations, or release metadata. Use `docs/engineering/DOMAIN_WORKFLOW.md` for the evidence map and worked example.

## Establish the actual baseline

1. Record the branch and commit SHA. Read `docs/engineering/CURRENT_PLAN.md`, `docs/release/current.json`, relevant open PRs, the affected code, and the focused checks. Historical `PATCH_*` and numbered release reports describe their own snapshots; they do not prove current behavior.
2. Separate **intended** behavior (an approved product decision or acceptance contract), **implemented** behavior (current code and schema), **verified** behavior (passing checks on that SHA), and **deployed** behavior (release-matched staging/device evidence). Never infer one from another.
3. When sources conflict, name the exact paths/refs and the disputed rule. Inspect the owning runtime path and resolve or record the conflict before changing dependent logic. Do not silently select the newest-looking document or weaken a test to make it pass.

## Model the domain before generating code

1. State the user outcome, bounded context, shared terms, state transitions, permissions, and invariants in a short change note. Use the same terms in the acceptance case, API, and code **within that context**. Similar words in different contexts do not imply one shared entity.
2. For a feature with several entrances, map each route/button to its UI flow, API action, persisted state, and final result. Decide explicitly which rules must be shared and which presentation steps may differ. For Client Garage, `Vehicle` and `FirstEntryState` are separate concepts; opening a form never constitutes saving a vehicle.
3. Resolve unclear business rules against approved decisions and real scenarios. Agents may propose a model, but a generated document is not approval. Record assumptions; ask for a product decision only when evidence cannot settle a material choice.
4. Prefer the smallest vertical change that preserves existing contracts. Apply DDD tactical patterns (aggregate, repository, service) only when a concrete invariant or coupling justifies them; do not reorganize the app merely to follow a pattern.

## KARETA boundaries

- Identity: preserve Account/Person/Context/Capability boundaries. New business authorization must use capabilities; check `docs/architecture/LEGACY_ROLE_BUDGET_CURRENT.json` and its no-growth check.
- Client Garage: trace `js/next/pages/cabinet.js`, `js/next/pages/client_first_vehicle.js`, `js/next/client/first_vehicle_flow.js`, `js/next/client/client_cabinet_api.js`, `api/client_cabinet.php`, and the `vehicles.*` actions in `api/db.php` before changing an entry or save path. Check active PRs because the visual picker is being reconciled.
- UI: obey `docs/KARETA_UI_LOCK_RULES.md` and `docs/KARETA_VISUAL_SYSTEM_RULES.md`; verify their applicability to the target release.
- Release: preserve matching asset, Service Worker, migration, and Native API contracts. A passing source test does not establish that staging or Android WebView has that release.

## Verification and handoff

- Preserve the existing user paths while changing a feature: compare the affected entry points, success/error states, ownership, repeat actions, back/re-entry, and dependent routes before and after. Never remove a working capability just to satisfy a new pattern or a stale assertion.
- Before adding a test, find the current check for that invariant. Extend or replace one authoritative behavioral regression; avoid another string-presence test of the same block. Retire a historical test only after mapping its distinct coverage to a current check. A failing old test is a contract conflict to investigate, not permission to weaken the product behavior.
- During implementation run focused checks for the changed risk. The current `.github/workflows/verify.yml` gate runs on the PR head; run release-matched staging/device smoke when the changed behavior is deployed. Documentation-only edits need source/link review, not repeated full runtime or Android smoke.
- Report exact commands, SHA, release, result, and unavailable evidence separately. DONE for a behavior change requires an observed user scenario and its evidence. A commit, document, generated test, or green local lint alone is an intermediate state.
