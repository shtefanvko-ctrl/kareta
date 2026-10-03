# KARETA 188.5.5.6.84.156

## Scope
Plesk runtime pressure recovery after live 84.154 browser testing.

## Evidence
Observed live symptoms on m.kareta.kz:
- transient mixed-release boot during overwrite deployment (84.154 shell vs 84.153 runtime probe);
- HTTP 429 on replay-safe DB reads including messages.get;
- realtime EventSource/poll connection resets/timeouts;
- runtime_log timeouts during the same degradation window;
- unrelated catalog requests timing out after the realtime/chat failures;
- route CSS timeout as a secondary symptom.

The mixed-release window is deployment-related and is currently resolved. The runtime-pressure symptoms require transport hardening.

## Changes
- Realtime default transport is now poll.
- SSE remains opt-in for dedicated infrastructure via realtime_transport='sse'.
- Server rejects stream requests when SSE is disabled, so old clients fall back instead of occupying PHP-FPM workers.
- Poll interval defaults to 15 seconds.
- DB safe-read pacing increases from 300 ms to 650 ms.
- Default 429 backoff increases from 900 ms to 1500 ms, max from 3000 ms to 8000 ms.
- Runtime logger enters a host-pressure cooldown on 429/502/503/504 and network errors.
- Runtime diagnostics expose realtimeTransport.

## Safety
- No DB schema change; canonical DB stays 137.
- No Android change.
- No data reset/reseed.
- Existing 84.155 safe DB auto-upgrade behavior is preserved.

## Acceptance
- PHP 8.1 lint PASS.
- verify PASS including Plesk pressure regression.
- Application gates PASS.
- Server package PASS.
- Harness final verdict PASS.
- After Plesk upload: provenance/runtime/identity PASS and browser smoke without sustained 429/reset/timeout cascade.
