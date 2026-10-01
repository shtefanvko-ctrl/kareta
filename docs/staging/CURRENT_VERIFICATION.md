# Current staging verification

This document replaces release-numbered staging scripts as the operational entry point.

Run:

```bash
python3 tools/verify_staging_current.py --base-url https://s.kareta.kz
```

The verifier reads the expected release from `inc/asset_version.php` and checks:

- database/Identity readiness through the public ping;
- server asset version;
- asset manifest availability and release metadata when exposed;
- Service Worker release parity;
- root HTML availability and current release marker.

A deployment is not considered verified merely because files were uploaded. The script must finish with `STAGING_CURRENT: PASS`.

GitHub Actions also exposes the manually triggered **staging-verify** workflow. The regular **verification-gate** is repository/static verification and does not substitute for deployed staging verification.
