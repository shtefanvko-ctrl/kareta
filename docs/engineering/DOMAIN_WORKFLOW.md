# Domain-first engineering workflow

This document is a focused domain-analysis guide for KARETA.KZ. It does not override `AGENTS.md`, `MB_MONITORING.md`, `ai/rules/*`, or `ai/CHANGE_LANES.md`.

## Authority order

When sources disagree, use the project order already defined by `AGENTS.md` and `MB_MONITORING.md`:

1. explicit current user decision / approved architecture invariant;
2. required Definition of Done and verification gates;
3. verified evidence for the exact candidate;
4. verified deployed/staging evidence for the exact candidate;
5. approved current plan;
6. issue / PR description;
7. commit message / historical changelog.

A domain document is evidence and design guidance. It is not allowed to silently become a higher source of truth.

## Required state separation

Always keep these states separate:

- **desired** — approved/intended behavior;
- **implemented** — code/schema/config exists;
- **verified** — required checks passed for the exact SHA;
- **deployed** — that exact candidate is present on the target environment.

A green repository gate is not deployment proof.

## Domain decision note

Before a cross-context or shared-contract change, record:

1. user outcome and affected route/API;
2. bounded context and supporting contexts;
3. owner of each mutable business entity;
4. invariants and authorization boundary;
5. existing physical/runtime store versus domain term;
6. callers/readers/writers affected;
7. focused regression and negative-path evidence;
8. exact candidate SHA and current desired/implemented/verified/deployed state.

Keep this note short enough to review.

## Ownership rule

Prefer one authoritative mutable owner per business entity.

A supporting context may read another context through an explicit query/read model. A write into another context must use that context's owner contract. Do not create a third parallel source of truth to bridge two existing ones.

Current examples:

- Identity owns Account/Person/Context/Capability authorization state.
- Garage owns vehicle state; Service may reference a vehicle but does not own it.
- Service owns accepted repair-order lifecycle and its legacy schedule projection fields.
- Booking/Master scheduling uses the Service-owned schedule projection contract recovered and verified in PR #37.
- Notification Center is the canonical in-app read model for resolvable per-user notifications; the legacy store remains a compatibility producer until migration evidence exists.
- Marketplace currently has seller_* and market_* semantics that are not proven equivalent; no physical canonical store is selected yet.

## Verification budget

Map each invariant to one current executable guard when possible.

Do not create multiple string-presence tests for the same invariant. Prefer a focused regression that protects behavior or a concrete contract. Historical tests remain evidence only until their assumptions are reconciled with the current candidate.

For repository work:

- PHP/JS syntax is necessary but not sufficient;
- shared-contract work must exercise a representative unaffected path;
- security/auth changes need a relevant rejection path where executable;
- read-only audits must not mutate runtime state or load mutating bootstrap paths.

## Current repository baseline

At the time this document is introduced:

- release reconciliation lane: PR #22, head `c20beb7fd2814e06b108451aa3e15bf414448123`;
- release identity remains `188.5.5.6.84.152`;
- recovered domain/runtime lane: PR #37, head `34331a52fb9386af5baa5ff0452540a2cce24b07`;
- PR #37 exact-head repository checks are PASS;
- deployment/staging verification is intentionally deferred and must not be inferred from repository CI.

Future edits must update this baseline rather than treating these SHAs as permanent architecture constants.

## Read-only audit tools

The following tools are repository-safe analysis entry points and must remain read-only:

- `tools/audit_marketplace_dual_sot.php`;
- `tools/audit_operational_finance_authorization.php`;
- `tools/audit_service_domain_projection.php`;
- `tools/audit_service_projection_consistency.php`.

Their output is evidence about a database snapshot. It is not authorization to mutate or migrate data.

## Change-lane rule

If another active PR owns the same shared contract, stack on that exact head or contribute to that lane. Do not branch from an older base and resolve overlapping behavior later by guesswork.

For recovered historical work, preserve evidence, isolate the smallest coherent increment, verify it on the current base, and only then retire the parallel historical line.
