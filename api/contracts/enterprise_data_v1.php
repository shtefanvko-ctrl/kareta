<?php
declare(strict_types=1);

/**
 * KARETA Enterprise Data Contract v1.
 *
 * Canonical API/DTO keys are English camelCase. Existing DB/API field names
 * remain supported through an explicit compatibility map while migration is
 * incremental. This file does not mutate persistence or remove legacy fields.
 */
const KARETA_ENTERPRISE_DATA_SCHEMA_VERSION = '1.0.0';

function kareta_enterprise_data_v1_common_keys(): array
{
    return [
        'accountId','personId','contextId','cityId',
        'vehicleId','brandId','modelId','generationId','vin',
        'stoId','masterId','sellerId',
        'orderId','serviceId','workOrderId',
        'deviceId','adapterId','diagnosticSessionId','diagnosticJobId',
        'dtcCode','pid','protocol','snapshot',
        'requestId','idempotencyKey','schemaVersion','createdAt','updatedAt',
    ];
}

function kareta_enterprise_data_v1_legacy_aliases(): array
{
    return [
        'account_id'=>'accountId',
        'person_id'=>'personId',
        'context_id'=>'contextId',
        'city_id'=>'cityId',
        'vehicle_id'=>'vehicleId',
        'client_vehicle_id'=>'vehicleId',
        'brand_id'=>'brandId',
        'model_id'=>'modelId',
        'generation_id'=>'generationId',
        'sto_id'=>'stoId',
        'master_id'=>'masterId',
        'seller_id'=>'sellerId',
        'order_id'=>'orderId',
        'source_order_id'=>'orderId',
        'service_id'=>'serviceId',
        'work_order_id'=>'workOrderId',
        'device_id'=>'deviceId',
        'adapter_id'=>'adapterId',
        'diagnostic_session_id'=>'diagnosticSessionId',
        'diagnostic_job_id'=>'diagnosticJobId',
        'dtc_code'=>'dtcCode',
        'code_value'=>'dtcCode',
        'protocol_label'=>'protocol',
        'snapshot_json'=>'snapshot',
        'request_id'=>'requestId',
        'idempotency_key'=>'idempotencyKey',
        'schema_version'=>'schemaVersion',
        'created_at'=>'createdAt',
        'updated_at'=>'updatedAt',
    ];
}

function kareta_enterprise_data_v1_canonical_dto(array $payload): array
{
    $aliases = kareta_enterprise_data_v1_legacy_aliases();
    $out = [];
    foreach ($payload as $key => $value) {
        $key = (string)$key;
        $canonical = $aliases[$key] ?? $key;
        if (!array_key_exists($canonical, $out) || $canonical === $key) {
            $out[$canonical] = $value;
        }
    }
    if (!isset($out['schemaVersion']) || trim((string)$out['schemaVersion']) === '') {
        $out['schemaVersion'] = KARETA_ENTERPRISE_DATA_SCHEMA_VERSION;
    }
    return $out;
}

/**
 * Add canonical aliases without removing legacy fields.
 * Use only at compatibility boundaries while old consumers still exist.
 */
function kareta_enterprise_data_v1_compat_payload(array $payload): array
{
    $out = $payload;
    foreach (kareta_enterprise_data_v1_legacy_aliases() as $legacy => $canonical) {
        if (!array_key_exists($canonical, $out) && array_key_exists($legacy, $payload)) {
            $out[$canonical] = $payload[$legacy];
        }
    }
    if (!isset($out['schemaVersion']) || trim((string)$out['schemaVersion']) === '') {
        $out['schemaVersion'] = KARETA_ENTERPRISE_DATA_SCHEMA_VERSION;
    }
    return $out;
}

function kareta_enterprise_data_v1_request_id(): string
{
    if (defined('KARETA_REQUEST_ID')) {
        $existing = trim((string)constant('KARETA_REQUEST_ID'));
        if ($existing !== '') return $existing;
    }
    return 'req_'.bin2hex(random_bytes(12));
}

function kareta_enterprise_data_v1_envelope(array $data, array $meta = []): array
{
    $requestId = trim((string)($meta['requestId'] ?? ''));
    $idempotencyKey = trim((string)($meta['idempotencyKey'] ?? ''));
    return [
        'schemaVersion'=>KARETA_ENTERPRISE_DATA_SCHEMA_VERSION,
        'requestId'=>$requestId !== '' ? $requestId : kareta_enterprise_data_v1_request_id(),
        'idempotencyKey'=>$idempotencyKey,
        'data'=>kareta_enterprise_data_v1_canonical_dto($data),
    ];
}
