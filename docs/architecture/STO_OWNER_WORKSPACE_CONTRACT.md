# STO owner workspace — organization-scoped functional contract

Status: **PARTIAL IMPLEMENTATION / NOT DEPLOYED**. Owner approval: 2026-10-29.
Main site: `kareta.kz`. No duplicate accounts, no separate database.
Design source: four screenshots from STO owner's desktop session on `#/services`, `#/masters`, `#/parts`, `#/orders`.

## Existing verified code contracts
- `js/next/pages/service_management.js`: role-aware service offers editor; catalogue picker, price, availability and booking controls.
- `js/next/pages/masters.js` and `api/sto_workplace.php`: team view backed by active `sto_master_links`.
- `api/order_scope.php`: server-side STO scope and ownership checks.
- `js/next/pages/parts.js`: marketplace + individual used-listing management. **This is not an organization warehouse.**
- `js/next/pages/chats.js`: participant chat UI. **An owner's permission to read a master's chats is not established by these files.**

## Five surfaces, one authoritative STO identity
All pages derive the active **organization context** from authenticated Identity; never from a query `sto_id`, URL, role override, or local storage. A user may manage multiple organizations; switching context must invalidate cached offers, chats, stock, and orders.

### Services
Default owner view: **Мои услуги** (`#/services/manage`), showing only the selected STO's offers.
Actions: add from global service catalogue, set own price, duration, warranty, booking availability, pause and resume; changes persist as server-scoped `service_offers`. The global catalogue is separate and remains browsable by explicit navigation. A new STI service is not silently published before the owner saves it.

### Masters
Default tab: **Мои мастера**, alongside **Все мастера** in filters.
"My masters" lists only active links to the selected STO; show photo/name, specialization, shift/availability, workload, assigned orders and actions to invite/activate/remove with confirmation. Pending invitations are separate from active staff. "All masters" remains the public catalogue. Removing a link must not erase history or other STO's relationships. Server checks must prevent cross-organization changes.

### Parts
Default owner tab: **Мои запчасти**. This means STO inventory, **not** the owner's personal marketplace listings.
Introduce a real organization-scoped inventory model only after checking existing order/parts schema: SKU, OEM, brand, photo, buy/sell price, physical quantity, reserved quantity, available quantity, warehouse position, linked purchase and job. Inventory movements require traceable actor, timestamp, reason and order reference. Support reserve/release/consume against STO orders with transactions and nonnegative availability. Keep **Каталог магазинов** as a separate discovery tab; never fake stock or ownership from `mineRows` in the consumer marketplace.

### Requests/orders
Show **Активные СТО**, **Биржа заявок**, **Отклики**, **Завершённые**. "Active" includes only the selected STO's accepted/assigned work; exchange contains eligible **unassigned** customer requests (not another STO's private orders), bounded/paginated and filtered by offered services, location and status. An accepted response moves into organization work order only through existing transactional lifecycle with idempotency and capacity checks. Do not make `masterExchange` accessible to STO merely by changing client navigation without server authorization.

### Chats and supervision
Separate **Клиенты СТО**, **Мастера СТО**, **Переписки по заказам**. Owner may access legitimate **work-order conversations of the selected STO** (including master-client conversation for jobs performed on STO's behalf), subject to explicit organization membership, privacy notice and an audited `sto.chat.read` capability. No personal chats or unrelated masters'/clients' conversations. Server must authorize **each chat and each message/attachment read** using organization and order linkage; do not infer permission merely from `master_id`, `chat_id` or client-supplied metadata. Log who opened which work dialogue and when. Show attribution and read-only supervisor mode; never impersonate a master or silently change their unread state. Master and customer should be informed that work correspondence may be visible to the owner when it is conducted on behalf of the STO.

## Backend safeguards and DoD
1. Every read/write is resolved from the selected authenticated context. 403 on foreign STO's services, staff links, stock, orders, conversations **and attachments**. Test two distinct STOs and a personal chat.
2. Existing MySQL records retained. Backward-compatible/idempotent migrations only, with backup and restore plan.
3. Services: adding, editing, pausing visible in organization's public offer; independently scoped per STO.
4. Masters: active, pending, rejected, removed; switching context cannot reuse stale cached team.
5. Stock: positive/released/consumed reservation scenarios, concurrent bookings, nonnegative invariants and audit.
6. Requests: eligible marketplace matches, quotes, acceptance, rejection and status transitions without duplicate orders.
7. Chats: current organization work-order full history readable to supervisor, unrelated/personal dialog forbidden, attachments separately authorized; audits and notices.
8. End-to-end desktop/mobile screenshots for STO owner, master and client, no demo placeholders; other roles unaffected.
9. Required gates: JS syntax, PHP syntax, unit tests, API negative cases, staged role E2E, release fingerprint. All are **NOT RUN** unless an exact commit has corresponding evidence.
10. No production deploy or enabled feature flags until PASS on staging, user-visible review and rollback procedure.

## Current change in this branch
Only navigation improvements for Services and Masters. Parts, marketplace and supervisor access remain intentionally **NOT IMPLEMENTED**, never represented as working by decorative buttons.
