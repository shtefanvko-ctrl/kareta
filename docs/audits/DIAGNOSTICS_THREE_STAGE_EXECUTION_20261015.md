# KARETA diagnostics — three-stage execution report
Date: 2026-10-15. Canonical PR: #133, branch `integrate/all-features-staging-20261014`.
Prompts and acceptance gates: `docs/product/KARETA_DIAGNOSTICS_THREE_STAGE_EXECUTION_PROMPTS_20261015.md`.
Full PR stays **DRAFT / NO MERGE / NO WHOLE-PR DEPLOY**. This report distinguishes repo commits from staging-origin file installations and CDN-visible release assets.

## 1 — Staging/CDN integrity: PARTIAL PASS, CSS CDN BLOCKED
Implemented `tools/check_diagnostics_staging_cdn_20261015.js`: read-only exact Git blob hash verification for selected JS/CSS assets against staging origin, release-scoped Cloudflare request and unique-query public request; explicit MIME/HTTP checks. This is not a cache purge.

At 2026-10-14 20:41 UTC, staging root showed `X-Kareta-Asset-Version: 188.5.5.6.84.179`.
- `js/next/pages/diagnostics.js`: Git=origin=CDN versioned URL=`f9ff24246c473d2aca3b822def910b02a0855aa2`, **PASS**.
- `css/next/diagnostics.css`: Git=origin=fresh URL=`2f53c78109b569fa10869620a32154ee6ab15425`; versioned CDN URL `?v=188.5.5.6.84.179` still returns old `3c40034751a78bf8195fb331fde8d19141ceeb58` (Cloudflare HIT), **BLOCKED**.
- No authorized Cloudflare zone-scoped purge credential or supported API tool was found; no purge was attempted. Do **not** bypass the SPA release version by reconfiguring shared runtime/Service Worker.
- File-scoped origin deployment was guarded by exact prior hashes, used atomic copy + rollback backup, and did not install the entire draft PR.
- Origin backups:
  `/home/karetakz/diag-staging-backups/diagnostics-pre-2264f79.js`,
  `/home/karetakz/diag-staging-backups/diagnostics-css-pre-727cf1c.css`.
- Browser guest check of `https://s.kareta.kz/#/diagnostics` showed onboarding, not diagnostics; **authenticated tester browser E2E BLOCKED**. Guest onboarding screenshot had an unloaded logo at capture, although logo asset endpoint was HTTP 200; this is an observation, not proof the canonical logo file is missing.

## 2 — Existing diagnostic page UI + RU/KK/EN: CODE VERIFIED, visual fixture VERIFIED
- Added keyed RU/KK/EN page copy for 45 static controls and dynamic garage selection/DTC category, error help and community question links. Language signal follows `<html lang>` through existing MutationObserver; no route rerender, second app header or second Back handler.
- Preserved two entry modes: home unbound vs explicit, verified garage vehicle.
- Statuses distinguish permission, adapter transport and responding ECU; Classic existing native connector only, BLE/Wi-Fi visibly marked unavailable.
- Prevented stale/live PID display when user stops diagnostics, disconnects or navigates away; in-flight native results cannot repaint stale telemetry after cancellation.
- Fixed mobile grid min-content overflow at 320px and LIVE badge collision using scoped `css/next/diagnostics.css`, no new global tokens.
- Chrome DevTools mobile emulation of a **synthetic page fixture** produced evidence:
  `320x844: innerWidth=320, scrollWidth=320 (PASS)`;
  `390x844: innerWidth=390, scrollWidth=390 (PASS)`.
  The initial 320px fixture failed with viewport expansion to 336px; CSS was corrected and retested. This is a **component viewport smoke**, not an authenticated real SPA nor Android screenshot.
- Scripts: `tools/render_diagnostics_mobile_fixture_20261015.js`, `tools/check_diagnostics_browser_viewport_20261015.js`, `tools/test_diagnostics_transport_guide_20261015.js`.
- Not every pre-existing native status/error string is translated yet; the dictionary covers the touched static controls and specified dynamic car/DTC content. Physical device UI remains NOT RUN.

## 3 — Existing ecosystem wiring: FRONTEND VERIFIED; work-order persistence BLOCKED
- Diagnostic DTC results link to existing `#/parts`, `#/masters`, `#/masters?type=sto` routes. `#/parts` receives `vehicleId` only when the ID has been selected from the successfully retrieved/authorized garage list. Home unbound scan, unknown ID, manually unbound car send **no vehicle ID**. DTC is never used as OEM, forced part purchase or fitment proof.
- Existing opt-in question handoff fills an editable community question with a DTC and optional non-sensitive brand/model/year; no auto-publication or implicit sharing of VIN/plate.
- Existing `api/obd.php` needs a separate contract for professional order attachment: it currently reports `orderId` in a sync response but inserts no `order_id` column in `obd_diagnostic_sessions`; master/STO vehicle access must also be tied to a verified order and tenant. **DO NOT claim work-order association or automatic client sharing** merely because JSON includes `orderId`. No PHP/DB/security mutation performed in this increment.
- Server/role-aware order binding, OEM/part compatibility, and real service booking must be done in a subsequent authorized patch with DB/API negative tests and tested rollback.

## Focused verification
Commands run in current local canonical branch tree:
`node --check js/next/pages/diagnostics.js` PASS;
`node tools/test_diagnostics_transport_guide_20261015.js` PASS;
`node tools/test_diagnostics_safe_clear_20261015.js` PASS, including late Native LIVE cancellation;
`node tools/test_diagnostics_entry_intent_20261015.js` PASS (unbound/bound/forbidden ID/parts URL);
`node tools/test_diagnostics_question_handoff_20261015.js` PASS;
`node tools/test_spa_android_bridge_contract.js` PASS (46 web commands; native API minimum 6);
`node tools/test_route_binding_contract.js` PASS (72/72);
`python3 tools/test_feature_preservation.py` PASS (72 routes, 19 files, 3 baseline language catalogs; negative self-test NOT RUN).
Main branch HEAD changes concurrently from unrelated onboarding/mobile PR work; focused evidence is bound to the unchanged diagnostic code blob `f9ff242...` and CSS blob `2f53c...`. Full required exact-current-HEAD CI/provenance, live Android bridge, permissions/device firmware, and tester-authenticated route smoke remain NOT RUN/BLOCKED, not PASS.

## Three next executable actions
1. Invalidate **only** stale staging versioned CSS URL through authorized Cloudflare purge or next approved version-rotation release, rerun exact CDN check and authenticated mobile SPA smoke at 320/390/430px. Do not weaken release-scoped assets.
2. Run real ELM327 Bluetooth Classic on Android WebView with negative reconnect/permission/ECU response tests, then design separate tested BLE/Wi-Fi transports where supported; finish remaining runtime error translations.
3. Design and implement a server-owned, consent-gated `diagnosticSessionId -> workOrderId` association with client/master/STO capabilities, same tenant, idempotency and negative API tests, then link parts OEM fitment and booking. No invented support status.

Status: **three scoped prompts documented; stages 1 and 3 partially blocked at external/security boundaries, stage 2 verified in isolated browser fixture. No production release.**
