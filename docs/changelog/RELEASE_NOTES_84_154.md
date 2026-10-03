# KARETA 188.5.5.6.84.154

## Scope

Plesk staging runtime recovery after exact-head 84.153 CI passed but live hosting exposed authorization, request-burst and provenance defects.

## Verified staging defects

On release `188.5.5.6.84.153` at `m.kareta.kz`:

- database/runtime diagnostics: PASS;
- Identity current session: PASS;
- onboarding, static OTP, client profile, Home, Services, Community, Masters, Parts and Chats: PASS;
- Notifications: FAIL with HTTP 403;
- Orders/client schedule read calls: FAIL intermittently with HTTP 429 under the page burst;
- provenance: FAIL with `workflow_run_id_invalid` for locally assembled server package metadata;
- More/context switcher: partial runtime failure retained for re-verification after the confirmed API defects are removed.

## Root causes and fixes

### Notifications authorization

Migration capability sets grant ordinary client contexts `notifications.read`. The notification API incorrectly required the alias `notifications.manageOwn`, canonicalized to `notifications.manage`.

Fix:

- `notifications.list`
- `notification.read`
- `notification.readAll`

now require `notifications.read`, preserving own-user SQL scoping by `user_id`.

### Plesk HTTP 429 on read-like POST requests

The shared API client already serializes safe reads through the DB replay gate and respects host-level HTTP 429 backoff. The Orders API used read-like POST actions without opting into that gate.

The following read-only calls are now marked `dbSafeReplay:true`:

- `orders.getAll`;
- `clientExchange.dashboard`;
- `clientExchange.schedulePreview`;
- `clientSchedule.reschedule.list`;
- `clientSchedule.arrival.list`.

Mutation actions remain outside automatic replay.

### Provenance

The local server-package builder could persist a non-numeric workflow run identifier. Runtime provenance accepts either an empty workflow run ID or a numeric GitHub Actions run ID.

Fix: invalid/non-numeric local values are normalized to an empty string before package manifests are written.

### Canonical logo

Full-logo references used by the shell/onboarding are aligned to:

`assets/logo/main/kareta_logo_full.png`

so the package no longer depends on the stale onboarding-path duplicate.

## Regression coverage

`tools/test_current_release.js` now asserts:

- notification API capability alignment;
- DB safe-replay coverage for the affected Orders reads;
- local package workflow-run normalization;
- canonical full-logo path.

## Release / cache

Runtime and Service Worker cache namespace advanced to:

`188.5.5.6.84.154`

## Out of scope

- no Android changes;
- no DB schema or migration changes;
- no deployment-target promotion;
- no widening of server rate limits.

## Acceptance gate

84.154 is not accepted until:

1. exact-head GitHub CI passes;
2. exact-head server package is built;
3. Plesk runtime reports DB ready / runtime compatible / valid provenance;
4. browser smoke passes Orders and Notifications;
5. More/context switcher is re-tested to determine whether any independent defect remains.
