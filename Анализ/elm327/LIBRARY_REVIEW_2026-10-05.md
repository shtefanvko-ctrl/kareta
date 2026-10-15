# Ready libraries and databases review — 2026-10-05

## Preferred import base

### OBDex
- Generic DTC coverage claimed by the project: 9,533 codes across P0/P2/P3/U0/U3/B0/C0.
- Mode 01/09 PID coverage claimed: 132 PIDs.
- Data license: CC0-1.0. Tooling: MIT.
- Decision: preferred bulk import source for generic DTC/PID facts.
- KARETA requirement: generate/curate RU text under stable IDs, preserve upstream sources, never convert a DTC directly into a mandatory part replacement.

## Useful implementation libraries

### python-OBD
Mature ELM327/OBD-II Python implementation with protocol mapping and command parsers. GPL-2.0-or-later. Use as behavior/reference material; do not copy GPL source into KARETA without an explicit licensing decision.

### elm327_obdii
Apache-2.0 BLE-oriented library. Useful architecture references: voltage-gated polling, ELM327 BLE transport, CAN header/filter context, profile fetching. Vehicle profile data fetched from OBDb/WiCAN carries separate licenses.

## Manufacturer-specific research

### AutoDiag2
Vehicle/engine/ECU/DTC-oriented collaborative database. Database is ODbL-1.0/DbCL-1.0; tooling GPL-3.0+. Keep reference-only until database licensing is deliberately accepted.

### OBDb
Community vehicle-specific signal profiles. Treat as reference-only until each vehicle repository's provenance/license is verified.

### Wal33D DTC Database
Large offline SQLite-oriented DTC collection with MIT repository license. Good coverage cross-check; manufacturer-specific definition provenance still needs independent review before canonical import.

## Repair procedures and repair history

### MechanicDB public sample
Contains DTC→ranked fixes/parts mappings, useful for schema design. Public sample is ODbL; full database is commercial. Do not merge silently into KARETA canonical data.

### NHTSA
Use official complaints, recalls, investigations and manufacturer communications/TSBs as external failure evidence by make/model/year. This is not a database of confirmed successful repairs.

### Real-vehicle OBD sample
AbouAbdallah-Lounis/OBD-Dataset contains measured OBD data and observed DTC combinations from real vehicles. No license file was confirmed during this review, so it remains reference-only.

## Canonical repair outcome layer
The actual "what repair fixed this vehicle" history should be first-party KARETA data:
DTC before → symptoms → measurements/checks → confirmed cause → work/parts → DTC after → verification drive → resolved/not resolved.
This is the only layer that should later support empirical repair success rates.
