<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }
$root = dirname(__DIR__);
$target = '188.5.5.6.84.79';
$versionFile = $root . '/inc/asset_version.php';
$swFile = $root . '/sw.js';

function readRequired8479(string $path): string {
    if (!is_file($path)) { fwrite(STDERR, "[84.79] Missing file: {$path}\n"); exit(2); }
    $text = file_get_contents($path);
    if (!is_string($text) || $text === '') { fwrite(STDERR, "[84.79] Cannot read: {$path}\n"); exit(2); }
    return $text;
}
function releaseFromAsset8479(string $text): string {
    return preg_match("/KARETA_ASSET_VERSION\\s*=\\s*'([^']+)'/", $text, $m) ? (string)$m[1] : '';
}
function releaseFromSw8479(string $text): string {
    return preg_match("/const\\s+RELEASE\\s*=\\s*['\"]([^'\"]+)['\"]\\s*;/", $text, $m) ? (string)$m[1] : '';
}
function supportedBase8479(string $version): bool {
    if ($version === '') return false;
    if (!preg_match('/^188\\.5\\.5\\.6\\.84\\.(\\d+)$/', $version, $m)) return false;
    $rev = (int)$m[1];
    return $rev >= 76 && $rev <= 79;
}
function atomicPairWrite8479(array $writes): void {
    $temps = []; $backups = [];
    try {
        foreach ($writes as $path => $content) {
            $dir = dirname($path);
            $tmp = tempnam($dir, '.k8479_');
            if ($tmp === false) throw new RuntimeException("cannot create temp for {$path}");
            if (file_put_contents($tmp, $content, LOCK_EX) === false) throw new RuntimeException("cannot stage {$path}");
            $temps[$path] = $tmp;
        }
        // Preserve originals until both staged files are known-good.
        foreach ($writes as $path => $_content) {
            $backup = $path . '.k8479.rollback.' . getmypid();
            if (!copy($path, $backup)) throw new RuntimeException("cannot backup {$path}");
            $backups[$path] = $backup;
        }
        $committed = [];
        foreach ($writes as $path => $_content) {
            if (!rename($temps[$path], $path)) throw new RuntimeException("cannot commit {$path}");
            unset($temps[$path]); $committed[] = $path;
        }
        foreach ($backups as $backup) @unlink($backup);
    } catch (Throwable $error) {
        foreach ($temps as $tmp) @unlink($tmp);
        foreach ($backups as $path => $backup) {
            if (is_file($backup)) { @copy($backup, $path); @unlink($backup); }
        }
        fwrite(STDERR, "[84.79] Atomic version update rolled back: {$error->getMessage()}\n");
        exit(4);
    }
}

$assetText = readRequired8479($versionFile);
$swText = readRequired8479($swFile);
$assetVersion = releaseFromAsset8479($assetText);
$swVersion = releaseFromSw8479($swText);
if ($assetVersion === $target && $swVersion === $target) {
    echo "[84.79] Runtime/cache version already converged.\n";
    exit(0);
}
if (!supportedBase8479($assetVersion) || !supportedBase8479($swVersion)) {
    fwrite(STDERR, "[84.79] Refusing unknown base. asset={$assetVersion}; sw={$swVersion}\n");
    exit(3);
}
$newAsset = preg_replace("/KARETA_ASSET_VERSION\\s*=\\s*'[^']+';/", "KARETA_ASSET_VERSION = '{$target}';", $assetText, 1, $assetCount);
$newSw = preg_replace("/const\\s+RELEASE\\s*=\\s*['\"][^'\"]+['\"]\\s*;/", "const RELEASE = '{$target}';", $swText, 1, $swCount);
if (!is_string($newAsset) || !is_string($newSw) || $assetCount !== 1 || $swCount !== 1) {
    fwrite(STDERR, "[84.79] Release tokens could not be transformed safely.\n");
    exit(3);
}
atomicPairWrite8479([$versionFile => $newAsset, $swFile => $newSw]);
$verifyAsset = releaseFromAsset8479(readRequired8479($versionFile));
$verifySw = releaseFromSw8479(readRequired8479($swFile));
if ($verifyAsset !== $target || $verifySw !== $target) {
    fwrite(STDERR, "[84.79] Post-commit parity check failed.\n");
    exit(5);
}
echo "[84.79] Runtime/cache version converged atomically to {$target}.\n";
echo "[84.79] Recovery Merge payload may now be verified with tools/release_gate.php.\n";
