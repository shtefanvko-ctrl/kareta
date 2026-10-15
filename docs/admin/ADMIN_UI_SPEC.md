# KARETA ADMIN — UI specification and incremental implementation plan

**Canonical source:** user image with 24 numbered screens/modals. Use it for information architecture and visual rhythm, not for fabricated application data.

## Non-negotiable visual rules

- Keep the real binary KARETA logo. Full brand header only on app home; interior admin pages use existing `KaretaPageUI.pageShell` compact header and the single shared SPA/Android Back.
- Preserve the existing three themes, glass v2 surfaces, light blue/white cards, `--k-accent` CTA, tokens from `css/next/design_contract.css`. Do not replace navigation, logo, icons, router or identity.
- Desktop >=1200: *within* the admin page content, a compact vertical sidebar for real registered administrative destinations; one responsive content area for the selected page; do not add a competing outer page header.
- Small viewports: convert contextual sidebar into horizontally-scrollable link chips/cards; preserve native/global bottom navigation and safe-area clearance. Do not add a second bottom navigation.
- Required widths: 320 / 360 / 390 / 430 / 768 / 1024 / 1440 / 1890 CSS px. Touch targets >=44px; focus and aria-current.
- Administrative links must resolve to a real registered route and pass the existing route access checks; planned screens are **not** dead navigation links.
- RU/KK/EN for **every new** visible string via the existing i18n system; no hard-coded country assumptions in data contracts. Existing untranslated admin strings are inherited debt, not grounds to create an independent language store.
- Lists: verified counts, bounded paging/search/filter; loading / empty / error / retry; missing chart data = unavailable, never fake 0 and never fictitious increase percentages.

## Layout / screen structure

**Existing first increment:** sidebar with six existing admin-context links (monitoring, users, organizations, management, platform, core); preserve their hashes. This is a layout change, not a claim that the 24-screen panel is finished.

**Next approved navigation map (not yet linkable):** dashboard; users; orders; masters; STO; shops; product/service moderation; content; communities; messages; finance; analytics; notifications; settings, including roles, cities, integrations, logs and backup metadata. Before exposing each link: register existing-compatible hash/lazy route, pass server-capability denial tests, implement API or honest unsupported state. Keep identity migration and existing operations reachable.

**User Identity:** account, person, profiles, contexts/memberships, sessions, trusted documents and activity separated by actual identity IDs. Reason required for sensitive mutation. Confirm, wait for server, then success/error; do not perform optimistic privilege changes.

**Orders:** view domain workflow; never turn admin action into bypass of customer/master/STO confirmation or double-booking guards.

**Geo:** reuse shared city IDs and geo map. Show only authorized public business locations and explicitly consented operational locations.

**Content and notifications:** stage changes, preview localized content, enforce target audience and authorization, never auto-publish/send from visual preview.

**Finance:** label GMV, revenue, platform commission, payable balance, payout and refund separately; present real source and accounting period. Export restricted to capability-bound operation.

## Modal contract

1. Form modal (user, service, invite, review, city, permissions, notification): title, context/target, validated real fields, Cancel, Submit.
2. Confirmation: full action/target/impact/reason; step-up when required.
3. Success: only on confirmed HTTP 2xx structured success.
4. Failure: recognizable message and safe request ID; no SQL/trace; retry only if idempotent.
5. Close/ESC/Back, focus trap/restore, accessibility and mobile keyboard.
6. No DEMO data in actual application or staging.

## Delivery increments

- E0 audited matrix: `docs/admin/ADMIN_AUDIT.md`.
- E1 admin shell/sidebar: existing admin JS/CSS only; **no new route, backend mutation, migration or deploy**.
- E2 authoritative admin landing metrics, backed by optimized scoped queries.
- E3 users / master / STO / store inventory and permission-safe actions.
- E4 orders / geo / catalog read-only, then bounded operations.
- E5 moderation / content / notifications.
- E6 finance / analytics; E7 settings / permissions / operations; E8 visual/accessibility/role/E2E/release gates.

At every increment, record exact HEAD, diff, syntax/focused tests, negative auth tests when needed, browser / staging / Android status and rollback. Do not touch server verification infrastructure without separate user authorization.
