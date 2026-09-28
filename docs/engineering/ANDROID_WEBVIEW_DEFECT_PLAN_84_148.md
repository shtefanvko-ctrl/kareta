# KARETA.KZ — Android WebView defect plan, release 84.148

Status: ACTIVE
Target: Android WebView running `s.kareta.kz`
Working branch: `import/kareta-current-84.142`
Merge target: `main`

## Purpose

This plan converts the defects observed during the Android WebView test into owned engineering work. "Owner" below means the responsible subsystem, not a person. DONE requires reproduced evidence after deployment, not only a code change.

## Current branch/release constraint

The web/runtime branch is currently 85 commits ahead and 3 commits behind `main`. The main-only Android Native API delta changes exactly these application files relative to the current web branch:

- `api/obd.php`
- `js/mobile_native_bridge.js`
- `js/next/pages/diagnostics.js`

The reconciliation must preserve the 84.148 WebView/runtime/cache work and the Android Native API 6 semantics from `main`.

## Defect inventory and root cause ownership

| ID | Observed defect | Responsible layer | Why this layer owns it | Priority | State / required work |
|---|---|---|---|---|---|
| WV-01 | Services: `route_style_load_failed:css/routes/services_runtime.css` | route asset manifest + deployment + HTTP fallback | The route exists but the required CSS was unavailable or returned with an unusable response/MIME. A user route must not depend on an unverified static artifact. | P1 | Mitigation in 84.147. Prove on staging with exhaustive lazy-asset verification and Android smoke. |
| WV-02 | Help: `route_script_load_failed:js/next/pages/info.js` | route asset manifest + deployment + HTTP fallback | The information route cannot mount when its lazy JS is missing, stale or returned as HTML. | P1 | Same gate as WV-01; no raw loader error may reach the user after deployment. |
| WV-03 | Community: route CSS load failure | route asset manifest + Service Worker + deploy integrity | Community route CSS is lazy and was dependent on live network/deploy state on first access. | P1 | 84.147 release-scoped static cache plus staging asset walk. |
| WV-04 | Masters: "Каталог временно недоступен" | `masters.catalog` API/data path + client fail-soft cache | Static UI loaded, but catalog data did not. The page must distinguish transport/auth/DB/rate-limit failures and retain previously good data. | P1 | 84.148 caches last usable result; next step is error-code telemetry and staging API diagnosis. |
| WV-05 | Drawer shows raw `Failed to fetch · повторить` | shell/menu data loader + error presentation | A browser exception is leaking into product UI. Navigation must remain usable from local route registry even if an auxiliary request fails. | P1 | Replace raw exception with structured offline/degraded state; drawer navigation cannot depend on optional fetch success. |
| WV-06 | Reopening routes repeatedly reloads content/skeletons | route state + API cache policy | Previously render freshness and network freshness were coupled. Every revisit could blank the surface before the request completed. | P1 | 84.148 stale-while-revalidate implemented for Services, Masters and Community. Must be proven by the second smoke cycle. |
| WV-07 | Bottom navigation can show route tile and "Ещё" as competing active states | shell navigation state | Drawer-open state and current-route state are visually conflated. | P2 | Keep one route active state; represent drawer state with `aria-expanded`/menu affordance, not a second primary active tile. |
| WV-08 | Floating chat/order actions overlap content and bottom navigation | mobile viewport/safe-area/FAB geometry | Fixed controls are positioned independently of the bottom dock and route scroll area. | P2 | One shared bottom inset token; FAB stack must clear dock + safe area and collapse/hide inside drawer/modals. |
| WV-09 | Failure screens expose technical filenames and leave most of viewport empty | route recovery UX | Internal transport diagnostics are presented as primary user copy instead of recovery detail. | P2 | Compact recovery state: human message + retry; technical code/path only in expandable diagnostics/runtime log. |
| WV-10 | Masters filter rail is visibly clipped at the right edge | route responsive layout | Horizontal filter controls do not have a clear scroll affordance/end padding at narrow WebView widths. | P2 | Safe horizontal scroll, end padding, no half-clipped control as resting layout. |
| WV-11 | Header/menu control geometry is inconsistent between ordinary page and open drawer | shell UI contract | Menu/open/close/location/back states change size and emphasis without one canonical mobile control token. | P2 | Canonical 48px touch target, one radius/icon weight system, stable header height. |
| WV-12 | System volume overlay visible in screenshots | Android OS overlay, not SPA | The grey volume/notification/moon controls are outside the WebView DOM. | NOT APP BUG | Do not "fix" with CSS. Exclude from app visual regression judgments unless the app itself causes it to open. |
| WV-13 | Small red touch/overlay marker appears near bottom-right | test/device overlay until proven otherwise | It persists across unrelated pages and is not yet mapped to a product component. | TRIAGE | Identify with WebView inspector/Android test settings before changing SPA CSS. |

## Execution order

### Phase A — repository reconciliation

1. Freeze `import/kareta-current-84.142` as the web/runtime source at 84.148.
2. Reconcile the main-only Native API 6 behavior into an integration branch.
3. Preserve these Native API 6 semantics:
   - `api/obd.php`: `nativeApiVersion=6`, expanded ELM/ECU readiness commands, and migration-owned OBD schema rather than runtime DDL.
   - `js/mobile_native_bridge.js`: structured native error propagation, longer ELM connect/init timeout, and `offlineAcknowledge`.
   - `js/next/pages/diagnostics.js`: adapter-connected and ECU-ready are separate states; durable offline acknowledgement replaces drain/restore loss risk.
4. Preserve 84.148 web semantics:
   - release-scoped static cache;
   - missing static resource -> real 404, never SPA HTML;
   - stale-while-revalidate Services/Masters/Community;
   - DB canonical boundary remains 129 until pending migrations are explicitly promoted.
5. Run `verification-gate` before targeting `main`.

Important: do not copy all of `main` over the web branch and do not copy the old three web files over the Native API 6 versions. Reconciliation is semantic, file-by-file.

## Phase B — staging route-asset integrity

`tools/verify_staging_current.py` must:

1. Verify DB ping and deployed release.
2. Verify runtime asset-manifest release header.
3. Load the route-loader manifest.
4. Enumerate every lazy CSS and JS entry.
5. For every entry require:
   - manifest `exists=true`;
   - URL release query `v=<current release>`;
   - HTTP 200;
   - CSS -> `text/css`;
   - JS -> JavaScript/ECMAScript MIME;
   - response body is not fallback HTML.
6. Fail the deployment gate on the first aggregate set of bad assets.
7. Print checked CSS/JS counts as evidence.

Implemented in commit `09490a9`; external staging result is still required.

## Phase C — API fail-soft and diagnostics

For Masters, Services, Community and shell auxiliary data:

- retain the last usable presentation snapshot;
- show cached content immediately;
- revalidate in background;
- repaint only if the content signature changes;
- expose structured error code/status/request ID to runtime diagnostics;
- never show raw `Failed to fetch` as normal product copy;
- never turn a transient API failure into an empty catalog if a valid cached snapshot exists.

Additional Masters DoD:
- first successful visit populates cache;
- simulated network failure on revisit still renders previous catalog;
- reconnect triggers background refresh;
- 401/403 is not hidden as stale public data when authorization materially changed.

## Phase D — shell/mobile visual cleanup

1. One canonical active-state rule for bottom navigation.
2. Drawer open state is separate from current route selection.
3. Reserve `bottom-nav-height + safe-area-inset-bottom` for all fixed FAB stacks.
4. Do not allow FABs to cover route CTAs/cards.
5. Normalize back/location/bell/menu touch targets and icon weights.
6. Fix narrow horizontal filter rails so their end state is intentional.
7. Replace technical full-page route failures with compact recovery UI.

## Android two-pass smoke route

Preconditions:
- intended merged release deployed to `https://s.kareta.kz`;
- staging verifier PASS for that exact release;
- Android APK/WebView build identified in evidence;
- network available;
- record runtime console/diagnostic log.

Cycle 1:
`Главная -> Услуги -> Сообщество -> Мастера -> Ещё -> назад`

Cycle 2:
repeat the same route sequence without clearing WebView/app data.

Required proof after cycle 2:

- zero `route_style_load_failed`;
- zero `route_script_load_failed`;
- zero raw `Failed to fetch` surfaces;
- no full route skeleton/loading surface for a route that had usable cached content from cycle 1;
- Services/Masters/Community content remains visible while background revalidation runs;
- already loaded lazy CSS/JS is served from the release cache without a second network download;
- no dual active bottom-nav state;
- no FAB/dock overlap;
- Back returns to the expected previous route/state;
- runtime log contains no uncaught JS exception for the route sequence.

Evidence bundle:
- release SHA + release token;
- APK/version/Native API version;
- staging verifier output;
- screen recording or screenshots for both cycles;
- runtime log excerpt containing route transitions;
- asset/network evidence showing no second-cycle lazy-asset network download.

## Definition of Done

This WebView stabilization program is DONE only when:

1. Native API 6 is reconciled with the 84.148 web/runtime line.
2. Verification gate passes on the reconciled commit.
3. Exhaustive lazy-asset staging verifier passes on the deployed release.
4. The Android two-pass smoke route passes all criteria above.
5. WV-01..WV-06 are closed with evidence, not only code references.
6. WV-07..WV-11 either pass visual acceptance or remain explicit open issues with screenshots and acceptance criteria.
7. `docs/release/current.json` is updated to staging PASS only after external verification.
