---
name: kareta-continue-pr
description: Continue work on an existing KARETA pull-request lane without creating a competing implementation.
version: 1.0.0
---
# Procedure
1. Read AGENTS.md, ai/CONTEXT_ROUTER.md, current plan, relevant contracts, and active PR metadata.
2. Verify actual HEAD; never trust a remembered SHA.
3. Check overlapping open PRs before editing shared surfaces.
4. Perform one coherent increment only.
5. Run focused checks and exact-head repository gates.
6. Record DESIRED / IMPLEMENTED / VERIFIED / DEPLOYED separately.
7. Hand off exact SHA, changed files, evidence, blockers, and next action.

Do not deploy, touch Android native source, or broaden scope unless explicitly requested.
