# CARAT Design Master — production integration audit

**Audit ref:** `prototype/carat-design-master-responsive-20261113`  
**Source candidate:** `993926e306e9758e7afc3975354d81bfcd729440`  
**Status:** source inspection only; this document is a plan, not an implementation approval.

## Verified repository contracts

| Area | Observed source | Finding | Integration consequence |
|---|---|---|---|
| SPA routes | `js/next/route_registry.js` | Routes and navigation metadata live in the shared route registry. | Represent a “window” by an existing route key; do not add a second router or write arbitrary hashes from configuration. |
| Lazy assets | `js/next/route_asset_loader.js`, `asset_manifest.php`, `sw.js` (entry points in `ai/SURFACE_MAP.json`) | Lazy route bundles are registered and release-scoped. | Any runtime module loader must use the existing loader/manifest and preserve release-scoped caching. |
| Window engine | `js/next/window_engine.js` | Current descriptor recognizes `#/orders/item/{id}` and mounts the work-order card in a dialog. It is not a general page/module renderer. | Reuse its dialog/lifecycle only if a concrete editor preview needs it; do not treat it as the window/module registry. |
| Flow helper | `js/next/kflow_windows.js` | Provides reusable registration-flow step markup and OTP interactions. | Registration steps can be referenced as an existing UI pattern; do not duplicate OTP behavior in a future editor renderer. |
| Admin authorization | `api/identity/authorization_pipeline.php`, `api/identity/capability_service.php`, `api/identity/capability_registry.php` | Server-side identity/context/capability authorization exists. Admin UI is explicitly not an authorization boundary (`ai/rules/admin.md`). | A future editor write endpoint needs an explicit server capability and denied-path evidence. UI role checks alone cannot authorize changes. |
| Existing admin operations | `api/admin_operations.php` | Generic privileged operations use the authorization pipeline and audit records; inspected actions are account, organization and moderation operations. | Do not silently overload this endpoint for module configuration. First identify the correct domain owner and capability, then decide whether a dedicated action belongs in an existing API surface. |
| Business API / DB | `api/db.php`, `api/bootstrap.php`, domain action files | Existing PDO-backed business actions are centralized through current API/domain contracts. | Form bindings must target verified existing actions; the browser must never connect directly to MySQL. No request/response contract for a generic form editor was established in this audit. |
| Migration registry | `api/migration_manifest.php`, `api/migration_manifest.json` | Both manifests advertise target DB version 137 in this candidate. | Do not add an editor table migration until migration ownership and target lineage are resolved. |

## Open change lanes and conflicts

- No open PR was returned by the repository-scoped search for a window/module design editor. PR #200 remains the sole editor prototype lane.
- The shared route, CSS/design-canon, and migration contracts have active lanes. In particular #192/#193/#195 touch design system or responsive UI work, so any future shared styling change must be checked against their exact files and heads before implementation.
- Migration ownership is not clear for a new table: open PRs #155 and #191 address migration manifest/provenance, #185 is a DB-history preflight, and #188 resolves a migration-number collision on a stacked lane. Existing ledger evidence records known 137/144 drift and release HOLD. This editor must not choose a migration number or modify either manifest until those owners reconcile the lineage.
- The prototype is isolated under `prototypes/carat-design-master/`; this audit found no need to alter SPA routes, APIs, migrations, or Android bridge in the prototype lane.

## Smallest safe production path

1. **Close the prototype scope.** Keep current preview and inspector state explicitly local; browser QA is still required before claiming the prototype is runtime-verified.
2. **Resolve ownership before coding runtime behavior.** With the route owner, decide whether “windows” are ordinary route destinations and whether reusable modules are route content descriptors. The current modal engine alone does not supply that contract.
3. **Specify a versioned allow-list schema.** Define route key, reusable module ID/version, ordered block IDs, block type, responsive layout/visibility, and data/action binding IDs. Exclude executable HTML/JS/CSS and all field values, especially passwords, from persisted configuration.
4. **Define authorization and lifecycle.** Select or add an explicit capability through the canonical capability registry; require server validation, audit trail, draft/published separation, optimistic version check, and rollback semantics. Do not infer authorization from route visibility or legacy role strings.
5. **Map forms to domain owners.** For each planned form, record the existing API action, payload, response, idempotency expectations, and validation owner. If no suitable action exists, design it with the owning domain before editor integration; do not create a generic write-through API.
6. **Only then plan persistence.** Once migration owners reconcile the canonical DB target and open lanes, propose the smallest migration and rollback plan. Keep DDL and any live DB operation outside this PR.
7. **Integrate in a separate reviewable PR.** Use the existing route registry and lazy loader, follow admin/API security rules, and preserve Android WebView through the responsive SPA unless source evidence proves a native bridge contract is required.

## Evidence and status

- **PASS (read-only source inspection):** exact branch head, issue #199, draft PR #200, `AGENTS.md`, `ai/CHANGE_LANES.md`, `ai/SURFACE_MAP.json`, route registry/loader, window engine, KFlow helper, admin API, identity authorization/capability services, API entry points, PHP and JSON migration manifests.
- **PASS (lane inventory):** repository search found no second open editor PR; relevant design and migration PRs are named above.
- **NOT RUN:** browser interaction/viewport QA, automated tests, live API authorization checks, database-history inspection.
- **BLOCKED:** assigning a production migration number or claiming a complete persisted editor contract, until migration lineage and domain/capability ownership are confirmed.
- **NOT DEPLOYED:** no production or staging changes; no DB/DDL; no Android native bridge changes.

## Next executable step

Run a focused browser review of the existing prototype on desktop, tablet, and phone, then record actual interaction outcomes. After that, bring the window/module ownership and proposed capability to the relevant maintainers before opening any runtime/API/migration implementation lane.
