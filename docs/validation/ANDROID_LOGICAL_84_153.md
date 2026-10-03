# Android logical validation — release 84.153

This branch validates the exact release line without changing the release or main branches.

## Base

- Release: `188.5.5.6.84.153`
- Base SHA: `4d969dbd9c779f4722a4afc4acf087f2eaba2948`
- Validation branch: `validate/android-logical-84.153`

## What this proves

The CI reuses repository-owned regression tests for:

- Android Native API 6 contract;
- logout and garage behavior across account changes;
- first-vehicle account isolation;
- cabinet/API cache isolation between accounts;
- route and session preservation after resume;
- tab-resume route authority;
- route revisit CSS cascade;
- lazy-route runtime contract;
- route loading/warm-revisit behavior.

The workflow writes `artifacts/android-logical-84.153.json` as machine-readable evidence.

## What this does not prove

This evidence is intentionally not accepted as:

- deployed staging exact-runtime evidence;
- deployed `/api/provenance.php` evidence;
- physical Android two-account smoke;
- physical Android two-pass warm-route smoke;
- Android WebView screenshots/video for WV-07..WV-11.

Those remain external release-to-main requirements. The validation branch does not weaken or edit `harness/release-evidence-policy.json`.
