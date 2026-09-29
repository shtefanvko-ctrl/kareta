<?php
declare(strict_types=1);

ini_set('display_errors','0');
ini_set('html_errors','0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('X-Content-Type-Options: nosniff');

$respond=static function(array $payload,int $status=200):void{
    http_response_code($status);
    echo json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT);
    exit;
};

$normalizePhone=static function(string $value):string{
    $digits=preg_replace('/\D+/','',$value)??'';
    if($digits==='')return '';
    if($digits[0]==='8')$digits='7'.substr($digits,1);
    if($digits[0]!=='7')$digits='7'.$digits;
    $digits=substr($digits,0,11);
    return strlen($digits)===11?'+'.$digits:'';
};

$tableExists=static function(PDO $pdo,string $table):bool{
    $st=$pdo->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?");
    $st->execute([$table]);
    return (int)$st->fetchColumn()>0;
};

try{
    $configFile=dirname(__DIR__).'/config.php';
    if(!is_file($configFile))throw new RuntimeException('config.php is missing');
    require $configFile;
    require_once __DIR__.'/identity/schema_contract.php';
    require_once __DIR__.'/identity/capability_registry.php';

    $db=defined('KARETA_DB')?constant('KARETA_DB'):($KARETA_DB??$GLOBALS['KARETA_DB']??[]);
    if(!is_array($db))throw new RuntimeException('Database configuration is unavailable');
    $name=trim((string)($db['database']??$db['dbname']??''));
    if($name==='')throw new RuntimeException('Database name is empty');
    $charset=trim((string)($db['charset']??'utf8mb4'))?:'utf8mb4';
    $socket=trim((string)($db['socket']??''));
    $dsn=$socket!==''
        ? 'mysql:unix_socket='.$socket.';dbname='.$name.';charset='.$charset
        : sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s',(string)($db['host']??'localhost'),(int)($db['port']??3306),$name,$charset);
    $pdo=new PDO(
        $dsn,
        (string)($db['username']??$db['user']??''),
        (string)($db['password']??$db['pass']??''),
        [
            PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES=>false,
            PDO::ATTR_TIMEOUT=>max(1,min(3,(int)($db['connect_timeout']??2))),
        ]
    );

    // Health is observational only: no bootstrap, migration, maintenance,
    // session touch/rotation, Identity reconciliation, account ensure or audit writes.
    $schema=KaretaSchemaContract::inspect($pdo);
    if(!$schema['ok']){
        $respond([
            'ok'=>false,
            'status'=>'degraded',
            'error'=>'identity_unavailable',
            'assetVersion'=>defined('KARETA_ASSET_VERSION')?KARETA_ASSET_VERSION:'',
        ],503);
    }

    // Read legacy PHP session without extending or mutating it.
    $legacyUser=null;
    $sessionName=is_array(defined('KARETA_APP')?constant('KARETA_APP'):null)
        ? trim((string)(constant('KARETA_APP')['session_name']??''))
        : '';
    if($sessionName!==''&&!empty($_COOKIE[$sessionName])){
        session_name($sessionName);
        if(session_status()!==PHP_SESSION_ACTIVE)@session_start(['read_and_close'=>true]);
        if(is_array($_SESSION['kareta_user']??null))$legacyUser=$_SESSION['kareta_user'];
    }

    $configuredToken=defined('KARETA_DIAGNOSTICS_TOKEN')?trim((string)KARETA_DIAGNOSTICS_TOKEN):'';
    $providedToken=trim((string)($_SERVER['HTTP_X_KARETA_DIAGNOSTICS_TOKEN']??''));
    $tokenAuthorized=$configuredToken!==''&&strlen($configuredToken)>=32&&$providedToken!==''&&hash_equals($configuredToken,$providedToken);
    $legacyRole=strtolower(trim((string)($legacyUser['role']??'')));
    $detailAuthorized=$tokenAuthorized||in_array($legacyRole,['admin','owner'],true);

    // Observe the Identity cookie directly. Unlike KaretaSessionService::current(),
    // this SELECT does not touch last_seen_at/idle expiry and never rotates/clears cookies.
    $identity=null;
    $identityToken=trim((string)($_COOKIE['kareta_identity_session']??''));
    if($identityToken!==''){
        $hash=hash('sha256',$identityToken);
        $st=$pdo->prepare("SELECT s.id,s.account_id,s.current_context_id,s.revoked_at,s.rotation_grace_until,s.expires_at,s.absolute_expires_at,s.idle_expires_at,a.phone,a.status AS account_status,p.id AS person_id,p.fullname
            FROM auth_sessions s
            JOIN accounts a ON a.id=s.account_id
            LEFT JOIN persons p ON p.account_id=a.id
            WHERE s.token_hash=?
              AND a.status='active'
              AND COALESCE(s.absolute_expires_at,s.expires_at)>NOW()
              AND COALESCE(s.idle_expires_at,s.expires_at)>NOW()
              AND (s.revoked_at IS NULL OR s.rotation_grace_until>NOW())
            LIMIT 1");
        $st->execute([$hash]);
        $identity=$st->fetch(PDO::FETCH_ASSOC)?:null;
    }

    $legacyAccount=null;
    $legacyPhone=$normalizePhone((string)($legacyUser['phone']??''));
    if($legacyPhone!==''){
        $st=$pdo->prepare("SELECT a.id,a.phone,a.status,p.id AS person_id,p.fullname FROM accounts a LEFT JOIN persons p ON p.account_id=a.id WHERE a.phone=? AND a.status='active' LIMIT 1");
        $st->execute([$legacyPhone]);
        $legacyAccount=$st->fetch(PDO::FETCH_ASSOC)?:null;
    }

    $identityAccountId=(int)($identity['account_id']??0);
    $legacyAccountId=(int)($legacyAccount['id']??0);
    if($identityAccountId>0&&$legacyAccountId>0&&$identityAccountId!==$legacyAccountId){
        $payload=['ok'=>false,'status'=>'degraded','error'=>'identity_unavailable','assetVersion'=>defined('KARETA_ASSET_VERSION')?KARETA_ASSET_VERSION:''];
        if($detailAuthorized)$payload['diagnostic']=['code'=>'session_identity_conflict','identityAccountId'=>$identityAccountId,'legacyAccountId'=>$legacyAccountId,'readOnly'=>true];
        $respond($payload,409);
    }

    $accountId=$identityAccountId>0?$identityAccountId:$legacyAccountId;
    $personId=(int)($identity['person_id']??$legacyAccount['person_id']??0);
    $mode=$identityAccountId>0&&$legacyAccountId>0?'dual-compatible':($identityAccountId>0?'identity':($legacyAccountId>0?'legacy-compatible':'anonymous'));
    $context=null;
    $capabilityCount=0;
    $contextProblem=null;

    if($accountId>0){
        $contextId=(int)($identity['current_context_id']??0);
        if($contextId<=0)$contextId=(int)($_SESSION['kareta_identity_context_id']??0);

        $contextSql="SELECT c.id,c.context_key,c.context_type,c.account_id,c.person_id,c.profile_id,c.organization_id,c.organization_key,c.capability_set_id,c.status,cm.capability_set_id AS member_set_id
            FROM contexts c
            LEFT JOIN context_members cm ON cm.context_id=c.id AND cm.account_id=? AND cm.membership_status='active'
            WHERE c.status='active' AND (c.account_id=? OR cm.account_id=?)";
        if($contextId>0){
            $st=$pdo->prepare($contextSql." AND c.id=? LIMIT 1");
            $st->execute([$accountId,$accountId,$accountId,$contextId]);
            $context=$st->fetch(PDO::FETCH_ASSOC)?:null;
            if(!$context)$contextProblem='selected_context_unavailable';
        }else{
            // Observe a deterministic fallback candidate, but do not persist it.
            $st=$pdo->prepare($contextSql." ORDER BY (c.context_type='personal') DESC,c.id ASC LIMIT 1");
            $st->execute([$accountId,$accountId,$accountId]);
            $context=$st->fetch(PDO::FETCH_ASSOC)?:null;
            if(!$context)$contextProblem='context_not_available';
        }

        if($context){
            $setIds=array_values(array_unique(array_filter([
                (int)($context['capability_set_id']??0),
                (int)($context['member_set_id']??0),
            ])));
            $allow=[];$deny=[];
            if($setIds){
                $marks=implode(',',array_fill(0,count($setIds),'?'));
                $st=$pdo->prepare("SELECT capability_key,effect FROM capabilities WHERE capability_set_id IN ($marks)");
                $st->execute($setIds);
                foreach($st->fetchAll(PDO::FETCH_ASSOC)?:[] as $cap){
                    $key=KaretaCapabilityRegistry::canonical((string)($cap['capability_key']??''));
                    if($key==='')continue;
                    if((string)($cap['effect']??'allow')==='deny')$deny[$key]=true;else $allow[$key]=true;
                }
            }
            if($tableExists($pdo,'context_capability_overrides')){
                $st=$pdo->prepare("SELECT capability_key,effect FROM context_capability_overrides WHERE context_id=? AND (account_id IS NULL OR account_id=?) AND (expires_at IS NULL OR expires_at>NOW()) ORDER BY account_id IS NULL ASC,id ASC");
                $st->execute([(int)$context['id'],$accountId]);
                foreach($st->fetchAll(PDO::FETCH_ASSOC)?:[] as $cap){
                    $key=KaretaCapabilityRegistry::canonical((string)($cap['capability_key']??''));
                    if($key==='')continue;
                    if((string)($cap['effect']??'allow')==='deny')$deny[$key]=true;else $allow[$key]=true;
                }
            }
            foreach(array_keys($deny) as $key)unset($allow[$key]);

            // Preserve the MASTER first-entry guard semantics without mutating state.
            if((string)($context['context_type']??'')==='profile'&&(int)($context['profile_id']??0)>0){
                $st=$pdo->prepare("SELECT profile_type FROM person_profiles WHERE id=? LIMIT 1");
                $st->execute([(int)$context['profile_id']]);
                if(strtolower((string)$st->fetchColumn())==='master'){
                    $onboardingStatus='not_started';
                    if($tableExists($pdo,'master_onboarding_state')){
                        $st=$pdo->prepare("SELECT status FROM master_onboarding_state WHERE profile_id=? LIMIT 1");
                        $st->execute([(int)$context['profile_id']]);
                        $stored=$st->fetchColumn();
                        if(is_string($stored)&&$stored!=='')$onboardingStatus=$stored;
                    }
                    if($onboardingStatus!=='completed'){
                        $allow=[
                            'master.onboarding.view'=>true,
                            'master.onboarding.edit'=>true,
                            'master.onboarding.complete'=>true,
                        ];
                    }
                }
            }
            $capabilityCount=count($allow);
            $context=[
                'id'=>(int)$context['id'],
                'key'=>(string)$context['context_key'],
                'type'=>(string)$context['context_type'],
                'accountId'=>(int)($context['account_id']??0)?:null,
                'personId'=>(int)($context['person_id']??0)?:null,
                'profileId'=>(int)($context['profile_id']??0)?:null,
                'organizationId'=>(int)($context['organization_id']??0)?:null,
                'organizationKey'=>(string)($context['organization_key']??''),
                'status'=>(string)$context['status'],
            ];
        }
    }

    $healthy=$contextProblem===null;
    if(!$detailAuthorized){
        $respond([
            'ok'=>$healthy,
            'status'=>$healthy?'ready':'degraded',
            'assetVersion'=>defined('KARETA_ASSET_VERSION')?KARETA_ASSET_VERSION:'',
        ],$healthy?200:503);
    }

    $respond([
        'ok'=>$healthy,
        'status'=>$healthy?'ready':'degraded',
        'assetVersion'=>defined('KARETA_ASSET_VERSION')?KARETA_ASSET_VERSION:'',
        'dbVersion'=>defined('KARETA_DB_VERSION')?KARETA_DB_VERSION:0,
        'authenticated'=>$accountId>0,
        'mode'=>$mode,
        'accountId'=>$accountId?:null,
        'personId'=>$personId?:null,
        'context'=>$context,
        'capabilityCount'=>$capabilityCount,
        'contextProblem'=>$contextProblem,
        'readOnly'=>true,
        'serverTime'=>date(DATE_ATOM),
    ],$healthy?200:503);
}catch(Throwable $e){
    $configuredToken=defined('KARETA_DIAGNOSTICS_TOKEN')?trim((string)KARETA_DIAGNOSTICS_TOKEN):'';
    $providedToken=trim((string)($_SERVER['HTTP_X_KARETA_DIAGNOSTICS_TOKEN']??''));
    $detailAuthorized=$configuredToken!==''&&strlen($configuredToken)>=32&&$providedToken!==''&&hash_equals($configuredToken,$providedToken);
    $payload=['ok'=>false,'status'=>'unavailable','error'=>'identity_health_unavailable'];
    if($detailAuthorized)$payload['diagnostic']=['type'=>get_class($e),'message'=>$e->getMessage(),'readOnly'=>true];
    $respond($payload,503);
}
