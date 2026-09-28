<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function kareta_accessibility_files(): array
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

        if (!in_array($ext, ['php', 'js', 'html'], true)) continue;
        if (str_starts_with($rel, '_patch_docs/')) continue;
        if (str_starts_with($rel, 'storage/')) continue;
        if (str_starts_with($rel, 'assets/')) continue;
        if (str_starts_with($rel, 'tools/')) continue;

        $files[] = [$rel, $path];
    }

    sort($files);
    return $files;
}

function kareta_accessibility_line(string $text, int $offset): int
{
    return substr_count(substr($text, 0, max(0, $offset)), "\n") + 1;
}

function kareta_accessibility_add(array &$findings, string $kind, string $file, int $line, array $extra = []): void
{
    $findings[] = array_merge([
        'kind' => $kind,
        'file' => $file,
        'line' => $line,
    ], $extra);
}

function kareta_accessibility_dynamic(string $raw): bool
{
    return str_contains($raw, '${')
        || str_contains($raw, '<?')
        || str_contains($raw, '+')
        || str_contains($raw, '?')
        || str_contains($raw, ':');
}

function kareta_accessibility_check(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        kareta_json(['ok' => false, 'error' => 'method_not_allowed'], 405);
    }
    if (!kareta_diagnostics_authorized()) kareta_json(['ok'=>false,'error'=>'diagnostics_authorization_required'],403);

    $findings = [];
    $filesScanned = 0;
    $ids = [];

    foreach (kareta_accessibility_files() as [$rel, $path]) {
        $text = @file_get_contents($path);
        if (!is_string($text)) continue;
        $filesScanned++;

        if (preg_match_all('~<img\b[^>]*>~is', $text, $matches, PREG_OFFSET_CAPTURE)) {
            foreach ($matches[0] as $m) {
                $tag = (string)$m[0];
                if (kareta_accessibility_dynamic($tag)) continue;
                if (!preg_match('~\salt\s*=~i', $tag)) {
                    kareta_accessibility_add($findings, 'image_missing_alt', $rel, kareta_accessibility_line($text, (int)$m[1]), [
                        'tag' => mb_substr($tag, 0, 180, 'UTF-8'),
                    ]);
                }
            }
        }

        if (preg_match_all('~<button\b([^>]*)>(.*?)</button>~is', $text, $matches, PREG_OFFSET_CAPTURE)) {
            foreach ($matches[0] as $index => $m) {
                $tag = (string)$m[0];
                $attrs = (string)$matches[1][$index][0];
                $body = trim(strip_tags((string)$matches[2][$index][0]));
                if (kareta_accessibility_dynamic($tag)) continue;
                if ($body === '' && !preg_match('~\s(aria-label|title)\s*=~i', $attrs)) {
                    kareta_accessibility_add($findings, 'button_missing_name', $rel, kareta_accessibility_line($text, (int)$m[1]), [
                        'tag' => mb_substr($tag, 0, 180, 'UTF-8'),
                    ]);
                }
                if (!preg_match('~\stype\s*=~i', $attrs)) {
                    kareta_accessibility_add($findings, 'button_missing_type', $rel, kareta_accessibility_line($text, (int)$m[1]), [
                        'tag' => mb_substr($tag, 0, 180, 'UTF-8'),
                    ]);
                }
            }
        }

        if (preg_match_all('~<(input|select|textarea)\b([^>]*)>~is', $text, $matches, PREG_OFFSET_CAPTURE)) {
            foreach ($matches[0] as $index => $m) {
                $tag = (string)$m[0];
                $attrs = (string)$matches[2][$index][0];
                if (kareta_accessibility_dynamic($tag)) continue;
                if (preg_match('~\stype\s*=\s*[\'"]?(hidden|submit|button|reset)[\'"]?~i', $attrs)) continue;
                if (!preg_match('~\s(aria-label|aria-labelledby|placeholder|title|id)\s*=~i', $attrs)) {
                    kareta_accessibility_add($findings, 'field_missing_accessible_hint', $rel, kareta_accessibility_line($text, (int)$m[1]), [
                        'tag' => mb_substr($tag, 0, 180, 'UTF-8'),
                    ]);
                }
            }
        }

        if (preg_match_all('~\sid\s*=\s*([\'"])([^\'"]+)\1~is', $text, $matches, PREG_OFFSET_CAPTURE)) {
            foreach ($matches[2] as $m) {
                $id = trim((string)$m[0]);
                if ($id === '' || kareta_accessibility_dynamic($id)) continue;
                $ids[$id][] = [$rel, kareta_accessibility_line($text, (int)$m[1])];
            }
        }
    }

    foreach ($ids as $id => $locations) {
        if (count($locations) <= 1) continue;
        foreach ($locations as [$rel, $line]) {
            kareta_accessibility_add($findings, 'duplicate_static_id', $rel, $line, [
                'id' => $id,
                'count' => count($locations),
            ]);
        }
    }

    $ok = empty($findings);

    kareta_json([
        'ok' => $ok,
        'status' => $ok ? 'accessibility_static_clean' : 'accessibility_static_failed',
        'filesScanned' => $filesScanned,
        'count' => count($findings),
        'findings' => array_slice($findings, 0, 200),
        'rules' => [
            'imagesHaveAlt',
            'buttonsHaveAccessibleName',
            'buttonsDeclareType',
            'fieldsHaveAccessibleHint',
            'noDuplicateStaticIds',
        ],
        'time' => date(DATE_ATOM),
    ], $ok ? 200 : 503);
}

kareta_accessibility_check();
