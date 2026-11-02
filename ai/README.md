# KARETA AI — user gateway / identity / bounded inference

Status: **staging-only, disabled by default**. This branch must not be released to production until protected QA signoff.

## Architecture

* Public entry point: `https://kareta.kz/ai/`, the existing public KARETA domain (not the administrator-only `chat.kareta.kz`).
* Login: existing KARETA `/api/identity_session.php` WhatsApp challenge flow. This change does not change OTP providers or SMS/WhatsApp credentials.
* Session: existing server-side `KaretaSessionService` HttpOnly cookie, verified on **every** AI API request. Neither an arbitrary user ID nor a model endpoint is accepted from the mobile client.
* Storage: migration 146 creates `ai_user_conversations` and `ai_user_messages`, each linked to a KARETA account. A compound DB foreign key prevents messages from being attached to a conversation belonging to another account.
* Inference: server-only Ollama loopback, one concurrent request across users, <=10 user requests/account/hour, <=1500 characters/request, bounded history/context/output and timeout; no externally configured model provider is invoked. Fail closed when overloaded.
* Android 8+: WebView to the public /ai/ portal, package `kz.kareta.adminassistant`.
* Android 4.4+: native login and message UI; TLS 1.2 with OS trust validation, in-RAM session cookies, API on the public domain; package `kz.kareta.ailite`.

## Release controls (mandatory)

1. **Default DENY:** `KARETA_AI_USER_GATEWAY_ENABLED` must equal `1` in the trusted PHP-FPM environment. Otherwise the authenticated API responds 503. Do not enable on production before full E2E.
2. `KARETA_AI_USER_MODEL` defaults to `qwen3.5:2b-q4_K_M`. Confirm this model is responsive under actual CPU/memory constraints, or set an approved local-only smaller model.
3. Existing Cloudflare Access on `chat.kareta.kz` remains unchanged. The new public portal uses the main site, and must enforce its own KARETA identity authentication.
4. WhatsApp OTP on the examined staging configuration was disabled. An additional production Hermes adapter now exists but is **OFF by default**; enable only via private `KARETA_OTP_HERMES_PROD_ENABLED=1` after a tightly scoped canary (the bridge is bound to `127.0.0.1:3002`, no provider key in APK). Six-digit codes remain random and hashed at rest. Production without this opt-in and without a configured HTTPS webhook remains fail-closed. Existing connected Hermes bridges **do not** prove live code delivery. Verify provider setup and a canary code using owner-approved accounts before release; do not hardcode 0000 or bypass confirmation.
5. Android 4.4 has limited CA root certificates and TLS compatibility; test real HTTPS handshakes on the device.
6. Independent accounts A/B must both log in and receive answers, and cross-account conversation read/write must return 404. Run browser + Android E2E before merge/release.

## Verified checks

* `php tests/test_ai_account_isolation.php`: 10/10 PASS.
* `php tools/test_release_migration_manifest.php`: manifest 146, PASS.
* `php -l api/ai_chat.php` and migration: PASS.
* `node --check` on extracted portal JS: PASS.
* Isolated MySQL QA migration: valid owner writes succeed; attempted cross-owner message inserts are rejected by DB composite FK (0 rows).
* Both APK packages built and signed (including v1 for API19). The updated Lite 1.0.0.2 has **not** been installed or E2E-tested on the device.
* Pre-existing `tools/test_migration_release_manifest_84_25.js` static check reports 10/16 on both baseline and feature checkout; not a feature-specific regression.

## Blocking issues / rollback

* Live `chat.kareta.kz`: HTTP 403; avoid changing its admin-only Access policy.
* Real WhatsApp OTP, production model response and authenticated two-device E2E: NOT RUN.
* Recent `kareta-hermes:64k` model check timed out (22 seconds) while swap was fully utilised. Do not expose an unconstrained model directly.
* Rollback: set `KARETA_AI_USER_GATEWAY_ENABLED=0`, remove public /ai/ route and AI PHP handler from the release (without dropping user tables). Retain Cloudflare admin Access policies.
