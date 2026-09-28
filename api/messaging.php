<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/messaging_core.php';

$pdo = kareta_pdo();
if (!$pdo instanceof PDO) kareta_json(['ok'=>false,'error'=>'database_unavailable'],503);
$user = kareta_require_any_role(['client','master','sto','seller','admin','owner']);
$userId = (int)($user['id'] ?? 0);
if ($userId <= 0) kareta_json(['ok'=>false,'error'=>'invalid_session'],401);
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$action = trim((string)($_GET['action'] ?? ($method === 'GET' ? 'status' : '')));

$requireSameOrigin = static function(): void {
    $host = strtolower(preg_replace('/:\d+$/','',(string)($_SERVER['HTTP_HOST'] ?? '')) ?? '');
    foreach ([(string)($_SERVER['HTTP_ORIGIN'] ?? ''),(string)($_SERVER['HTTP_REFERER'] ?? '')] as $source) {
        if ($source === '') continue;
        $sourceHost = strtolower((string)(parse_url($source,PHP_URL_HOST) ?? ''));
        if ($host !== '' && $sourceHost !== '' && $sourceHost !== $host) kareta_json(['ok'=>false,'error'=>'cross_origin_request_denied'],403);
        break;
    }
};

try {
    if ($method === 'GET' && $action === 'status') {
        kareta_json(['ok'=>true,'messaging'=>kareta_messaging_status($pdo,$userId)]);
    }
    if ($method !== 'POST') kareta_json(['ok'=>false,'error'=>'method_not_allowed'],405);
    $requireSameOrigin();
    $body = kareta_read_json();
    if ($action === 'link.create') {
        $channel = strtolower(trim((string)($body['channel'] ?? '')));
        $link = kareta_messaging_create_link_token($pdo,$userId,$channel);
        kareta_log_audit($pdo,'messaging.link.create',['channel'=>$channel]);
        kareta_json(['ok'=>true,'link'=>$link,'messaging'=>kareta_messaging_status($pdo,$userId)]);
    }
    if ($action === 'unlink') {
        $channel = strtolower(trim((string)($body['channel'] ?? '')));
        if (!in_array($channel,['telegram','whatsapp'],true)) kareta_json(['ok'=>false,'error'=>'invalid_channel'],422);
        kareta_messaging_unlink($pdo,$userId,$channel);
        kareta_log_audit($pdo,'messaging.unlink',['channel'=>$channel]);
        kareta_json(['ok'=>true,'messaging'=>kareta_messaging_status($pdo,$userId)]);
    }
    if ($action === 'preferences.save') {
        $preferences = kareta_messaging_save_preferences($pdo,$userId,$body);
        kareta_log_audit($pdo,'messaging.preferences.save',['primaryChannel'=>$preferences['primaryChannel'] ?? 'kareta']);
        kareta_json(['ok'=>true,'preferences'=>$preferences,'messaging'=>kareta_messaging_status($pdo,$userId)]);
    }
    kareta_json(['ok'=>false,'error'=>'unknown_action'],404);
} catch (DomainException $e) {
    $code = $e->getMessage();
    $status = in_array($code,['provider_not_configured','channel_not_linked'],true) ? 409 : 422;
    kareta_json(['ok'=>false,'error'=>$code],$status);
} catch (InvalidArgumentException $e) {
    kareta_json(['ok'=>false,'error'=>$e->getMessage() ?: 'invalid_request'],422);
} catch (Throwable $e) {
    if (function_exists('kareta_log_error')) kareta_log_error('MESSAGING_API',$e->getMessage());
    kareta_json(['ok'=>false,'error'=>'messaging_unavailable'],503);
}
