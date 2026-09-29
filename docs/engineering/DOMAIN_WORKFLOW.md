# Domain-first work and sources of truth

This guide turns the useful DDD ideas into decisions and checks for KARETA.KZ. The source essay is [Miłosz Smółka, Domain-Driven Design matters more when AI writes your code](https://threedots.tech/post/ddd-and-ai-coding/). Its useful practices are understanding the business problem together, designing before a large code change, consistent language within a bounded context, and small reviewed increments. It does not require a full DDD class hierarchy for ordinary CRUD.

## Which source answers which question?

There is no single file that can simultaneously define desired behavior, describe implementation, and prove deployment.

| Question | Consult | What it proves |
| --- | --- | --- |
| What should the user experience and business rule be? | Explicit approved request/acceptance criteria and applicable UI contracts such as `docs/KARETA_UI_LOCK_RULES.md` | Intended behavior; resolve later conflicting decisions explicitly. |
| What is the active work and merge line? | Open PRs and `docs/engineering/CURRENT_PLAN.md` at the same ref | Planned/candidate behavior and dependencies, not a released feature. |
| What is implemented on this commit? | Owning JS/PHP, API action, migrations/manifest, route/asset registry, and `docs/release/current.json` | Source behavior and release claim at a pinned SHA; a release snapshot alone is not runtime proof. |
| What was checked? | Focused behavioral tests, `.github/workflows/verify.yml`, and CI on that SHA | Only the assertions and environments actually exercised. A historical test can be stale. |
| What did users receive? | `tools/verify_staging_current.py`, exact release token, HTTP/MIME asset walk, and device/WebView scenario | Deployed behavior for that host/device and release, if the evidence exists. |
| Why did an older decision exist? | `PATCH_*`, numbered stage reports, changelog, archived migration sources | Historical context; never silently promote it to current policy. |

If two rows disagree, write down **intended / implemented / verified / deployed** separately. Do not hide a disagreement by calling one file “the source of truth.” Keep the current branch and open stacked PRs in view; `main` can lag the active release candidate.

## Short domain decision note for a change

Before editing, put these answers in the issue/PR description or a nearby feature map when the feature is long-lived:

1. **Outcome and context:** user action, role/context, route/entry point; what remains out of scope.
2. **Language:** names of the entities and states, and any similar term that means something else in another context.
3. **Invariants:** ownership, required/optional data, validation, allowed transitions, duplicate and idempotency rules; point to the API/schema that enforces each.
4. **Flow:** every UI entry, API read/write, persisted state, success/error/return path, and affected neighboring feature.
5. **Proof:** focused regression, release gate, staging/device scenario, exact SHA and release. Mark each as passed, failed, or not run.

Keep the note short enough to review. Update it when implementation exposes a wrong assumption. A plan is a working model, not a generated essay that replaces inspection.

## Worked example: adding a Client vehicle

At the 84.151 candidate PR, these are distinct concepts and paths:

- `FirstEntryState` in `api/client_cabinet.php` tracks the Client introduction/draft/dismissal/completion. It is not another `Vehicle`.
- The garage and dedicated first-vehicle route lead to `KaretaFirstVehicleFlow`; the Client API wrapper sends `vehicles.upsert` to `api/db.php`. The visual flow may start at a different step for first entry versus manual addition, while the vehicle save contract remains one server action.
- The inspected server action checks the actor/owner, requires brand/model/year for a first-vehicle flow, validates a supplied VIN, rejects duplicate VIN/plate, and makes the first active vehicle primary. These are observed implementation rules; confirm the approved product contract and run the behavior before claiming them as delivered.
- The active draft PR [#17](https://github.com/shtefanvko-ctrl/kareta/pull/17) removes the older garage create/passport form and adds `tools/test_webview_logout_garage_84_151.js`. This is candidate code; `docs/release/current.json` still says `NOT_VERIFIED_AFTER_84_151` for staging. Its base is the reconciliation PR [#16](https://github.com/shtefanvko-ctrl/kareta/pull/16), not current `main`.

Acceptance for a future garage change: first entry, manual add, edit, validation errors, archive/restore, default vehicle, account switch, and return to garage must agree with their respective contracts. A structural check that a form disappeared is useful, but saving and re-opening a vehicle need executable/API and device evidence.

## Conflicts found while preparing this guide (29 September 2026)

- `main` is behind the active #16 → #17 candidate line. `docs/engineering/CURRENT_PLAN.md` on #17 still opens with 84.150, while `docs/release/current.json` says candidate 84.151. The plan needs a candidate-status note; neither number proves deployment.
- On `main`, `tools/test_client_first_vehicle_three_steps_84_25.js` expects “Автомобиль → Детали → Проверка” and an older flow version, whereas the inspected flow renders introduction, basic vehicle, and confirmation. The newer `tools/test_first_vehicle_flow_r188558413.js` describes a minimal form. Identify the current gate before retiring or rewriting a historical test.
- On `main`, `docs/architecture/API_DB_DECOMPOSITION_84_109.md` and its test reference `api/domains/*`, but that directory was absent in the inspected tree. The current candidate branch must be checked independently. Do not claim that old decomposition gate passed merely because a report says it did.

These findings are investigation targets, not changes to the vehicle or API implementation in this documentation PR. Open/refresh focused work for each conflict before treating the historical checks as current gates.
