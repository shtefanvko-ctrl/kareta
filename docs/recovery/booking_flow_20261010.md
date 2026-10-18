# KARETA.KZ Booking Flow Recovery (2026-10-10)

Isolated implementation based on main 673826b9c4559b5f1dda22d1e79a6a7a19b302e0.
Branch: fix/booking-unified-client-flow-20261010.
PR #123 and #124 have not been modified.

## Confirmed causes
- requestNew page/modal used legacy request module instead of final client module.
- Route manifest omitted final client script/CSS.
- Existing draft took precedence over freshly selected master/service/time.
- Master booking auto-selected the first service.
- booking.slots could return invented times for unknown master, missing service ownership checks.
- orders.create had no serializing overlap guard for direct master appointments.

## Changes
- Client page and modal now share the final 3-step renderer; master/STO retain legacy role flows.
- Asynchronous modal mount cleanup fixed.
- Per-attempt booking context carries provider ID, offer/service, local date and exact slot.
- Explicit service selection and fresh availability recheck added.
- Demo providers cannot accept real booking and are never substituted.
- Booking API verifies master and offer and computes free slots, and orders.create serializes bookings with row lock and overlap check.
- Regenerated boot bundle and added regression contract to CI.

## Evidence
PASS: test_client_request_three_steps_84_23.js
PASS: test_booking_flow_recovery_20261010.js (mocked order API payload)
PASS: build_boot_js_bundles.js --check
PASS: test_route_binding_contract.js
PASS: PHP and JavaScript syntax and git diff --check

FAIL (independently investigate): test_runtime_hard_dependency_graph_84_24.js reports missing route-lazy consumers.

NOT RUN: authenticated real DB order, competing-client MySQL test, Android WebView physical/visual QA.
No production or staging deployment or DB writes occurred.

## Next steps
1. Run real booking and concurrent slots against an isolated MySQL test instance.
2. Verify exact-head CI and resolve any required gates before merging.
3. Run browser/Android/i18n QA before separately authorized local staging rollout.
