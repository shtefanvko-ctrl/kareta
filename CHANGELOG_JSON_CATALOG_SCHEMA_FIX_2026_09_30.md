# JSON catalog schema guard — 2026-09-30

Repository: `shtefanvko-ctrl/kareta`, PR #25.
Base candidate: `90a932d0e2e93abbef1fc555e78fbb26200c2c60`.

## Change

- Validate the requested schema for cached catalog payloads.
- Share the HTTP request while validating schema independently for every caller.
- A caller with an incompatible schema cannot make another compatible caller fail.
- Cache a fetched payload only after a caller successfully validates it.
- Keep demand loading, request deduplication, release-scoped URLs, MIME/payload guards and retry behavior.
- Extend the existing regression with 13 runtime scenarios using the actual loader in Node VM and a controlled fetch boundary.

## Evidence

- Before the fix: 9/13 runtime scenarios passed; cached and shared-request schema assertions failed in four cases.
- After the fix: 13/13 runtime scenarios PASS; progressive JSON catalog regression PASS.
- Node syntax checks for the loader and regression PASS.
- Input reconstruction matched all 2,073 Git blobs of the exact base candidate.

## Remaining gates

- Related lazy-route checks 84.66/84.67/84.68 were attempted and FAIL: PHP probes cannot run (`php ENOENT`), and the unchanged base has asset release 84.127 versus Service Worker release 84.142.
- Full PHP release gate: NOT RUN; no PHP CLI is available in this execution environment.
- No verification workflow exists on the PR #25 head; its workflow directory contains only Instagram asset generation.
- Browser Garage -> choose -> PHP/API save -> reload acceptance: NOT RUN.
- A read-only staging ping returned HTTP 502 from this execution environment; the failing network layer was not established.
- Delivery, staging identity and deployed SHA: NOT VERIFIED.

The release mismatch is part of the existing integration/release work in PR #22 and issue #12. Keep PR #25 draft until it is integrated into a coherent release candidate and that candidate passes its applicable gates. This change establishes the loader fix; it does not establish deploy readiness.

## Next step

Integrate this fix with the 84.152 reconciliation candidate, retain the canonical cabinetSettings work, verify PHP/Service Worker release parity, run the PHP/SPA checks, and then perform one real Garage save/reload scenario on staging.
