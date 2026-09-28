<?php
declare(strict_types=1);
final class KaretaSessionService {
  public const COOKIE='kareta_identity_session';
  private const ABSOLUTE_DAYS=30;
  private const IDLE_DAYS=7;
  private const ROTATE_AFTER_HOURS=24;
  private const GRACE_SECONDS=30;
  private const DEVICE_COOKIE='kareta_device';

  public function __construct(private PDO $pdo) {}

  public function create(int $accountId, ?int $contextId=null, ?int $rotatedFromId=null, ?string $absoluteExpiresAt=null): array {
    $record=$this->createRecord($accountId,$contextId,$rotatedFromId,$absoluteExpiresAt);
    $this->setCookie($record['_token'],strtotime($record['expiresAt']));
    unset($record['_token']);
    return $record;
  }

  public function current(bool $allowAutoRotation=true): ?array {
    $token=trim((string)($_COOKIE[self::COOKIE]??''));
    if($token==='')return null;
    $hash=hash('sha256',$token);
    $sql="SELECT s.*,a.phone,a.status AS account_status,p.id AS person_id,p.fullname
      FROM auth_sessions s
      JOIN accounts a ON a.id=s.account_id
      LEFT JOIN persons p ON p.account_id=a.id
      WHERE s.token_hash=?
        AND a.status='active'
        AND COALESCE(s.absolute_expires_at,s.expires_at)>NOW()
        AND COALESCE(s.idle_expires_at,s.expires_at)>NOW()
        AND (s.revoked_at IS NULL OR s.rotation_grace_until>NOW())
      LIMIT 1";
    $st=$this->pdo->prepare($sql);$st->execute([$hash]);$row=$st->fetch(PDO::FETCH_ASSOC);
    if(!$row){$this->clearCookie();return null;}

    if($allowAutoRotation && $row['revoked_at']===null && $this->shouldRotate($row)){
      $rotated=$this->rotateRow($row,'scheduled');
      if($rotated!==null){
        $fresh=$this->findById((int)$rotated['id']);
        if($fresh){$fresh['_rotation']=$rotated;return $fresh;}
      }
    }

    if($row['revoked_at']===null)$this->touch((int)$row['id'],(string)($row['absolute_expires_at']??$row['expires_at']));
    $row['_rotation']=null;
    return $row;
  }

  public function rotateCurrent(string $reason='manual'): ?array {
    $row=$this->current(false);
    if(!$row || $row['revoked_at']!==null)return null;
    return $this->rotateRow($row,$reason);
  }

  public function revokeCurrent(): bool {
    $row=$this->current(false);
    if(!$row){$this->clearCookie();return false;}
    $this->pdo->prepare("UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()),rotation_grace_until=NULL WHERE id=?")->execute([(int)$row['id']]);
    $this->clearCookie();
    return true;
  }

  private function rotateRow(array $row,string $reason): ?array {
    $this->pdo->beginTransaction();
    try{
      $lock=$this->pdo->prepare("SELECT * FROM auth_sessions WHERE id=? FOR UPDATE");$lock->execute([(int)$row['id']]);$current=$lock->fetch(PDO::FETCH_ASSOC);
      if(!$current || $current['revoked_at']!==null){$this->pdo->rollBack();return null;}
      $absolute=(string)($current['absolute_expires_at']??$current['expires_at']);
      if(strtotime($absolute)<=time()){$this->pdo->prepare("UPDATE auth_sessions SET revoked_at=NOW() WHERE id=?")->execute([(int)$current['id']]);$this->pdo->commit();$this->clearCookie();return null;}
      $new=$this->createRecord((int)$current['account_id'],$current['current_context_id']!==null?(int)$current['current_context_id']:null,(int)$current['id'],$absolute);
      $grace=(new DateTimeImmutable('+'.self::GRACE_SECONDS.' seconds'))->format('Y-m-d H:i:s');
      $up=$this->pdo->prepare("UPDATE auth_sessions SET revoked_at=NOW(),rotated_at=NOW(),rotation_grace_until=?,rotation_reason=?,rotated_to_session_id=? WHERE id=? AND revoked_at IS NULL");
      $up->execute([$grace,substr($reason,0,32),(int)$new['id'],(int)$current['id']]);
      $this->pdo->commit();
      $this->setCookie((string)$new['_token'],strtotime((string)$new['expiresAt']));
      unset($new['_token']);
      $new['graceUntil']=$grace;
      $new['rotatedFromSessionId']=(int)$current['id'];
      return $new;
    }catch(Throwable $e){if($this->pdo->inTransaction())$this->pdo->rollBack();throw $e;}
  }

  private function createRecord(int $accountId, ?int $contextId, ?int $rotatedFromId, ?string $absoluteExpiresAt): array {
    $token=bin2hex(random_bytes(32));
    $tokenHash=hash('sha256',$token);
    $sessionKey=hash('sha256',random_bytes(32));
    $now=new DateTimeImmutable('now');
    $absolute=$absoluteExpiresAt ? new DateTimeImmutable($absoluteExpiresAt) : $now->modify('+'.self::ABSOLUTE_DAYS.' days');
    $idle=$now->modify('+'.self::IDLE_DAYS.' days');
    if($idle>$absolute)$idle=$absolute;
    $expires=$idle;
    $device=$this->deviceId();
    $st=$this->pdo->prepare("INSERT INTO auth_sessions(session_key,token_hash,account_id,current_context_id,device_id,user_agent_hash,ip_prefix,last_seen_at,expires_at,absolute_expires_at,idle_expires_at,rotated_from_session_id) VALUES(?,?,?,?,?,?,?,NOW(),?,?,?,?)");
    $st->execute([$sessionKey,$tokenHash,$accountId,$contextId,$device,$this->userAgentHash(),$this->ipPrefix(),$expires->format('Y-m-d H:i:s'),$absolute->format('Y-m-d H:i:s'),$idle->format('Y-m-d H:i:s'),$rotatedFromId]);
    $id=(int)$this->pdo->lastInsertId();
    return ['id'=>$id,'accountId'=>$accountId,'currentContextId'=>$contextId,'expiresAt'=>$expires->format('Y-m-d H:i:s'),'absoluteExpiresAt'=>$absolute->format('Y-m-d H:i:s'),'idleExpiresAt'=>$idle->format('Y-m-d H:i:s'),'deviceId'=>$device,'rotated'=>$rotatedFromId!==null,'_token'=>$token];
  }

  private function shouldRotate(array $row): bool {
    $created=strtotime((string)$row['created_at']);
    return $created>0 && $created<=time()-(self::ROTATE_AFTER_HOURS*3600);
  }

  private function touch(int $id,string $absoluteExpiresAt): void {
    $absoluteTs=strtotime($absoluteExpiresAt);
    $idleTs=min($absoluteTs,time()+self::IDLE_DAYS*86400);
    $idle=date('Y-m-d H:i:s',$idleTs);
    $this->pdo->prepare("UPDATE auth_sessions SET last_seen_at=NOW(),idle_expires_at=?,expires_at=? WHERE id=? AND revoked_at IS NULL")->execute([$idle,$idle,$id]);
  }

  private function findById(int $id): ?array {
    $st=$this->pdo->prepare("SELECT s.*,a.phone,a.status AS account_status,p.id AS person_id,p.fullname FROM auth_sessions s JOIN accounts a ON a.id=s.account_id LEFT JOIN persons p ON p.account_id=a.id WHERE s.id=? LIMIT 1");
    $st->execute([$id]);$row=$st->fetch(PDO::FETCH_ASSOC);return $row?:null;
  }

  private function deviceId(): string {
    $header=trim((string)($_SERVER['HTTP_X_KARETA_DEVICE']??''));
    if($header!=='') return substr($header,0,128);
    $cookie=trim((string)($_COOKIE[self::DEVICE_COOKIE]??''));
    if(preg_match('/^[a-f0-9]{32,128}$/i',$cookie)) return substr(strtolower($cookie),0,128);
    $device=bin2hex(random_bytes(24));
    setcookie(self::DEVICE_COOKIE,$device,['expires'=>time()+31536000,'path'=>'/','secure'=>$this->isHttps(),'httponly'=>true,'samesite'=>'Lax']);
    $_COOKIE[self::DEVICE_COOKIE]=$device;
    return $device;
  }
  private function userAgentHash(): string { return hash('sha256',(string)($_SERVER['HTTP_USER_AGENT']??'')); }
  private function setCookie(string $token,int $expires): void { setcookie(self::COOKIE,$token,['expires'=>$expires,'path'=>'/','secure'=>$this->isHttps(),'httponly'=>true,'samesite'=>'Lax']); }
  private function clearCookie(): void { setcookie(self::COOKIE,'',['expires'=>time()-3600,'path'=>'/','secure'=>$this->isHttps(),'httponly'=>true,'samesite'=>'Lax']); }
  private function isHttps(): bool { return (!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off') || strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO']??''))==='https'; }
  private function ipPrefix(): string { $ip=(string)($_SERVER['REMOTE_ADDR']??'');if(filter_var($ip,FILTER_VALIDATE_IP,FILTER_FLAG_IPV4)){ $p=explode('.',$ip);return implode('.',array_slice($p,0,3)).'.0/24'; }if(filter_var($ip,FILTER_VALIDATE_IP,FILTER_FLAG_IPV6)){ $p=explode(':',$ip);return implode(':',array_slice($p,0,4)).'::/64'; }return ''; }
}
