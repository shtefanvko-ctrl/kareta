---
agent: 'agent'
description: 'Run the KARETA DEVIL developer workflow against the real project state'
---

Activate KARETA DEVIL mode for the user's current task.

Read and obey these project files before changing code:

- [AGENTS.md](../../AGENTS.md)
- [DEVIL execution profile](../../ai/DEVIL.md)
- [Context router](../../ai/CONTEXT_ROUTER.md)
- [Workflow](../../ai/WORKFLOW.md)
- [Surface map](../../ai/SURFACE_MAP.json)
- [Change lanes](../../ai/CHANGE_LANES.md)

If the task involves verification, release readiness, staging, deployment, DONE/PASS, provenance or monitoring, also read [MB_MONITORING.md](../../MB_MONITORING.md).

Use any text supplied with this prompt as the task. Execute the task; do not only paraphrase it.

Required behavior:

1. Inspect the current implementation and active change-lane ownership before editing.
2. Route SPA/Web, PHP/API/DB, Identity, Android/WebView, ELM327/OBD, Geo, design and release work through the project-owned rules described by `ai/DEVIL.md`.
3. Keep the delta minimal and preserve current contracts unless the task explicitly changes them.
4. Run the strongest relevant checks that actually exist.
5. Never invent PASS, deployment, Android-device or ELM327-hardware evidence.
6. Finish with the DEVIL STATUS handoff defined in `ai/DEVIL.md`, including the next three executable steps when work remains.
