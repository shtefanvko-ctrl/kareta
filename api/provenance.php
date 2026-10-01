<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once dirname(__DIR__) . '/inc/deployment_provenance.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    kareta_json(['ok'=>false,'error'=>'method_not_allowed'], 405);
}

$assetVersion = defined('KARETA_ASSET_VERSION') ? KARETA_ASSET_VERSION : (defined('APP_VER') ? APP_VER : '');
$state = kareta_provenance_read(null, (string)$assetVersion);

if (!$state['ok']) {
    kareta_json([
        'ok' => false,
        'status' => (string)($state['status'] ?? 'provenance_invalid'),
        'errors' => array_values($state['errors'] ?? []),
        'assetVersion' => (string)$assetVersion,
    ], 503);
}

$manifest = $state['manifest'];
kareta_json([
    'ok' => true,
    'status' => 'provenance_ready',
    'schema' => (int)$manifest['schema'],
    'gitSha' => (string)$manifest['gitSha'],
    'gitRef' => (string)$manifest['gitRef'],
    'assetVersion' => (string)$manifest['assetVersion'],
    'builtAt' => (string)$manifest['builtAt'],
    'workflowRunId' => (string)$manifest['workflowRunId'],
], 200);
