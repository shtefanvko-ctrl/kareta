<?php
declare(strict_types=1);
require_once __DIR__.'/session_service.php';
require_once __DIR__.'/context_service.php';
require_once __DIR__.'/capability_service.php';
require_once __DIR__.'/account_service.php';
require_once __DIR__.'/profile_service.php';

final class KaretaAuthResolution {
  public function __construct(
    public string $mode,
    public int $accountId,
    public int $personId,
    public array $account,
    public array $context,
    public array $capabilities,
    public array $deniedCapabilities,
    public ?array $identitySession,
    public ?array $legacyUser
  ) {}
}

final class KaretaAuthResolver {
  private KaretaSessionService $sessions;
  private KaretaIdentityContextService $contexts;
  private KaretaCapabilityService $capabilityEngine;
  public function __construct(private PDO $pdo){
    $this->sessions=new KaretaSessionService($pdo);
    $this->contexts=new KaretaIdentityContextService($pdo);
    $this->capabilityEngine=new KaretaCapabilityService($pdo,$this->contexts);
  }

  public function resolve(bool $required=true): ?KaretaAuthResolution {
    $identity=$this->sessions->current(false);
    $legacy=function_exists('kareta_current_user')?(kareta_current_user()?:null):null;
    $identityId=(int)($identity['account_id']??0);
    $legacyAccount=$this->legacyAccount($legacy);
    $legacyId=(int)($legacyAccount['id']??0);
    if($identityId>0 && $legacyId>0 && $identityId!==$legacyId){
      $this->audit($identityId,'conflict','identity_legacy_account_mismatch',['legacyAccountId'=>$legacyId]);
      $this->logoutAll();
      throw new DomainException('session_identity_conflict');
    }
    $account=null;$mode='anonymous';
    if($identityId>0){
      $account=['id'=>$identityId,'phone'=>(string)($identity['phone']??''),'personId'=>(int)($identity['person_id']??0)?:null,'fullname'=>(string)($identity['fullname']??'')];
      $mode=$legacyId>0?'dual-compatible':'identity';
      // Seed ContextService with the identity session.
      $this->contexts->resolveAccount($legacy??[]);
    }elseif($legacyId>0){$account=$legacyAccount;$mode='legacy-compatible';}
    if(!$account){
      if($required) throw new DomainException('session_required');
      return null;
    }
    $accountId=(int)$account['id'];
    $context=$this->contexts->currentContext($accountId);
    if($identityId>0 && (int)($identity['current_context_id']??0)>0 && (int)$identity['current_context_id']!==(int)$context['id']){
      // ContextService may safely recover an unavailable/archived context to Personal and
      // persist the new value in the same session. Re-read the session before declaring
      // a mismatch so revoked memberships do not produce a false authentication failure.
      $freshIdentity=$this->sessions->current(false);
      $freshContextId=(int)($freshIdentity['current_context_id']??0);
      if($freshContextId!==(int)$context['id']){
        $this->audit($accountId,'deny','session_context_mismatch',['sessionContextId'=>$freshContextId,'resolvedContextId'=>(int)$context['id']]);
        throw new DomainException('session_context_mismatch');
      }
      $identity=$freshIdentity;
      $this->audit($accountId,'allow','context_recovered',['contextId'=>(int)$context['id']]);
    }
    $effective=$this->capabilityEngine->effective($accountId,(int)$context['id']);
    $personId=(int)($account['personId']??0);
    if($personId<=0){$st=$this->pdo->prepare('SELECT id FROM persons WHERE account_id=? LIMIT 1');$st->execute([$accountId]);$personId=(int)($st->fetchColumn()?:0);}
    $this->audit($accountId,'allow',$mode,['contextId'=>(int)$context['id']]);
    return new KaretaAuthResolution($mode,$accountId,$personId,$account,$context,$effective['allowed']??[],$effective['denied']??[],$identity,$legacy);
  }

  public function logoutAll(): array {
    $identityRevoked=$this->sessions->revokeCurrent();
    $legacyCleared=false;
    if(session_status()===PHP_SESSION_ACTIVE){
      $_SESSION=[];
      if(ini_get('session.use_cookies')){$p=session_get_cookie_params();setcookie(session_name(),'',['expires'=>time()-3600,'path'=>$p['path']??'/','domain'=>$p['domain']??'','secure'=>(bool)($p['secure']??false),'httponly'=>true,'samesite'=>'Lax']);}
      $legacyCleared=session_destroy();
    }
    $secure=(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off')||strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO']??''))==='https';
    foreach(['kareta_phone','kareta_role','kareta_onb_done','kareta_entry_role','kareta_demo_role'] as $name){setcookie($name,'',['expires'=>time()-3600,'path'=>'/','secure'=>$secure,'httponly'=>true,'samesite'=>'Lax']);}
    return ['identityRevoked'=>$identityRevoked,'legacyCleared'=>$legacyCleared];
  }

  private function legacyAccount(?array $legacy): ?array {
    if(!$legacy)return null;
    $phone=function_exists('kareta_normalize_phone')?kareta_normalize_phone((string)($legacy['phone']??'')):preg_replace('/\D+/','',(string)($legacy['phone']??''));
    if(!$phone)return null;
    $st=$this->pdo->prepare("SELECT a.id,a.phone,p.id AS person_id,p.fullname FROM accounts a LEFT JOIN persons p ON p.account_id=a.id WHERE a.phone=? AND a.status='active' LIMIT 1");
    $st->execute([$phone]);$r=$st->fetch(PDO::FETCH_ASSOC);
    if(!$r){
      $created=(new KaretaAccountService($this->pdo))->ensure($phone,trim((string)($legacy['name']??'')));
      (new KaretaProfileService($this->pdo))->ensureClient((int)$created['personId']);
      return ['id'=>(int)$created['id'],'phone'=>(string)$created['phone'],'personId'=>(int)$created['personId'],'fullname'=>trim((string)($legacy['name']??''))];
    }
    return $r?['id'=>(int)$r['id'],'phone'=>(string)$r['phone'],'personId'=>(int)($r['person_id']??0)?:null,'fullname'=>(string)($r['fullname']??'')]:null;
  }
  private function audit(?int $accountId,string $decision,string $reason,array $payload):void{
    try{$st=$this->pdo->prepare("INSERT INTO auth_resolver_audit(account_id,decision,reason,request_method,request_path,request_id,payload_json) VALUES(?,?,?,?,?,?,?)");$st->execute([$accountId,$decision,substr($reason,0,80),(string)($_SERVER['REQUEST_METHOD']??''),substr((string)($_SERVER['REQUEST_URI']??''),0,255),defined('KARETA_REQUEST_ID')?KARETA_REQUEST_ID:null,json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);}catch(Throwable $_){}
  }
}
