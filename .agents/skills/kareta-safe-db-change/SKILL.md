---
name: kareta-safe-db-change
description: Change KARETA database schema or migrations while preserving the canonical migration chain and runtime safety.
version: 1.0.0
---
Read the migration manifest, current DB version and historical collision rules before editing.
Use only the next safe migration number; never reuse historical conflicting slots.
Make migrations idempotent/reversible where practical and define rollback/data compatibility.
Do not rely on request-time production DDL as a migration strategy.
Run migration contracts plus affected domain regressions on the exact head.
