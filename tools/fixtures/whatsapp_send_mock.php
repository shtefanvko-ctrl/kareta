<?php
declare(strict_types=1);
// Local-only fake provider used by test_whatsapp_routing_db.php.
if (PHP_SAPI !== 'cli-server') { http_response_code(404); exit; }
if (($_SERVER['REMOTE_ADDR'] ?? '') !== '127.0.0.1') { http_response_code(403); exit; }
$log = getenv('KARETA_TEST_SEND_LOG');
if (!is_string($log) || $log === '') { http_response_code(500); exit; }
$request = ['method'=>$_SERVER['REQUEST_METHOD'], 'path'=>$_SERVER['REQUEST_URI'],
    'payload'=>json_decode((string)file_get_contents('php://input'), true)];
file_put_contents($log, json_encode($request) . "\n", FILE_APPEND | LOCK_EX);
header('Content-Type: application/json');
echo json_encode(['messages'=>[['id'=>'wamid.mock.sent']]]);
