# KARETA — feature ownership registry v1.0

**Status: NAVIGATION INDEX; NOT FUNCTIONAL ACCEPTANCE.**

The canonical `ai/FEATURE_OWNER_INDEX.json` lists *area identifiers*, owning surface keys and existing route keys. The **only** route-presence source is `ai/FEATURE_PRESERVATION_BASELINE.json`; the owner/entry-point source is `ai/SURFACE_MAP.json`. Do not copy route URLs, schemas or permissions into this index. Index roles denote intended views, never effective access grants.

## Covered areas
Home/services, client garage, work orders, master exchange, STO workspace, marketplace/seller, community/messages, diagnostics/scanner, administrator, identity/account, finance and geo discovery. This is an index of architectural ownership, **not** a statement that end-to-end workflows are all implemented or deployed.

## Per-function change record
Record (1) business goal, role and route key, (2) exact code/API/data owner and consumers, (3) DESIRED versus IMPLEMENTED versus VERIFIED versus DEPLOYED, (4) acceptance tests including negative permission paths, (5) exact branch/SHA and target environment, (6) compatibility/rollback, (7) real visual/native evidence when required.

## Gaps that need independent verification
- The static route/file/i18n gate guards 72 known routes, 19 critical files, RU/KK/EN at its historical baseline, not working forms, layout, native hardware or backend.
- PR #124–#134 reconciliation must use fresh diffs and actual HEAD. Historical inventory is a snapshot, not current integration proof.
- ELM/Android physical support, old cached JS vs Git version, admin privileges, OTP test-only controls, stock/booking correctness, full role UX and authenticated staging are not proved by this index.
- A missing indexed area does **not** mean the app lacks it; inspect actual implementation.

Changes to canonical route availability, permissions, data model or features require explicit user decision and the relevant owning contract. No deployment is authorized by updating this document.
