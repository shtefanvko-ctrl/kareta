# KARETA.KZ — WhatsApp standby / ownership — 2026-10-01

State: **IMPLEMENTED; local checks PASS; CI and staging recorded separately**.
Base: `release/reconcile-84.152` at `c20beb7fd2814e06b108451aa3e15bf414448123`
(PR #22). Candidate branch: `fix/whatsapp-standby-ownership-20261001`.
This backend increment keeps asset release `188.5.5.6.84.152` and canonical DB
migrations `1..135`; it is not a deployed release claim.

## Changed behavior

- WhatsApp now decodes the official nested standby payload and
  `messaging_handovers`. The configured business phone ID bounds every event.
- Ownership is persisted per business phone/customer. Standby or `control_taken`
  blocks all text sends; a newer `control_passed` restores eligible queued sends.
  Older grants cannot override a revoke; conflicting equal timestamps stay blocked.
- Linked, authorized standby text is stored once. Echoes/receipts never become
  customer messages. Standby link commands consume no token and send no response.
- An explicit WhatsApp reply must match an authorized KARETA outbound delivery.
  An unknown/forbidden reply no longer falls back to another recent chat.
- The send guard uses actual provider customer timestamps for the existing
  24-hour window. Neither an outgoing echo nor a handover creates a new window.
- Inbox deduplication, message insert, unread changes and link-token/link updates
  commit together. Transient failures roll back and cause HTTP 503 for redelivery.
  Ownership is committed first so an inbox failure cannot leave sending enabled
  after a revoke. All send/network calls run after the inbox commit.
- Added `messaging_whatsapp_threads` through the existing explicit Messaging
  installer. Missing routing storage blocks WhatsApp sending. Runtime auto-schema
  cannot create this table; Telegram retains its existing six-table requirement.
- The Messaging UI regression reads the actual PHP asset plan and checks lazy
  loading, globals and Messaging-before-Cabinet order. It accepts the release
  lane's JSON loader between those scripts instead of assuming literal adjacency.

## Verification actually executed

| Check | Target | Result |
| --- | --- | --- |
| Parser/state/negative paths + DB/send integration | PHP 8.3.6, disposable MariaDB 10.11.14, local fake provider | PASS: 50 checks |
| Repository PHP syntax | Refreshed candidate, PHP 8.3.6 | PASS: 438 files |
| Messaging 84.86 / Telegram 84.87 | Candidate | PASS |
| Migration chain/manifest/collision bridges | Candidate | PASS: canonical 135 |
| Current release / 84.152 / Native API 6 | Candidate | PASS |
| Current API contract | Local PHP HTTP server | PASS: 8/8 |
| Authorization/recovery, lazy route/catalog, PWA, browser support, asset hygiene, provenance unit checks | Refreshed candidate | PASS |
| Boot bundle freshness / cabinet account isolation | Refreshed candidate | PASS |
| PHP 8.1/8.2 + MySQL 8 CI | Initial `5fabbb424b84033dd349caf94344e7a010147f1f`; PHP unchanged by the compatibility-test correction | PASS: 50 checks each; latest exact-head result remains in GitHub checks |
| Target readiness, identity health, staging and deployment provenance | Intended staging target | NOT RUN |

The historical `tools/release_gate.php` failed on both the initial `6b78de9`
baseline and its WhatsApp delta (31/58 passed, same failing checks). Its frozen
UI/hash assertions are not the current application gate. The refreshed base
provides G0/G0.5 through `php-syntax.yml` / `application-gates.yml`; their CI
results must be checked separately. This increment does not rewrite those
historical assertions. No browser/end-to-end or provider-account test is claimed.

## Upgrade order and rollback

1. Resolve/merge PR #22, then this stacked increment, after the required gates.
2. Back up the intended DB; test and run `php tools/messaging_schema_install.php`
   on the approved staging target before starting the new webhook/worker code.
   The installer is explicit and idempotent. Existing canonical messages schema
   (dedup column/index from migrations 28/54) is required.
3. Separately verify `messages`, `standby`, `messaging_handovers` subscriptions
   and business-granted visibility/terms. This work did not change Meta accounts.
4. Verify exact-SHA readiness, identity health and staging/provenance. Older linked
   recipients without observed routing state remain queued until a valid event
   establishes ownership; there is no permissive backfill from old link timestamps.

Recovery: restore prior webhook/core/worker code together; keep the additive
routing table. Do not drop data or undo canonical migrations. No production
database, deployment, subscriptions or provider accounts were changed.

## Scope limits

The adapter still supports text and phone/wa_id identity. Unsupported media and
BSUID-only events are not converted into text or guessed phone identities.
Instagram has no publishing/messaging adapter in this repository, so the monitored
Instagram changes remain future adapter requirements. Promotion Hub publication
behavior, Telegram APIs and OLX.kz contracts are not changed by this increment.

Official contract links and regression scenarios:
`docs/engineering/WHATSAPP_ROUTING_UPDATE_2026_10_01.md`.
