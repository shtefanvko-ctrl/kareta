<?php
declare(strict_types=1);

/**
 * Notification compatibility recovery bridge v2.
 * Default is read-only. Use --apply only after reviewing the dry-run report.
 */
$root=dirname(__DIR__);
$configFile=$root.'/config.php';
if(!is_file($configFile)){fwrite(STDERR,"config.php is missing\n");exit(2);}
require $configFile;

$db=defined('KARETA_DB')?constant('KARETA_DB'):[];
if(!is_array($db)){fwrite(STDERR,"Database configuration is unavailable\n");exit(2);}
$host=(string)($db['host']??'127.0.0.1');
$port=(int)($db['port']??3306);
$name=(string)($db['database']??'');
$charset=(string)($db['charset']??'utf8mb4');
$user=(string)($db['username']??'');
$pass=(string)($db['password']??'');
$socket=(string)($db['socket']??'');
if($name===''||$user===''){fwrite(STDERR,"Database configuration is incomplete\n");exit(2);}

$dsn=$socket!=='' ? sprintf('mysql:unix_socket=%s;dbname=%s;charset=%s',$socket,$name,$charset)
                  : sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s',$host,$port,$name,$charset);
$pdo=new PDO($dsn,$user,$pass,[
    PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES=>false,
    PDO::ATTR_TIMEOUT=>max(1,min(5,(int)($db['connect_timeout']??3))),
]);

$tableExists=static function(PDO $pdo,string $table):bool{
    $st=$pdo->prepare("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? LIMIT 1");
    $st->execute([$table]); return (bool)$st->fetchColumn();
};
$columnExists=static function(PDO $pdo,string $table,string $column):bool{
    $st=$pdo->prepare("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=? LIMIT 1");
    $st->execute([$table,$column]); return (bool)$st->fetchColumn();
};
$normalizePhone=static function(string $value):string{
    $digits=preg_replace('/\D+/','',$value)??'';
    if(strlen($digits)===11&&$digits[0]==='8')$digits='7'.substr($digits,1);
    if(strlen($digits)===10)$digits='7'.$digits;
    return $digits!==''?'+'.$digits:'';
};

foreach(['notifications','notification_center','users'] as $table){
    if(!$tableExists($pdo,$table)){fwrite(STDERR,"Missing required table: {$table}\n");exit(2);}
}
foreach(['notification_key','user_id','notification_type','status','payload_json'] as $column){
    if(!$columnExists($pdo,'notification_center',$column)){fwrite(STDERR,"notification_center.{$column} is missing\n");exit(2);}
}

$apply=in_array('--apply',$argv,true);
$jsonPath='';
foreach($argv as $arg)if(str_starts_with($arg,'--json='))$jsonPath=substr($arg,7);

$userPhoneMap=[];$ambiguousPhones=[];
$userRows=$pdo->query("SELECT id,phone FROM users WHERE active=1")->fetchAll()?:[];
foreach($userRows as $u){
    $phone=$normalizePhone((string)($u['phone']??''));$id=(int)($u['id']??0);
    if($phone===''||$id<=0)continue;
    if(isset($userPhoneMap[$phone])&&$userPhoneMap[$phone]!==$id){$ambiguousPhones[$phone]=true;unset($userPhoneMap[$phone]);continue;}
    if(!isset($ambiguousPhones[$phone]))$userPhoneMap[$phone]=$id;
}

$rows=$pdo->query("SELECT id,recipient_user_id,recipient_phone,recipient_role,event_type,entity_type,entity_id,title,body,action_url,is_read,read_at,meta,created_at FROM notifications ORDER BY id")->fetchAll()?:[];
$stats=['legacyRows'=>count($rows),'alreadyMirrored'=>0,'eligibleByUserId'=>0,'eligibleByPhone'=>0,'unresolvedRoleOnly'=>0,'unresolvedRecipient'=>0,'wouldInsert'=>0,'inserted'=>0,'errors'=>0];
$examples=['unresolvedRoleOnly'=>[],'unresolvedRecipient'=>[],'eligible'=>[]];
$exists=$pdo->prepare("SELECT id FROM notification_center WHERE notification_key=? LIMIT 1");
$insert=$pdo->prepare("INSERT INTO notification_center
(notification_key,user_id,context_id,event_id,notification_type,title,body,action_url,entity_type,entity_key,status,payload_json,created_at,read_at)
VALUES(?,?,NULL,NULL,?,?,?,?,?,?,?, ?,?,?)
ON DUPLICATE KEY UPDATE notification_type=VALUES(notification_type),title=VALUES(title),body=VALUES(body),action_url=VALUES(action_url),entity_type=VALUES(entity_type),entity_key=VALUES(entity_key),payload_json=VALUES(payload_json)");

if($apply)$pdo->beginTransaction();
try{
foreach($rows as $row){
    $legacyId=(int)($row['id']??0);if($legacyId<=0)continue;
    $userId=(int)($row['recipient_user_id']??0);$resolvedBy='userId';
    if($userId<=0){
        $phone=$normalizePhone((string)($row['recipient_phone']??''));
        if($phone!==''&&isset($userPhoneMap[$phone])){$userId=(int)$userPhoneMap[$phone];$resolvedBy='phone';}
    }
    if($userId<=0){
        $role=trim((string)($row['recipient_role']??''));
        if($role!==''){$stats['unresolvedRoleOnly']++;if(count($examples['unresolvedRoleOnly'])<25)$examples['unresolvedRoleOnly'][]=['id'=>$legacyId,'role'=>$role];}
        else{$stats['unresolvedRecipient']++;if(count($examples['unresolvedRecipient'])<25)$examples['unresolvedRecipient'][]=['id'=>$legacyId];}
        continue;
    }
    $resolvedBy==='phone'?$stats['eligibleByPhone']++:$stats['eligibleByUserId']++;
    $key='legacy:'.$legacyId.':user:'.$userId;
    $exists->execute([$key]);if($exists->fetchColumn()){$stats['alreadyMirrored']++;continue;}
    $stats['wouldInsert']++;if(count($examples['eligible'])<25)$examples['eligible'][]=['id'=>$legacyId,'userId'=>$userId,'resolvedBy'=>$resolvedBy];
    if(!$apply)continue;
    $meta=json_decode((string)($row['meta']??''),true);if(!is_array($meta))$meta=[];
    $payload=['schemaVersion'=>1,'source'=>'legacy_notifications','legacyNotificationId'=>$legacyId,'recipientRole'=>(string)($row['recipient_role']??''),'meta'=>$meta,'backfilled'=>true];
    $status=((int)($row['is_read']??0)===1)?'read':'unread';
    $readAt=$status==='read'?(($row['read_at']??null)?:($row['created_at']??null)):null;
    $insert->execute([$key,$userId,(string)($row['event_type']??''),(string)($row['title']??''),(string)($row['body']??''),(string)($row['action_url']??''),(string)($row['entity_type']??''),(string)($row['entity_id']??''),$status,json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),(string)($row['created_at']??date('Y-m-d H:i:s')),$readAt]);
    if($insert->rowCount()>0)$stats['inserted']++;
}
if($apply)$pdo->commit();
}catch(Throwable $e){
    if($apply&&$pdo->inTransaction())$pdo->rollBack();
    $stats['errors']++;fwrite(STDERR,$e->getMessage()."\n");exit(3);
}

$report=['schema'=>'kareta.notification-center-backfill.v2','checkedAt'=>gmdate('c'),'mode'=>$apply?'APPLY':'DRY_RUN','canonicalStore'=>'notification_center','compatibilityStore'=>'notifications','roleOnlyPolicy'=>'SKIP','stats'=>$stats,'examples'=>$examples,'status'=>$apply?'APPLIED':'DRY_RUN_COMPLETE'];
$json=json_encode($report,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT).PHP_EOL;
if($jsonPath!=='')file_put_contents($jsonPath,$json);
echo $json;
