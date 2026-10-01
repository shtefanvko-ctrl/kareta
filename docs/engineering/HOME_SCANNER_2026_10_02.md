# Home scanner navigation — 2026-10-02

User invariant: preserve client and master home layout; insert Scan into existing quick actions and use the canonical navigation branch.

## Change lane and restore point
Stacked on PR #34, `perf/lazy-account-window-20261001`, exact base `2c3eae32314091469d99f5c0f088229ac2308e03`. This includes #31 and #32. It is an incremental UI candidate on that chain, not an integrated 84.152/84.155 release. No merges, release changes, DB migrations or deployment.

Merge order: #29 → #31 → #32 → #34 → this delta, reconciled into the current release lane before release acceptance. Restore by reverting only this delta. Existing other PR changes are not copied.

## Implemented
- Existing home quick actions gain Scan; page sections and current links remain.
- `#/scan` → `#/scan/qr` or `#/scan/document`; three hidden-nav entries through the existing registry, role access, bindings and lazy asset loader.
- Back goes from subroute to scanner, and scanner to the current role's home. Existing navigation-state capture/restore handles the route transitions.
- Browser camera and image QR detection using BarcodeDetector when supported. Manual QR text is available when unsupported. No additional dependency downloaded at startup.
- Camera stops on cancellation, successful read, errors and route disposal; late camera permission result closes its stream.
- KARETA links limited to explicit HTTPS hosts, existing entity routes and role access. No automatic navigation or writes. Server entity authorization remains authoritative.
- Document QR can be read and shown, but cannot import vehicle data. Document text OCR, field mapping, supported sample matrix and save-to-garage are NOT IMPLEMENTED. UI states this limitation.
- Native bridge unchanged: native scan result schema was not established in this base; this candidate does not claim native camera support.
- Relevant generated core/identity/shell bundles regenerated. Unrelated stale UI bundle preserved.

## Evidence
| Gate | Local result |
|---|---|
| Home scanner behavioral regression: roles, registry, QR input positive/negative, back, lazy declarations | PASS |
| Camera lifecycle: late permission after disposal, permission denial, unsupported detector, stale target invalidation | PASS (mock execution) |
| JS syntax on changed JS | PASS |
| diff whitespace | PASS |
| master More contract | PASS |
| master UI cleanup 84.99 | PASS |
| historical home hero actions 84.14 | FAIL: same four failures on base and candidate |
| lazy runtime 84.68 / lazy account-window / PHP registry lint | BLOCKED locally: PHP missing; dedicated CI added |
| Real camera, image detection, layout matrix, physical Android/WebView smoke | NOT RUN |
| CI on exact remote candidate | Pending |
| Staging, provenance, deployment | NOT RUN |

## Next changes
1. Run exact-candidate CI and fix any new failures.
2. Browser/device smoke: both homes → scanner → QR/document → back; repeat warm route; permission denial and cancellation; portrait/landscape tablet matrix.
3. Verify Native API result schema against APK source, then reuse scanQr without changing bridge contracts.
4. Establish actual KARETA QR producers/formats; this increment only accepts existing entity links.
5. Establish document sample matrix, implement OCR adapter and field validation, then connect user-confirmed data to the canonical garage form with ownership checks.

State: IMPLEMENTED navigation increment; NOT VERIFIED end to end; NOT DEPLOYED. Full requested all-sample document scanner remains NOT_DONE.
