<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

const KARETA_CLIENT_EVENT_MAX_BODY = 24000;
const KARETA_CLIENT_EVENT_MAX_LOG_SIZE = 2097152;
const KARETA_CLIENT_EVENT_KEEP_ROTATED = 5;
const KARETA_CLIENT_EVENT_RATE_LIMIT = 45;
const KARETA_CLIENT_EVENT_RATE_WINDOW = 60;

function kareta_client_event_string($value, int $max = 500): string
{
    $text = is_scalar($value) ? (string)$value : '';
    $text = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]+/u', ' ', $text) ?? '');
    $text = preg_replace('/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/iu', '[email]', $text) ?? $text;
    $text = preg_replace('/(?:\+?\d[\s\-()]*){9,}/u', '[phone]', $text) ?? $text;
    $text = preg_replace('/\b(password|passwd|token|secret|authorization|bearer)\s*[:=]\s*[^\s,;]+/iu', '$1=[hidden]', $text) ?? $text;
    if (function_exists('mb_substr')) return mb_substr($text, 0, $max, 'UTF-8');
    return substr($text, 0, $max);
}

function kareta_client_event_allowed_type(string $type): bool
{
    return in_array($type, [
        'runtime_error',
        'unhandled_rejection',
        'release_acceptance',
        'visual_regression',
        'design_quality',
        'manual_report',
        'performance_report',
    ], true);
}

function kareta_client_event_log_dir(): string
{
    return defined('KARETA_LOG_ROOT') ? KARETA_LOG_ROOT : dirname(__DIR__) . '/storage/logs';
}

function kareta_client_event_rotate(string $file): void
{
    if (!is_file($file) || filesize($file) < KARETA_CLIENT_EVENT_MAX_LOG_SIZE) return;

    $dir = dirname($file);
    $rotated = $dir . '/client_events.' . date('Ymd_His') . '.log';
    @rename($file, $rotated);

    $files = glob($dir . '/client_events.*.log') ?: [];
    rsort($files, SORT_STRING);
    foreach (array_slice($files, KARETA_CLIENT_EVENT_KEEP_ROTATED) as $old) {
        @unlink($old);
    }
}

function kareta_client_event_rate_key(): string
{
    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? '');
    $ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
    return hash('sha256', $ip . '|' . substr($ua, 0, 120) . '|client-event-rate');
}

function kareta_client_event_rate_allowed(): bool
{
    $dir = kareta_client_event_log_dir();
    if (!is_dir($dir)) @mkdir($dir, 0775, true);

    $key = kareta_client_event_rate_key();
    $file = $dir . '/client_event_rate_' . $key . '.json';
    $now = time();
    $state = ['window' => $now, 'count' => 0];

    if (is_file($file)) {
        $raw = @file_get_contents($file);
        $decoded = is_string($raw) ? json_decode($raw, true) : null;
        if (is_array($decoded)) $state = array_merge($state, $decoded);
    }

    $window = (int)($state['window'] ?? $now);
    $count = (int)($state['count'] ?? 0);

    if (($now - $window) >= KARETA_CLIENT_EVENT_RATE_WINDOW) {
        $window = $now;
        $count = 0;
    }

    $count++;
    @file_put_contents($file, json_encode(['window' => $window, 'count' => $count], JSON_UNESCAPED_SLASHES), LOCK_EX);

    return $count <= KARETA_CLIENT_EVENT_RATE_LIMIT;
}

function kareta_client_event_log(array $event): void
{
    $dir = kareta_client_event_log_dir();
    if (!is_dir($dir)) @mkdir($dir, 0775, true);

    $file = $dir . '/client_events.log';
    kareta_client_event_rotate($file);

    $line = json_encode($event, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($line) || $line === '') return;

    @file_put_contents($file, $line . PHP_EOL, FILE_APPEND | LOCK_EX);
}

function kareta_client_event_handle(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        kareta_json(['ok' => false, 'error' => 'method_not_allowed'], 405);
    }

    $contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($contentLength > KARETA_CLIENT_EVENT_MAX_BODY) {
        kareta_json(['ok' => false, 'error' => 'payload_too_large'], 413);
    }

    if (!kareta_client_event_rate_allowed()) {
        kareta_json(['ok' => false, 'error' => 'rate_limited'], 429);
    }

    $body = kareta_read_json();
    $type = kareta_client_event_string($body['type'] ?? '', 80);
    if (!kareta_client_event_allowed_type($type)) {
        kareta_json(['ok' => false, 'error' => 'bad_event_type'], 400);
    }

    $payload = is_array($body['payload'] ?? null) ? $body['payload'] : [];
    $sessionUser = function_exists('kareta_session_user') ? (kareta_session_user() ?: []) : [];

    $event = [
        'time' => date(DATE_ATOM),
        'type' => $type,
        'route' => kareta_client_event_string($body['route'] ?? '', 160),
        'url' => kareta_client_event_string($body['url'] ?? '', 240),
        'userAgent' => kareta_client_event_string($_SERVER['HTTP_USER_AGENT'] ?? '', 240),
        'ipHash' => hash('sha256', (string)($_SERVER['REMOTE_ADDR'] ?? '') . '|kareta-client-event'),
        'user' => [
            'id' => kareta_client_event_string($sessionUser['id'] ?? '', 80),
            'role' => kareta_client_event_string($sessionUser['role'] ?? 'guest', 40),
        ],
        'payload' => [
            'message' => kareta_client_event_string($payload['message'] ?? '', 700),
            'source' => kareta_client_event_string($payload['source'] ?? '', 260),
            'line' => (int)($payload['line'] ?? 0),
            'col' => (int)($payload['col'] ?? 0),
            'name' => kareta_client_event_string($payload['name'] ?? '', 120),
            'stack' => kareta_client_event_string($payload['stack'] ?? '', 1200),
            'checks' => is_array($payload['checks'] ?? null) ? array_slice($payload['checks'], 0, 20, true) : null,
            'failed' => is_array($payload['failed'] ?? null) ? array_slice($payload['failed'], 0, 20) : null,
        ],
    ];

    kareta_client_event_log($event);
    kareta_json(['ok' => true]);
}

kareta_client_event_handle();
