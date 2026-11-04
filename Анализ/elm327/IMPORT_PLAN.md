# Bulk import plan

Preferred source: OBDex (CC0 data).

Pipeline:
1. Fetch release/source snapshot and record commit SHA.
2. Validate upstream schema and counts.
3. Import generic DTC/PID factual fields into staging.
4. Preserve upstream source URLs.
5. Generate/curate Russian translations under the same stable IDs.
6. Run duplicate/link/license checks.
7. Mark imported content STRUCTURED/SUPPORTED, never EXPERT_VERIFIED automatically.
8. Produce a coverage report before any runtime use.

Do not bulk-merge ODbL datasets into the canonical database without a licensing decision.
