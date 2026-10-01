# KARETA.KZ 188.5.5.6.84.149

## Database canonicalization

- Canonical migration chain is now strictly **1..135**.
- Versions **130–134** are side-effect-free compatibility slots. They intentionally tolerate historical production markers created by parallel branches without replaying incompatible transforms.
- Original conflicting 130–134 source files are preserved under `api/migrations_pending/historical/`.
- Version **135** canonically owns `obd_diagnostic_sessions` for Android Native API 6.
- `KARETA_DB_VERSION`, PHP manifest and JSON manifest are synchronized at **135**.

## Why this was required

84.148 correctly removed runtime DDL from `api/obd.php`, but the only OBD table migration was still quarantined as historical 134 while the active DB contract ended at 129. On a clean DB 129, OBD sync could therefore return `503 OBD_SCHEMA_PENDING`.

Reusing version 130 directly was unsafe because the migration runner preserves already-applied versions even when their checksum differs. The compatibility bridge avoids replaying old onboarding/account/identity transforms while guaranteeing that the new OBD schema runs at version 135.

## Verification

CI must pass:
- migration sequence and manifest checksum verification;
- collision bridge side-effect check;
- Native API 6 schema ownership contract;
- current release contract.

Staging remains **NOT VERIFIED** until 84.149 is deployed and the current staging verifier succeeds.
