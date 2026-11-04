# KARETA Enterprise API Contract v1

## Purpose

Enterprise Data Contract v1 introduces a compatibility-first canonical DTO layer across the KARETA SPA, PHP API, MySQL persistence boundaries and Android native bridge. It does not redesign the current application and it does not require an immediate database migration.

## Canonical data language

Business contract keys, IDs, schema names and enum values are English. New API/DTO contracts must not use Cyrillic keys, translated identifiers or translated enum values.

Localized RU/KK/EN strings belong to the presentation/i18n layer. User-entered free text may contain any supported language; this rule does not prohibit names, descriptions or comments written by users.

Canonical common keys are:

`accountId, personId, contextId, cityId, vehicleId, brandId, modelId, generationId, vin, stoId, masterId, sellerId, orderId, serviceId, workOrderId, deviceId, adapterId, diagnosticSessionId, diagnosticJobId, dtcCode, pid, protocol, snapshot, requestId, idempotencyKey, schemaVersion, createdAt, updatedAt`.

Schema version: `1.0.0`.

## Envelope

New contract-aware boundaries use:

```json
{
  "schemaVersion": "1.0.0",
  "requestId": "req_...",
  "idempotencyKey": "",
  "data": {}
}
```

Existing endpoints are not forced to switch response shape in v1. The envelope is introduced through adapters first.

## Compatibility mapping

Legacy field names remain readable while migration is incremental. Compatibility adapters translate explicit legacy aliases to canonical keys; they do not infer IDs from labels.

Examples:

| Legacy | Canonical |
| --- | --- |
| `account_id` | `accountId` |
| `context_id` | `contextId` |
| `client_vehicle_id`, `vehicle_id` | `vehicleId` |
| `brand_id` | `brandId` |
| `model_id` | `modelId` |
| `generation_id` | `generationId` |
| `order_id` | `orderId` |
| `work_order_id` | `workOrderId` |
| `diagnostic_session_id` | `diagnosticSessionId` |
| `diagnostic_job_id` | `diagnosticJobId` |
| `dtc_code`, `code_value` | `dtcCode` |
| `created_at` | `createdAt` |
| `updated_at` | `updatedAt` |

Legacy fields are compatibility inputs, not new canonical output vocabulary.

## Vehicle identity

The identity chain is:

`brandId → modelId → generationId → client_vehicles.id (vehicleId) → order vehicle relation → OBD vehicleId → repair/history`.

VIN is an attribute and scan/decode input. It never replaces the internal `vehicleId`.

ELM327 must not create an independent vehicle identity.

## SPA / Android boundary

SPA owns UI, forms, validation, DTO construction and business flow.

Android owns native capabilities only: location, camera, QR/VIN scan, file/image access, share, offline queue and Bluetooth/ELM327 transport.

Android does not own Account, Context, Vehicle, Order, STO, Master, Seller or form schemas.

## Form target pipeline

`FORM SCHEMA → SPA renderer → shared validation → canonical DTO → API contract → authorization/context → domain service → canonical DB entity`.

Compatibility adapters are permitted before legacy API handlers until those handlers are migrated.

## Verification boundary

Contract PASS proves static/runtime adapter behavior covered by contract tests. It does not prove browser E2E, a real MySQL migration, Android device behavior or Bluetooth/ELM327 hardware acceptance.

## Contract gate

The contract layer is verified independently from Application gates until PR #100 is merged.

Run the complete contract verification locally with one command:

```bash
node scripts/enterprise_contract_gate.js
```

The dedicated CI entrypoint is `.github/workflows/enterprise-contract.yml`. Application gates are intentionally not modified by this increment. After PR #100 is merged, integration into Application gates is a separate minimal commit containing one workflow step.

The gate covers the canonical PHP/JS contract, form compatibility adapters, onboarding/vehicle/master/STO/seller/order boundaries, generated boot-bundle synchronization, the golden flow, and the OBD vehicle binding guard.

## OBD vehicle binding finding

During the v1 contract audit, `api/obd.php?action=sync` was confirmed to accept a diagnostic item without `vehicleId`. The ownership check ran only when an ID was present, and the empty value could be stored as `NULL` in `obd_diagnostic_sessions.vehicle_id`.

The compatibility fix is intentionally narrow: OBD sync now returns `VEHICLE_ID_REQUIRED` with HTTP 422 when `vehicleId` is empty, then applies the existing `kareta_obd_vehicle_access` ownership guard. The optional `vehicleId` filter for read-only history queries is unchanged. No DB migration, Android change, Geo change, Design canon change, or Master CSS change is part of this fix.



## Form Canon v1

Runtime form boundaries use `KaretaFormContract`.

The compatibility path is:

`existing form state → shared Form Contract validation → canonical DTO → compatibility payload → existing API handler`.

The compatibility payload keeps legacy fields required by current PHP handlers and adds canonical aliases. Canonical aliases never overwrite an explicit canonical value.

Covered boundaries in this increment:

- onboarding;
- client vehicle;
- master onboarding/workplace;
- STO workplace;
- seller;
- client order/exchange;
- work order.

No visual markup or CSS is changed by the contract layer.

## Presentation / i18n boundary

This increment does not introduce or replace presentation dictionaries. Existing RU/KK/EN UI labels remain owned by the current presentation/i18n layer. Canonical contract values remain English codes and identifiers.

DTC business payloads carry `dtcCode` such as `P0300`. Localized DTC descriptions currently live in the ELM327 knowledge material introduced by PR #100 and are not edited here.

## OBD / repair-history relation

New OBD sync writes require a canonical `vehicleId`. Legacy `vehicle_id` and `client_vehicle_id` are mapped before validation.

The current compatibility relation is:

`vehicleId → optional orderId in OBD raw payload → diagnosticSessionId`.

Existing vehicle repair history remains keyed by `vehicle_id + order_id`. `api/vehicle_passport.php` is intentionally unchanged in this increment; no new `diagnostics[]` response contract is introduced here.

A dedicated indexed `order_id` column on `obd_diagnostic_sessions`, or a separate vehicle-passport diagnostics projection, is deferred because those changes would extend the API/DB scope beyond this contract-only increment.

## Legacy allowlist

The machine-readable compatibility allowlist is `tests/contracts/legacy_allowlist.json`.

The main remaining legacy names are snake_case DB/API fields such as `account_id`, `context_id`, `client_vehicle_id`, `vehicle_id`, `brand_id`, `model_id`, `generation_id`, `order_id`, `work_order_id`, `diagnostic_session_id`, `diagnostic_job_id`, `dtc_code`, `protocol_label`, `snapshot_json`, `created_at` and `updated_at`.

Presentation compatibility also still accepts legacy display fields `city`, `brand`, `model`, `generation` and `clientVehicleId`. These are not canonical identity fields.

## Golden integration flow

Automated contract scenario:

`SPA form → Form Contract → Identity contract → stable vehicle IDs → order DTO → Android bridge capability → ELM snapshot/offline queue boundary → /api/obd.php → diagnosticSessionId/vehicleId/orderId relation`.

Run locally with:

`node scripts/enterprise_contract_gate.js`

### Manual acceptance checklist

1. Browser: complete onboarding and confirm network payload contains English canonical metadata while the visible RU/KK/EN labels remain unchanged.
2. Browser: create/edit a vehicle and confirm `brandId`, `modelId` and server-resolved `generationId` are stable IDs; verify the returned `vehicleId`.
3. Browser: create an order for that vehicle and verify the same `vehicleId` reaches the order domain.
4. Android device: open the same account/context in the WebView and verify Native API 6 is available.
5. Android + paired ELM327: run `elmConnect → elmSnapshot`.
6. SPA: enqueue diagnostic payload with the same `vehicleId` and, when diagnostics belong to an order, its `orderId`.
7. Restore network and sync to `/api/obd.php?action=sync`; verify response contains `diagnosticSessionId`, `vehicleId` and matching `orderId`.
8. Confirm the existing vehicle passport/history behavior is unchanged; this increment does not add a `diagnostics[]` passport response.
9. Negative test: sync without any `vehicleId/vehicle_id/client_vehicle_id` and expect HTTP 422 / `VEHICLE_ID_REQUIRED`.
10. Authorization negative test: sync another user's `vehicleId` and expect HTTP 403 / `VEHICLE_FORBIDDEN`.

Until executed against real environments, browser, MySQL and Android/Bluetooth acceptance remain **NOT RUN**.
