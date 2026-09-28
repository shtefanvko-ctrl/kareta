# KARETA.KZ — RELEASE BASELINE 188.5.5.6.84.109

Canonical source baseline for RELEASE MASTER PLAN V3, stage 1/2516.

## Identity
- Release: `188.5.5.6.84.109`
- Source files: `1009`
- Source archive SHA-256: `3959141cb6327bbc4c78e566616f67883c9c86202beb3b4de0f3febc56853013`
- Source tree SHA-256: `98cd84ca234e727b030a561b75fbe2d0640678e92e4f1f0d59028cf870ec24b6`
- Key files fingerprinted: `26`

## Routing
- Route keys: `67`
- Legacy aliases: `39`
- Dynamic route forms: `17`
- Route source: `js/next/route_registry.js`

## Assets
- Lazy bundles: `56`
- Eager CSS: `1`
- Eager JS: `11`
- Missing runtime code assets: `0`
- Missing image assets: `22` (expected because this source package is `NO_ASSETS`)

## Staging check
External `https://s.kareta.kz/` could not be verified from this execution environment: web access was unavailable and container DNS resolution failed. This is recorded as `BLOCKED_BY_EXECUTION_ENVIRONMENT`, not PASS.

The exact extracted source was smoke-tested through PHP's local server: `/` and critical route/asset files returned HTTP 200, and the generated HTML contains the `188.5.5.6.84.109` asset token.

## Contract
`file_hashes.sha256` is the immutable fingerprint of the original 1009-file source tree. Additional QA artifacts created by this stage are intentionally not part of that source-tree fingerprint.

## Stage completion
Baseline integrity is **PASS**, but Stage 1/2516 is **NOT_OK**. External `https://s.kareta.kz/` is reachable and currently serves UKHPC / Высший Политехнический колледж rather than KARETA.KZ, so release `188.5.5.6.84.109` cannot be verified there. A local smoke check is evidence for baseline integrity only and does not satisfy the staging CHECK.
