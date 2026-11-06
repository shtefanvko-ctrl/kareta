<?php
declare(strict_types=1);
ini_set('display_errors','0');
require_once dirname(__DIR__).'/inc/request_logger.php';
require_once __DIR__.'/bootstrap.php';
require_once __DIR__.'/sto_claim_service.php';

$pdo=kareta_pdo();
if (!$pdo instanceof PDO) kareta_json(['ok'=>false,'error'=>'database_unavailable'],503);
$method=strtoupper((string)($_SERVER['REQUEST_METHOD']??'GET'));
$action=ksto_text($_GET['action']??'',40);

try {
    if ($method==='GET' && $action==='list') {
        kareta_json(['ok'=>true,'data'=>['unclaimedStos'=>ksto_public_list($pdo,$_GET)]]);
    }
    if ($method==='GET' && $action==='mine') {
        $actor=ksto_actor($pdo);
        kareta_json(['ok'=>true,'data'=>['claims'=>ksto_mine($pdo,$actor)]]);
    }
    if ($method==='GET' && $action==='reviewQueue') {
        $actor=ksto_actor($pdo,true);
        kareta_json(['ok'=>true,'data'=>['claims'=>ksto_review_queue($pdo,$actor)]]);
    }
    if ($method==='POST' && $action==='submit') {
        // Combined with same-origin checks in bootstrap, the custom header denies
        // ordinary CSRF forms and prevents simple cross-origin browser requests.
        $contentType=strtolower((string)($_SERVER['CONTENT_TYPE']??''));
        if (!str_starts_with($contentType,'application/json')
            || ($_SERVER['HTTP_X_KARETA_CLAIM_REQUEST']??'')!=='1') {
            kareta_json(['ok'=>false,'error'=>'claim_request_header_required'],403);
        }
        $body=kareta_read_json();
        $actor=ksto_actor($pdo);
        kareta_json(['ok'=>true,'data'=>ksto_request_claim($pdo,$actor,$body)]);
    }
    if ($method==='POST' && $action==='review') {
        $contentType=strtolower((string)($_SERVER['CONTENT_TYPE']??''));
        if (!str_starts_with($contentType,'application/json')
            || ($_SERVER['HTTP_X_KARETA_CLAIM_REQUEST']??'')!=='1') {
            kareta_json(['ok'=>false,'error'=>'claim_request_header_required'],403);
        }
        $actor=ksto_actor($pdo,true);
        $body=kareta_read_json();
        kareta_json(['ok'=>true,'data'=>ksto_review($pdo,$actor,$body)]);
    }
    if ($method==='POST' && $action==='saveDraft') {
        $contentType=strtolower((string)($_SERVER['CONTENT_TYPE']??''));
        if (!str_starts_with($contentType,'application/json')
            || ($_SERVER['HTTP_X_KARETA_CLAIM_REQUEST']??'')!=='1') {
            kareta_json(['ok'=>false,'error'=>'claim_request_header_required'],403);
        }
        $actor=ksto_actor($pdo);
        $body=kareta_read_json();
        kareta_json(['ok'=>true,'data'=>ksto_save_own_draft($pdo,$actor,$body)]);
    }
    if ($method==='POST' && $action==='activate') {
        $contentType=strtolower((string)($_SERVER['CONTENT_TYPE']??''));
        if (!str_starts_with($contentType,'application/json')
            || ($_SERVER['HTTP_X_KARETA_CLAIM_REQUEST']??'')!=='1') {
            kareta_json(['ok'=>false,'error'=>'claim_request_header_required'],403);
        }
        $actor=ksto_actor($pdo);
        $body=kareta_read_json();
        kareta_json(['ok'=>true,'data'=>ksto_activate($pdo,$actor,$body)]);
    }
    kareta_json(['ok'=>false,'error'=>'action_not_found'],404);
} catch (DomainException $e) {
    $code=$e->getMessage();
    $status=match($code) {
        'session_required','active_account_required'=>401,
        'admin_required','identity_session_required','self_approval_denied',
        'activation_not_authorized','draft_not_authorized','claim_request_header_required'=>403,
        'claim_not_found','invalid_candidate'=>404,
        'claim_schema_unavailable'=>503,
        'claim_daily_limit','claim_retry_cooldown'=>429,
        'claim_state_changed','candidate_not_claimable','activation_state_changed',
        'existing_sto_merge_review_required','already_approved'=>409,
        default=>422,
    };
    kareta_json(['ok'=>false,'error'=>$code],$status);
} catch (Throwable $e) {
    kareta_log_error('STO_CLAIM_RUNTIME',$e->getMessage());
    kareta_json(['ok'=>false,'error'=>'sto_claim_unavailable'],503);
}
