# KARETA scaling governance v1.0

Load for new subsystems, capacity, performance, decomposition or cross-domain growth. Also load `ai/rules/architecture.md` and `ai/CHANGE_LANES.md`.

## Architectural default
- Preserve the current PHP/MySQL + vanilla-JS SPA modular monolith. Do not introduce microservices, parallel routers, API wrappers, stores or databases without measured need, an approved architectural decision, migration and rollback.
- Find the existing producer, consumers, persisted authority and server-side capability boundary before extending cars, orders, booking, diagnostics, identity, payments, messages, catalog or geo.
- One active lane owns each shared contract. Re-read canonical PR HEAD before editing; never overwrite another agent's changes or infer integration from PR descriptions.
- Persisted business records are server-authoritative. Imported JSON, client caches, CDN assets and offline queues are projections with explicit freshness, reconciliation and failure states.
- Optimize by measurement rather than guessed traffic: baseline, environment, workload, p50/p95/p99 where meaningful, candidate SHA, results and residual risk. No claimed PASS from document presence, HTTP 200 or green unrelated CI.
- Retried writes need idempotency where business semantics demand it. Bounded pagination, route-level lazy assets and explicit cache invalidation take precedence over full-catalog boot payloads.
- Preserve client/master/STO/seller/admin behavior and ownership, RU/KK/EN, three themes, Android/WebView bridge and the existing 72-route/19-path baseline unless explicitly authorized to change.
- All high-risk deployments, privileged writes, schema changes and security controls use the existing verified release/security procedures. This rule grants no production, staging, DB, SMS or Android permission.

## Per-change record
State: feature and owner; old/new API/data contract; affected and unaffected consumers; risk; rollback SHA; measurements; focused checks and denied-path check when protected; exact candidate evidence. Always distinguish DESIRED, IMPLEMENTED, VERIFIED and DEPLOYED.
