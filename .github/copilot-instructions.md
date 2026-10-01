# GitHub Copilot project instructions

Treat `AGENTS.md` as the project-wide operating kernel.

Use `ai/CONTEXT_ROUTER.md` to load only task-relevant rules and `ai/WORKFLOW.md` for the implementation/verification lifecycle. For status, DoD, verification, staging, deployment, or release decisions, follow `MB_MONITORING.md`.

Inspect existing implementation before editing. Do not invent project commands, APIs, schemas, paths, or passing verification results.

Keep this file adapter-thin. Shared rules belong in `AGENTS.md` or one routed module, not duplicated here.
