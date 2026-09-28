<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/request_logger.php';
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/identity/session_service.php';
require_once __DIR__ . '/identity/context_service.php';
require_once __DIR__ . '/identity/auth_resolver.php';

$pdo=kareta_pdo();
if(!$pdo instanceof PDO)kareta_json(['ok'=>false,'error'=>'database_unavailable'],503);
try{$auth=(new KaretaAuthResolver($pdo))->resolve(true);}catch(DomainException $e){kareta_json(['ok'=>false,'error'=>$e->getMessage()],$e->getMessage()==='session_identity_conflict'?409:401);}
$legacyUser=$auth->legacyUser;
$identitySession=$auth->identitySession;
$mode=(string)($_GET['mode']??'stream');
if(!in_array($mode,['stream','poll'],true))kareta_json(['ok'=>false,'error'=>'invalid_mode'],400);
$cursor=max(0,(int)($_GET['cursor']??($_SERVER['HTTP_LAST_EVENT_ID']??0)));
$clientId=substr(preg_replace('/[^a-zA-Z0-9_.:-]/','',(string)($_GET['clientId']??''))??'',0,80);
$accountId=$auth->accountId;
$contextId=(int)$auth->context['id'];
$legacyUid=(int)($legacyUser['id']??0);
if($identitySession && $contextId<=0)kareta_json(['ok'=>false,'error'=>'context_required'],409);

$loadEvents=static function(PDO $pdo,int $accountId,int $contextId,int $legacyUid,int $cursor):array{
  try{
    if($accountId>0&&$contextId>0){
      $st=$pdo->prepare("SELECT e.id,e.event_key AS eventKey,e.event_type AS eventType,e.aggregate_type AS aggregateType,e.aggregate_key AS aggregateKey,e.actor_user_id AS actorUserId,e.organization_id AS organizationId,e.payload_json AS payload,e.occurred_at AS occurredAt
        FROM domain_event_recipients r JOIN domain_events e ON e.id=r.event_id
        LEFT JOIN users u ON u.id=r.user_id LEFT JOIN accounts a ON a.phone=u.phone
        WHERE a.id=? AND r.context_id=? AND e.id>? ORDER BY e.id ASC LIMIT 100");
      $st->execute([$accountId,$contextId,$cursor]);
    }else{
      $st=$pdo->prepare("SELECT e.id,e.event_key AS eventKey,e.event_type AS eventType,e.aggregate_type AS aggregateType,e.aggregate_key AS aggregateKey,e.actor_user_id AS actorUserId,e.organization_id AS organizationId,e.payload_json AS payload,e.occurred_at AS occurredAt FROM domain_event_recipients r JOIN domain_events e ON e.id=r.event_id WHERE r.user_id=? AND e.id>? ORDER BY e.id ASC LIMIT 100");
      $st->execute([$legacyUid,$cursor]);
    }
    $events=[];foreach($st->fetchAll(PDO::FETCH_ASSOC)?:[] as $row){$p=json_decode((string)($row['payload']??''),true);$row['payload']=is_array($p)?$p:[];$row['id']=(int)$row['id'];$row['contextId']=$contextId?:null;$events[]=$row;}return $events;
  }catch(Throwable $e){try{kareta_log_error('REALTIME_EVENTS_DEGRADED',$e->getMessage());}catch(Throwable $_){}return [];}
};
$unread=static function(PDO $pdo,int $accountId,int $contextId,int $legacyUid):int{
  try{if($accountId>0&&$contextId>0){$s=$pdo->prepare("SELECT COUNT(*) FROM notification_center n JOIN users u ON u.id=n.user_id JOIN accounts a ON a.phone=u.phone WHERE a.id=? AND n.context_id=? AND n.status='unread'");$s->execute([$accountId,$contextId]);}
  else{$s=$pdo->prepare("SELECT COUNT(*) FROM notification_center WHERE user_id=? AND status='unread'");$s->execute([$legacyUid]);}
  return (int)$s->fetchColumn();}catch(Throwable $e){try{kareta_log_error('REALTIME_UNREAD_DEGRADED',$e->getMessage());}catch(Throwable $_){}return 0;}
};
$touch=static function(PDO $pdo,int $accountId,int $contextId,int $legacyUid,int $cursor,string $transport,string $clientId):void{
  try{if($accountId>0&&$contextId>0){$s=$pdo->prepare("INSERT INTO realtime_context_cursors(account_id,context_id,last_event_id,last_seen_at,transport,client_id) VALUES(?,?,?,NOW(),?,?) ON DUPLICATE KEY UPDATE last_event_id=GREATEST(last_event_id,VALUES(last_event_id)),last_seen_at=NOW(),transport=VALUES(transport),client_id=VALUES(client_id)");$s->execute([$accountId,$contextId,$cursor,$transport,$clientId?:null]);}
  else{$s=$pdo->prepare("INSERT INTO realtime_user_cursors(user_id,last_event_id,last_seen_at,transport,client_id) VALUES(?,?,NOW(),?,?) ON DUPLICATE KEY UPDATE last_event_id=GREATEST(last_event_id,VALUES(last_event_id)),last_seen_at=NOW(),transport=VALUES(transport),client_id=VALUES(client_id)");$s->execute([$legacyUid,$cursor,$transport,$clientId?:null]);}}catch(Throwable $e){try{kareta_log_error('REALTIME_CURSOR_DEGRADED',$e->getMessage());}catch(Throwable $_){}}
};

if($mode==='poll'){$events=$loadEvents($pdo,$accountId,$contextId,$legacyUid,$cursor);$next=$events?(int)end($events)['id']:$cursor;$touch($pdo,$accountId,$contextId,$legacyUid,$next,'poll',$clientId);kareta_json(['ok'=>true,'data'=>['events'=>$events,'unreadCount'=>$unread($pdo,$accountId,$contextId,$legacyUid),'cursor'=>$next,'contextId'=>$contextId?:null]]);}
if(session_status()===PHP_SESSION_ACTIVE)session_write_close();ignore_user_abort(false);@set_time_limit(30);@ini_set('zlib.output_compression','0');while(ob_get_level()>0){@ob_end_flush();}
header_remove('Content-Type');header('Content-Type: text/event-stream; charset=utf-8');header('Cache-Control: no-cache, no-store, must-revalidate');header('X-Accel-Buffering: no');header('X-Content-Type-Options: nosniff');header('Connection: keep-alive');echo "retry: 5000\n\n";
$started=microtime(true);$lastHeartbeat=0.0;$lastUnread=-1;
while(!connection_aborted()&&microtime(true)-$started<25){
  $events=$loadEvents($pdo,$accountId,$contextId,$legacyUid,$cursor);if($events||microtime(true)-$lastHeartbeat>=10)$lastUnread=$unread($pdo,$accountId,$contextId,$legacyUid);
  foreach($events as $event){$cursor=(int)$event['id'];echo 'id: '.$cursor."\n";echo "event: domain\n";echo 'data: '.json_encode(['event'=>$event,'unreadCount'=>$lastUnread,'contextId'=>$contextId?:null],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)."\n\n";}
  if(microtime(true)-$lastHeartbeat>=10){echo "event: heartbeat\n";echo 'data: '.json_encode(['cursor'=>$cursor,'unreadCount'=>max(0,$lastUnread),'contextId'=>$contextId?:null,'serverTime'=>gmdate('c')],JSON_UNESCAPED_SLASHES)."\n\n";$lastHeartbeat=microtime(true);}
  @flush();if($events)$touch($pdo,$accountId,$contextId,$legacyUid,$cursor,'sse',$clientId);usleep(2000000);
}
$touch($pdo,$accountId,$contextId,$legacyUid,$cursor,'sse',$clientId);
