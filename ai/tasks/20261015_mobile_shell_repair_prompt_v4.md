# KARETA.KZ — MOBILE SHELL REPAIR / EXECUTION PROMPT v4 (2026-10-15)

## Goal
Repair the screenshot-confirmed broken logo, header and duplicate navigation on Android mobile without changing API/database or replacing existing features.

## Canon / invariants
- Main page only: original KARETA full brand logo centred and a functional city picker at the right.
- Inner page: the EXISTING single Back button and a page-specific title. No full logo or shared hamburger.
- Phone navigation: client and guest both have Home / Services / Community (Works) / Masters / Parts / More. More retains its existing route/role authorization.
- Chat and order shortcuts must remain available via existing navigation; remove only overlapping floating duplicates on <=599px.
- Preserve role-specific master/STO/seller/admin navigation, RU/KK/EN, route registry, Android bridge, diagnostics ELM327, QR, garage, booking, notifications.
- Preserve authenticated versus guest capability gates. No hardcoded identity or new bypass.
- Do not touch server checks, production, staging deployment, native app, DB or migrations in this increment.

## Execution order
1. Inspect actual PR #133 HEAD and AGENTS.md; inventory header/index/navigation/CSS bundle owner.
2. Add versioned logo failure handling: original image -> versioned icon -> readable brand text (never broken-image glyph).
3. Eliminate hamburger/extra actions on <=599px home where bottom More already provides it; centre brand and anchor city icon inside 68px header.
4. Hide two fixed FAB shortcuts on phone only, keeping their routes and tablets unchanged.
5. Restore public guest six-item menu including Services, without elevating its capabilities.
6. Keep source JS and generated boot JS synchronized, and source CSS with critical boot CSS.
7. Run Node static/behavioral contract checks, syntax checks, shared bundle freshness, preservation test, inspect exact Git diff. Confirm UI/Android screenshot tests separately; do not claim them passed.
8. Commit ONLY to existing canonical integration branch when fast-forward is safe. Do not merge PR #133 or deploy.

## Definition of Done
- Phone main header full logo displays if asset is available, image failure has graceful fallbacks, city opens its existing picker.
- Header actions and hamburger cannot float into content; internal page title + one Back.
- Bottom nav six authorized items on client/guest; no double floating chat/order buttons on phone.
- No removed routes, roles, functions, or API. Focused tests pass on exact SHA. Browser and Android visual verification remain NOT RUN until exercised.
- Document HEAD SHA/rollback and exact checked/unchecked gates.
