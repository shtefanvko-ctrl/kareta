---
name: kareta-domain-owner-audit
description: Resolve KARETA bounded-context ownership and cross-context writes before changing shared business state.
version: 1.0.0
---
Identify mutable entity, authoritative owner, physical store, readers, writers and projections.
Cross-context writes must use the owner command/contract.
Do not create a third source of truth.
Keep domain term and legacy physical table name distinct when they differ.
Use current exact-head evidence; historical domain docs are advisory unless reconciled.
