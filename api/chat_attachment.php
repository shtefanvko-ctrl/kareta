<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

if(($_SERVER['REQUEST_METHOD']??'GET')!=='GET')kareta_json(['ok'=>false,'error'=>'method_not_allowed'],405);
$pdo=kareta_pdo();if(!$pdo instanceof PDO)kareta_json(['ok'=>false,'error'=>'database_unavailable'],503);
$chatId=trim((string)($_GET['chatId']??''));$messageId=trim((string)($_GET['messageId']??''));
if(!preg_match('/^[A-Za-z0-9_-]{1,96}$/',$chatId)||!preg_match('/^[A-Za-z0-9_-]{1,96}$/',$messageId))kareta_json(['ok'=>false,'error'=>'invalid_attachment_id'],422);

$st=$pdo->prepare("SELECT m.file_name,m.file_type,m.file_url,c.* FROM messages m JOIN chats c ON c.id=m.chat_id WHERE m.id=? AND m.chat_id=? LIMIT 1");
$st->execute([$messageId,$chatId]);$row=$st->fetch(PDO::FETCH_ASSOC);
if(!$row)kareta_json(['ok'=>false,'error'=>'attachment_not_found'],404);
$user=kareta_session_user()??[];$uid=(int)($user['id']??0);$role=kareta_normalize_role((string)($user['role']??'guest'));$phone=kareta_normalize_phone((string)($user['phone']??''));
$allowed=in_array($role,['admin','owner'],true);
if(!$allowed&&$uid>0){
    try{$participant=$pdo->prepare("SELECT 1 FROM chat_participants WHERE chat_id=? AND user_id=? AND left_at IS NULL LIMIT 1");$participant->execute([$chatId,$uid]);$allowed=(bool)$participant->fetchColumn();}catch(Throwable $_error){}
}
if(!$allowed&&$role==='client')$allowed=($uid>0&&(int)($row['client_user_id']??0)===$uid)||($phone!==''&&hash_equals($phone,kareta_normalize_phone((string)($row['client_phone']??''))));
if(!$allowed&&$role==='master')$allowed=$uid>0&&(int)($row['master_user_id']??0)===$uid;
if(!$allowed&&$role==='seller')$allowed=$uid>0&&(int)($row['seller_user_id']??0)===$uid;
if(!$allowed&&$role==='sto'){
    $sto=$pdo->prepare("SELECT 1 FROM orders o JOIN sto_profiles s ON s.id=o.sto_id WHERE o.id=? AND (s.user_id=? OR s.manager_phone=?) LIMIT 1");$sto->execute([(string)($row['order_id']??''),$uid?:-1,$phone]);$allowed=(bool)$sto->fetchColumn();
}
if(!$allowed)kareta_json(['ok'=>false,'error'=>'forbidden'],403);

$stored=(string)($row['file_url']??'');
if(!preg_match('~^secure-chat/(\d{4}/\d{2})/([a-f0-9]{48}\.(?:jpe?g|png|webp|gif|mp4|webm|ogg|mp3|pdf|txt))$~i',$stored,$match))kareta_json(['ok'=>false,'error'=>'attachment_unavailable'],404);
$path=KARETA_STORAGE_ROOT.'/uploads/chat/'.$match[1].'/'.$match[2];
$root=realpath(KARETA_STORAGE_ROOT.'/uploads/chat');$real=realpath($path);
if(!$root||!$real||!str_starts_with($real,$root.DIRECTORY_SEPARATOR)||!is_file($real))kareta_json(['ok'=>false,'error'=>'attachment_not_found'],404);
$mime=strtolower((string)($row['file_type']??'application/octet-stream'));
$allowedMime=['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/webm','audio/ogg','audio/mpeg','application/pdf','text/plain'];
if(!in_array($mime,$allowedMime,true))$mime='application/octet-stream';
$name=preg_replace('/[^\pL\pN._ -]+/u','_',basename((string)($row['file_name']??'attachment')))?:'attachment';
$inline=str_starts_with($mime,'image/')||str_starts_with($mime,'video/')||str_starts_with($mime,'audio/');
header('Content-Type: '.$mime);header('Content-Length: '.filesize($real));header('Cache-Control: private, max-age=300');header('X-Content-Type-Options: nosniff');header("Content-Security-Policy: default-src 'none'; media-src 'self'; img-src 'self'; sandbox");
header('Content-Disposition: '.($inline?'inline':'attachment').'; filename="'.str_replace(['"',"\r","\n"],'_',$name).'"');
readfile($real);exit;
