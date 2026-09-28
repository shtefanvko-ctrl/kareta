<?php
declare(strict_types=1);
ini_set('display_errors','0');
ini_set('html_errors','0');
header('Content-Type: application/json; charset=utf-8');

require_once dirname(__DIR__).'/inc/request_logger.php';
require_once __DIR__.'/bootstrap.php';
require_once __DIR__.'/identity/context_service.php';
require_once __DIR__.'/identity/auth_resolver.php';

const KARETA_ENTRY_PROMPT_CLIENT_FIRST_VEHICLE = 'client_first_vehicle';

$pdo=kareta_pdo();
if(!$pdo instanceof PDO)kareta_json(['ok'=>false,'error'=>'database_unavailable'],503);
if(!kareta_table_exists($pdo,'account_entry_prompt_state'))kareta_json(['ok'=>false,'error'=>'entry_prompt_schema_missing','message'=>'Требуется миграция базы данных 129'],503);

try{$auth=(new KaretaAuthResolver($pdo))->resolve(true);}catch(DomainException $e){kareta_json(['ok'=>false,'error'=>$e->getMessage()],401);}
$contexts=new KaretaIdentityContextService($pdo);$contexts->resolveAccount($auth->legacyUser??[]);
$accountId=(int)$auth->accountId;$current=$contexts->currentContext($accountId);
if(strtolower((string)($current['type']??''))!=='personal')kareta_json(['ok'=>false,'error'=>'client_context_required','message'=>'Выберите контекст Клиента'],409);
$contextId=(int)($current['id']??0)?:null;
$legacy=is_array($auth->legacyUser??null)?$auth->legacyUser:[];$uid=(int)($legacy['id']??0);$phone=kareta_normalize_phone((string)($legacy['phone']??''));
if($phone===''&&kareta_table_exists($pdo,'accounts')){try{$q=$pdo->prepare('SELECT phone FROM accounts WHERE id=? LIMIT 1');$q->execute([$accountId]);$phone=kareta_normalize_phone((string)($q->fetchColumn()?:''));}catch(Throwable $_){}}

function kep_local_date($value): string{
    $v=trim((string)$value);
    return preg_match('/^\d{4}-\d{2}-\d{2}$/',$v)?$v:'';
}
function kep_prompt_key($value): string{
    $key=trim((string)$value);
    return $key===KARETA_ENTRY_PROMPT_CLIENT_FIRST_VEHICLE?$key:'';
}
function kep_has_active_vehicle(PDO $pdo,int $uid,string $phone): bool{
    if(!kareta_table_exists($pdo,'client_vehicles'))return false;
    if($phone!==''){
        $sql="SELECT COUNT(*) FROM client_vehicles WHERE active=1 AND (user_id=? OR user_phone=?";
        $args=[$uid?:0,$phone];
        if(kareta_table_exists($pdo,'clients')){$sql.=" OR client_id IN (SELECT id FROM clients WHERE user_phone=? OR phone=?)";$args[]=$phone;$args[]=$phone;}
        $sql.=')';$q=$pdo->prepare($sql);$q->execute($args);return (int)$q->fetchColumn()>0;
    }
    if($uid>0){$q=$pdo->prepare('SELECT COUNT(*) FROM client_vehicles WHERE active=1 AND user_id=?');$q->execute([$uid]);return (int)$q->fetchColumn()>0;}
    return false;
}
function kep_row(PDO $pdo,int $accountId,string $key,?int $contextId): array{
    $pdo->prepare('INSERT IGNORE INTO account_entry_prompt_state(account_id,prompt_key,context_id) VALUES(?,?,?)')->execute([$accountId,$key,$contextId]);
    $q=$pdo->prepare('SELECT account_id,prompt_key,context_id,last_shown_local_date,last_dismissed_local_date,last_action,show_count,revision,updated_at FROM account_entry_prompt_state WHERE account_id=? AND prompt_key=? LIMIT 1');
    $q->execute([$accountId,$key]);return $q->fetch(PDO::FETCH_ASSOC)?:[];
}
function kep_payload(array $row,bool $hasVehicle,string $localDate): array{
    $last=(string)($row['last_shown_local_date']??'');
    return [
      'promptKey'=>(string)($row['prompt_key']??KARETA_ENTRY_PROMPT_CLIENT_FIRST_VEHICLE),
      'localDate'=>$localDate,
      'hasActiveVehicle'=>$hasVehicle,
      'shouldShow'=>!$hasVehicle&&$localDate!==''&&$last!==$localDate,
      'lastShownLocalDate'=>$last?:null,
      'lastDismissedLocalDate'=>(string)($row['last_dismissed_local_date']??'')?:null,
      'lastAction'=>(string)($row['last_action']??''),
      'showCount'=>(int)($row['show_count']??0),
      'revision'=>(int)($row['revision']??0),
      'updatedAt'=>$row['updated_at']??null,
    ];
}

$method=strtoupper((string)($_SERVER['REQUEST_METHOD']??'GET'));
$body=$method==='POST'?kareta_read_json():[];
$action=(string)($body['action']??($_GET['action']??'current'));
$key=kep_prompt_key($body['promptKey']??($_GET['promptKey']??KARETA_ENTRY_PROMPT_CLIENT_FIRST_VEHICLE));
if($key==='')kareta_json(['ok'=>false,'error'=>'unsupported_prompt_key'],422);
$localDate=kep_local_date($body['localDate']??($_GET['localDate']??''));
if($localDate==='')kareta_json(['ok'=>false,'error'=>'local_date_required','message'=>'Передайте локальную календарную дату YYYY-MM-DD'],422);
$hasVehicle=kep_has_active_vehicle($pdo,$uid,$phone);

if($method==='GET'&&$action==='current'){
    $row=kep_row($pdo,$accountId,$key,$contextId);kareta_json(['ok'=>true,'data'=>kep_payload($row,$hasVehicle,$localDate)]);
}
if($method==='POST'&&in_array($action,['markShown','dismiss'],true)){
    $row=kep_row($pdo,$accountId,$key,$contextId);
    if($hasVehicle)kareta_json(['ok'=>true,'data'=>kep_payload($row,true,$localDate),'skipped'=>'vehicle_exists']);
    $claimed=true;
    if($action==='markShown'){
        // Atomic daily claim: only one tab/session may own the automatic prompt for this local date.
        $st=$pdo->prepare("UPDATE account_entry_prompt_state SET context_id=?,last_shown_local_date=?,last_action='shown',show_count=show_count+1,revision=revision+1 WHERE account_id=? AND prompt_key=? AND (last_shown_local_date IS NULL OR last_shown_local_date<>?)");
        $st->execute([$contextId,$localDate,$accountId,$key,$localDate]);
        $claimed=$st->rowCount()>0;
    }else{
        $pdo->prepare("UPDATE account_entry_prompt_state SET context_id=?,last_shown_local_date=?,last_dismissed_local_date=?,last_action='dismissed',revision=revision+1 WHERE account_id=? AND prompt_key=?")
            ->execute([$contextId,$localDate,$localDate,$accountId,$key]);
    }
    $row=kep_row($pdo,$accountId,$key,$contextId);$data=kep_payload($row,false,$localDate);$data['claimed']=$claimed;kareta_json(['ok'=>true,'data'=>$data]);
}
kareta_json(['ok'=>false,'error'=>'not_found'],404);
