<?php
declare(strict_types=1);
ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__.'/bootstrap.php';
require_once __DIR__.'/identity/auth_resolver.php';
$pdo=kareta_pdo(); if(!$pdo instanceof PDO)kareta_json(['ok'=>false,'error'=>'database_unavailable'],503);
$auth=(new KaretaAuthResolver($pdo))->resolve(false);
if(!$auth||$auth->accountId<=0)kareta_json(['ok'=>false,'error'=>'session_required'],401);
$accountId=$auth->accountId;
$method=strtoupper((string)($_SERVER['REQUEST_METHOD']??'GET'));
$body=$method==='POST'?kareta_read_json():[];
$dashboardKey=preg_replace('/[^a-z0-9_.-]/','',strtolower((string)($body['dashboardKey']??($_GET['dashboardKey']??''))));
$contextKind=preg_replace('/[^a-z_]/','',strtolower((string)($body['contextKind']??($_GET['contextKind']??'personal'))));
$contextKey=mb_substr(preg_replace('/[^a-zA-Z0-9:_.-]/','',(string)($body['contextKey']??($_GET['contextKey']??($auth->context['key']??'')))),0,128);
if($dashboardKey==='')kareta_json(['ok'=>false,'error'=>'dashboard_key_required'],422);
if(!in_array($contextKind,['personal','master','seller','organization','admin'],true))$contextKind='personal';
if($method==='GET'){
  $st=$pdo->prepare('SELECT layout_json,revision,updated_at FROM dashboard_layout_preferences WHERE account_id=? AND context_kind=? AND context_key=? AND dashboard_key=? LIMIT 1');
  $st->execute([$accountId,$contextKind,$contextKey,$dashboardKey]);$row=$st->fetch(PDO::FETCH_ASSOC)?:null;$layout=$row?json_decode((string)$row['layout_json'],true):null;
  kareta_json(['ok'=>true,'dashboardKey'=>$dashboardKey,'contextKind'=>$contextKind,'contextKey'=>$contextKey,'layout'=>is_array($layout)?$layout:null,'revision'=>(int)($row['revision']??0),'updatedAt'=>$row['updated_at']??null]);
}
$action=strtolower(trim((string)($body['action']??'save')));
if(!array_key_exists('expectedRevision',$body))kareta_json(['ok'=>false,'error'=>'dashboard_revision_required'],428);
$expectedRevision=max(0,(int)$body['expectedRevision']);
$pdo->beginTransaction();
$st=$pdo->prepare('SELECT id,layout_json,revision FROM dashboard_layout_preferences WHERE account_id=? AND context_kind=? AND context_key=? AND dashboard_key=? FOR UPDATE');
$st->execute([$accountId,$contextKind,$contextKey,$dashboardKey]);$current=$st->fetch(PDO::FETCH_ASSOC)?:null;$currentRevision=(int)($current['revision']??0);
if($expectedRevision!==$currentRevision){$pdo->rollBack();$currentLayout=$current?json_decode((string)$current['layout_json'],true):null;kareta_json(['ok'=>false,'error'=>'dashboard_revision_conflict','dashboardKey'=>$dashboardKey,'contextKind'=>$contextKind,'contextKey'=>$contextKey,'layout'=>is_array($currentLayout)?$currentLayout:null,'revision'=>$currentRevision],409);}
if($action==='reset'){
  if($current)$pdo->prepare('DELETE FROM dashboard_layout_preferences WHERE id=?')->execute([(int)$current['id']]);
  $pdo->commit();kareta_json(['ok'=>true,'action'=>'reset','dashboardKey'=>$dashboardKey,'contextKind'=>$contextKind,'contextKey'=>$contextKey,'layout'=>null,'revision'=>0]);
}
if($action!=='save'){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'dashboard_action_invalid'],422);}
$layout=$body['layout']??null;if(!is_array($layout)){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'layout_required'],422);}
$order=array_values(array_unique(array_filter(array_map(static fn($v)=>preg_replace('/[^a-z0-9_.-]/','',strtolower((string)$v)),array_slice((array)($layout['order']??[]),0,50)))));
$spans=[];foreach((array)($layout['spans']??[]) as $key=>$value){$clean=preg_replace('/[^a-z0-9_.-]/','',strtolower((string)$key));if($clean!=='')$spans[$clean]=max(1,min(4,(int)$value));}
$normalized=['order'=>$order,'spans'=>$spans];
$nextRevision=$currentRevision+1;$json=json_encode($normalized,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
if($current)$pdo->prepare('UPDATE dashboard_layout_preferences SET layout_json=?,revision=?,updated_at=NOW() WHERE id=?')->execute([$json,$nextRevision,(int)$current['id']]);
else try{$pdo->prepare('INSERT INTO dashboard_layout_preferences(account_id,context_kind,context_key,dashboard_key,layout_json,revision,updated_at) VALUES(?,?,?,?,?,?,NOW())')->execute([$accountId,$contextKind,$contextKey,$dashboardKey,$json,$nextRevision]);}catch(PDOException $e){if($pdo->inTransaction())$pdo->rollBack();if((string)$e->getCode()==='23000'){kareta_json(['ok'=>false,'error'=>'dashboard_revision_conflict','dashboardKey'=>$dashboardKey,'contextKind'=>$contextKind,'contextKey'=>$contextKey,'layout'=>null,'revision'=>1],409);}throw $e;}
$pdo->commit();
kareta_json(['ok'=>true,'action'=>'save','dashboardKey'=>$dashboardKey,'contextKind'=>$contextKind,'contextKey'=>$contextKey,'layout'=>$normalized,'revision'=>$nextRevision]);
