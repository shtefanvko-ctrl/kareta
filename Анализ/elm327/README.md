# KARETA ELM327 / OBD-II Knowledge Base

Status: research + structured seed. This directory does **not** prove runtime integration.

## Current seed
- 22 high-value DTC entries, RU/EN.
- 13 commonly useful Mode 01/09 PID entries.
- 15 ELM327/OBD commands already aligned with the existing KARETA OBD surface.
- 5 protocol families.
- normalized symptoms, causes, checks and repair actions.
- source registry with license/use policy.
- repair-history source model using NHTSA official datasets and a future KARETA first-party outcome layer.

## Preferred external base
OBDex is the preferred bulk import candidate because its OBD data files are CC0-1.0 and it exposes 9,533 generic DTC entries plus 132 Mode 01/09 PIDs. Import must preserve source metadata and generate RU labels instead of copying copyrighted standards.

## Reference-only datasets
AutoDiag2 and MechanicDB public sample are ODbL. Keep them out of the canonical merged dataset until share-alike/database licensing is explicitly accepted. Wal33D and smaller MIT DTC collections may be used for cross-checking, but manufacturer-specific provenance still needs review.

## Repair-history strategy
NHTSA complaints, recalls, investigations and manufacturer communications/TSBs provide real-world failure evidence. They do not prove a successful repair. Verified repair outcomes should ultimately come from KARETA orders/reports and be stored as first-party structured history.

## Next executable steps
1. Build CC0 OBDex importer and translation pipeline with deterministic IDs and provenance.
2. Add validation gates for IDs, links, bilingual fields and source requirements.
3. Add NHTSA ingestion adapter keyed by normalized vehicle identity.
4. Only after source/validation review, design runtime API integration.
