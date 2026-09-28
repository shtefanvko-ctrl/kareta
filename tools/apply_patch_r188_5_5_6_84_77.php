<?php
declare(strict_types=1);

$root = dirname(__DIR__);
$expected = '188.5.5.6.84.76';
$target = '188.5.5.6.84.77';

function patchFile(string $path, callable $transform): void {
    if (!is_file($path)) {
        fwrite(STDERR, "[84.77] Missing file: {$path}\n");
        exit(2);
    }
    $before = file_get_contents($path);
    if ($before === false) {
        fwrite(STDERR, "[84.77] Cannot read: {$path}\n");
        exit(2);
    }
    $after = $transform($before);
    if (!is_string($after) || $after === '') {
        fwrite(STDERR, "[84.77] Invalid transform: {$path}\n");
        exit(2);
    }
    if ($after !== $before && file_put_contents($path, $after, LOCK_EX) === false) {
        fwrite(STDERR, "[84.77] Cannot write: {$path}\n");
        exit(2);
    }
}

$versionFile = $root . '/inc/asset_version.php';
$versionText = file_get_contents($versionFile) ?: '';
if (strpos($versionText, "'{$target}'") !== false) {
    echo "[84.77] Already applied.\n";
    exit(0);
}
if (strpos($versionText, "'{$expected}'") === false) {
    fwrite(STDERR, "[84.77] Refusing to bump unknown base. Expected {$expected}.\n");
    exit(3);
}

patchFile($versionFile, static function(string $text) use ($expected, $target): string {
    return str_replace("const KARETA_ASSET_VERSION = '{$expected}';", "const KARETA_ASSET_VERSION = '{$target}';", $text);
});

patchFile($root . '/sw.js', static function(string $text) use ($expected, $target): string {
    $count = 0;
    $text = preg_replace("/const\\s+RELEASE\\s*=\\s*['\"]" . preg_quote($expected, '/') . "['\"]\\s*;/", "const RELEASE = '{$target}';", $text, 1, $count) ?? $text;
    if ($count !== 1) {
        fwrite(STDERR, "[84.77] Service Worker release token {$expected} not found.\n");
        exit(3);
    }
    return $text;
});

echo "[84.77] Runtime/cache version bumped {$expected} -> {$target}.\n";
echo "[84.77] Tow Truck + Garage UI payload is ready.\n";
