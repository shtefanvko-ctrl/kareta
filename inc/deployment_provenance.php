<?php
declare(strict_types=1);

function kareta_provenance_manifest_path(): string
{
    return dirname(__DIR__) . '/storage/deployment_manifest.json';
}

function kareta_provenance_normalize(array $data): array
{
    return [
        'schema' => (int)($data['schema'] ?? 0),
        'gitSha' => strtolower(trim((string)($data['gitSha'] ?? ''))),
        'gitRef' => trim((string)($data['gitRef'] ?? '')),
        'assetVersion' => trim((string)($data['assetVersion'] ?? '')),
        'builtAt' => trim((string)($data['builtAt'] ?? '')),
        'workflowRunId' => trim((string)($data['workflowRunId'] ?? '')),
    ];
}

function kareta_provenance_validate(array $data, string $runtimeAssetVersion = ''): array
{
    $manifest = kareta_provenance_normalize($data);
    $errors = [];

    if ($manifest['schema'] !== 1) $errors[] = 'schema_invalid';
    if (preg_match('/^[a-f0-9]{40}$/', $manifest['gitSha']) !== 1) $errors[] = 'git_sha_invalid';
    if ($manifest['gitRef'] === '' || strlen($manifest['gitRef']) > 255) $errors[] = 'git_ref_invalid';
    if ($manifest['assetVersion'] === '' || strlen($manifest['assetVersion']) > 96) $errors[] = 'asset_version_invalid';
    if ($manifest['builtAt'] === '' || strtotime($manifest['builtAt']) === false) $errors[] = 'built_at_invalid';

    if ($manifest['workflowRunId'] !== '' && preg_match('/^[0-9]{1,32}$/', $manifest['workflowRunId']) !== 1) {
        $errors[] = 'workflow_run_id_invalid';
    }

    $runtimeAssetVersion = trim($runtimeAssetVersion);
    if ($runtimeAssetVersion !== '' && $manifest['assetVersion'] !== $runtimeAssetVersion) {
        $errors[] = 'asset_version_mismatch';
    }

    return [
        'ok' => $errors === [],
        'status' => $errors === [] ? 'provenance_valid' : 'provenance_invalid',
        'errors' => $errors,
        'manifest' => $manifest,
    ];
}

function kareta_provenance_read(?string $path = null, string $runtimeAssetVersion = ''): array
{
    $path = $path ?: kareta_provenance_manifest_path();
    if (!is_file($path) || !is_readable($path)) {
        return ['ok'=>false,'status'=>'provenance_missing','errors'=>['manifest_missing'],'manifest'=>null];
    }

    $raw = file_get_contents($path);
    if ($raw === false || trim($raw) === '') {
        return ['ok'=>false,'status'=>'provenance_invalid','errors'=>['manifest_empty'],'manifest'=>null];
    }

    try {
        $decoded = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        return ['ok'=>false,'status'=>'provenance_invalid','errors'=>['manifest_json_invalid'],'manifest'=>null];
    }

    if (!is_array($decoded)) {
        return ['ok'=>false,'status'=>'provenance_invalid','errors'=>['manifest_shape_invalid'],'manifest'=>null];
    }

    return kareta_provenance_validate($decoded, $runtimeAssetVersion);
}
