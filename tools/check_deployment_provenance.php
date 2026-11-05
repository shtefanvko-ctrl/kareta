<?php
declare(strict_types=1);

// Read-only release preflight: a missing or stale deployment manifest is fatal.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once dirname(__DIR__) . '/inc/deployment_provenance.php';
require_once dirname(__DIR__) . '/inc/asset_version.php';

$options = getopt('', ['manifest:', 'expected-sha:', 'expected-asset-version:']);
$expectedSha = strtolower(trim((string)($options['expected-sha'] ?? (getenv('KARETA_DEPLOY_GIT_SHA') ?: ''))));
$expectedAsset = trim((string)($options['expected-asset-version'] ?? KARETA_ASSET_VERSION));
$manifestPath = (string)($options['manifest'] ?? kareta_provenance_manifest_path());

if (preg_match('/^[a-f0-9]{40}$/', $expectedSha) !== 1 || $expectedAsset === '') {
    fwrite(STDERR, "PROVENANCE_PREFLIGHT: FAIL exact SHA and asset version required\n");
    exit(2);
}

$state = kareta_provenance_read($manifestPath, $expectedAsset);
if (!$state['ok']) {
    fwrite(STDERR, "PROVENANCE_PREFLIGHT: FAIL " . implode(',', $state['errors']) . "\n");
    exit(1);
}

$actualSha = (string)$state['manifest']['gitSha'];
if (!hash_equals($expectedSha, $actualSha)) {
    fwrite(STDERR, "PROVENANCE_PREFLIGHT: FAIL git_sha_mismatch\n");
    exit(1);
}

echo "PROVENANCE_PREFLIGHT: PASS sha={$actualSha} asset={$expectedAsset}\n";
