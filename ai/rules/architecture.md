# Architecture Rules

Load this file only for architecture, routing, shared-state, public-contract, or cross-module work.

## Preserve before replacing
Inspect the current architecture and reuse existing abstractions when they satisfy the requirement. Do not introduce a parallel router, state layer, API wrapper, template system, identity model, or persistence path merely because it is easier locally.

## Contract-first change
Before modifying a shared contract, identify its producers and consumers. Treat route names, API request/response shapes, persisted data, auth/session semantics, shared DOM hooks, and externally referenced identifiers as contracts unless proven otherwise.

For intentional contract changes:
1. state the old and new contract;
2. identify affected consumers;
3. provide migration/compatibility handling where required;
4. verify both the changed path and a representative unaffected path.

## Single source of truth
Prefer one authoritative representation for project state/configuration. If duplicate representations already exist, do not silently add a third. Document which source is authoritative before consolidation.

## Incremental architecture rule
Solve the requested problem with the smallest architecture-compatible delta. A broad redesign requires an explicit task/decision, a migration path, and stronger regression evidence than an ordinary change.

## Failure visibility
Do not hide broken routing, missing assets, schema mismatches, or failed dependencies behind success-looking fallbacks. A fallback may preserve availability, but it must not falsify the underlying state.

## Review gate
Before marking architecture work verified, inspect the final diff for:
- duplicate sources of truth;
- accidental public-contract drift;
- circular dependencies or hidden coupling;
- new global state without ownership;
- dead compatibility paths;
- unrelated refactoring mixed into the task.
