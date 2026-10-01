<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "CLI only\n");
    exit(1);
}

$root = dirname(__DIR__);
require_once $root . '/inc/asset_version.php';
require_once $root . '/inc/deployment_provenance.php';

$output = kareta_provenance_manifest_path();
foreach (array_slice($argv, 1) as $arg) {
    if (str_starts_with($arg, '--output=')) $output = substr($arg, 9);
}

$firstEnv = static function(array $names): string {
    foreach ($names as $name) {
        $value = getenv($name);
        if ($value !== false && trim((string)$value) !== '') return trim((string)$value);
    }
    return '';
};

$manifest = [
    'schema' => 1,
    'gitSha' => $firstEnv(['KARETA_DEPLOY_GIT_SHA','GITHUB_SHA']),
    'gitRef' => $firstEnv(['KARETA_DEPLOY_GIT_REF','GITHUB_REF_NAME','GITHUB_REF']),
    'assetVersion' => defined('KARETA_ASSET_VERSION') ? KARETA_ASSET_VERSION : '',
    'builtAt' => $firstEnv(['KARETA_DEPLOY_BUILT_AT']) ?: gmdate(DATE_ATOM),
    'workflowRunId' => $firstEnv(['KARETA_DEPLOY_WORKFLOW_RUN_ID','GITHUB_RUN_ID']),
];

$validated = kareta_provenance_validate($manifest, (string)$manifest['assetVersion']);
if (!$validated['ok']) {
    fwrite(STDERR, "DEPLOYMENT_PROVENANCE_GENERATION_FAIL " . implode(',', $validated['errors']) . "\n");
    exit(2);
}

$dir = dirname($output);
if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
    fwrite(STDERR, "Cannot create manifest directory\n");
    exit(3);
}

$json = json_encode($validated['manifest'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
$tmp = $output . '.tmp.' . getmypid();
if (file_put_contents($tmp, $json, LOCK_EX) === false || !rename($tmp, $output)) {
    @unlink($tmp);
    fwrite(STDERR, "Cannot write deployment manifest\n");
    exit(4);
}

echo $json;
