<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/config.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok'=>false,'code'=>'METHOD_NOT_ALLOWED'], JSON_UNESCAPED_UNICODE);
    exit;
}
$length = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($length > 32768) {
    http_response_code(413);
    echo json_encode(['ok'=>false,'code'=>'PAYLOAD_TOO_LARGE'], JSON_UNESCAPED_UNICODE);
    exit;
}
$origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
$host = (string)($_SERVER['HTTP_HOST'] ?? '');
if ($origin !== '' && $host !== '' && parse_url($origin, PHP_URL_HOST) !== preg_replace('/:\d+$/', '', $host)) {
    http_response_code(403);
    echo json_encode(['ok'=>false,'code'=>'ORIGIN_REJECTED'], JSON_UNESCAPED_UNICODE);
    exit;
}
$ip = substr((string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 0, 80);
$rateDir = KARETA_STORAGE_ROOT . '/runtime';
if (!is_dir($rateDir)) @mkdir($rateDir, 0775, true);
$bucket = $rateDir . '/client_error_' . hash('sha256', $ip) . '.rate';
$now = time(); $state = ['start'=>$now,'count'=>0];
if (is_file($bucket)) {
    $loaded = json_decode((string)@file_get_contents($bucket), true);
    if (is_array($loaded)) $state = $loaded + $state;
}
if (($now - (int)$state['start']) >= 60) $state = ['start'=>$now,'count'=>0];
$state['count'] = (int)$state['count'] + 1;
@file_put_contents($bucket, json_encode($state), LOCK_EX);
if ($state['count'] > 30) {
    http_response_code(429);
    echo json_encode(['ok'=>false,'code'=>'RATE_LIMITED'], JSON_UNESCAPED_UNICODE);
    exit;
}
$raw = file_get_contents('php://input') ?: '';
$data = json_decode($raw, true);
if (!is_array($data)) $data = [];
$clean = static function ($value, int $max): string {
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', (string)$value) ?? '';
    return mb_substr($value, 0, $max, 'UTF-8');
};
$entry = [
    'time'=>gmdate('c'), 'ip'=>$ip,
    'userAgent'=>$clean($_SERVER['HTTP_USER_AGENT'] ?? '', 500),
    'url'=>$clean($data['url'] ?? '', 1000),
    'message'=>$clean($data['message'] ?? '', 2000),
    'source'=>$clean($data['source'] ?? '', 1000),
    'line'=>(int)($data['line'] ?? 0), 'column'=>(int)($data['column'] ?? 0),
    'stack'=>$clean($data['stack'] ?? '', 8000),
    'role'=>$clean($data['role'] ?? '', 50), 'version'=>$clean($data['version'] ?? '', 100),
    'errorCode'=>$clean($data['errorCode'] ?? '', 80),
    'context'=>$clean($data['context'] ?? '', 120),
];
$dir = KARETA_LOG_ROOT;
if (!is_dir($dir)) @mkdir($dir, 0775, true);
$written = @file_put_contents($dir . '/client_errors.log', json_encode($entry, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES) . PHP_EOL, FILE_APPEND|LOCK_EX);
if ($written === false) { http_response_code(503); echo json_encode(['ok'=>false,'code'=>'LOG_WRITE_FAILED']); exit; }
echo json_encode(['ok'=>true], JSON_UNESCAPED_UNICODE);
