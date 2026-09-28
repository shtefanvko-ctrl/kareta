<?php
declare(strict_types=1);
ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');
require __DIR__.'/bootstrap.php';
require_once __DIR__.'/identity/authorization_pipeline.php';
function ao_out(array $v,int $s=200):never{http_response_code($s);echo json_encode($v,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
function ao_body():array{$raw=file_get_contents('php://input');$v=json_decode($raw?:'{}',true);return is_array($v)?$v:[];}
function ao_admin(PDO $pdo):array{
 $legacy=function_exists('kareta_current_user')?kareta_current_user():null;
 try{$decision=kareta_authorize($pdo,'*',[],is_array($legacy)?$legacy:null);return ['account'=>(int)($decision->accountId??0),'user'=>(int)($legacy['id']??0)];}
 catch(DomainException $e){if(!in_array($e->getMessage(),['session_required','identity_account_unavailable'],true))ao_out(['ok'=>false,'error'=>$e->getMessage()],403);}
 catch(Throwable $e){ao_out(['ok'=>false,'error'=>'admin_identity_resolution_failed'],500);}
 $role=strtolower((string)($legacy['role']??''));if(!in_array($role,['admin','owner'],true))ao_out(['ok'=>false,'error'=>'admin_required'],403);return ['account'=>0,'user'=>(int)($legacy['id']??0)];
}
function ao_audit(PDO $pdo,array $actor,string $action,string $type,string $id,$before,$after,string $reason=''):void{
 $request=(string)($_SERVER['HTTP_X_REQUEST_ID']??'');
 $pdo->prepare("INSERT INTO admin_operation_audit(actor_account_id,actor_user_id,action_key,target_type,target_id,before_json,after_json,reason,request_id) VALUES(?,?,?,?,?,?,?,?,?)")
 ->execute([$actor['account']?:null,$actor['user']?:null,$action,$type,$id,json_encode($before,JSON_UNESCAPED_UNICODE),json_encode($after,JSON_UNESCAPED_UNICODE),$reason,$request]);
}
function ao_enum(string $value,array $allowed,string $error):string{if(!in_array($value,$allowed,true))ao_out(['ok'=>false,'error'=>$error],422);return $value;}
function ao_reason(string $reason):string{$reason=mb_substr(trim($reason),0,500);if(mb_strlen($reason)<3)ao_out(['ok'=>false,'error'=>'admin_reason_required'],422);return $reason;}
try{
 $pdo=kareta_pdo();if(!$pdo)ao_out(['ok'=>false,'error'=>'database_unavailable'],503);$actor=ao_admin($pdo);
 $method=$_SERVER['REQUEST_METHOD']??'GET';$action=(string)($_GET['action']??'overview');
 if($method==='GET'&&$action==='overview'){
  $counts=[];
  foreach(['accounts','persons','person_profiles','contexts','organizations','auth_sessions','moderation_cases'] as $table){try{$counts[$table]=(int)$pdo->query("SELECT COUNT(*) FROM `$table`")->fetchColumn();}catch(Throwable $e){$counts[$table]=0;}}
  $counts['activeSessions']=(int)$pdo->query("SELECT COUNT(*) FROM auth_sessions WHERE revoked_at IS NULL AND expires_at>NOW()")->fetchColumn();
  $counts['openModeration']=(int)$pdo->query("SELECT COUNT(*) FROM moderation_cases WHERE status IN('open','escalated')")->fetchColumn();
  $audit=$pdo->query("SELECT id,action_key actionKey,target_type targetType,target_id targetId,reason,created_at createdAt FROM admin_operation_audit ORDER BY id DESC LIMIT 30")->fetchAll(PDO::FETCH_ASSOC);
  ao_out(['ok'=>true,'counts'=>$counts,'audit'=>$audit]);
 }
 if($method==='GET'&&$action==='users'){
  $q=trim((string)($_GET['q']??''));$like='%'.$q.'%';
  $st=$pdo->prepare("SELECT a.id accountId,a.phone,a.status accountStatus,a.created_at createdAt,p.id personId,p.fullname,p.locale,p.timezone,
   (SELECT GROUP_CONCAT(CONCAT(pp.profile_type,':',pp.status) ORDER BY pp.profile_type SEPARATOR ',') FROM person_profiles pp WHERE pp.person_id=p.id) profiles,
   (SELECT COUNT(*) FROM auth_sessions s WHERE s.account_id=a.id AND s.revoked_at IS NULL AND s.expires_at>NOW()) activeSessions
   FROM accounts a LEFT JOIN persons p ON p.account_id=a.id
   WHERE ?='' OR a.phone LIKE ? OR p.fullname LIKE ? ORDER BY a.id DESC LIMIT 100");$st->execute([$q,$like,$like]);ao_out(['ok'=>true,'items'=>$st->fetchAll(PDO::FETCH_ASSOC)]);
 }
 if($method==='GET'&&$action==='accountDetail'){
  $accountId=(int)($_GET['accountId']??0);if($accountId<=0)ao_out(['ok'=>false,'error'=>'account_id_required'],422);
  $st=$pdo->prepare("SELECT a.id accountId,a.phone,a.status accountStatus,a.created_at createdAt,p.id personId,p.fullname,p.avatar,p.locale,p.timezone FROM accounts a LEFT JOIN persons p ON p.account_id=a.id WHERE a.id=? LIMIT 1");$st->execute([$accountId]);$account=$st->fetch(PDO::FETCH_ASSOC);if(!$account)ao_out(['ok'=>false,'error'=>'account_not_found'],404);
  $st=$pdo->prepare("SELECT pp.id,pp.profile_type profileType,pp.status,pp.legacy_entity_type legacyEntityType,pp.legacy_entity_id legacyEntityId,pp.created_at createdAt,pp.updated_at updatedAt FROM person_profiles pp JOIN persons p ON p.id=pp.person_id WHERE p.account_id=? ORDER BY pp.profile_type");$st->execute([$accountId]);$profiles=$st->fetchAll(PDO::FETCH_ASSOC)?:[];
  $st=$pdo->prepare("SELECT c.id,c.context_key contextKey,c.context_type contextType,c.status,c.account_id accountId,c.person_id personId,c.profile_id profileId,c.organization_key organizationKey,o.name organizationName,o.type organizationType,pp.profile_type profileType,COALESCE(memberSet.code,contextSet.code) capabilitySet,cm.id membershipId,cm.membership_status membershipStatus,c.created_at createdAt FROM contexts c LEFT JOIN context_members cm ON cm.context_id=c.id AND cm.account_id=? LEFT JOIN capability_sets memberSet ON memberSet.id=cm.capability_set_id LEFT JOIN capability_sets contextSet ON contextSet.id=c.capability_set_id LEFT JOIN person_profiles pp ON pp.id=c.profile_id LEFT JOIN organizations o ON o.id=c.organization_key WHERE c.account_id=? OR cm.account_id=? ORDER BY FIELD(c.context_type,'personal','profile','organization'),c.id");$st->execute([$accountId,$accountId,$accountId]);$contexts=$st->fetchAll(PDO::FETCH_ASSOC)?:[];
  $st=$pdo->prepare("SELECT s.id,s.current_context_id currentContextId,c.context_key currentContextKey,s.device_id deviceId,s.ip_prefix ipPrefix,s.last_seen_at lastSeenAt,s.expires_at expiresAt,s.absolute_expires_at absoluteExpiresAt,s.idle_expires_at idleExpiresAt,s.revoked_at revokedAt,s.created_at createdAt FROM auth_sessions s LEFT JOIN contexts c ON c.id=s.current_context_id WHERE s.account_id=? ORDER BY (s.revoked_at IS NULL AND s.expires_at>NOW()) DESC,s.id DESC LIMIT 100");$st->execute([$accountId]);$sessions=$st->fetchAll(PDO::FETCH_ASSOC)?:[];
  ao_out(['ok'=>true,'account'=>$account,'profiles'=>$profiles,'contexts'=>$contexts,'sessions'=>$sessions]);
 }
 if($method==='GET'&&$action==='organizations'){
  $q=trim((string)($_GET['q']??''));$like='%'.$q.'%';
  $st=$pdo->prepare("SELECT o.id,o.type,o.name,o.status,o.city,o.phone,
   (SELECT COUNT(*) FROM organization_members om WHERE om.organization_id=o.id AND om.status='active') members,
   (SELECT COUNT(*) FROM contexts c WHERE c.organization_key=o.id AND c.status='active') contexts
   FROM organizations o WHERE ?='' OR o.name LIKE ? OR o.id LIKE ? ORDER BY o.updated_at DESC LIMIT 100");$st->execute([$q,$like,$like]);ao_out(['ok'=>true,'items'=>$st->fetchAll(PDO::FETCH_ASSOC)]);
 }
 if($method==='GET'&&$action==='moderation'){
  $items=$pdo->query("SELECT id,case_key caseKey,entity_type entityType,entity_id entityId,status,priority,reason,created_at createdAt,updated_at updatedAt FROM moderation_cases ORDER BY FIELD(status,'open','escalated','hidden','rejected','approved','closed'),FIELD(priority,'critical','high','normal','low'),updated_at DESC LIMIT 100")->fetchAll(PDO::FETCH_ASSOC);
  ao_out(['ok'=>true,'items'=>$items]);
 }
 if($method==='POST'){
  $d=ao_body();$action=(string)($d['action']??$action);$reason=trim((string)($d['reason']??''));
  if($action==='setAccountStatus'){
   $reason=ao_reason($reason);
   $id=(int)($d['accountId']??0);$status=ao_enum((string)($d['status']??''),['active','blocked','deleted'],'invalid_account_status');
   $st=$pdo->prepare("SELECT id,phone,status FROM accounts WHERE id=? FOR UPDATE");$pdo->beginTransaction();$st->execute([$id]);$before=$st->fetch(PDO::FETCH_ASSOC);if(!$before){$pdo->rollBack();ao_out(['ok'=>false,'error'=>'account_not_found'],404);} $pdo->prepare("UPDATE accounts SET status=? WHERE id=?")->execute([$status,$id]);
   if($status!=='active')$pdo->prepare("UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()) WHERE account_id=? AND revoked_at IS NULL")->execute([$id]);
   $after=['id'=>$id,'status'=>$status];ao_audit($pdo,$actor,$action,'account',(string)$id,$before,$after,$reason);$pdo->commit();ao_out(['ok'=>true,'item'=>$after]);
  }
  if($action==='revokeSessions'){
   $reason=ao_reason($reason);
   $id=(int)($d['accountId']??0);$count=$pdo->prepare("UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()) WHERE account_id=? AND revoked_at IS NULL");$count->execute([$id]);ao_audit($pdo,$actor,$action,'account',(string)$id,[],['revoked'=>$count->rowCount()],$reason);ao_out(['ok'=>true,'revoked'=>$count->rowCount()]);
  }
  if($action==='revokeSession'){
   $reason=ao_reason($reason);$id=(int)($d['sessionId']??0);$accountId=(int)($d['accountId']??0);
   $st=$pdo->prepare('SELECT id,account_id,current_context_id,revoked_at,expires_at FROM auth_sessions WHERE id=? AND account_id=? LIMIT 1');$st->execute([$id,$accountId]);$before=$st->fetch(PDO::FETCH_ASSOC);if(!$before)ao_out(['ok'=>false,'error'=>'session_not_found'],404);
   $pdo->prepare('UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()) WHERE id=? AND account_id=?')->execute([$id,$accountId]);ao_audit($pdo,$actor,$action,'auth_session',(string)$id,$before,['revoked'=>true],$reason);ao_out(['ok'=>true,'sessionId'=>$id]);
  }
  if($action==='setProfileStatus'){
   $reason=ao_reason($reason);$id=(int)($d['profileId']??0);$status=ao_enum((string)($d['status']??''),['draft','active','suspended','archived'],'invalid_profile_status');$st=$pdo->prepare("SELECT * FROM person_profiles WHERE id=?");$st->execute([$id]);$before=$st->fetch(PDO::FETCH_ASSOC);if(!$before)ao_out(['ok'=>false,'error'=>'profile_not_found'],404);$pdo->beginTransaction();$pdo->prepare("UPDATE person_profiles SET status=? WHERE id=?")->execute([$status,$id]);if($status!=='active'){$pdo->prepare("UPDATE contexts SET status='suspended' WHERE profile_id=? AND status='active'")->execute([$id]);$pdo->prepare("UPDATE auth_sessions s JOIN contexts c ON c.id=s.current_context_id SET s.revoked_at=COALESCE(s.revoked_at,NOW()) WHERE c.profile_id=? AND s.revoked_at IS NULL")->execute([$id]);}ao_audit($pdo,$actor,$action,'profile',(string)$id,$before,['status'=>$status],$reason);$pdo->commit();ao_out(['ok'=>true]);
  }
  if($action==='setContextStatus'){
   $reason=ao_reason($reason);$id=(int)($d['contextId']??0);$status=ao_enum((string)($d['status']??''),['active','suspended','archived'],'invalid_context_status');$st=$pdo->prepare("SELECT id,context_key,status FROM contexts WHERE id=?");$st->execute([$id]);$before=$st->fetch(PDO::FETCH_ASSOC);if(!$before)ao_out(['ok'=>false,'error'=>'context_not_found'],404);$pdo->beginTransaction();$pdo->prepare("UPDATE contexts SET status=? WHERE id=?")->execute([$status,$id]);if($status!=='active')$pdo->prepare("UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()) WHERE current_context_id=? AND revoked_at IS NULL")->execute([$id]);ao_audit($pdo,$actor,$action,'context',(string)$id,$before,['status'=>$status],$reason);$pdo->commit();ao_out(['ok'=>true]);
  }
  if($action==='setOrganizationStatus'){
   $reason=ao_reason($reason);
   $id=(string)($d['organizationId']??'');$status=ao_enum((string)($d['status']??''),['active','inactive','blocked','archived'],'invalid_organization_status');$st=$pdo->prepare("SELECT id,name,status FROM organizations WHERE id=?");$st->execute([$id]);$before=$st->fetch(PDO::FETCH_ASSOC);if(!$before)ao_out(['ok'=>false,'error'=>'organization_not_found'],404);$pdo->beginTransaction();$pdo->prepare("UPDATE organizations SET status=? WHERE id=?")->execute([$status,$id]);if($status!=='active'){$pdo->prepare("UPDATE auth_sessions s JOIN contexts c ON c.id=s.current_context_id SET s.revoked_at=COALESCE(s.revoked_at,NOW()) WHERE c.organization_key=? AND s.revoked_at IS NULL")->execute([$id]);$pdo->prepare("UPDATE contexts SET status='suspended' WHERE organization_key=? AND status='active'")->execute([$id]);}ao_audit($pdo,$actor,$action,'organization',$id,$before,['status'=>$status],$reason);$pdo->commit();ao_out(['ok'=>true]);
  }
  if($action==='setMembershipStatus'){
   $reason=ao_reason($reason);$id=(int)($d['membershipId']??0);$status=ao_enum((string)($d['status']??''),['invited','active','suspended','revoked'],'invalid_membership_status');$st=$pdo->prepare("SELECT * FROM context_members WHERE id=?");$st->execute([$id]);$before=$st->fetch(PDO::FETCH_ASSOC);if(!$before)ao_out(['ok'=>false,'error'=>'membership_not_found'],404);$pdo->beginTransaction();$pdo->prepare("UPDATE context_members SET membership_status=? WHERE id=?")->execute([$status,$id]);if($status!=='active')$pdo->prepare("UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()) WHERE account_id=? AND current_context_id=? AND revoked_at IS NULL")->execute([(int)$before['account_id'],(int)$before['context_id']]);ao_audit($pdo,$actor,$action,'context_member',(string)$id,$before,['membership_status'=>$status],$reason);$pdo->commit();ao_out(['ok'=>true]);
  }
  if($action==='createModerationCase'){
   $reason=ao_reason($reason);$type=trim((string)($d['entityType']??''));$id=trim((string)($d['entityId']??''));if($type===''||$id==='')ao_out(['ok'=>false,'error'=>'moderation_target_required'],422);$priority=ao_enum((string)($d['priority']??'normal'),['low','normal','high','critical'],'invalid_priority');$key='mod_'.bin2hex(random_bytes(12));$pdo->prepare("INSERT INTO moderation_cases(case_key,entity_type,entity_id,priority,reason,created_by_account_id) VALUES(?,?,?,?,?,?)")->execute([$key,$type,$id,$priority,$reason,$actor['account']?:null]);ao_audit($pdo,$actor,$action,$type,$id,[],['caseKey'=>$key,'priority'=>$priority],$reason);ao_out(['ok'=>true,'caseKey'=>$key]);
  }
  if($action==='resolveModerationCase'){
   $reason=ao_reason($reason);$id=(int)($d['caseId']??0);$status=ao_enum((string)($d['status']??''),['approved','rejected','hidden','escalated','closed'],'invalid_moderation_status');$st=$pdo->prepare("SELECT * FROM moderation_cases WHERE id=?");$st->execute([$id]);$before=$st->fetch(PDO::FETCH_ASSOC);if(!$before)ao_out(['ok'=>false,'error'=>'moderation_case_not_found'],404);$resolved=in_array($status,['approved','rejected','hidden','closed'],true);$pdo->prepare("UPDATE moderation_cases SET status=?,reason=IF(?<>'',?,reason),resolved_by_account_id=?,resolved_at=IF(?,NOW(),NULL) WHERE id=?")->execute([$status,$reason,$reason,$actor['account']?:null,$resolved?1:0,$id]);ao_audit($pdo,$actor,$action,'moderation_case',(string)$id,$before,['status'=>$status],$reason);ao_out(['ok'=>true]);
  }
 }
 ao_out(['ok'=>false,'error'=>'unsupported_action'],400);
}catch(Throwable $e){if(isset($pdo)&&$pdo instanceof PDO&&$pdo->inTransaction())$pdo->rollBack();if(function_exists('kareta_log_error'))kareta_log_error('ADMIN_OPERATION',$e->getMessage());ao_out(['ok'=>false,'error'=>'admin_operation_error','requestId'=>defined('KARETA_REQUEST_ID')?KARETA_REQUEST_ID:''],500);}
