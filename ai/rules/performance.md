# KARETA performance governance v1.0

Load for payload growth, page startup, CDN, Service Worker, catalog/geo scale, Android WebView or performance refactoring.

- Collect a baseline before approving hard byte/time budgets: target mobile device, role, route, viewport, network, cold/warm cache, exact SHA and representative measurement count.
- Use p75 Core Web Vitals as experience targets (LCP <= 2.5 s; INP <= 200 ms; CLS <= 0.1). They are goals, **not** evidence KARETA meets them.
- Keep route JS/CSS and route data lazy. Avoid preloading shop inventories or unneeded datasets on the first screen; use bounded server queries and paginated JSON.
- Verify cold and warm SPA paths independently. For WebView, verify both first launch and warmed navigation. Track duplicated event handlers and layout shifts.
- Check cache key, stale CDN asset, asset MIME and SW version behavior before calling a UI correction deployed. Prefer visible errors over stale-success fallbacks.
- Optimizations must preserve current permissions, business semantics, stock freshness, idempotency and user choice.
- Measure before/after and a representative unaffected route for the exact candidate. Browser/Android/runtime evidence marked NOT RUN cannot be promoted to PASS.
