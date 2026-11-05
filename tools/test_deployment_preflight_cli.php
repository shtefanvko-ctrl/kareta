<?php
declare(strict_types=1);

// Regression: a missing, malformed, or mismatched provenance manifest fails closed.
$directory = sys_get_temp_dir() . '/kareta-provenance-' . bin2hex(random_bytes(8));
if (!mkdir($directory, 0700)) {
    fwrite(STDERR, "cannot create test directory\n");
    exit(1);
}
$manifest = $directory . '/deployment_manifest.json';
$sha = str_repeat('a', 40);
$asset = '188.5.5.6.84.178';
$valid = [
    'schema' => 1,
    'gitSha' => $sha,
    'gitRef' => 'main',
    'assetVersion' => $asset,
    'builtAt' => '2026-10-13T00:00:00+00:00',
    'workflowRunId' => '',
];

function runProvenancePreflight(array $args): array
{
    $command = array_merge([PHP_BINARY, __DIR__ . '/check_deployment_provenance.php'], $args);
    $process = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (!is_resource($process)) {
        throw new RuntimeException('preflight process could not start');
    }
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    return [proc_close($process), $stdout . $stderr];
}

$cases = [
    ['valid', $valid, $sha, $asset, 0, 'PASS'],
    ['sha_mismatch', $valid, str_repeat('b', 40), $asset, 1, 'git_sha_mismatch'],
    ['asset_mismatch', $valid, $sha, '188.5.5.6.84.999', 1, 'asset_version_mismatch'],
    ['invalid_sha', array_merge($valid, ['gitSha' => 'invalid']), $sha, $asset, 1, 'git_sha_invalid'],
    ['invalid_schema', array_merge($valid, ['schema' => 2]), $sha, $asset, 1, 'schema_invalid'],
    ['invalid_expected_sha', $valid, 'invalid', $asset, 2, 'exact SHA'],
    ['missing_manifest', null, $sha, $asset, 1, 'manifest_missing'],
    ['invalid_json', '{', $sha, $asset, 1, 'manifest_json_invalid'],
];
$failures = 0;
try {
    foreach ($cases as [$name, $data, $expectedSha, $expectedAsset, $expectedCode, $expectedMessage]) {
        if ($data === null) {
            @unlink($manifest);
        } else {
            file_put_contents($manifest, is_string($data) ? $data : json_encode($data, JSON_THROW_ON_ERROR));
        }
        [$code, $output] = runProvenancePreflight([
            '--manifest=' . $manifest,
            '--expected-sha=' . $expectedSha,
            '--expected-asset-version=' . $expectedAsset,
        ]);
        if ($code !== $expectedCode || strpos($output, $expectedMessage) === false) {
            fwrite(STDERR, "[FAIL] {$name}: exit={$code}, output={$output}\n");
            $failures++;
        } else {
            echo "[PASS] {$name}\n";
        }
    }
} finally {
    @unlink($manifest);
    @rmdir($directory);
}
if ($failures !== 0) {
    exit(1);
}
echo "DEPLOYMENT_PREFLIGHT_CLI: PASS " . count($cases) . " scenarios\n";
