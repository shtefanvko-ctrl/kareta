# KARETA.KZ — Universal OBD-II / ELM327 diagnostics: approved product canon
Status: APPROVED PRODUCT REQUIREMENTS / IMPLEMENTATION PARTIAL / RELEASE NOT VERIFIED.
Date: 2026-10-15. Owners: KARETA product + existing SPA/Android/API owners.
Source: two user-provided UX image references (12 ecosystem screens + 10 connection/diagnostic screens); current explicit product decisions.

## Four approved decisions (mandatory)
1. Universal modular adapter architecture: Bluetooth Classic SPP (existing contract), BLE and Wi-Fi as **targets to investigate and implement separately**, not advertised as already working. A discovered BLE GATT device is not automatically ELM-compatible. USB OTG deferred.
2. **Home**: "Диагностика ЭБУ" starts without requiring garage/vehicle, even if garage has cars. No implicit association with last/default vehicle. Current-session results remain visible without cloud persistence; optional explicit association/saving to a car. **Garage -> one specific vehicle**: "Диагностика ЭБУ" passes that car's genuine vehicleId and binds the report to that vehicle subject to authorization. Missing VIN must not block OBD-II. VIN disagreement must not silently rebind.
3. Shared diagnostic engine with **different authorized workflows**: client reads own vehicle / requests assistance; master handles authorized customer vehicle/assignment; STO attaches verified report to authorized work order. Role alone never grants cross-account vehicle access; server enforces ownership/capabilities.
4. "Спросить мастеров об этой ошибке": user-initiated draft with DTC + optional non-sensitive car details, editable and **never auto-published**. No VIN, plate, location, phone, full report in public draft without explicit consent.

## Preserve existing single sources of truth
- SPA route: `#/diagnostics`; garage `#/cabinet/garage`, car `#/garage/car/{id}`, assistant `#/assistant`, community `#/community/question/create`, parts `#/parts`, masters `#/masters`. Use existing route registry + lazy loader and one canonical Back handler. Home logo only on home; internal-page headings and existing tokens elsewhere. RU/KK/EN through existing i18n without losing active connection.
- Web client: `js/next/pages/diagnostics.js`; Native JS contract: `js/mobile_native_bridge.js` requiring native API >= 6 and `elmStatus`, `elmDevices`, `elmConnect`, `elmReconnectLast`, `elmDisconnect`, `elmInit`, `elmCommand`, `elmSnapshot`, `elmLiveSnapshot`. This alone does **not** prove native APK capabilities. Do not replace or fork the bridge.
- Persistence: `api/obd.php` / `obd_diagnostic_sessions`, using server authorization and vehicleId; offline native queue -> sync contract is existing. Do not claim cloud save if vehicleId absent, sync failed or no native store is available.
- Existing community API, catalog fitment / OEM/SKU, geography/cityId, order/booking, and user identity. Reuse their contracts; no parallel databases, shop, account state, conversation system or service order.

## Unified UX map (existing pages + nested states; not 24 independent routes)
1. Client home CTA / garage card for exact selected car.
2. Connection start / supported transport cards, with disabled/unsupported states labelled, pairing instructions and permission.
3. Adapter discovery -> selection -> transport connection -> ELM init -> ECU protocol handshake -> ready. These are distinct statuses.
4. Diagnostic hub: DTC / PID live data / available ECU identity / readiness / history / report / safe clear DTC. Missing capabilities are explicit, not green success cards.
5. DTC list with genuine status and exact decoding: P0110 is IAT circuit malfunction, **P0113** is IAT circuit high input, P2178 is system too rich off idle (Bank 1); mockup text is not a diagnostic truth source. Reference code + available supported OBD mode/source; no auto-buying from one DTC.
6. Actual PID values and graph, unavailable marker per PID, freshness/timestamp and stop on transport loss. Never fabricate measurements.
7. Report: scan timestamp, optional authorized car ID, adapter, supported protocol, DTC (stored/pending/permanent only where queried), actual PID data, readiness, cautions, opt-in save/share. Offer association with selected/created garage car; preserve no-car session in UI.
8. Repair actions: knowledge-based checks -> optional editable question draft -> parts with confirmed fitment -> masters/СТО with real city and availability -> authorized booking. Do not assert price/availability without provider evidence.
9. Screens for client/master/СТО share engine but surface role-specific authorized actions. Master/СТО customer cars via existing order/workflow and capability checks only.

## Navigation contract
- Home entry **must not** auto-select a previously used/default garage car.
- Garage car entry uses explicit vehicle ID, consume navigation handoff exactly once; if ID is not in the authorized retrieved garage list, show a visible mismatch/permission error and remain unbound.
- User may explicitly select/unselect a garage car from diagnostics. Unbound scans remain possible without identity or VIN; cloud sync requires vehicleId under existing contract.
- Single Back handler; direct deep-link fallback; modal first, then route history; no duplicate listener.
- Auto-saving an unbound scan to a vehicle is prohibited: require explicit user confirmation.

## DTC / adapter safety
- Capability gate each OBD command and per-PID. Standard service modes 01,02,03,04,07,09,0A only if supported by actual ECU/adapter. Manufacturer-specific ABS/SRS/TCU requires verified transport/protocol and must not be promised through generic ELM.
- Clear DTC (mode 04) is a destructive action: explicit informed confirmation and attempt to preserve original DTC/freeze frames before clear. No automatic clear after scanning.
- Separate BT permission denied / off / no device / transport fails / ELM init failure / ECU no response / unsupported protocol / disconnect, with retry and diagnostics; do not hide errors behind success fallback.
- Vehicle VIN match, manufacturer decoding, recommendations and fitment must be grounded in verified data. Never present causality or part compatibility based on a code alone.

## Security & privacy
Server-enforce authenticated ownership for OBD history/sync and authorized client/vehicle/work order; deny enumeration and cross-tenant access. No hard-coded OTP, bypass, sharing or diagnostics payload leaks. Audit where raw adapter MAC, VIN, identity, order ID and diagnostic snapshots are retained; minimize/public redact. Question drafts and shared reports need explicit confirmation.

## Work increments / rollback gates
A. Audit owner surfaces + stage exact-head provenance. Compare PR #133 and related PRs; no competing implementation. Resolve staging tester guard/allowlist before deploying experimental features.
B. Canonical mobile UX: home and garage entry, internal headers, back, 320-430px, genuine logo, RU/KK/EN; staging visual comparison; rollback file-level.
C. Native adapters: verify Classic on real APK, add BLE/Wi-Fi only with native design/permission/protocol + test hardware and transport-specific errors.
D. DTC source and PID parser, safe clear, available ECU data; no placeholder DTC text; tests on supported hardware or tagged fixtures.
E. Role-aware reports/authorized persistence, explicit no-car save choice, offline migration and deduplicated synchronization.
F. User-approved community question draft; customer opt-in; parts/masters/СТО/booking integration only through existing API.
G. Exact SHA syntax/route/i18n/security/72-protected-routes baseline if still current/19-critical-files baseline if still current; CI, WebView two-pass smoke and physical ELM tests where applicable.
H. Before **full PR staging deploy**: reconcile integration PR dependencies, complete tester authorization enforcement on endpoints, run required release/provenance gates and obtain exact-head deployment evidence. Never equate file presence with deployed state. No production deploy.

## Audit registry snapshot (2026-10-15)
- Existing JS diagnostic hub / Classic Native Bridge commands / history/offline sync: IMPLEMENTED in repository, physical adapter/installed APK NOT RUN.
- Exact vehicle deep-link `data-vehicle-diagnostics` in vehicle page: IMPLEMENTED in branch; staging implementation must be checked independently.
- Home no-garage launch: UI path exists via `#/diagnostics` but unbound selection correctness needs explicit test/fix.
- BLE / Wi-Fi / extended ECUs: DESIRED, NOT VERIFIED.
- Automatic DTC decoding into user advice, community draft, fitment-based parts and authorized bookings: DESIRED, not assumed.
- PR #133 is DRAFT and historically indicated DO NOT DEPLOY; staged experimental authorization currently guard primitive only according to PR description. Full-tree deployment NOT APPROVED by verification without updated evidence.
- Staging endpoint `https://s.kareta.kz`: LIVE at 2026-10-15 audit, response header `X-Kareta-Asset-Version:188.5.5.6.84.178.4`; does not establish deployed Git SHA.

## Acceptance / Definition of Done
Both launch paths, vehicle intent/no default, native capability accuracy, authorized roles, no faked telemetry, precise DTCs, privacy-aware community drafts, fitment checks, safe clearing, three languages, one Back, successful offline sync, required negative-case security tests, successful exact-head CI, Android smoke, staging provenance. Status must be one of DESIRED / IMPLEMENTED / VERIFIED / DEPLOYED, never collapsed.

## Next three actions
1. Implement and test no-car vs vehicle-scoped entry on canonical `js/next/pages/diagnostics.js` with explicit optional save.
2. Audit and implement opt-in community question draft and three-role authorization through existing contracts.
3. Prove Android Classic, investigate BLE/Wi-Fi native support, run exact-head gates and deploy only eligible staging candidate.


## Increment log — 2026-10-15 / DTC safety and ecosystem entry points
**Current scope:** the existing diagnostics SPA page, not a new ELM transport or a full PR deploy.

- Added a dedicated `Сбросить ошибки` action, gated on initialized diagnostic readiness and explicit confirmation. Attempts `elmSnapshot` before OBD service 04, queues evidence for a selected authorized garage vehicle when native offline storage supports it. If evidence is not persisted, requires an additional warning/confirmation. Never claims successful DTC erasure simply from a dispatched command; requires another DTC/readiness scan.
- Manual `04` command now goes through the exact same consent path. Direct `04...` variants and selected mutation/security/actuation diagnostic services are rejected in the basic console (front-end UX guard only; not a Native Bridge/API security boundary).
- Serializes DTC clear requests and blocks sending service 04 after page lifecycle disposal.
- Validates/deduplicates actual DTC codes before displaying help/question actions; renders repair links to existing `#/parts`, `#/masters` and `#/masters?type=sto` only when verified-format codes were supplied by the scan. No unverified part fitment, diagnosis or booking is inferred.
- New test `tools/test_diagnostics_safe_clear_20261015.js` covers cancellation, no-car warning, queued evidence, manual-command bypass, two simultaneous attempts, unmount during a pending snapshot, and DTC link display.
- **Test evidence for implementation candidate**: JavaScript syntax PASS; `test_diagnostics_entry_intent_20261015.js` PASS; `test_diagnostics_question_handoff_20261015.js` PASS; `test_diagnostics_safe_clear_20261015.js` PASS; `test_spa_android_bridge_contract.js` PASS; `test_route_binding_contract.js` PASS (72/72); `test_feature_preservation.py` PASS (72 routes, 19 files, three baseline language catalogs). These do not validate new RU/KK/EN strings, actual hardware, role E2E, Android or full release.
- **Scoped origin staging install**: `js/next/pages/diagnostics.js` Git blob `e8c61975e74dd598f1a0a8692d21438791d3cfe5` installed on staging with rollback backup `/home/karetakz/diag-staging-backups/diagnostics-pre-7cf9f5d.js`. Fresh HTTP query-key fetch returns matching file. Existing CDN release-scoped `?v=188.5.5.6.84.178.4` **still returns a stale older blob** `50cbbc212f44ae2871b3ad0e0c40086d3a6a6f22`; user-visible release approval is BLOCKED until authorized cache invalidation/version handling and browser verification. No assertion of full PR #133 staging release.
- **Remaining work**: RU/KK/EN translations for new controls and inherited diagnostic surface; actual full-screen visual canon, role/ownership integration, native BLE/Wi-Fi support, real ECU DTC decoding and part fitment, Cloudflare cache invalidation, current exact-head full CI, physical ELM and Android tests, protected staging tester endpoints.
