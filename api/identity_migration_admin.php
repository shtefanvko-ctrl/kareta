<?php
declare(strict_types=1);
ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');
require __DIR__.'/bootstrap.php';
require __DIR__.'/identity/identity_migration_service.php';
require_once __DIR__.'/identity/authorization_pipeline.php';
function out(array $v,int $s=200):never{http_response_code($s);echo json_encode($v,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
function body():array{$raw=file_get_contents('php://input');$v=json_decode($raw?:'{}',true);return is_array($v)?$v:[];}
try{
 $pdo=kareta_pdo(); if(!$pdo) out(['ok'=>false,'error'=>'database_unavailable'],503);
 $legacy=function_exists('kareta_current_user')?kareta_current_user():null;
 try{$decision=kareta_authorize($pdo,'*',[],is_array($legacy)?$legacy:null);}catch(Throwable $e){
  $role=strtolower((string)($legacy['role']??'')); if(!in_array($role,['admin','owner'],true)) out(['ok'=>false,'error'=>'migration_admin_required'],403);
  $decision=null;
 }
 $svc=new KaretaIdentityMigrationService($pdo); $method=$_SERVER['REQUEST_METHOD']??'GET'; $action=(string)($_GET['action']??'overview');
 if($method==='GET' && $action==='overview'){
  $status=$svc->status();
  $runs=$pdo->query("SELECT id,run_key runKey,mode,status,cursor_user_id cursorUserId,scanned_count scanned,migrated_count migrated,unchanged_count unchanged,conflict_count conflicts,failed_count failed,started_at startedAt,finished_at finishedAt,error_message errorMessage FROM identity_migration_runs ORDER BY id DESC LIMIT 20")->fetchAll(PDO::FETCH_ASSOC);
  $conflicts=$pdo->query("SELECT id,legacy_type legacyType,legacy_id legacyId,normalized_phone phone,conflict_type conflictType,severity,status,details_json details,first_seen_at firstSeenAt,last_seen_at lastSeenAt FROM identity_migration_conflicts ORDER BY FIELD(status,'open','ignored','resolved'),FIELD(severity,'blocking','warning'),last_seen_at DESC LIMIT 100")->fetchAll(PDO::FETCH_ASSOC);
  foreach($conflicts as &$c){$c['details']=json_decode((string)($c['details']??''),true)?:[];} unset($c);
  out(['ok'=>true,'status'=>$status,'runs'=>$runs,'conflicts'=>$conflicts]);
 }
 if($method==='POST'){
  $d=body(); $action=(string)($d['action']??$action); $actor=(int)($legacy['id']??0); $account=(int)($decision->accountId??0);
  if($action==='runBatch'){
   $apply=($d['mode']??'dry_run')==='apply'; if($apply && ($d['confirm']??'')!=='APPLY') out(['ok'=>false,'error'=>'apply_confirmation_required'],422);
   $r=$svc->runBatch((int)($d['after']??0),(int)($d['limit']??100),!$apply,$actor?:null);
   $pdo->prepare("INSERT INTO identity_migration_actions(actor_user_id,actor_account_id,action_type,payload_json,result_json) VALUES(?,?, 'run_batch',?,?)")->execute([$actor?:null,$account?:null,json_encode($d),json_encode($r)]); out($r);
  }
  if(in_array($action,['resolveConflict','ignoreConflict','reopenConflict'],true)){
   $id=(int)($d['conflictId']??0); if($id<=0) out(['ok'=>false,'error'=>'conflict_id_required'],422);
   $status=$action==='resolveConflict'?'resolved':($action==='ignoreConflict'?'ignored':'open');
   $resolution=['note'=>(string)($d['note']??''),'actorUserId'=>$actor?:null,'at'=>date(DATE_ATOM)];
   $st=$pdo->prepare("UPDATE identity_migration_conflicts SET status=?,resolution_json=?,resolved_at=IF(?='open',NULL,NOW()) WHERE id=?");$st->execute([$status,json_encode($resolution,JSON_UNESCAPED_UNICODE),$status,$id]);
   $pdo->prepare("INSERT INTO identity_migration_actions(actor_user_id,actor_account_id,action_type,target_type,target_id,payload_json) VALUES(?,?,?,'conflict',?,?)")->execute([$actor?:null,$account?:null,$action,(string)$id,json_encode($resolution)]); out(['ok'=>true,'status'=>$status]);
  }
 }
 out(['ok'=>false,'error'=>'unsupported_action'],400);
}catch(Throwable $e){out(['ok'=>false,'error'=>'migration_control_error','message'=>$e->getMessage()],500);}
