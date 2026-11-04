# OBDex bulk import and RU translation policy

Pinned upstream: `foerbsnavi/OBDex@bc58b0eb7273226a1aabae98e956b70b8362bda1`.

The bulk source contains 9,533 generic DTC records and 132 PID records. Its data files are CC0-1.0.

## Why bulk data goes to staging first

OBDex provides English and German. KARETA requires Russian and English under one stable ID. Therefore the importer writes:

`Анализ/elm327/staging/obdex/`

with `ru: null` and `translation_status: PENDING_RU`.

A staging record is **not** runtime/canonical data.

## Promotion rule

A record may be promoted into `Анализ/elm327/data/` only when:

1. RU and EN are both non-empty.
2. The upstream commit/blob/path provenance is preserved.
3. DTC/PID identifier validation passes.
4. Every linked KARETA symptom/cause/check/equipment/service/profession ID exists.
5. Repair guidance is reviewed separately from the factual DTC title/description.
6. No rule equates a DTC with an automatic component replacement.

## Reproducibility

The manifest stores Git blob SHA and byte size for every upstream YAML file. The importer recomputes Git's blob SHA before parsing, so a changed external file fails closed.

Run:

```
cd tools/elm327
npm install
npm run verify:obdex
npm run import:obdex
```

For an offline checked-out OBDex tree:

```
node import_obdex.mjs --source-dir /path/to/OBDex
```
