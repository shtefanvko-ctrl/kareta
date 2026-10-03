# KARETA 188.5.5.6.84.158

## Scope

Protected UI authorization boundary recovery after live 84.156 logs exposed frontend calls to protected APIs from anonymous/stale session state.

## Live evidence

Observed:

- GET `api/db.php?action=masterSocial.following` -> HTTP 403 while Community requested subscription state;
- GET `api/domain.php?action=notifications.list` -> HTTP 401 while Notifications mounted.

The server protections were correct. The defect was frontend/navigation state allowing protected surfaces or helper calls without an authoritative session.

## Fixes

### Following / Community

- `following` is no longer a public navigation item;
- anonymous direct navigation cannot authorize the `following` route through the legacy fallback;
- Community does not call `masterSocial.following` without an Identity session or explicit legacy fallback session;
- the `Подписки` tab is hidden for anonymous visitors;
- a direct `#/community/subscriptions` guest link degrades to the recommended feed without making the protected API call.

### Notifications

- navigation now requires capability `notifications.read`;
- direct/legacy anonymous routing to Notifications is blocked;
- Notifications checks authoritative Identity authentication before the first API call;
- anonymous state renders a sign-in-required surface instead of sending `notifications.list`;
- if the session expires after mount and `notifications.list` returns 401, polling stops immediately and the page switches to a session-expired surface.

## Server security

No authorization was weakened:

- `notifications.list/read/readAll` still require `notifications.read`;
- `masterSocial.following` remains role/session protected.

## Verification

`tools/test_auth_ui_boundaries_84_158.js` enforces:

- Notifications capability-gated navigation;
- Following is not public;
- direct session-only route guards;
- anonymous Community following suppression;
- anonymous subscription tab/deep-link handling;
- Notifications pre-request auth guard;
- Notifications polling stop after 401;
- server-side protections remain intact;
- generated Identity boot bundle matches the protected-route source contract.

The test runs in both `verify` and `Application gates`.

## Boundaries

- no DB migration;
- canonical DB remains 137;
- no Android changes;
- 84.155 DB auto-upgrade preserved;
- 84.156 Plesk runtime-pressure recovery preserved;
- 84.157 canonical UI recovery preserved.
