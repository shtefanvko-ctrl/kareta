# Applying the 84.171 design overlay safely

1. Start from an extracted copy of the exact full `188.5.5.6.84.170` Plesk package. Do not apply to GitHub `main`, 84.158, or any older branch.
2. Verify `inc/asset_version.php` reports `188.5.5.6.84.170` and DB target remains 138.
3. Verify every `base_sha256` entry in `84.171-overlay-manifest.json`. If any existing-file hash differs, **abort** instead of forcing the patch.
4. Apply `84.171-design-canon.patch` from the project root with paths stripped to the project-relative name (`patch -p1` only after checking path prefixes in your environment).
5. Verify every `target_sha256` entry after application.
6. Run the package/runtime/design verification described by the 84.171 candidate.
7. Deploy only to the host-test slot. Do not merge to production/main before browser acceptance.

## Host acceptance

Required before promotion:

- manifest/provenance/SW all report 84.171;
- no mixed 84.170 assets in Network;
- Master phone nav is one row with six destinations and no `Сегодня`;
- phone/tablet/desktop Master Exchange layout passes;
- second navigation circle passes without disappearing menu or repeat load failures;
- server logs show no new PHP-FPM/nginx/MySQL regressions.