<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/request_logger.php';
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/identity/context_service.php';
require_once __DIR__ . '/identity/capability_service.php';
require_once __DIR__ . '/identity/auth_resolver.php';

$pdo = kareta_pdo();
if (!$pdo instanceof PDO) kareta_json(['ok'=>false,'error'=>'database_unavailable'],503);
try { $auth=(new KaretaAuthResolver($pdo))->resolve(true); } catch (DomainException $e) { kareta_json(['ok'=>false,'error'=>$e->getMessage()],$e->getMessage()==='session_identity_conflict'?409:401); }
$contexts = new KaretaIdentityContextService($pdo);
$contexts->resolveAccount($auth->legacyUser ?? []);
$account = $auth->account;
$engine = new KaretaCapabilityService($pdo,$contexts);
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$action = trim((string)($_GET['action'] ?? 'current'));
$accountId = $auth->accountId;

if ($method === 'GET' && $action === 'current') {
    kareta_json(['ok'=>true,'account'=>$account] + $engine->current($accountId) + ['stage'=>3]);
}
if ($method === 'GET' && $action === 'check') {
    $key = trim((string)($_GET['capability'] ?? ''));
    if ($key === '') kareta_json(['ok'=>false,'error'=>'capability_required'],422);
    $context = $contexts->currentContext($accountId);
    kareta_json(['ok'=>true,'capability'=>$key,'allowed'=>$engine->can($accountId,$key,(int)$context['id'],true),'currentContext'=>$context,'stage'=>3]);
}
kareta_json(['ok'=>false,'error'=>'not_found'],404);
