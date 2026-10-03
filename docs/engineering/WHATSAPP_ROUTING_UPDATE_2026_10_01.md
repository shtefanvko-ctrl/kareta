# WhatsApp routing update — 2026-10-01

Status: implemented; local behavior verified. Exact-head CI and deployment
evidence must be recorded separately.

## Base and scope

Canonical code: `shtefanvko-ctrl/kareta`, stacked on `release/reconcile-84.152`
at `c20beb7fd2814e06b108451aa3e15bf414448123` (PR #22). The base was refreshed
from `6b78de9` after the release lane advanced during implementation. Merge PR #22 before
this increment. The existing release number, Native API 6, migrations 1–135,
SPA assets and Telegram contracts stay under their existing release lane.

This increment applies to the existing WhatsApp text transport. The repository
has no Instagram publishing/messaging adapter, so the Instagram changes from
the monitoring report are not implemented by this increment.

## Source contract (checked 2026-10-01)

- [Standby payloads](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/standby/):
  `value.standby.messages` is inbound; `message_echoes` and `statuses` describe
  other responders' outbound traffic. Never create a customer message from an echo/receipt.
- [Thread control](https://developers.facebook.com/documentation/business-messaging/whatsapp/conversation-routing/thread-control/):
  subscribe to `messaging_handovers`; `control_passed` reaches the new owner,
  `control_taken` reaches the previous owner. Track ownership locally from these
  events and inbound/standby delivery; ownership becomes idle after 24 hours of
  customer inactivity.
- [Standby permissions](https://developers.facebook.com/documentation/business-messaging/whatsapp/conversation-routing/standby-partners/):
  subscription, business-granted visibility and accepted terms are required.
  This code does not grant permission or change subscriptions, roles or accounts.

## Planned invariants and regression inputs

1. Check the configured business phone ID before processing any event. Another
   phone's signed payload has no state, chat, token or send effect.
2. Persist routing state per business phone and customer. A newer standby/taken
   event blocks all sends; older/duplicate grants cannot restore ownership.
   For equal timestamps, non-ownership wins conservatively (KARETA policy).
3. Standby text for a linked customer uses existing chat authorization and reply
   routing and is stored once. Standby never consumes a link token or sends an
   automatic response. An explicit WhatsApp reply must match an authorized KARETA
   delivery; an unknown/forbidden reply cannot fall back to another recent chat.
   Unlinked/unresolved messages create no guessed chat.
4. Echoes/receipts can revoke local ownership but cannot extend the customer
   service window or become customer messages. Unknown/malformed events are ignored.
5. All text sends require known ownership and an actual customer message within
   the existing 24-hour window, measured by provider timestamp. A handover alone
   does not open a window. Standby inbound activity is recorded but cannot grant
   sending rights. Blocked deliveries stay in the existing queue.
6. Database failures return a retryable webhook response. Inbound deduplication
   and database effects commit together; retry after failure stores one message
   and increments unread once. No provider network call runs inside that transaction.

## Upgrade and recovery plan

Add one table through the existing explicit `tools/messaging_schema_install.php`
installer, not the canonical migration sequence. The WhatsApp guard fails closed
if that table is missing; Telegram uses the existing six-table guard. Do not create
the routing table from a webhook/worker request.

The canonical message dedup column/index already belong to migrations 28/54.
The transactional WhatsApp receiver relies on them and skips the legacy runtime
DDL repair; it returns a retryable failure if the canonical schema is incomplete.

Before a deployment, back up the target DB, apply the installer to a disposable
DB and then the intended staging DB, and verify the exact candidate. Roll back
code/worker together to the previous candidate; leave the additive routing table
in place. Do not drop it during recovery. No production DB or account change is
authorized by this implementation increment.

## Required evidence

- PHP syntax and executable parser/state/security negative tests.
- Disposable MySQL/MariaDB behavior: installer idempotency, missing schema,
  deduplication, rollback/retry, account boundaries and queue/send guards.
- Existing Messaging/Telegram and 84.152 release/migration regressions.
- Exact-head CI; staging DB/API readiness and deployment provenance remain
  separate gates, never inferred from local tests or an open PR.
