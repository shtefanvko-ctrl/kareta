<?php
declare(strict_types=1);
ini_set('display_errors','0');
ini_set('html_errors','0');
header('Content-Type: application/json; charset=utf-8');

require_once dirname(__DIR__).'/inc/request_logger.php';
require_once __DIR__.'/bootstrap.php';
require_once __DIR__.'/identity/account_service.php';
require_once __DIR__.'/identity/profile_service.php';
require_once __DIR__.'/identity/session_service.php';
require_once __DIR__.'/identity/challenge_service.php';
require_once __DIR__.'/identity/context_service.php';
require_once __DIR__.'/identity/capability_service.php';
require_once __DIR__.'/identity/auth_resolver.php';
$pdo=kareta_pdo(); if(!$pdo instanceof PDO)kareta_json(['ok'=>false,'error'=>'database_unavailable'],503);
$method=strtoupper((string)($_SERVER['REQUEST_METHOD']??'GET')); $body=$method==='POST'?kareta_read_json():[]; $action=(string)($body['action']??($_GET['action']??'current'));
$sessions=new KaretaSessionService($pdo);
header('X-Kareta-Identity-Endpoint: identity_session.php');
if($method==='GET'&&$action==='current'){
  $row=$sessions->current(false); if(!$row)kareta_json(['ok'=>true,'authenticated'=>false,'session'=>null,'stage'=>12]);
  $ctx=new KaretaIdentityContextService($pdo);
  // Bind ContextService to the same identity cookie/session before resolving the current
  // context. Otherwise a fresh tab/page could fall back to the PHP-session context and
  // silently reset a Master/STO/Seller back to Personal on resume.
  $ctx->resolveAccount([]);
  $account=['id'=>(int)$row['account_id'],'phone'=>(string)$row['phone'],'personId'=>(int)$row['person_id'],'fullname'=>(string)$row['fullname']];
  $accountId=(int)$row['account_id'];
  $contexts=$ctx->listContexts($accountId);
  $current=$ctx->currentContext($accountId);
  $caps=(new KaretaCapabilityService($pdo,$ctx))->effective($accountId,(int)$current['id']);
  kareta_json(['ok'=>true,'authenticated'=>true,'account'=>$account,'session'=>['id'=>(int)$row['id'],'expiresAt'=>$row['expires_at'],'absoluteExpiresAt'=>$row['absolute_expires_at']??$row['expires_at'],'idleExpiresAt'=>$row['idle_expires_at']??$row['expires_at'],'rotated'=>is_array($row['_rotation']??null)],'contexts'=>$contexts,'accountTypes'=>$ctx->listAccountTypes($accountId,$contexts),'currentContext'=>$current,'capabilities'=>$caps['allowed'],'deniedCapabilities'=>$caps['denied'],'stage'=>12]);
}
if($method==='POST'&&$action==='requestCode'){
  try{$result=(new KaretaChallengeService($pdo))->create((string)($body['phone']??'')); kareta_json(['ok'=>true]+$result+['stage'=>12]);}
  catch(InvalidArgumentException $e){kareta_json(['ok'=>false,'error'=>$e->getMessage()],422);}
  catch(DomainException $e){kareta_json(kareta_challenge_error_payload($e),$e->getMessage()==='challenge_rate_limited'?429:503);}
}
if($method==='POST'&&$action==='verifyCode'){
  try{
    $challenge=(new KaretaChallengeService($pdo))->verify((string)($body['challengeKey']??''),(string)($body['code']??''));
    $legacyUser=$pdo->prepare("SELECT id,active FROM users WHERE phone=? LIMIT 1");
    $legacyUser->execute([(string)$challenge['phone']]);
    $legacyState=$legacyUser->fetch(PDO::FETCH_ASSOC);
    if($legacyState && (int)($legacyState['active']??0)!==1) throw new DomainException('account_not_active');
    session_regenerate_id(true);
    $account=(new KaretaAccountService($pdo))->ensure((string)$challenge['phone'],trim((string)($body['fullname']??'')));
    $profile=(new KaretaProfileService($pdo))->ensureClient((int)$account['personId']);
    $ctx=new KaretaIdentityContextService($pdo); $current=$ctx->currentContext((int)$account['id']);
    $session=$sessions->create((int)$account['id'],(int)$current['id']);
    $pdo->prepare("INSERT INTO identity_session_audit(account_id,auth_session_id,challenge_id,event_type,request_id,payload_json) VALUES(?,?,?,?,?,JSON_OBJECT('profileId',?))")->execute([(int)$account['id'],(int)$session['id'],(int)$challenge['id'],'session.created',defined('KARETA_REQUEST_ID')?KARETA_REQUEST_ID:null,(int)($profile['id']??0)]);
    $caps=(new KaretaCapabilityService($pdo,$ctx))->effective((int)$account['id'],(int)$current['id']);
    kareta_json(['ok'=>true,'authenticated'=>true,'account'=>$account,'profile'=>['id'=>(int)($profile['id']??0),'type'=>'client'],'session'=>$session,'currentContext'=>$current,'capabilities'=>$caps['allowed'],'stage'=>12]);
  }catch(DomainException|InvalidArgumentException $e){kareta_json(['ok'=>false,'error'=>$e->getMessage()],422);}
}
if($method==='POST'&&$action==='rotate'){ $rotated=$sessions->rotateCurrent('manual'); if(!$rotated)kareta_json(['ok'=>false,'error'=>'session_not_rotatable'],401); $pdo->prepare("INSERT INTO identity_session_audit(account_id,auth_session_id,event_type,request_id,payload_json) VALUES(?,?,?,?,JSON_OBJECT('rotatedFromSessionId',?,'graceUntil',?))")->execute([(int)$rotated['accountId'],(int)$rotated['id'],'session.rotated',defined('KARETA_REQUEST_ID')?KARETA_REQUEST_ID:null,(int)$rotated['rotatedFromSessionId'],(string)$rotated['graceUntil']]); kareta_json(['ok'=>true,'session'=>$rotated,'stage'=>12]); }
if($method==='POST'&&$action==='logout'){ $result=(new KaretaAuthResolver($pdo))->logoutAll(); kareta_json(['ok'=>true,'loggedOut'=>true]+$result+['stage'=>'14C']); }
kareta_json(['ok'=>false,'error'=>'not_found'],404);
