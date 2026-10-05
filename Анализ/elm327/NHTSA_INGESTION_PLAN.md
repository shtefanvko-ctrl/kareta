# NHTSA failure-history ingestion plan

NHTSA is an external evidence layer, not KARETA's confirmed repair-outcome database.

Official current endpoints support:
- recalls by make/model/modelYear;
- complaints by make/model/modelYear;
- lookup by campaign/ODI number.

Manufacturer communications/TSBs are available as bulk public datasets and should be ingested separately with exact vehicle applicability.

## Normalized external evidence key

```
make_normalized
model_normalized
model_year
nhtsa_campaign_or_odi
component
summary
report_date
source_type
source_url
```

Never infer that a complaint was repaired successfully.

## Future KARETA-owned outcome key

```
vehicle_id
vin_hash
make
model
year
engine
dtc_before[]
freeze_frame
live_data
symptoms[]
checks_performed[]
confirmed_cause
repair_actions[]
parts[]
dtc_after[]
verification_drive
resolved
mileage_km
repair_date
```

Only this first-party layer may later be used to compute empirical KARETA repair success rates.
