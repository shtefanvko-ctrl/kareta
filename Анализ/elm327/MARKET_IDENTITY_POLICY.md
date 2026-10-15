# Manufacturer-specific vehicle identity policy

Manufacturer-specific DTC, TSB, recall, calibration and repair information may only be attached to a KARETA vehicle after market identity is resolved.

Required identity dimensions:
- make;
- model;
- model year;
- market/region;
- generation/platform when known;
- engine/fuel type when relevant;
- ECU/module when relevant;
- VIN or VIN-derived identifiers where available;
- WMI/plant/model metadata when available.

## Hard rule

The same commercial model name in two markets is **not** assumed to be the same vehicle.

Examples of unsafe joins:
- US-market service information applied to a Kazakhstan-market vehicle only because make/model text matches;
- Korean recall applied globally without VIN/campaign applicability;
- a Chevrolet Cobalt source for a different generation/platform treated as applicable to the Kazakhstan Cobalt;
- a generic DTC cause promoted to an OEM repair instruction.

## Evidence matching levels

EXACT_VIN — source explicitly applies to the VIN/campaign.
EXACT_PLATFORM — market + model year + platform/engine/module align.
MODEL_YEAR_MARKET — market + model + model year align, but engine/module details are incomplete.
NAME_ONLY — make/model text only. Research hint; never canonical repair guidance.
UNKNOWN — insufficient identity.

Only EXACT_VIN, EXACT_PLATFORM, or explicitly reviewed MODEL_YEAR_MARKET may influence manufacturer-specific diagnostic guidance.

## NHTSA boundary

NHTSA is authoritative for US-regulated vehicle evidence. It is not automatically authoritative for Kazakhstan-market applicability. NHTSA records may be attached only when the vehicle identity contract proves the relevant US-market configuration/campaign relationship.

## OEM portal boundary

Hyundai TechInfo explicitly describes US-sold Hyundai vehicles. Kia, GM, Changan and Chery sources likewise carry market/product applicability that must be preserved. Store the source market and applicability text; never erase it during normalization.
