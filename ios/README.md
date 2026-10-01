# KARETA iOS shell

Repository-only iOS port scaffold created from Android snapshot `archive/android-apk-2026-10-01`.

## Baseline

- source snapshot: `13201c2f5bbbbaa1a34766de62b5f9587a2859eb`
- SPA origin: `https://kareta.kz/`
- web/native contract: `js/mobile_native_bridge.js`
- iOS branch: `ios/kareta-2026-10-01`
- Android archive remains unchanged.

## Porting contract

The iOS shell must not fork business logic from the SPA. It hosts KARETA in `WKWebView`, preserves first-party cookies/session storage, and implements the existing `window.KaretaNative.postMessage(...)` command contract.

Phase 1 commands implemented in this scaffold:
- `ping`
- `appInfo`
- `openExternal`
- `openPhone`
- `openMap`
- `openSettings`
- `copy`
- `share`
- `vibrate`
- `reload`
- `openRoute`

All unimplemented commands return `KARETA_NATIVE_NOT_IMPLEMENTED`; they do not silently succeed.

## Required next contracts

1. Authentication/logout and cookie lifecycle.
2. Camera / image picker / QR-VIN scan.
3. Geolocation permission and native location.
4. Push registration.
5. Offline queue parity.
6. ELM327 transport on iOS.
7. App icon, launch assets, signing team, final bundle identifier.
8. iPhone smoke matrix and App Store packaging.

## ELM327 note

The Android UI currently assumes a Bluetooth ELM327 adapter and calls `elmStatus`, `elmDevices`, `elmConnect`, `elmInit`, `elmCommand`, `elmSnapshot` and `elmLiveSnapshot`.

Do not claim iOS ELM parity until the target adapter class is verified. iOS Core Bluetooth is appropriate for BLE/GATT peripherals; MFi accessories can use External Accessory. The adapter transport must therefore be implemented and tested separately from the WKWebView bridge.

## Build status

This commit is a source scaffold only. No `.xcodeproj` or signed IPA is claimed yet. A macOS/Xcode build and real-device verification are still required.
