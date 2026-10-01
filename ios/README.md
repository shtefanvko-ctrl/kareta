# KARETA iOS shell

Repository-only iPhone port created from the dated Android snapshot `archive/android-apk-2026-10-01`.

## Baseline

- source snapshot: `13201c2f5bbbbaa1a34766de62b5f9587a2859eb`
- SPA origin: `https://kareta.kz/`
- web/native contract: `js/mobile_native_bridge.js`
- iOS branch: `ios/kareta-2026-10-01`
- Android archive remains unchanged.
- canonical KARETA logo already exists in `assets/onboarding/kareta_logo_full.png`; do not replace it with generated branding.

## Architecture

The iOS app is a thin native shell around the existing KARETA SPA.

- `WKWebView` hosts the production SPA.
- `window.KaretaNative.postMessage(...)` keeps the existing JS/native contract.
- business logic remains in the existing SPA/API.
- unsupported commands fail explicitly; no native command silently reports success.
- native storage, camera, location, contacts, scanner and push are platform services rather than duplicated SPA logic.

## Implemented native commands

Implemented:
- `ping`, `appInfo`, `network`
- `logout`
- `pushToken`, `registerPush`, `unregisterPush`
- `requestPermission`
- `pickImage`, `takePhoto`, `pickContact`
- `getLocation`
- `scanCode` for QR and VIN
- `actionSheet`
- `offlineState`, `offlineEnqueue`, `offlineDrain`, `offlineAcknowledge`, `offlineRestore`, `offlineClear`
- `share`, `copy`, `openPhone`, `openMap`, `openExternal`, `openSettings`
- `vibrate`, `reload`, `openRoute`

Degraded by iOS platform rules:
- `openBluetoothSettings` opens the app settings because iOS does not expose a public deep link to the Bluetooth settings pane.

OBD/ELM:
- `elmStatus` is an explicit stub.
- all remaining ELM transport commands are pending.
- do not claim ELM parity until the actual iOS adapter transport is verified.

## Offline contract

`offlineDrain` is intentionally non-destructive. The current diagnostics flow performs:

`drain -> POST /api/obd.php?action=sync -> acknowledge`

Therefore queued items remain on the device if synchronization fails.

## Session logout

Native logout calls the existing server contract:

`POST https://kareta.kz/api/auth_session.php`
with `{"action":"logout"}`.

Only after the server confirms success are KARETA cookies removed from the WKWebView store.

## Scanner

QR/VIN uses VisionKit `DataScannerViewController` when available. The app target is iOS 15+, while live QR/VIN scanning requires iOS 16+; older supported devices receive an explicit unsupported result instead of a fake scan.

## Push

APNs registration is routed through `KaretaAppDelegate`. The bridge returns immediately when the system authorization prompt is started so the existing eight-second JS bridge timeout is not consumed while a person decides. The token is stored when the app delegate receives it and is exposed by `pushToken`.

Push still requires:
- a real Apple Development Team;
- Push Notifications capability/provisioning;
- server-side APNs token registration contract.

## Xcode project

The project is generated from `ios/project.yml` using XcodeGen.

From macOS:

```bash
cd ios
xcodegen generate
open KaretaIOS.xcodeproj
```

Current provisional settings:
- deployment target: iOS 15.0
- bundle id: `kz.kareta.app`
- product: `KARETA`
- signing: Automatic
- Development Team: intentionally unset

Do not invent a Team ID in the repository.

## CI

`.github/workflows/ios-source-build.yml` runs:
1. all iOS JS/source contract guards;
2. XcodeGen project generation;
3. unsigned iOS Simulator compilation on macOS.

A green simulator build proves source/project compilation only. It does not prove APNs entitlement, App Store signing, camera behavior on a physical device, or BLE ELM compatibility.

## Next gate

1. Make simulator CI green.
2. Add BLE ELM transport behind the existing ELM bridge commands.
3. Correct the diagnostics UI text that currently assumes Android pairing when the runtime platform is iOS.
4. Resolve the server diagnostic-source label before iOS OBD sync; current `api/obd.php` persists source as `android`.
5. Bind the canonical KARETA icon/logo to the Xcode asset catalog.
6. Configure Apple Team/signing and run a real-iPhone smoke test.
