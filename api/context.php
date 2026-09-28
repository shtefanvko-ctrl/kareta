<?php
declare(strict_types=1);
ini_set('display_errors','0');
ini_set('html_errors','0');
header('Content-Type: application/json; charset=utf-8');

require_once dirname(__DIR__) . '/inc/request_logger.php';
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/identity/context_service.php';
require_once __DIR__ . '/identity/capability_service.php';
require_once __DIR__ . '/identity/auth_resolver.php';

$pdo = kareta_pdo();
if (!$pdo instanceof PDO) kareta_json(['ok'=>false,'error'=>'database_unavailable'],503);
try { $auth=(new KaretaAuthResolver($pdo))->resolve(true); } catch (DomainException $e) { kareta_json(['ok'=>false,'error'=>$e->getMessage()],$e->getMessage()==='session_identity_conflict'?409:401); }
$service = new KaretaIdentityContextService($pdo);
$service->resolveAccount($auth->legacyUser ?? []);
$account = $auth->account;

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$action = trim((string)($_GET['action'] ?? ''));
if ($action === '') { $path = trim((string)($_SERVER['PATH_INFO'] ?? ''), '/'); $action = $path !== '' ? $path : 'current'; }
$accountId = $auth->accountId;
$capabilityService = new KaretaCapabilityService($pdo, $service);
$respond = static function(array $payload) use ($service,$accountId): void { kareta_json($payload + ['sessionContext'=>$service->sessionContextMeta($accountId),'stage'=>6]); };

if ($method === 'GET' && $action === 'list') {
    $contexts=$service->listContexts($accountId);$current=$service->currentContext($accountId);$effective=$capabilityService->effective($accountId,(int)$current['id']);
    $respond(['ok'=>true,'account'=>$account,'contexts'=>$contexts,'accountTypes'=>$service->listAccountTypes($accountId,$contexts),'currentContext'=>$current,'capabilities'=>$effective['allowed'],'deniedCapabilities'=>$effective['denied']]);
}
if ($method === 'GET' && $action === 'current') {
    $current=$service->currentContext($accountId);$effective=$capabilityService->effective($accountId,(int)$current['id']);
    $respond(['ok'=>true,'account'=>$account,'currentContext'=>$current,'capabilities'=>$effective['allowed'],'deniedCapabilities'=>$effective['denied']]);
}
if ($method === 'POST' && $action === 'select') {
    $body=kareta_read_json();$contextId=(int)($body['contextId']??0);$contextKey=trim((string)($body['contextKey']??''));
    if($contextId<=0&&$contextKey==='')kareta_json(['ok'=>false,'error'=>'context_id_or_key_required'],422);
    try{$selected=$contextId>0?$service->selectContext($accountId,$contextId):$service->selectContextByKey($accountId,$contextKey);}catch(DomainException $e){kareta_json(['ok'=>false,'error'=>$e->getMessage()],403);}
    $effective=$capabilityService->effective($accountId,(int)$selected['id']);
    $respond(['ok'=>true,'account'=>$account,'currentContext'=>$selected,'capabilities'=>$effective['allowed'],'deniedCapabilities'=>$effective['denied'],'contextChanged'=>true]);
}
if ($method === 'POST' && $action === 'request-type') {
    $body=kareta_read_json();$role=strtolower(trim((string)($body['role']??'')));$profile=is_array($body['profile']??null)?$body['profile']:[];
    $approvalMode=$service->accountTypeApprovalMode();
    try{$request=$service->requestAccountType($accountId,$role,$profile);}catch(InvalidArgumentException $e){kareta_json(['ok'=>false,'error'=>$e->getMessage()],422);}catch(RuntimeException $e){kareta_json(['ok'=>false,'error'=>$e->getMessage()],409);}
    $contexts=$service->listContexts($accountId);$current=$service->currentContext($accountId);$effective=$capabilityService->effective($accountId,(int)$current['id']);
    $autoApproved=(bool)($request['autoApproved']??false);
    try{if(function_exists('kareta_log_audit'))kareta_log_audit($pdo,'account_type.request',['accountId'=>$accountId,'role'=>$role,'created'=>(bool)($request['created']??false),'approvalMode'=>$approvalMode,'autoApproved'=>$autoApproved]);}catch(Throwable $_error){}
    $respond(['ok'=>true,'account'=>$account,'contexts'=>$contexts,'accountTypes'=>$service->listAccountTypes($accountId,$contexts),'currentContext'=>$current,'capabilities'=>$effective['allowed'],'deniedCapabilities'=>$effective['denied'],'approvalMode'=>$approvalMode,'autoApproved'=>$autoApproved,'targetContextId'=>$request['targetContextId']??null,'targetContextKey'=>$request['targetContextKey']??'','request'=>$request]);
}
kareta_json(['ok'=>false,'error'=>'not_found'],404);
