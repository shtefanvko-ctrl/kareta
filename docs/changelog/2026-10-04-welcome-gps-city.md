# Welcome GPS city selector — 2026-10-04

Base: `fix/auth-ui-boundaries-84-158-20261004`.

- Added `Ваш город?` on the first onboarding screen under the welcome copy.
- Reused the canonical onboarding city catalog and existing `flow.city/cityName` state.
- Automatic GPS detection runs on the welcome screen.
- `Найти меня` forces a fresh high-accuracy geolocation request with `maximumAge: 0` and replaces the city with the newly detected city.
- Manual city selection remains available and is persisted to the existing onboarding/local city keys.
- Source JS/CSS and boot bundles are kept synchronized.
- Added `tools/test_welcome_city_geo_contract.js`.

Release token is intentionally not changed on this feature branch. Rebase/cherry-pick onto the current release head and bump the runtime version only at integration time.
