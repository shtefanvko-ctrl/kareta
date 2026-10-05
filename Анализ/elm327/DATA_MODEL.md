# ELM327 / OBD-II knowledge model

Canonical machine data lives under `Анализ/elm327/data/`. Git is source of truth; Drive is a readable mirror.

Core diagnostic relation:

Vehicle → protocol → ECU/system → DTC/live data/freeze frame → symptom → hypotheses → checks → confirmed cause → repair action → service/profession.

Rules:
- A DTC is an observed diagnostic condition, not a part-replacement instruction.
- Generic and manufacturer-specific facts must remain distinguishable.
- RU and EN are two labels of the same stable ID.
- Missing facts remain null/UNKNOWN.
- Repair history must distinguish external evidence (complaints/recalls/TSBs) from actual verified repair outcomes.
- Manufacturer-specific instructions require exact applicability and source provenance.
- Safety-critical work (SRS, brakes, steering, HV, fuel, ECU programming) may be PROFESSIONAL_ONLY.
