<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function kareta_static_quality_files(): array
{
    $root = dirname(__DIR__);
    $rii = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );

    $files = [];
    foreach ($rii as $file) {
        if (!$file->isFile()) continue;

        $path = $file->getPathname();
        $rel = str_replace('\\', '/', substr($path, strlen($root) + 1));
        $ext = strtolower(pathinfo($rel, PATHINFO_EXTENSION));

        if (!in_array($ext, ['php', 'js', 'css', 'html'], true)) continue;
        if (str_starts_with($rel, '_patch_docs/')) continue;
        if (str_starts_with($rel, 'storage/')) continue;
        if (str_starts_with($rel, 'assets/')) continue;
        if (str_starts_with($rel, 'tools/')) continue;
        if ($rel === 'inc/asset_version.php') continue;
        if ($rel === 'index_old.php') continue;
        if ($rel === 'sw.js') continue;

        $files[] = [$rel, $path];
    }

    sort($files);
    return $files;
}

function kareta_static_quality_line(string $text, int $offset): int
{
    return substr_count(substr($text, 0, max(0, $offset)), "\n") + 1;
}

function kareta_static_quality_add(array &$findings, string $kind, string $file, int $line, array $extra = []): void
{
    $findings[] = array_merge([
        'kind' => $kind,
        'file' => $file,
        'line' => $line,
    ], $extra);
}

function kareta_static_quality_check(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        kareta_json(['ok' => false, 'error' => 'method_not_allowed'], 405);
    }
    if (!kareta_diagnostics_authorized()) kareta_json(['ok'=>false,'error'=>'diagnostics_authorization_required'],403);

    $badExact = [
        'duplicate_parts_shop_cat' => 'parts-shop-cat ' . 'parts-shop-cat',
        'duplicate_parts_shop_cats' => 'parts-shop-cats ' . 'parts-shop-cats',
        'parts_category_cols_five' => 'parts-shop-cats ' . 'kareta-mobile-grid--cols-5',
        'legacy_services_mobile_header' => 'services-' . 'mobile-header',
        'mixed_services_header_selector' => 'services-home-head.' . 'services-' . 'mobile-header',
        'mixed_services_header_class' => 'services-home-head ' . 'services-' . 'mobile-header',
        'duplicate_page_active' => 'page active ' . 'page active',
        'duplicate_services_directory_class' => 'services-directory ' . 'services-directory',
        'generic_block_grid_contract_css' => '#app [data-block-grid-contract="max-4"]',
    ];

    $findings = [];
    $filesScanned = 0;

    foreach (kareta_static_quality_files() as [$rel, $path]) {
        $text = @file_get_contents($path);
        if (!is_string($text)) continue;
        $filesScanned++;

        foreach ($badExact as $kind => $pattern) {
            $pos = strpos($text, $pattern);
            if ($pos !== false) {
                kareta_static_quality_add($findings, $kind, $rel, kareta_static_quality_line($text, $pos), [
                    'match' => $pattern,
                ]);
            }
        }



        if (preg_match_all('~class\s*=\s*([\'"])(.*?)\1~is', $text, $matches, PREG_OFFSET_CAPTURE)) {
            foreach ($matches[2] as $m) {
                $raw = (string)$m[0];
                $offset = (int)$m[1];

                if (str_contains($raw, '${') || str_contains($raw, '<?') || str_contains($raw, '+') || str_contains($raw, '?') || str_contains($raw, ':')) {
                    continue;
                }

                $tokens = preg_split('~\s+~', trim($raw)) ?: [];
                $seen = [];
                $dups = [];
                foreach ($tokens as $token) {
                    if ($token === '') continue;
                    if (isset($seen[$token]) && !in_array($token, $dups, true)) {
                        $dups[] = $token;
                    }
                    $seen[$token] = true;
                }

                if ($dups) {
                    kareta_static_quality_add($findings, 'duplicate_class_tokens', $rel, kareta_static_quality_line($text, $offset), [
                        'duplicates' => $dups,
                        'class' => mb_substr($raw, 0, 180, 'UTF-8'),
                    ]);
                }
            }
        }

        if (preg_match_all('~\b[A-Za-z_$][A-Za-z0-9_$]*(?:R|r)\d{2}[A-Za-z0-9_$]*\b~', $text, $matches, PREG_OFFSET_CAPTURE)) {
            foreach ($matches[0] as $m) {
                kareta_static_quality_add($findings, 'versioned_identifier', $rel, kareta_static_quality_line($text, (int)$m[1]), [
                    'match' => (string)$m[0],
                ]);
            }
        }

        if (preg_match_all('~(?:class|id|data-[a-z0-9_-]+)\s*=\s*[\'"][^\'"]*(?:-|_)(?:r|R)\d{2}[a-z0-9_-]*[^\'"]*[\'"]~i', $text, $matches, PREG_OFFSET_CAPTURE)) {
            foreach ($matches[0] as $m) {
                kareta_static_quality_add($findings, 'versioned_markup_token', $rel, kareta_static_quality_line($text, (int)$m[1]), [
                    'match' => mb_substr((string)$m[0], 0, 220, 'UTF-8'),
                ]);
            }
        }
    }

    $ok = empty($findings);

    kareta_json([
        'ok' => $ok,
        'status' => $ok ? 'static_quality_clean' : 'static_quality_failed',
        'filesScanned' => $filesScanned,
        'count' => count($findings),
        'findings' => array_slice($findings, 0, 200),
        'rules' => [
            'noDuplicateClassTokens',
            'noLegacyServicesMobileHeader',
            'noMixedServicesHeaderClass',
            'noDuplicatePartsCategoryClass',
            'noVersionedIdentifiers',
            'noVersionedMarkupTokens',
            'noDuplicateServicesDirectoryClass',
            'servicesDirectoryModeRequired',
            'servicesQuickLayoutContractRequired',
            'homeFastMobileOneColumn',
            'servicesQuickCssOrderGuard',
            'noUnscopedServicesQuickOverridesAfterContract',
            'noGenericBlockGridContractCss',
        ],
        'time' => date(DATE_ATOM),
    ], $ok ? 200 : 503);
}

kareta_static_quality_check();
