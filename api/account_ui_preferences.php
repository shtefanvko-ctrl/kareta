<?php
declare(strict_types=1);
ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__.'/bootstrap.php';
require_once __DIR__.'/identity/auth_resolver.php';
$pdo=kareta_pdo(); if(!$pdo instanceof PDO)kareta_json(['ok'=>false,'error'=>'database_unavailable'],503);
$resolver=new KaretaAuthResolver($pdo); $auth=$resolver->resolve();
if(!$auth instanceof KaretaAuthResolution||$auth->accountId<=0)kareta_json(['ok'=>false,'error'=>'session_required'],401);
$accountId=$auth->accountId;
$method=strtoupper((string)($_SERVER['REQUEST_METHOD']??'GET'));
$body=$method==='POST'?kareta_read_json():[];
$kind=preg_replace('/[^a-z_]/','',strtolower((string)($body['contextKind']??($_GET['contextKind']??'personal'))));
if(!in_array($kind,['personal','master','seller','organization','organization_service','organization_store','admin'],true))$kind='personal';
if($method==='GET'){
  $st=$pdo->prepare('SELECT more_menu_layout FROM account_ui_preferences WHERE account_id=? AND context_kind=? LIMIT 1');$st->execute([$accountId,$kind]);$v=$st->fetchColumn();
  kareta_json(['ok'=>true,'contextKind'=>$kind,'moreMenuLayout'=>in_array($v,['grid','arc','hex'],true)?$v:'arc']);
}
$layout=(string)($body['moreMenuLayout']??'arc');if(!in_array($layout,['grid','arc','hex'],true))$layout='arc';
$pdo->prepare('INSERT INTO account_ui_preferences(account_id,context_kind,more_menu_layout,updated_at) VALUES(?,?,?,NOW()) ON DUPLICATE KEY UPDATE more_menu_layout=VALUES(more_menu_layout),updated_at=NOW()')->execute([$accountId,$kind,$layout]);
kareta_json(['ok'=>true,'contextKind'=>$kind,'moreMenuLayout'=>$layout]);
