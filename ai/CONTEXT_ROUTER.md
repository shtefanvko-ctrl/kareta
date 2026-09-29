# AI Context Router

Goal: maximize useful project context while minimizing context pollution. The agent should load the smallest sufficient rule set for the current task.

## Always loaded
- `AGENTS.md`
- the current user/task request
- the concrete files being changed

`MB_MONITORING.md` becomes required when the task involves status, verification, release readiness, staging, deployment, DoD, or monitoring.

## Routing table

| Task signal | Load | Avoid by default |
| --- | --- | --- |
| architecture, router, shared state, cross-module refactor, public contracts | `ai/rules/architecture.md` | unrelated historical patch notes |
| auth, identity, permissions, capabilities, cookies, sessions, secrets, uploads, destructive actions | `ai/rules/security.md` | broad UI/product docs unless affected |
| tests, regression, release, staging, deploy, DONE/PASS, baseline, evidence | `ai/rules/verification-release.md`, `MB_MONITORING.md` | assuming latest commit == verified release |
| ordinary implementation task | `ai/WORKFLOW.md` plus only the affected module files | all rule modules at once |
| ambiguous conflict between docs and runtime | `MB_MONITORING.md`, then the smallest relevant rule module | silently choosing the newest text |

## Progressive disclosure rules
1. Start with the smallest context that can answer the task.
2. Expand context only after a concrete dependency, conflict, or unknown is found.
3. Prefer source files and executable evidence over summaries when correctness depends on implementation.
4. Prefer a current approved decision over old patch/changelog prose.
5. Do not recursively load documentation merely because it is linked.
6. Summarize large evidence before carrying it into the next reasoning step.
7. If two instructions overlap, keep the stricter safety/verification invariant and resolve product/architecture conflicts by the source-of-truth order in `AGENTS.md`.

## Context budget discipline
A rule belongs in `AGENTS.md` only if it applies to almost every task. Domain-specific detail belongs in a routed module. Historical state belongs in changelog/patch records. Machine-verifiable requirements should migrate to executable checks rather than grow as prose.

## Adding a new rule
Before adding it, answer:
- Is this universal? If yes, add one concise invariant to `AGENTS.md`.
- Is it domain-specific? Add/update one routed rule module.
- Can a tool verify it? Prefer an executable gate and reference the gate from documentation.
- Is it merely history? Keep it out of active agent context.

This file is a router, not a second policy book. Do not duplicate detailed rules here.
