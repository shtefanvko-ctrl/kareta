# CARAT Design Master — prototype

**Status:** interactive UI prototype only. It does not modify KARETA routes, PHP endpoints, database, or production assets.

## Product model

- A **window** is a KARETA route or navigation destination (home, community, request, registration).
- A **module** is reusable content rendered inside a window. The registration flow links three windows to three modules.
- A module contains typed blocks (heading, text, text input, password, button, image). Selecting a block exposes its visual and data properties.
- One module has responsive rules. For each block, the editor can set visibility for desktop, tablet, and phone. The selected viewport changes the canvas width.
- A password input has semantic type `password` and a data key. The password value is never part of the module configuration.

## Prototype interactions

- Switch desktop / tablet / phone preview.
- Select a layer and edit visibility for the selected viewport.
- Select another block in the tree.
- Save and publish controls clearly report that no backend is connected.

The sample endpoint label is descriptive only. No form is submitted and no network request is made.

## Planned production architecture

1. Keep the existing KARETA SPA route registry, window engine, identity/capability checks, and current domain APIs as the sources of truth. Inspect them before integration.
2. Save editor configuration through protected PHP admin endpoints. PHP validates authorization and schema and writes versioned configuration using the existing PDO/database conventions. The browser never connects directly to MySQL.
3. Let KARETA runtime request only the published module configuration for a route. Render allow-listed block types and responsive CSS rules.
4. Bind form blocks to existing business API actions only after their real request/response contracts are verified. Do not invent endpoints, table names, or duplicate business records.
5. Add explicit preview, publish, version history, and rollback. A draft must not affect visitors.
6. Handle Android WebView through the same responsive SPA unless repository inspection shows a required native bridge change.

## Initial implementation prompt

> Build the CARAT Design Master for KARETA.KZ by reusing the existing SPA window engine, route registry, admin capability checks, PHP API and MySQL ownership contracts. Model windows as routes and modules as reusable content. Provide desktop/tablet/phone preview and per-block responsive visibility/layout rules. Use allow-listed semantic block types and explicit data/action bindings to verified existing API contracts. Persist versioned drafts and published versions through authorized PHP endpoints; never expose direct database access to browser code. Password values must never be stored in module configuration, logs, local storage or editor drafts. Preserve the existing runtime and visual canon. Work in one reviewable Git increment, inspect current callers and open PRs, and keep production unchanged until a separate release review and approval.

## Next step

Audit the current route/window engine, admin capabilities, API contracts, database/migration ownership, and active change lanes. Then propose the smallest production integration increment. No production wiring is included in this prototype.
