# KARETA: direction-ready homepage content — first isolated increment
2026-11-04. QA/draft only; **production remains unchanged**.

Stacked on PR #144 at 5b8a5a67e0d5f9aa354d00413013041cd727ae6f. There is no parallel service catalog implementation.

## Implementation
Replaced source-hardcoded fake automotive promotions (discounts, names, availability, prices) with a neutral existing-component auto banner. Preserved current card/navigation routes, roles, city/geo and community/home DOM hooks. Existing static popular price labels now say `Уточнить стоимость` until real service offers are linked.

Changed: `js/next/pages/core.js`, generated `js/boot/runtime_core_bundle.js`. Focused Node test: `node tools/test_home_trusted_content_20261104.js`.

## Not delivered by this increment
No multi-direction backend, new category mappings, booking model, database migration, admin UI or enabled `Дом` yet. The next increment must inspect isolated MySQL schema, implement server-authoritative direction mappings and feature flags, then switch `Авто / Дом` end-to-end with role, migration, WebView and visual regression evidence.

Release remains DENY. No staging/production changes. Revert this commit to roll back; no user data modified.
