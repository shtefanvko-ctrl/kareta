# KARETA.KZ — API DB Decomposition Contract

Baseline: `R188.5.5.6.84.109`
Stage: `12/2513`

## Goal

`api/db.php` remains the compatibility entrypoint, but it is no longer the place where new actions or new critical-domain handlers are added.

The migration pattern is a strangler: existing API URLs remain stable while action routing and handlers move into `api/domains/*`.

## Stage 12 extraction

Before:
- `api/db.php`: 687448 bytes.
- detected router actions: 291.

After:
- `api/db.php`: 675028 bytes.
- router actions remaining in monolith: 281.
- extracted critical actions: 10.

Identity/admin domain:
- `auth.sendOtp`
- `auth.verifyOtp`
- `users.getAll`
- `users.setRole`
- `users.setActive`
- `users.upsert` (deprecated compatibility response)
- `users.upsertAdmin`
- `profile.updateMine`

Runtime-config domain:
- `config.get`
- `config.save`

Files:
- `api/domains/identity_admin.php`
- `api/domains/runtime_config.php`

## Non-growth rule

Do not add a new `case '<action>'` or `$action === '<action>'` branch to `api/db.php`.

New actions must:
1. live in a domain module under `api/domains/*` (or an already extracted domain API file);
2. be routed by a domain dispatcher;
3. preserve the existing auth/capability/idempotency/error contract;
4. add or update a domain-specific regression test;
5. pass `tools/test_db_monolith_decomposition_84_109.js` and the unified release checklist.

The contract file `tools/contracts/db_monolith_84_109.json` records the maximum monolith size and its post-Stage-12 action set. Removals are allowed; additions to the monolith are not.

## Compatibility

Public endpoint remains `/api/db.php`.
No action name was renamed.
No request/response schema was intentionally changed.
No DB migration was added.
No frontend route was changed.

## Next decomposition candidates

Continue incrementally, one domain per stage:
- order core/disputes;
- chats/messages;
- news/site content/audit;
- legacy service/catalog CRUD.

Do not move several high-risk transactional domains in one patch.
