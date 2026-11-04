# Manufacturer-specific validation rules

Future records under `Анализ/elm327/vehicles/manufacturers/**` must:
1. carry `market`;
2. carry an applicability level;
3. reference a registered `source_id`;
4. never be promoted from `NAME_ONLY` or `UNKNOWN` to repair guidance;
5. preserve VIN/campaign/platform constraints;
6. not convert a recall/TSB from one market into a global rule.
