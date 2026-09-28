<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "CLI only\n");
    exit(1);
}

$root = dirname(__DIR__);
$logDir = $root . '/storage/logs';
$backupDir = $root . '/storage/backups';

function keepLatestFiles(string $pattern, int $keep): int
{
    $files = glob($pattern) ?: [];
    rsort($files, SORT_STRING);
    $deleted = 0;
    foreach (array_slice($files, $keep) as $file) {
        if (is_file($file) && unlink($file)) $deleted++;
    }
    return $deleted;
}

$deleted = [
    'clientEventRateFiles' => keepLatestFiles($logDir . '/client_event_rate_*.json', 300),
    'clientEventRotatedLogs' => keepLatestFiles($logDir . '/client_events.*.log', 5),
    'backups' => keepLatestFiles($backupDir . '/kareta_backup_*.zip', 10),
];

echo json_encode(['ok' => true, 'deleted' => $deleted, 'time' => date(DATE_ATOM)], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL;
