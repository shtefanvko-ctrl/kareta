<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/messaging_core.php';

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$cfg = kareta_messaging_config()['whatsapp'] ?? [];
if ($method === 'GET') {
    $mode=(string)($_GET['hub_mode'] ?? $_GET['hub.mode'] ?? '');
    $token=(string)($_GET['hub_verify_token'] ?? $_GET['hub.verify_token'] ?? '');
    $challenge=(string)($_GET['hub_challenge'] ?? $_GET['hub.challenge'] ?? '');
    $expected=(string)($cfg['verify_token'] ?? '');
    if ($mode==='subscribe' && $expected!=='' && $token!=='' && hash_equals($expected,$token)) {
        header('Content-Type: text/plain; charset=utf-8'); echo $challenge; exit;
    }
    kareta_json(['ok'=>false,'error'=>'verification_failed'],403);
}
if ($method !== 'POST') kareta_json(['ok'=>false,'error'=>'method_not_allowed'],405);
if (!kareta_messaging_provider_configured('whatsapp')) kareta_json(['ok'=>false,'error'=>'provider_not_configured'],503);
$raw = (string)file_get_contents('php://input');
$appSecret=(string)($cfg['app_secret'] ?? '');
$signature=(string)($_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '');
$expectedSignature='sha256='.hash_hmac('sha256',$raw,$appSecret);
if ($appSecret==='' || $signature==='' || !hash_equals($expectedSignature,$signature)) kareta_json(['ok'=>false,'error'=>'invalid_signature'],403);
$payload=json_decode($raw,true);if(!is_array($payload))kareta_json(['ok'=>true]);
$pdo=kareta_pdo();if(!$pdo instanceof PDO)kareta_json(['ok'=>false,'error'=>'database_unavailable'],503);

try {
    $events=kareta_messaging_whatsapp_events($payload,(string)($cfg['phone_number_id']??''));
    foreach ($events as $event) {
        // Commit ownership even if storing the inbound message later fails.
        kareta_messaging_whatsapp_observe($pdo,$event);
    }
    foreach ($events as $event) {
        kareta_messaging_whatsapp_process_message($pdo,$event);
    }
} catch(Throwable $e) {
    if(function_exists('kareta_log_error'))kareta_log_error('WHATSAPP_WEBHOOK',$e->getMessage());
    kareta_json(['ok'=>false,'error'=>'processing_unavailable'],503);
}
kareta_json(['ok'=>true]);
