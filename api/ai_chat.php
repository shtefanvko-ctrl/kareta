<?php
declare(strict_types=1);
/**
 * KARETA AI user API. No Open WebUI admin token, no direct client Ollama access.
 * Disabled by default; enable only after isolated QA and authorised release.
 */
require_once __DIR__.'/bootstrap.php';
require_once __DIR__.'/identity/session_service.php';
require_once __DIR__.'/ai/owner_guard.php';
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function ai_reply(array $data,int $code=200): never {
 http_response_code($code);
 echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_INVALID_UTF8_SUBSTITUTE);
 exit;
}
function ai_owned(PDO $pdo,int $account,string $id): array {
 if(!preg_match('/^[a-f0-9]{32}$/D',$id))ai_reply(['ok'=>false,'error'=>'invalid_conversation'],422);
 $row=kareta_ai_owned_conversation($pdo,$account,$id);
 if(!$row)ai_reply(['ok'=>false,'error'=>'conversation_not_found'],404);
 return $row;
}
function ai_model(): string {
 $model=trim((string)(getenv('KARETA_AI_USER_MODEL')?:'qwen3.5:2b-q4_K_M'));
 return preg_match('/^[A-Za-z0-9_.:-]{1,70}$/D',$model)?$model:'qwen3.5:2b-q4_K_M';
}
function ai_predict(array $messages): string {
 if(!function_exists('curl_init'))throw new RuntimeException('provider_unavailable');
 $url='http://127.0.0.1:11434/api/chat'; // fixed loopback, never client-supplied
 $request=json_encode([
  'model'=>ai_model(), 'messages'=>$messages,'stream'=>false,'think'=>false,
  'options'=>['num_ctx'=>1536,'num_predict'=>128,'num_thread'=>2,'temperature'=>0.4],
  'keep_alive'=>'30s'
 ],JSON_INVALID_UTF8_SUBSTITUTE|JSON_UNESCAPED_UNICODE);
 if($request===false)throw new RuntimeException('invalid_payload');
 $ch=curl_init($url);
 curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>$request,
  CURLOPT_HTTPHEADER=>['Content-Type: application/json'],CURLOPT_RETURNTRANSFER=>true,
  CURLOPT_CONNECTTIMEOUT=>2,CURLOPT_TIMEOUT=>30,
  CURLOPT_PROTOCOLS=>CURLPROTO_HTTP, CURLOPT_MAXREDIRS=>0]);
 $raw=curl_exec($ch);$http=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
 if(!is_string($raw) || strlen($raw)>500000 || $http!==200)throw new RuntimeException('model_timeout_or_unavailable');
 $json=json_decode($raw,true);
 $content=is_array($json)?($json['message']['content']??''):'';
 if(!is_string($content)||trim($content)==='')throw new RuntimeException('empty_ai_reply');
 return mb_substr(trim($content),0,6000,'UTF-8');
}
if(!in_array($_SERVER['REQUEST_METHOD']??'GET',['GET','POST'],true))ai_reply(['ok'=>false,'error'=>'method_not_allowed'],405);
$pdo=kareta_pdo();
if(!$pdo instanceof PDO)ai_reply(['ok'=>false,'error'=>'database_unavailable'],503);
try{$session=(new KaretaSessionService($pdo))->current(false);}
catch(Throwable $e){ai_reply(['ok'=>false,'error'=>'session_check_failed'],503);}
if(!$session)ai_reply(['ok'=>false,'error'=>'login_required'],401);
$account=(int)($session['account_id']??0);
if($account<=0)ai_reply(['ok'=>false,'error'=>'login_required'],401);
if((string)getenv('KARETA_AI_USER_GATEWAY_ENABLED')!=='1')ai_reply(['ok'=>false,'error'=>'ai_gateway_not_enabled'],503);
$method=(string)$_SERVER['REQUEST_METHOD'];
$action=trim((string)($_GET['action']??($method==='POST'?'send':'status')));
if($method==='GET'){
 if($action==='status')ai_reply(['ok'=>true,'authenticated'=>true,'model'=>ai_model()]);
 if($action==='conversations'){
  $st=$pdo->prepare('SELECT id,title,updated_at FROM ai_user_conversations WHERE account_id=? ORDER BY updated_at DESC LIMIT 30');
  $st->execute([$account]);ai_reply(['ok'=>true,'conversations'=>$st->fetchAll(PDO::FETCH_ASSOC)]);
 }
 if($action==='messages'){
  $id=(string)($_GET['conversationId']??'');
  ai_owned($pdo,$account,$id);
  ai_reply(['ok'=>true,'messages'=>kareta_ai_owned_messages($pdo,$account,$id)]);
 }
 ai_reply(['ok'=>false,'error'=>'unknown_action'],404);
}
if($method!=='POST'||$action!=='send')ai_reply(['ok'=>false,'error'=>'unknown_action'],404);
if(stripos((string)($_SERVER['CONTENT_TYPE']??''),'application/json')!==0)ai_reply(['ok'=>false,'error'=>'json_required'],415);
if(($_SERVER['HTTP_X_KARETA_AI_CLIENT']??'')!=='1')ai_reply(['ok'=>false,'error'=>'client_header_required'],403);
$raw=file_get_contents('php://input',false,null,0,5001);
if(!is_string($raw)||strlen($raw)>5000)ai_reply(['ok'=>false,'error'=>'payload_too_large'],413);
$body=json_decode($raw,true);
if(!is_array($body))ai_reply(['ok'=>false,'error'=>'invalid_json'],422);
$prompt=trim((string)($body['message']??''));
if($prompt===''||mb_strlen($prompt,'UTF-8')>1500)ai_reply(['ok'=>false,'error'=>'message_size_invalid'],422);
$convId=trim((string)($body['conversationId']??''));
if($convId!=='')ai_owned($pdo,$account,$convId);
$locked=false;
try{
 // Serialize expensive inference globally, fail fast rather than exhaust RAM/swap.
 $lock=$pdo->query("SELECT GET_LOCK('kareta_ai_inference_single',0)");
 $locked=(int)$lock->fetchColumn()===1;
 if(!$locked)ai_reply(['ok'=>false,'error'=>'model_busy','retryAfter'=>10],429);
 $st=$pdo->prepare("SELECT COUNT(*) FROM ai_user_messages WHERE account_id=? AND role='user' AND created_at>DATE_SUB(NOW(),INTERVAL 1 HOUR)");
 $st->execute([$account]);
 if((int)$st->fetchColumn()>=10){$pdo->query("SELECT RELEASE_LOCK('kareta_ai_inference_single')");$locked=false;ai_reply(['ok'=>false,'error'=>'hourly_limit'],429);}
 $messages=[['role'=>'system','content'=>'Ты KARETA AI. Отвечай по-русски, точно и кратко. Не раскрывай данные других пользователей.']];
 if($convId!==''){
  $st=$pdo->prepare('SELECT role,content FROM ai_user_messages WHERE conversation_id=? AND account_id=? ORDER BY id DESC LIMIT 8');
  $st->execute([$convId,$account]);
  foreach(array_reverse($st->fetchAll(PDO::FETCH_ASSOC)) as $row)$messages[]=['role'=>$row['role'],'content'=>$row['content']];
 }
 $messages[]=['role'=>'user','content'=>$prompt];
 $answer=ai_predict($messages);
 $pdo->beginTransaction();
 if($convId===''){
  $convId=bin2hex(random_bytes(16));
  $st=$pdo->prepare('INSERT INTO ai_user_conversations(id,account_id,title) VALUES(?,?,?)');
  $st->execute([$convId,$account,mb_substr($prompt,0,75,'UTF-8')]);
 } else ai_owned($pdo,$account,$convId);
 $st=$pdo->prepare('INSERT INTO ai_user_messages(conversation_id,account_id,role,content) VALUES(?,?,?,?)');
 $st->execute([$convId,$account,'user',$prompt]);
 $st->execute([$convId,$account,'assistant',$answer]);
 $st=$pdo->prepare('UPDATE ai_user_conversations SET updated_at=NOW() WHERE id=? AND account_id=?');
 $st->execute([$convId,$account]);
 $pdo->commit();
 $pdo->query("SELECT RELEASE_LOCK('kareta_ai_inference_single')");$locked=false;
 ai_reply(['ok'=>true,'conversationId'=>$convId,'answer'=>$answer,'model'=>ai_model()]);
}catch(Throwable $e){
 if($pdo->inTransaction())$pdo->rollBack();
 if($locked){try{$pdo->query("SELECT RELEASE_LOCK('kareta_ai_inference_single')");}catch(Throwable $ignored){}$locked=false;}
 if($e instanceof PDOException)ai_reply(['ok'=>false,'error'=>'database_error'],503);
 ai_reply(['ok'=>false,'error'=>'model_unavailable'],504);
}finally{
 if($locked)try{$pdo->query("SELECT RELEASE_LOCK('kareta_ai_inference_single')");}catch(Throwable $ignored){}
}
