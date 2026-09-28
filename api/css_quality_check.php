<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function kareta_css_quality_files(): array
{
    $root = dirname(__DIR__);
    $files = [];
    $rii = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($root . '/css', FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );

    foreach ($rii as $file) {
        if (!$file->isFile()) continue;
        $path = $file->getPathname();
        $rel = str_replace('\\', '/', substr($path, strlen($root) + 1));
        if (strtolower(pathinfo($rel, PATHINFO_EXTENSION)) !== 'css') continue;
        $files[] = [$rel, $path];
    }

    sort($files);
    return $files;
}

function kareta_css_quality_line(string $text, int $offset): int
{
    return substr_count(substr($text, 0, max(0, $offset)), "\n") + 1;
}

function kareta_css_quality_add(array &$findings, string $kind, string $file, int $line, array $extra = []): void
{
    $findings[] = array_merge([
        'kind' => $kind,
        'file' => $file,
        'line' => $line,
    ], $extra);
}


function kareta_css_quality_selector_menu_like(string $selector): bool
{
    return (bool)preg_match('~(nav|menu|tab|tabs|chip|chips|toolbar|action|actions|button|buttons|pager|pagination|bottom-nav|top-nav|filter|sort|search|cat|cats|category|categories|step|steps|counter|time|times)~i', $selector);
}

function kareta_css_quality_selector_block_like(string $selector): bool
{
    return (bool)preg_match('~(card|cards|grid|catalog|product|products|service|services|master|masters|news|order|orders|part|parts|store|inventory|tile|tiles|feed|garage|block|panel|list)~i', $selector);
}

function kareta_css_quality_rule_has_five_columns(string $body): bool
{
    return (bool)preg_match('~grid-template-columns\s*:\s*repeat\s*\(\s*5\s*,~i', $body)
        || (bool)preg_match('~--[a-z0-9_-]*(?:col|cols|columns)[a-z0-9_-]*\s*:\s*5\s*;~i', $body)
        || (bool)preg_match('~grid-template-columns\s*:\s*repeat\s*\(\s*var\s*\(\s*--[a-z0-9_-]+\s*,\s*5\s*\)~i', $body);
}


function kareta_css_quality_check(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        kareta_json(['ok' => false, 'error' => 'method_not_allowed'], 405);
    }
    if (!kareta_diagnostics_authorized()) kareta_json(['ok'=>false,'error'=>'diagnostics_authorization_required'],403);

    $findings = [];
    $filesScanned = 0;
    $totalImportant = 0;
    $totalBytes = 0;
    $selectorCounts = [];

    $forbidden = [
        'parts_cols_five_selector' => '.parts-shop-cats.' . 'kareta-mobile-grid--cols-5',
        'parts_cols_five_attr_selector' => '[data-parts-ref-cats="1"].' . 'kareta-mobile-grid--cols-5',
        'legacy_services_mobile_header_selector' => '.services-home-head.' . 'services-' . 'mobile-header',
    ];

    foreach (kareta_css_quality_files() as [$rel, $path]) {
        $text = @file_get_contents($path);
        if (!is_string($text)) continue;

        $filesScanned++;
        $totalBytes += strlen($text);

        $balance = 0;
        $minBalance = 0;
        $chars = preg_split('//u', $text, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        foreach ($chars as $ch) {
            if ($ch === '{') $balance++;
            if ($ch === '}') $balance--;
            if ($balance < $minBalance) $minBalance = $balance;
        }
        if ($balance !== 0 || $minBalance < 0) {
            kareta_css_quality_add($findings, 'css_brace_balance', $rel, 1, [
                'balance' => $balance,
                'minBalance' => $minBalance,
            ]);
        }

        foreach ($forbidden as $kind => $pattern) {
            $pos = strpos($text, $pattern);
            if ($pos !== false) {
                kareta_css_quality_add($findings, $kind, $rel, kareta_css_quality_line($text, $pos), [
                    'match' => $pattern,
                ]);
            }
        }

        if (preg_match_all('~!important\b~i', $text, $matches, PREG_OFFSET_CAPTURE)) {
            $count = count($matches[0]);
            $totalImportant += $count;
            if ($count > 260) {
                kareta_css_quality_add($findings, 'important_over_budget_file', $rel, 1, [
                    'count' => $count,
                    'budget' => 260,
                ]);
            }
        }

        if (preg_match_all('~(?:^|[}\n])\s*([^{}@][^{}]*?)\s*\{~s', $text, $matches, PREG_OFFSET_CAPTURE)) {
            foreach ($matches[1] as $m) {
                $selector = trim(preg_replace('~/\*.*?\*/~s', '', (string)$m[0]) ?? '');
                if ($selector === '' || str_contains($selector, '@')) continue;
                $selector = preg_replace('~\s+~', ' ', $selector) ?? $selector;
                if (strlen($selector) > 260) {
                    kareta_css_quality_add($findings, 'selector_too_long', $rel, kareta_css_quality_line($text, (int)$m[1]), [
                        'length' => strlen($selector),
                        'selector' => mb_substr($selector, 0, 240, 'UTF-8'),
                    ]);
                }
                $key = $selector;
                $selectorCounts[$key][] = [$rel, kareta_css_quality_line($text, (int)$m[1])];
                $ruleStart = strpos($text, '{', (int)$m[1]);
                $ruleEnd = $ruleStart !== false ? strpos($text, '}', $ruleStart) : false;
                $body = ($ruleStart !== false && $ruleEnd !== false) ? substr($text, $ruleStart + 1, $ruleEnd - $ruleStart - 1) : '';
                if ($body !== '' && kareta_css_quality_rule_has_five_columns($body) && kareta_css_quality_selector_block_like($selector) && !kareta_css_quality_selector_menu_like($selector)) {
                    kareta_css_quality_add($findings, 'block_grid_five_columns', $rel, kareta_css_quality_line($text, (int)$m[1]), [
                        'selector' => mb_substr($selector, 0, 240, 'UTF-8'),
                    ]);
                }

            }
        }

        if (preg_match_all('~(?:\.|#|--|data-[a-z0-9_-]*=)[A-Za-z0-9_-]*(?:-|_)(?:r|R)\d{2}[A-Za-z0-9_-]*~', $text, $matches, PREG_OFFSET_CAPTURE)) {
            foreach ($matches[0] as $m) {
                kareta_css_quality_add($findings, 'versioned_css_token', $rel, kareta_css_quality_line($text, (int)$m[1]), [
                    'match' => (string)$m[0],
                ]);
            }
        }
    }

    $duplicateSelectors = [];
    foreach ($selectorCounts as $selector => $locations) {
        if (count($locations) <= 3) continue;
        $duplicateSelectors[] = [
            'selector' => mb_substr($selector, 0, 220, 'UTF-8'),
            'count' => count($locations),
            'locations' => array_slice(array_map(static fn($item) => ['file' => $item[0], 'line' => $item[1]], $locations), 0, 8),
        ];
    }

    usort($duplicateSelectors, static fn($a, $b) => ($b['count'] <=> $a['count']));

    if (count($duplicateSelectors) > 80) {
        kareta_css_quality_add($findings, 'duplicate_selector_over_budget', 'css', 1, [
            'count' => count($duplicateSelectors),
            'budget' => 80,
            'top' => array_slice($duplicateSelectors, 0, 20),
        ]);
    }

    if ($totalImportant > 520) {
        kareta_css_quality_add($findings, 'important_over_budget_total', 'css', 1, [
            'count' => $totalImportant,
            'budget' => 520,
        ]);
    }

    $ok = empty($findings);

    kareta_json([
        'ok' => $ok,
        'status' => $ok ? 'css_quality_clean' : 'css_quality_failed',
        'filesScanned' => $filesScanned,
        'totalBytes' => $totalBytes,
        'totalImportant' => $totalImportant,
        'duplicateSelectorGroups' => count($duplicateSelectors),
        'duplicateSelectorsTop' => array_slice($duplicateSelectors, 0, 20),
        'count' => count($findings),
        'findings' => array_slice($findings, 0, 200),
        'rules' => [
            'braceBalance',
            'noForbiddenPartsFiveColumnSelectors',
            'blockGridMaxFourColumns',
            'noLegacyServicesMobileHeaderSelector',
            'importantBudget',
            'duplicateSelectorBudget',
            'noVersionedCssTokens',
            'selectorLengthBudget',
        ],
        'time' => date(DATE_ATOM),
    ], $ok ? 200 : 503);
}

kareta_css_quality_check();
