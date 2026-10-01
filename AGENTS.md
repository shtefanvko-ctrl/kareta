# KARETA Agent Kernel

This file is the small, vendor-neutral entry point for AI coding agents. Keep it short. Detailed rules are loaded only when the task requires them.

## Source-of-truth order
1. Explicit current user decision / approved architecture invariant.
2. Required Definition of Done and verification gates.
3. Verified runtime or test evidence for the exact candidate.
4. Verified deployed/staging state for the exact candidate.
5. Approved plan/current task document.
6. Issue/PR description.
7. Commit message/changelog.

For status semantics and release evidence, `MB_MONITORING.md` is authoritative.

## Mandatory operating loop
1. ORIENT — identify the requested outcome and affected surface.
2. ROUTE — read `ai/CONTEXT_ROUTER.md` and load only relevant rule modules.
3. INSPECT — inspect existing implementation before editing; do not guess contracts, paths, commands, schemas, or APIs.
4. PLAN — for multi-file/risky work, state the intended change, invariants, checks, and rollback point.
5. CHANGE — make the smallest coherent change; preserve working architecture unless the task explicitly changes it.
6. VERIFY — run the strongest available relevant checks. Never invent a passing check.
7. EVIDENCE — record what was actually inspected/tested and the exact candidate/ref when relevant.
8. DONE — only when the requested DoD is satisfied. Otherwise report the precise remaining blocker/next executable step.

## Global invariants
- No unrelated rewrites or opportunistic architecture replacement.
- No hidden fallback that masks a failure.
- No fake data, fake success state, fake test result, or claimed deployment without evidence.
- Preserve backward compatibility unless the task explicitly authorizes a breaking change.
- Treat auth, identity, capability checks, payments, personal data, secrets, DB migrations, and production deployment as high-risk surfaces.
- Never commit credentials, tokens, private keys, session material, or production secrets.
- When desired, implemented, verified, and deployed states differ, keep them explicitly separate.
- Prefer reversible, incremental changes with a clear restore point.

## Context modules
Load only what applies:
- architecture / routing / shared contracts: `ai/rules/architecture.md`
- auth / secrets / sensitive data / destructive actions: `ai/rules/security.md`
- verification / release / status / evidence: `ai/rules/verification-release.md`
- execution lifecycle and reporting: `ai/WORKFLOW.md`
- surface ownership and verified entry points: `ai/SURFACE_MAP.json`
- parallel PR / integration-lane rules: `ai/CHANGE_LANES.md`

Do not read every historical patch note by default. Use historical documents only when they are directly relevant to the task or needed to resolve a conflict.
