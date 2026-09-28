<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/config.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
$length = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($length > 131072) { http_response_code(413); echo json_encode(['ok'=>false,'code'=>'PAYLOAD_TOO_LARGE']); exit; }
$origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
$host = preg_replace('/:\d+$/', '', (string)($_SERVER['HTTP_HOST'] ?? ''));
if ($origin !== '' && $host !== '' && parse_url($origin, PHP_URL_HOST) !== $host) { http_response_code(403); echo json_encode(['ok'=>false,'code'=>'ORIGIN_REJECTED']); exit; }
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok'=>false,'error'=>'method_not_allowed']);
    exit;
}
$raw = file_get_contents('php://input') ?: '';
$data = json_decode($raw, true);
if (!is_array($data)) $data = [];
$events = is_array($data['events'] ?? null) ? array_slice($data['events'], 0, 50) : [];
$dir = KARETA_LOG_ROOT;
if (!is_dir($dir)) @mkdir($dir, 0775, true);
$file = $dir . '/runtime_' . gmdate('Y-m-d') . '.jsonl';
$common = [
    'receivedAt'=>gmdate('c'),
    'ip'=>substr((string)($_SERVER['REMOTE_ADDR'] ?? ''),0,80),
    'userAgent'=>substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''),0,500),
    'sessionId'=>substr((string)($data['sessionId'] ?? ''),0,120),
    'version'=>substr((string)($data['version'] ?? ''),0,120),
    'url'=>substr((string)($data['url'] ?? ''),0,1200),
];
$lines = '';
foreach ($events as $event) {
    if (!is_array($event)) continue;
    $entry = $common + ['event'=>$event];
    $lines .= json_encode($entry, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES) . PHP_EOL;
}
$written = true;
if ($lines !== '') $written = @file_put_contents($file, $lines, FILE_APPEND|LOCK_EX) !== false;
if (!$written) {
    http_response_code(503);
    echo json_encode(['ok'=>false,'error'=>'runtime_log_write_failed','saved'=>0], JSON_UNESCAPED_UNICODE);
    exit;
}
echo json_encode(['ok'=>true,'saved'=>count($events)], JSON_UNESCAPED_UNICODE);
