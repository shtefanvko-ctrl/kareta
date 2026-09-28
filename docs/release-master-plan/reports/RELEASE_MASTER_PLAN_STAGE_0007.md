# KARETA.KZ — Browser Support Matrix — Stage 0007/2513

Release: R188.5.5.6.84.109

## Minimum supported versions

| Target | Minimum |
|---|---|
| Chrome desktop | 105+ |
| Edge desktop | 105+ |
| Safari macOS | 15.4+ |
| Firefox desktop | 121+ |
| Android | Android 10+ with Chrome 105+ |
| iOS | iOS 15.4+ / Safari-WebKit 15.4+ |

## Why these floors

The runtime ships modern JavaScript without transpilation and uses optional chaining/nullish coalescing. More importantly, runtime CSS uses `:has()` outside `@supports` for request selection, shell/layout state and route-specific presentation, and the application uses native `<dialog>/showModal()` in core flows.

Compatibility evidence checked 2026-09-25:
- CSS `:has()`: Chrome 105+, Edge 105+, Firefox 121+, Safari/iOS 15.4+.
- Dialog/showModal: Chrome 37+, Edge 79+, Firefox 98+, Safari/iOS 15.4+.
- Optional chaining: Chrome/Edge 80+, Firefox 74+, Safari 13.1+, iOS 13.4+.
- Current Chrome for Android requires Android 10+ to receive supported updates.

Therefore the selected functional floor is the maximum required by the real runtime, with Android 10+ added as the current supported OS policy.

## Required smoke matrix

Every supported target must cover:
1. boot_shell
2. auth_session
3. spa_routing
4. native_dialogs
5. request_flow
6. responsive_layout
7. asset_mime
8. pwa_runtime

The machine-readable matrix is `docs/qa/browser_support_matrix_84_109.json`.

## Automated contract

`node tools/test_browser_support_matrix_84_109.js`:
`BROWSER_SUPPORT_MATRIX_84_109: PASS targets=6 chrome=105 edge=105 safari=15.4 firefox=121 android=10+/chrome105 ios=15.4`

The unified release gate now includes this matrix:
`bash tools/release_checklist.sh` → 18/18 PASS.

## Real browser smoke available in this environment

Chrome 153.0.8010.53 headless against a temporary local server rooted at the exact 84.109 tree:
- process exit: 0;
- release marker 188.5.5.6.84.109 present;
- app root present;
- KARETA.KZ marker present.

Other browser engines/devices are not installed/available on the connected Windows host, so they are registered in the smoke matrix but not falsely marked as executed.

## Staging CHECK

HTTP preflight with UA profiles matching all six support targets:
- Chrome 105 → 403
- Edge 105 → 403
- Safari 15.4 → 403
- Firefox 121 → 403
- Android 10 / Chrome 105 → 403
- iOS 15.4 / Safari → 403

All return `text/html; charset=UTF-8` before the application loads. Therefore staging browser smoke is BLOCKED_HTTP_403 and not counted as PASS.
