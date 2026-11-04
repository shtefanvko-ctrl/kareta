# /devil — KARETA developer mode

Use this command for the current KARETA task.

Before editing:

1. Read `AGENTS.md`.
2. Read `ai/DEVIL.md`.
3. Read `ai/CONTEXT_ROUTER.md` and `ai/WORKFLOW.md`.
4. Resolve ownership through `ai/SURFACE_MAP.json`.
5. Read `ai/CHANGE_LANES.md` before touching a shared contract.
6. If the task involves PASS/DONE, release, staging, deployment, provenance or monitoring, read `MB_MONITORING.md`.

Then execute the user's task against the real repository state.

Do not create a second source of truth. Inspect before changing. Keep the smallest coherent delta. Preserve compatibility unless explicitly authorized otherwise. Do not claim checks, deployment, physical Android/WebView behavior or real ELM327/Bluetooth behavior that were not actually verified.

For SPA/Web, PHP/API/DB, Identity, Android/WebView, ELM327/OBD, Geo, design and release work, follow the routing and evidence rules in `ai/DEVIL.md`.

Finish with the `DEVIL STATUS` handoff from `ai/DEVIL.md`.
