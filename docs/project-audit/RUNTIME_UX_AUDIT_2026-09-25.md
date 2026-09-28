# KARETA.KZ — Runtime UX audit 2026-09-25

Release: `188.5.5.6.84.118`  
Environment: `http://localhost/` only.

## Scope
Audit and correction of Master chats, cabinet/profile SPA loading, Master navigation, redundant workspace page headers, message notifications, and the flow where a Master records a client to themself.

## Confirmed defects and corrections

1. **Master chats could be empty/broken under Identity sessions.**
   - Root cause: chat role came from Identity context, while legacy `users.id` was still taken only from the legacy session. Under a normal Identity session this could resolve to `0`.
   - Fix: `api/db.php::kareta_chat_actor()` now resolves one effective actor from Identity + legacy compatibility data and, if necessary, maps account phone back to the legacy `users.id`.
   - The same actor is used for chat access, message author, unread counters, read markers and recipients.

2. **“Мой профиль → Посмотреть как клиент” required F5.**
   - Root cause: `js/next/pages/details.js::mountProvider()` declared local `const location`, shadowing global `window.location`. Earlier access to `location.hash` hit the lexical TDZ and threw `ReferenceError: Cannot access 'location' before initialization`.
   - Fix: local value renamed to `providerLocation`.
   - Result: public Master profile mounts on the first SPA transition without page reload.

3. **Master owner profile and cabinet had first-load API defects.**
   - `master_profile_owner.js` now reads the actual API payload wrapper.
   - `cabinet.js` now calls `api/db.php?action=masterWorkplace.get` rather than passing the action name as a URL.

4. **Master navigation lost items.**
   - Active Identity migrations stop at 129; stale recovery migrations 130–133 are not relied upon.
   - `serviceManagement` now has a Master-profile-only fallback based on an existing work capability.
   - `cabinet` now has a Master-profile-only fallback based on existing profile rights.
   - Mobile navigation logic was corrected so `Ещё` is always the last item and fallback items can never be appended after it.
   - Verified bottom nav: `Главная / Биржа / Услуги / Запчасти / Аккаунт / Ещё`.
   - Verified “Ещё”: `Рабочее место / Календарь / Чаты / Мои заказы / Подписки / Настройки`.

5. **Redundant website-style page titles inside the app.**
   - `pageShell` now supports `chromeHeader:false`.
   - Generic `k-workspace-head` is removed from working surfaces that already have their own application toolbar/header: Chats, Orders, Request, Services, Service Management, Workflow and Work Order.
   - Admin/Platform keep their shell heading where it is still the primary page context.

6. **Master recording a client was forced through irrelevant “offer / where” steps.**
   - Master flow is now 4 real steps: client+vehicle → date/time → work/problem → confirmation.
   - No city, visit format or service address is requested from a Master recording a client to themself.
   - Review explicitly shows `Исполнитель — Вы`.
   - Payload cannot carry a stale external master/location override for this flow.
   - Server invariant still forcibly assigns `master_client_booking` to the current Master context.

7. **Chat notification routing.**
   - Internal `message.new` notifications deep-link to `#/chats?chatId=...`.
   - Inbound Telegram/WhatsApp replies create the same exact internal deep-link.
   - Telegram chat deliveries include an “Открыть чат KARETA” button to the exact conversation.
   - WhatsApp chat deliveries now append the exact KARETA chat URL, subject to WhatsApp's service-window rules.
   - The current messaging core has Telegram and WhatsApp providers. A separate carrier SMS gateway is not implemented/configured, so no SMS provider behavior is claimed.

## Verification

Static/runtime contract:
- `node tools/test_runtime_ux_84_118.js` — PASS.
- PHP syntax: `api/db.php`, `api/messaging_core.php` — PASS.
- JS syntax for changed navigation/request/provider modules — PASS.
- Boot JS bundles rebuilt and `--check` reports all 5 fresh.

Live Chrome SPA fixture:
- 14/14 checks PASS.
- Top-level document loads: **1** for the complete scenario.
- Runtime events/errors: **0**.
- No F5/reload between Master workplace → profile → public profile → exact chat → new client booking.
- Fixture limitation: synthetic Master Identity/profile/chat/order data; API POST mutations are intercepted, so this proves frontend/runtime navigation and contracts without changing real local orders/messages.

Evidence:
- `docs/project-audit/runtime-ux-188.5.5.6.84.118/evidence.json`
- screenshots 01–04 in the same directory.
