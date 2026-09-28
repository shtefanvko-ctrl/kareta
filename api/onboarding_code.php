<?php
declare(strict_types=1);

// Compatibility endpoint for older onboarding bundles. Authentication is
// delegated to the same persistent challenge service as Identity Session.
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/identity/challenge_service.php';
require_once __DIR__ . '/identity/onboarding_identity_bridge.php';


function kareta_onboarding_gateway_cookie_options(int $expires): array
{
    return [
        'expires'=>$expires,'path'=>'/',
        'secure'=>(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off') || strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO']??''))==='https',
        'httponly'=>true,'samesite'=>'Lax',
    ];
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    kareta_json(['ok'=>false,'error'=>'method_not_allowed','requestId'=>KARETA_REQUEST_ID],405);
}

$pdo=kareta_pdo();
if(!$pdo instanceof PDO){
    $databaseState=kareta_db_public_state($pdo);
    $failureMeta=kareta_db_public_failure_meta();
    kareta_json([
        'ok'=>false,'error'=>'database_unavailable','databaseState'=>$databaseState,
        'recoveryAction'=>kareta_db_public_recovery_action($databaseState),
        'failureStage'=>$failureMeta['failureStage'],'failedMigrationVersion'=>$failureMeta['failedMigrationVersion'],
        'diagnosticCode'=>$failureMeta['diagnosticCode'],'failureCategory'=>$failureMeta['failureCategory'],
            'failureSqlState'=>$failureMeta['failureSqlState'],'failureDriverCode'=>$failureMeta['failureDriverCode'],'requestId'=>KARETA_REQUEST_ID,
    ],503);
}
$body=kareta_read_json();
$action=(string)($body['action']??'');
$phone=kareta_normalize_phone((string)($body['phone']??''));
if($phone==='')kareta_json(['ok'=>false,'error'=>'invalid_phone','requestId'=>KARETA_REQUEST_ID],422);

if($action==='onboarding.requestCode'){
    try{$challenge=(new KaretaChallengeService($pdo))->create($phone,'login');}
    catch(DomainException $error){
        kareta_json(
            kareta_challenge_error_payload($error,['requestId'=>KARETA_REQUEST_ID]),
            kareta_challenge_http_status($error)
        );
    }
    $_SESSION['kareta_onboarding_verification']=[
        'phone'=>$phone,'challenge_key'=>(string)$challenge['challengeKey'],
        'expires_at'=>time()+600,'verified'=>false,
    ];
    // Do not disclose account existence until phone possession is proven.
    $response=[
        'ok'=>true,'sent'=>true,'expiresIn'=>(int)$challenge['expiresIn'],
        'resendAfter'=>(int)($challenge['resendAfter']??60),'requestId'=>KARETA_REQUEST_ID,
        'deliveryMode'=>(string)($challenge['deliveryMode']??'webhook'),
        'codeLength'=>(int)($challenge['codeLength']??6),
        'testMode'=>(bool)($challenge['testMode']??false),
    ];
    if(isset($challenge['testCode']))$response['testCode']=(string)$challenge['testCode'];
    if(isset($challenge['devCode']))$response['devCode']=(string)$challenge['devCode'];
    kareta_json($response);
}

if($action==='onboarding.verifyCode'){
    $verification=is_array($_SESSION['kareta_onboarding_verification']??null)?$_SESSION['kareta_onboarding_verification']:null;
    if(!$verification || !hash_equals((string)($verification['phone']??''),$phone))kareta_json(['ok'=>false,'error'=>'verification_required','requestId'=>KARETA_REQUEST_ID],409);
    if((int)($verification['expires_at']??0)<time()){unset($_SESSION['kareta_onboarding_verification']);kareta_json(['ok'=>false,'error'=>'verification_expired','requestId'=>KARETA_REQUEST_ID],410);}
    $code=preg_replace('/\D+/','',(string)($body['code']??''))?:'';
    try{(new KaretaChallengeService($pdo))->verify((string)($verification['challenge_key']??''),$code);}
    catch(DomainException|InvalidArgumentException $error){kareta_json(['ok'=>false,'error'=>$error->getMessage(),'requestId'=>KARETA_REQUEST_ID],$error->getMessage()==='challenge_attempts_exceeded'?429:422);}
    session_regenerate_id(true);
    $verification['verified']=true;$verification['verified_at']=time();$_SESSION['kareta_onboarding_verification']=$verification;
    $profile=kareta_profile_by_phone($pdo,$phone);
    if($profile){
        if((int)($profile['active']??1)!==1){unset($_SESSION['kareta_onboarding_verification']);kareta_json(['ok'=>false,'error'=>'account_blocked','requestId'=>KARETA_REQUEST_ID],403);}
        $selectedRole=strtolower(trim((string)($body['entryRole']??$body['role']??$profile['entry_role']??$profile['role']??'client')));
        if(!in_array($selectedRole,['client','master'],true))$selectedRole='client';
        $profile['entry_role']=$selectedRole;
        $_SESSION['kareta_user']=$profile;
        unset($_SESSION['kareta_onboarding_verification']);
        $cookieExpires=time()+60*60*24*KARETA_APP['cookie_days'];
        setcookie('kareta_phone',(string)$profile['phone'],kareta_onboarding_gateway_cookie_options($cookieExpires));
        setcookie('kareta_role',(string)($profile['role']??'client'),kareta_onboarding_gateway_cookie_options($cookieExpires));
        setcookie('kareta_entry_role',$selectedRole,kareta_onboarding_gateway_cookie_options($cookieExpires));
        setcookie('kareta_onb_done','1',kareta_onboarding_gateway_cookie_options($cookieExpires));
        $identity=null;$warnings=[];
        try{$identity=(new KaretaOnboardingIdentityBridge($pdo))->establish($profile,$selectedRole);}catch(Throwable $error){$warnings[]='identity_session_degraded';kareta_log_error('ONBOARDING_GATEWAY_IDENTITY_DEGRADED',KARETA_REQUEST_ID.' '.$error->getMessage());}
        kareta_json(['ok'=>true,'verified'=>true,'phone'=>$phone,'existingAccount'=>true,'user'=>$profile,'identity'=>$identity,'selectedRole'=>$selectedRole,'entryRole'=>$selectedRole,'warnings'=>$warnings,'identityDegraded'=>$identity===null,'requestId'=>KARETA_REQUEST_ID]);
    }
    kareta_json(['ok'=>true,'verified'=>true,'phone'=>$phone,'existingAccount'=>false,'requestId'=>KARETA_REQUEST_ID]);
}

kareta_json(['ok'=>false,'error'=>'unknown_action','requestId'=>KARETA_REQUEST_ID],404);
