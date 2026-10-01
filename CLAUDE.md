# Claude Code entry point

Use `AGENTS.md` as the project-wide operating kernel.

Before substantial work, route context through `ai/CONTEXT_ROUTER.md` and load only the rule modules relevant to the current task. Use `ai/WORKFLOW.md` for implementation lifecycle and evidence reporting.

For status, DoD, verification, staging, deployment, or release decisions, `MB_MONITORING.md` is authoritative.

Do not duplicate project rules in this file. If a Claude-specific instruction becomes necessary, keep only that adapter-specific delta here.
