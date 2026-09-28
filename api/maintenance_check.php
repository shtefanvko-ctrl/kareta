<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function kareta_maintenance_log_info(string $filename): array
{
    $dir = defined('KARETA_LOG_ROOT') ? KARETA_LOG_ROOT : dirname(__DIR__) . '/storage/logs';
    $path = $dir . '/' . $filename;
    return [
        'file' => $filename,
        'exists' => is_file($path),
        'size' => is_file($path) ? filesize($path) : 0,
        'writable' => is_file($path) ? is_writable($path) : is_writable($dir),
        'modified' => is_file($path) ? date(DATE_ATOM, filemtime($path) ?: time()) : null,
    ];
}

function kareta_maintenance_check(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        kareta_json(['ok' => false, 'error' => 'method_not_allowed'], 405);
    }
    if (!kareta_diagnostics_authorized()) kareta_json(['ok'=>false,'error'=>'diagnostics_authorization_required'],403);

    $root = dirname(__DIR__);
    $logDir = defined('KARETA_LOG_ROOT') ? KARETA_LOG_ROOT : $root . '/storage/logs';
    $rotated = glob($logDir . '/client_events.*.log') ?: [];
    $rateFiles = glob($logDir . '/client_event_rate_*.json') ?: [];

    $checks = [
        'logDirExists' => is_dir($logDir),
        'logDirWritable' => is_dir($logDir) && is_writable($logDir),
        'clientEventEndpoint' => is_file(__DIR__ . '/client_event.php'),
        'clientEventLogProtected' => is_file($root . '/storage/logs/.htaccess'),
        'rotationWithinLimit' => count($rotated) <= 5,
        'rateStateReasonable' => count($rateFiles) <= 500,
    ];

    $ok = !in_array(false, $checks, true);

    kareta_json([
        'ok' => $ok,
        'status' => $ok ? 'maintenance_ready' : 'maintenance_attention_required',
        'checks' => $checks,
        'logs' => [
            kareta_maintenance_log_info('client_events.log'),
            kareta_maintenance_log_info('php_errors.log'),
        ],
        'rotatedClientEventLogs' => count($rotated),
        'clientEventRateFiles' => count($rateFiles),
        'limits' => [
            'clientEventMaxBody' => 24000,
            'clientEventMaxLogSize' => 2097152,
            'clientEventKeepRotated' => 5,
            'clientEventRateLimit' => 45,
            'clientEventRateWindowSeconds' => 60,
        ],
        'time' => date(DATE_ATOM),
    ], $ok ? 200 : 503);
}

kareta_maintenance_check();
