---
name: kareta-handoff
description: Produce compact verified handoff state for the next KARETA agent/session.
version: 1.0.0
---
Return only durable state:
- canonical PR/branch and exact head SHA;
- completed increment;
- changed files/contracts;
- gates run and results;
- deferred evidence;
- blockers;
- next executable action.

Do not carry full chat history or stale speculative context.
