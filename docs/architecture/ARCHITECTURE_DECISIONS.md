# KARETA — architecture decision register

This append-only register records working defaults and later accepted/rejected proposals. It is not a deployment manifest, feature status registry or test report.

## ADR-001: Maintain a modular monolith while scaling
**Date:** 2026-10-15. **Status:** WORKING DEFAULT (no runtime change approved).

**Context:** Cross-domain SPA/PHP/MySQL/Android behavior and multiple stacked PRs make distributed transactions and duplicated ownership risky.

**Decision:** Evolve the existing modular monolith by contract-defined business modules. Propose independently deployed services only with measured bottlenecks, security assessment, migration/compatibility and rollback evidence.

**Consequence:** Shared deploy boundary remains; domain coupling must be made explicit. Avoid premature service split. No infrastructure change in this record.

## ADR-002: Reference existing business authorities
**Date:** 2026-10-15. **Status:** WORKING DEFAULT (no role grants or database changes).

**Decision:** New features reference the established route baseline, domain owners, identity, orders, cars, marketplace, geo and OBD records. Use `ai/FEATURE_OWNER_INDEX.json` only as navigation, not as an independent source of routes, stock, permissions or deployed state.

**Review:** The static scaling governance gate validates references. Runtime correctness, server permissions and Android are NOT RUN until independently checked.
