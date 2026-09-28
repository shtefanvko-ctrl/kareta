<?php
declare(strict_types=1);

final class KaretaIdentityContextService
{
    private PDO $pdo;
    private ?array $resolvedSession = null;

    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function accountTypeApprovalMode(): string
    {
        if((defined('KARETA_ENVIRONMENT')?KARETA_ENVIRONMENT:'production')==='production')return 'admin_review';
        $mode=defined('KARETA_ACCOUNT_TYPE_APPROVAL_MODE')
            ? strtolower(trim((string)KARETA_ACCOUNT_TYPE_APPROVAL_MODE))
            : 'admin_review';
        return in_array($mode,['test_auto','admin_review'],true)?$mode:'admin_review';
    }

    public function autoApprovePendingApplications(int $accountId): int
    {
        if((defined('KARETA_ENVIRONMENT')?KARETA_ENVIRONMENT:'production')==='production')return 0;
        if($this->accountTypeApprovalMode()!=='test_auto'||!$this->tableExists('role_applications'))return 0;
        $stmt=$this->pdo->prepare("SELECT u.id FROM accounts a JOIN users u ON u.phone=a.phone WHERE a.id=? AND u.active=1 LIMIT 1");
        $stmt->execute([$accountId]);
        $userId=(int)($stmt->fetchColumn()?:0);
        if($userId<=0)return 0;

        // If an approved row already exists, a stale pending duplicate is not needed.
        $delete=$this->pdo->prepare("DELETE pending FROM role_applications pending JOIN role_applications approved ON approved.user_id=pending.user_id AND approved.requested_role=pending.requested_role AND approved.status='approved' WHERE pending.user_id=? AND pending.status='pending'");
        $delete->execute([$userId]);

        // Reconciliation transition marker: ra.status='pending' -> ra.status='approved'.
        $approve=$this->pdo->prepare("UPDATE role_applications ra SET status='approved',reviewed_by_user_id=NULL,reviewed_at=NOW(),updated_at=CURRENT_TIMESTAMP WHERE ra.user_id=? AND ra.status='pending' AND ra.requested_role IN ('master','sto','seller')");
        $approve->execute([$userId]);
        return $approve->rowCount();
    }

    public function resolveAccount(array $legacyUser = []): ?array
    {
        $identityToken = trim((string)($_COOKIE['kareta_identity_session'] ?? ''));
        if ($identityToken !== '') {
            $hash = hash('sha256', $identityToken);
            $stmt = $this->pdo->prepare("SELECT s.*,a.id AS resolved_account_id,a.phone,a.status AS account_status,p.id AS person_id,p.fullname
                FROM auth_sessions s
                JOIN accounts a ON a.id=s.account_id
                LEFT JOIN persons p ON p.account_id=a.id
                WHERE s.token_hash=?
                  AND (s.revoked_at IS NULL OR s.rotation_grace_until>NOW())
                  AND COALESCE(s.absolute_expires_at,s.expires_at)>NOW()
                  AND COALESCE(s.idle_expires_at,s.expires_at)>NOW()
                  AND a.status='active' LIMIT 1");
            $stmt->execute([$hash]);
            $session = $stmt->fetch(PDO::FETCH_ASSOC);
            if (is_array($session)) { $this->resolvedSession = $session; return $this->accountPayload($session); }
        }

        $phone = function_exists('kareta_normalize_phone')
            ? kareta_normalize_phone((string)($legacyUser['phone'] ?? ''))
            : preg_replace('/\D+/', '', (string)($legacyUser['phone'] ?? ''));
        if ($phone === '') return null;
        $stmt = $this->pdo->prepare("SELECT a.id,a.phone,a.status,p.id AS person_id,p.fullname FROM accounts a LEFT JOIN persons p ON p.account_id=a.id WHERE a.phone=? AND a.status='active' LIMIT 1");
        $stmt->execute([$phone]);
        $account = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($account) ? $this->accountPayload($account) : null;
    }

    public function listContexts(int $accountId): array
    {
        $this->reconcileContexts($accountId);
        $stmt = $this->pdo->prepare("SELECT DISTINCT
                c.id,c.context_key,c.context_type,c.account_id,c.person_id,c.profile_id,c.organization_id,c.organization_key,
                c.capability_set_id,c.status,c.created_at,
                pp.profile_type,pp.status AS profile_status,
                cs.code AS capability_set_code,cs.title AS capability_set_title,
                o.name AS organization_name,o.type AS organization_type,
                CASE WHEN c.account_id=? OR cs.code='organization.owner' THEN 'owner' ELSE 'member' END AS access_mode
            FROM contexts c
            LEFT JOIN context_members cm ON cm.context_id=c.id AND cm.account_id=? AND cm.membership_status='active'
            LEFT JOIN person_profiles pp ON pp.id=c.profile_id
            LEFT JOIN capability_sets cs ON cs.id=COALESCE(cm.capability_set_id,c.capability_set_id)
            LEFT JOIN organizations o ON o.id=c.organization_key
            WHERE c.status='active' AND (c.account_id=? OR cm.account_id=?)
            ORDER BY FIELD(c.context_type,'personal','profile','organization'),c.id");
        $stmt->execute([$accountId,$accountId,$accountId,$accountId]);
        return array_map([$this, 'contextPayload'], $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }


    public function listAccountTypes(int $accountId, ?array $contexts=null): array
    {
        $contexts = is_array($contexts) ? $contexts : $this->listContexts($accountId);
        $stmt=$this->pdo->prepare("SELECT u.id,u.role FROM accounts a LEFT JOIN users u ON u.phone=a.phone WHERE a.id=? LIMIT 1");
        $stmt->execute([$accountId]);
        $legacy=$stmt->fetch(PDO::FETCH_ASSOC)?:[];
        $userId=(int)($legacy['id']??0);
        $applications=[];
        if($userId>0&&$this->tableExists('role_applications')){
            $q=$this->pdo->prepare("SELECT requested_role,status,created_at,updated_at FROM role_applications WHERE user_id=? AND requested_role IN ('master','sto','seller') ORDER BY updated_at DESC,id DESC");
            $q->execute([$userId]);
            foreach($q->fetchAll(PDO::FETCH_ASSOC)?:[] as $row){
                $role=strtolower((string)($row['requested_role']??''));
                if($role!==''&&!isset($applications[$role]))$applications[$role]=$row;
            }
        }
        $findContext=static function(string $role,array $items):?array{
            if($role==='seller'){
                foreach($items as $context){
                    if(($context['type']??'')==='organization'&&strtolower((string)($context['organizationType']??$context['organization_type']??''))==='parts_store')return $context;
                }
            }
            foreach($items as $context){
                $type=(string)($context['type']??'');
                $profile=strtolower((string)($context['profileType']??$context['profile_type']??''));
                $organization=strtolower((string)($context['organizationType']??$context['organization_type']??''));
                if($role==='client'&&$type==='personal')return $context;
                if($role==='master'&&$type==='profile'&&$profile==='master')return $context;
                if($role==='seller'&&$type==='profile'&&$profile==='seller')return $context;
                if($role==='sto'&&$type==='organization'&&$organization!=='parts_store')return $context;
            }
            return null;
        };
        $definitions=[
            'client'=>['label'=>'Клиент','icon'=>'user'],
            'master'=>['label'=>'Мастер','icon'=>'masters'],
            'sto'=>['label'=>'СТО','icon'=>'work'],
            'seller'=>['label'=>'Магазин','icon'=>'store'],
        ];
        $result=[];
        foreach($definitions as $role=>$definition){
            $context=$findContext($role,$contexts);
            $application=$applications[$role]??null;
            $applicationStatus=strtolower((string)($application['status']??''));
            $status=$context?'active':($role==='client'?'active':($applicationStatus==='pending'?'pending':($applicationStatus==='approved'?'setup_required':($applicationStatus==='rejected'?'rejected':'available'))));
            $statusLabel=match($status){
                'active'=>'Доступен',
                'pending'=>'На проверке',
                'rejected'=>'Можно повторить',
                'setup_required'=>'Завершение настройки',
                default=>'Можно добавить',
            };
            $description=$context?(string)($context['label']??$definition['label']):match($status){
                'pending'=>'Заявка отправлена администратору',
                'rejected'=>'Заявка отклонена — можно отправить снова',
                'setup_required'=>'Тип одобрен, рабочее пространство создаётся',
                default=>'Добавить к текущему номеру телефона',
            };
            $result[]=[
                'role'=>$role,'label'=>$definition['label'],'icon'=>$definition['icon'],'status'=>$status,
                'statusLabel'=>$statusLabel,'description'=>$description,
                'contextId'=>(int)($context['id']??0)?:null,'contextKey'=>(string)($context['key']??''),
                'applicationStatus'=>$applicationStatus,'applicationUpdatedAt'=>$application['updated_at']??null,
            ];
        }
        return $result;
    }

    public function requestAccountType(int $accountId,string $role,array $payload=[]): array
    {
        $role=strtolower(trim($role));
        if(!in_array($role,['master','sto','seller'],true))throw new InvalidArgumentException('invalid_account_type');
        $approvalMode=$this->accountTypeApprovalMode();
        $autoApproved=$approvalMode==='test_auto';
        $contexts=$this->listContexts($accountId);
        foreach($this->listAccountTypes($accountId,$contexts) as $type){
            if(($type['role']??'')!==$role)continue;
            if(($type['status']??'')==='active')return [
                'created'=>false,'alreadyActive'=>true,'alreadyPending'=>false,
                'approvalMode'=>$approvalMode,'autoApproved'=>$autoApproved,
                'status'=>'approved','targetContextId'=>(int)($type['contextId']??0)?:null,
                'targetContextKey'=>(string)($type['contextKey']??''),
                'accountTypes'=>$this->listAccountTypes($accountId,$contexts),
            ];
            if(($type['status']??'')==='pending'&&!$autoApproved)return [
                'created'=>false,'alreadyActive'=>false,'alreadyPending'=>true,
                'approvalMode'=>$approvalMode,'autoApproved'=>false,'status'=>'pending',
                'targetContextId'=>null,'targetContextKey'=>'',
                'accountTypes'=>$this->listAccountTypes($accountId,$contexts),
            ];
        }
        if(!$this->tableExists('role_applications'))throw new RuntimeException('role_applications_unavailable');
        $stmt=$this->pdo->prepare("SELECT u.id FROM accounts a JOIN users u ON u.phone=a.phone WHERE a.id=? AND u.active=1 LIMIT 1");
        $stmt->execute([$accountId]);$userId=(int)($stmt->fetchColumn()?:0);
        if($userId<=0)throw new RuntimeException('legacy_user_not_found');
        $safePayload=[
            'source'=>'identity_context_switcher',
            'accountId'=>$accountId,
            'requestedAt'=>date(DATE_ATOM),
            'approvalMode'=>$approvalMode,
        ];
        foreach(['specialization','city','name','storeName'] as $key){
            $value=trim((string)($payload[$key]??''));
            if($value!=='')$safePayload[$key]=mb_substr($value,0,191);
        }
        $json=json_encode($safePayload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)?:'{}';
        // Historical R188.5.5.6.10 verifier marker: VALUES(?,?,'pending',?)
        $status=$autoApproved?'approved':'pending';
        $startedTransaction=!$this->pdo->inTransaction();
        if($startedTransaction)$this->pdo->beginTransaction();
        try{
            $find=$this->pdo->prepare("SELECT id FROM role_applications WHERE user_id=? AND requested_role=? ORDER BY updated_at DESC,id DESC");
            $find->execute([$userId,$role]);
            $ids=array_values(array_filter(array_map('intval',$find->fetchAll(PDO::FETCH_COLUMN)?:[])));
            $applicationId=(int)($ids[0]??0);
            if($applicationId>0){
                $delete=$this->pdo->prepare("DELETE FROM role_applications WHERE user_id=? AND requested_role=? AND id<>?");
                $delete->execute([$userId,$role,$applicationId]);
                $update=$this->pdo->prepare("UPDATE role_applications SET status=?,payload_json=?,reviewed_by_user_id=NULL,reviewed_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?");
                $update->execute([$status,$json,$autoApproved?date('Y-m-d H:i:s'):null,$applicationId,$userId]);
            }else{
                $insert=$this->pdo->prepare("INSERT INTO role_applications(user_id,requested_role,status,payload_json,reviewed_by_user_id,reviewed_at) VALUES(?,?,?,?,NULL,?) ON DUPLICATE KEY UPDATE status=VALUES(status),payload_json=VALUES(payload_json),reviewed_by_user_id=NULL,reviewed_at=VALUES(reviewed_at),updated_at=CURRENT_TIMESTAMP");
                $insert->execute([$userId,$role,$status,$json,$autoApproved?date('Y-m-d H:i:s'):null]);
                $applicationId=(int)$this->pdo->lastInsertId();
            }
            if($startedTransaction)$this->pdo->commit();
        }catch(Throwable $error){
            if($startedTransaction&&$this->pdo->inTransaction())$this->pdo->rollBack();
            throw $error;
        }

        if($autoApproved)$this->reconcileContexts($accountId);
        $contexts=$this->listContexts($accountId);
        $accountTypes=$this->listAccountTypes($accountId,$contexts);
        $target=null;
        foreach($accountTypes as $type)if(($type['role']??'')===$role){$target=$type;break;}
        $targetContextId=(int)($target['contextId']??0)?:null;
        $targetContextKey=(string)($target['contextKey']??'');
        if($autoApproved&&$targetContextId===null&&$targetContextKey==='')throw new RuntimeException('account_type_context_not_materialized');
        return [
            'created'=>true,'alreadyActive'=>false,'alreadyPending'=>false,
            'applicationId'=>$applicationId?:null,'approvalMode'=>$approvalMode,
            'autoApproved'=>$autoApproved,'status'=>$status,
            'targetContextId'=>$targetContextId,'targetContextKey'=>$targetContextKey,
            'accountTypes'=>$accountTypes,
        ];
    }

    /**
     * First-entry role activation after the owner of the phone has passed OTP.
     * This is not identity/document verification. It only enables the requested
     * application context for the same Account/Person so its own onboarding can run.
     * The public/verification state remains owned by the role-specific profile.
     */
    public function activateEntryRoleForOnboarding(int $accountId, string $role, array $payload=[]): array
    {
        $role=strtolower(trim($role));
        if(!in_array($role,['client','master'],true))throw new InvalidArgumentException('invalid_entry_role');
        $stmt=$this->pdo->prepare("SELECT u.id,u.phone FROM accounts a JOIN users u ON u.phone=a.phone WHERE a.id=? AND u.active=1 LIMIT 1");
        $stmt->execute([$accountId]);
        $legacy=$stmt->fetch(PDO::FETCH_ASSOC)?:[];
        $userId=(int)($legacy['id']??0);
        if($userId<=0)throw new RuntimeException('legacy_user_not_found');

        // entry_role is an interface/context preference, never the RBAC/verification role.
        try{$this->pdo->prepare("UPDATE users SET entry_role=? WHERE id=?")->execute([$role,$userId]);}catch(Throwable $_e){}

        if($role==='master'){
            if(!$this->tableExists('role_applications'))throw new RuntimeException('role_application_schema_missing');
            $safe=[
                'source'=>'onboarding_first_entry',
                'accountId'=>$accountId,
                'requestedAt'=>date(DATE_ATOM),
                // Account-type activation is distinct from profile publication and identity verification.
                'verificationStatus'=>'unverified',
                'publicationStatus'=>'pending_onboarding',
            ];
            foreach(['name','city','specialization'] as $key){
                $value=trim((string)($payload[$key]??''));
                if($value!=='')$safe[$key]=mb_substr($value,0,191);
            }
            $json=json_encode($safe,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)?:'{}';
            $this->pdo->prepare("INSERT INTO role_applications(user_id,requested_role,status,payload_json,reviewed_by_user_id,reviewed_at)
                VALUES(?,'master','approved',?,NULL,NOW())
                ON DUPLICATE KEY UPDATE payload_json=VALUES(payload_json),reviewed_by_user_id=NULL,reviewed_at=NOW(),updated_at=CURRENT_TIMESTAMP")
                ->execute([$userId,$json]);
            // A stale pending request must not win listAccountTypes() by a newer timestamp.
            $this->pdo->prepare("DELETE FROM role_applications WHERE user_id=? AND requested_role='master' AND status='pending'")->execute([$userId]);
        }

        $this->reconcileContexts($accountId);
        if($role==='master' && $this->tableExists('masters') && $this->columnExists('masters','profile_visible')){
            $completed=false;
            if($this->tableExists('person_profiles')){
                $q=$this->pdo->prepare("SELECT pp.payload_json FROM persons p JOIN person_profiles pp ON pp.person_id=p.id AND pp.profile_type='master' WHERE p.account_id=? ORDER BY pp.id DESC LIMIT 1");
                $q->execute([$accountId]);
                $payload=json_decode((string)($q->fetchColumn()?:'{}'),true);
                $completed=is_array($payload) && strtolower((string)($payload['onboardingStatus']??''))==='completed';
            }
            if(!$completed){
                $this->pdo->prepare("UPDATE masters SET profile_visible=0 WHERE user_id=?")->execute([$userId]);
            }
        }
        $target=null;
        foreach($this->listContexts($accountId) as $context){
            $type=strtolower((string)($context['type']??''));
            $profileType=strtolower((string)($context['profileType']??''));
            if($role==='client'&&$type==='personal'){$target=$context;break;}
            if($role==='master'&&$type==='profile'&&$profileType==='master'){$target=$context;break;}
        }
        if(!$target)throw new RuntimeException($role==='master'?'master_context_not_materialized':'personal_context_not_materialized');
        return $this->selectContext($accountId,(int)$target['id']);
    }

    public function currentContext(int $accountId): array
    {
        $contexts = $this->listContexts($accountId);
        if (!$contexts) throw new RuntimeException('context_not_available');
        $available = []; foreach ($contexts as $context) $available[(int)$context['id']] = $context;
        $selectedId = 0;
        if (is_array($this->resolvedSession) && (int)($this->resolvedSession['account_id'] ?? 0) === $accountId) $selectedId = (int)($this->resolvedSession['current_context_id'] ?? 0);
        if ($selectedId <= 0) $selectedId = (int)($_SESSION['kareta_identity_context_id'] ?? 0);
        if ($selectedId > 0 && isset($available[$selectedId])) return $available[$selectedId];
        $fallback = $contexts[0]; foreach ($contexts as $context) if (($context['type'] ?? '') === 'personal') { $fallback = $context; break; }
        $this->persistCurrentContext($accountId, (int)$fallback['id'], false);
        return $fallback;
    }

    public function selectContext(int $accountId, int $contextId): array
    {
        foreach ($this->listContexts($accountId) as $context) {
            if ((int)$context['id'] === $contextId) { $this->persistCurrentContext($accountId,$contextId,true); return $context; }
        }
        throw new DomainException('context_not_available');
    }

    public function selectContextByKey(int $accountId, string $contextKey): array
    {
        $contextKey = trim($contextKey);
        foreach ($this->listContexts($accountId) as $context) {
            if (hash_equals((string)$context['key'], $contextKey)) { $this->persistCurrentContext($accountId,(int)$context['id'],true); return $context; }
        }
        throw new DomainException('context_not_available');
    }

    public function sessionContextMeta(int $accountId): array
    {
        if (is_array($this->resolvedSession) && (int)($this->resolvedSession['account_id'] ?? 0) === $accountId) {
            return [
                'sessionId'=>(int)($this->resolvedSession['id'] ?? 0) ?: null,
                'contextRevision'=>(int)($this->resolvedSession['context_revision'] ?? 0),
                'contextChangedAt'=>$this->resolvedSession['context_changed_at'] ?? null,
            ];
        }
        return ['sessionId'=>null,'contextRevision'=>(int)($_SESSION['kareta_identity_context_revision'] ?? 0),'contextChangedAt'=>$_SESSION['kareta_identity_context_changed_at'] ?? null];
    }

    public function reconcileContexts(int $accountId): void
    {
        $stmt = $this->pdo->prepare("SELECT a.phone,p.id AS person_id FROM accounts a JOIN persons p ON p.account_id=a.id WHERE a.id=? AND a.status='active' LIMIT 1");
        $stmt->execute([$accountId]); $row=$stmt->fetch(PDO::FETCH_ASSOC); if(!$row) return;
        $personId=(int)$row['person_id']; $phone=(string)$row['phone'];
        $this->autoApprovePendingApplications($accountId);
        $this->ensureApprovedLegacyEntities($phone);
        $this->ensurePersonalContext($accountId,$personId);
        $this->syncLegacyProfiles($accountId,$personId,$phone);
        $this->ensureProfileContexts($accountId,$personId);
        $this->ensureOrganizationContexts($accountId,$personId,$phone);
    }

    private function ensureApprovedLegacyEntities(string $phone): void
    {
        $stmt=$this->pdo->prepare("SELECT id,phone,name,role,initials,city,spec FROM users WHERE phone=? AND active=1 LIMIT 1");
        $stmt->execute([$phone]);$user=$stmt->fetch(PDO::FETCH_ASSOC)?:[];$userId=(int)($user['id']??0);
        if($userId<=0)return;
        $authorized=[];$primary=strtolower((string)($user['role']??'client'));
        if(in_array($primary,['master','sto','seller'],true))$authorized[]=$primary;
        if($this->tableExists('role_applications')){
            $q=$this->pdo->prepare("SELECT requested_role FROM role_applications WHERE user_id=? AND status='approved' AND requested_role IN ('master','sto','seller')");
            $q->execute([$userId]);foreach($q->fetchAll(PDO::FETCH_COLUMN)?:[] as $role)$authorized[]=strtolower((string)$role);
        }
        $authorized=array_values(array_unique($authorized));
        if(!$authorized)return;
        $name=trim((string)($user['name']??''))?:'Пользователь KARETA.KZ';
        $initials=trim((string)($user['initials']??''));
        $city=trim((string)($user['city']??''));
        $spec=trim((string)($user['spec']??''));
        if(in_array('master',$authorized,true)&&$this->tableExists('masters')){
            $q=$this->pdo->prepare("SELECT id FROM masters WHERE user_id=? OR user_phone=? OR phone=? ORDER BY active DESC LIMIT 1");$q->execute([$userId,$phone,$phone]);$id=(string)($q->fetchColumn()?:'');
            if($id===''){
                $id='master_user_'.substr(sha1($userId.'|'.$phone),0,20);
                $stmt=$this->pdo->prepare("INSERT INTO masters(id,user_id,user_phone,name,phone,initials,spec,active) VALUES(?,?,?,?,?,?,?,1)");
                $stmt->execute([$id,$userId,$phone,$name,$phone,$initials,$spec]);
            }else{
                $stmt=$this->pdo->prepare("UPDATE masters SET user_id=?,user_phone=?,name=COALESCE(NULLIF(name,''),?),phone=?,initials=COALESCE(NULLIF(initials,''),?),spec=COALESCE(NULLIF(spec,''),?),active=1 WHERE id=?");
                $stmt->execute([$userId,$phone,$name,$phone,$initials,$spec,$id]);
            }
        }
        if(in_array('sto',$authorized,true)&&$this->tableExists('sto_profiles')){
            $q=$this->pdo->prepare("SELECT id FROM sto_profiles WHERE user_id=? OR user_phone=? OR contact_phone=? ORDER BY active DESC LIMIT 1");$q->execute([$userId,$phone,$phone]);$id=(string)($q->fetchColumn()?:'');
            if($id===''){
                $id='sto_user_'.substr(sha1($userId.'|'.$phone),0,20);
                $stmt=$this->pdo->prepare("INSERT INTO sto_profiles(id,user_id,user_phone,name,contact_phone,country_code,city,address,active) VALUES(?,?,?,?,?,'KZ',?,'',1)");
                $stmt->execute([$id,$userId,$phone,$name,$phone,$city]);
            }else{
                $stmt=$this->pdo->prepare("UPDATE sto_profiles SET user_id=?,user_phone=?,name=COALESCE(NULLIF(name,''),?),contact_phone=?,city=COALESCE(NULLIF(city,''),?),active=1 WHERE id=?");
                $stmt->execute([$userId,$phone,$name,$phone,$city,$id]);
            }
            $this->ensureOwnedOrganization('org_sto_'.$id,'service_station',$name,$userId,'sto_profile',$id,$phone,$city,'');
        }
        if(in_array('seller',$authorized,true)&&$this->tableExists('seller_profiles')){
            $stmt=$this->pdo->prepare("INSERT INTO seller_profiles(user_id,user_phone,store_name,contact_phone,country_code,city,assortment,moderation_status,active) VALUES(?,?,?,?,'KZ',?,?,'approved',1) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),user_phone=VALUES(user_phone),store_name=COALESCE(NULLIF(store_name,''),VALUES(store_name)),contact_phone=VALUES(contact_phone),city=COALESCE(NULLIF(city,''),VALUES(city)),assortment=COALESCE(NULLIF(assortment,''),VALUES(assortment)),moderation_status='approved',active=1");
            $stmt->execute([$userId,$phone,$name,$phone,$city,$spec]);
            $q=$this->pdo->prepare("SELECT id,store_name,warehouse_address FROM seller_profiles WHERE user_id=? LIMIT 1");$q->execute([$userId]);$seller=$q->fetch(PDO::FETCH_ASSOC)?:[];
            $sellerId=(int)($seller['id']??0);if($sellerId>0)$this->ensureOwnedOrganization('org_shop_'.$sellerId,'parts_store',trim((string)($seller['store_name']??''))?:$name,$userId,'seller_profile',(string)$sellerId,$phone,$city,(string)($seller['warehouse_address']??''));
        }
    }

    private function ensureOwnedOrganization(string $organizationId,string $type,string $name,int $userId,string $legacyType,string $legacyId,string $phone,string $city,string $address): void
    {
        if(!$this->tableExists('organizations')||!$this->tableExists('organization_members'))return;
        $stmt=$this->pdo->prepare("INSERT INTO organizations(id,type,name,owner_user_id,legacy_entity_type,legacy_entity_id,phone,country_code,city,address,status) VALUES(?,?,?,?,?,?,?,'KZ',?,?,'active') ON DUPLICATE KEY UPDATE type=VALUES(type),name=VALUES(name),owner_user_id=VALUES(owner_user_id),phone=VALUES(phone),city=VALUES(city),address=VALUES(address),status='active'");
        $stmt->execute([$organizationId,$type,$name,$userId,$legacyType,$legacyId,$phone,$city,$address]);
        $memberId='om_owner_'.substr(sha1($organizationId.'|'.$userId),0,28);
        $stmt=$this->pdo->prepare("INSERT INTO organization_members(id,organization_id,user_id,entity_type,entity_id,member_role,position,status,permissions_json,joined_at) VALUES(?,?,?,'user',?,'owner','Владелец','active',JSON_ARRAY('*'),NOW()) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),member_role='owner',status='active',permissions_json=JSON_ARRAY('*'),left_at=NULL");
        $stmt->execute([$memberId,$organizationId,$userId,(string)$userId]);
    }

    private function syncLegacyProfiles(int $accountId,int $personId,string $phone): void
    {
        $stmt=$this->pdo->prepare("SELECT id,role FROM users WHERE phone=? AND active=1 LIMIT 1"); $stmt->execute([$phone]); $legacyUser=$stmt->fetch(PDO::FETCH_ASSOC)?:[];$legacyUserId=(int)($legacyUser['id']??0);
        if($legacyUserId<=0)return;
        $authorized=[];$role=strtolower(trim((string)($legacyUser['role']??'client')));
        if(in_array($role,['master','seller'],true))$authorized[]=$role;
        if($this->tableExists('role_applications')){
            $approved=$this->pdo->prepare("SELECT requested_role FROM role_applications WHERE user_id=? AND status='approved' AND requested_role IN ('master','seller')");$approved->execute([$legacyUserId]);
            foreach($approved->fetchAll(PDO::FETCH_COLUMN)?:[] as $type)$authorized[]=strtolower((string)$type);
        }
        $authorized=array_values(array_unique($authorized));
        $marks=$authorized?implode(',',array_fill(0,count($authorized),'?')):"''";
        $suspend=$this->pdo->prepare("UPDATE person_profiles SET status='suspended',updated_at=CURRENT_TIMESTAMP WHERE person_id=? AND profile_type IN ('master','seller') AND profile_type NOT IN ({$marks}) AND status='active'");
        $suspend->execute(array_merge([$personId],$authorized));
        $this->pdo->prepare("UPDATE contexts c JOIN person_profiles pp ON pp.id=c.profile_id SET c.status='suspended' WHERE pp.person_id=? AND pp.status<>'active' AND c.context_type='profile'")->execute([$personId]);
        $profiles=[
            'master'=>["SELECT id FROM masters WHERE user_id=? AND COALESCE(active,1)=1 LIMIT 1",'master'],
            'seller'=>["SELECT id FROM seller_profiles WHERE user_id=? AND COALESCE(active,1)=1 LIMIT 1",'seller_profile'],
        ];
        foreach($profiles as $type=>$def){
            if(!in_array($type,$authorized,true))continue;
            $q=$this->pdo->prepare($def[0]);$q->execute([$legacyUserId]);$legacyId=$q->fetchColumn();if($legacyId===false)continue;
            $ins=$this->pdo->prepare("INSERT INTO person_profiles(person_id,profile_type,status,legacy_entity_type,legacy_entity_id,payload_json) VALUES(?,?,'active',?,?,JSON_OBJECT('source','stage6_runtime','legacyUserId',?)) ON DUPLICATE KEY UPDATE status='active',legacy_entity_type=VALUES(legacy_entity_type),legacy_entity_id=VALUES(legacy_entity_id),updated_at=CURRENT_TIMESTAMP");
            $ins->execute([$personId,$type,$def[1],(string)$legacyId,$legacyUserId]);
        }
    }

    private function ensurePersonalContext(int $accountId, ?int $personId=null): void
    {
        if($personId===null){$stmt=$this->pdo->prepare("SELECT id FROM persons WHERE account_id=? LIMIT 1");$stmt->execute([$accountId]);$personId=(int)($stmt->fetchColumn()?:0);} if($personId<=0)return;
        $setId=$this->capabilitySetId('personal.client');$key='personal:'.$accountId;
        $stmt=$this->pdo->prepare("INSERT INTO contexts(context_key,context_type,account_id,person_id,capability_set_id,status) VALUES(?,'personal',?,?,?,'active') ON DUPLICATE KEY UPDATE person_id=VALUES(person_id),capability_set_id=COALESCE(contexts.capability_set_id,VALUES(capability_set_id)),status='active'");
        $stmt->execute([$key,$accountId,$personId,$setId?:null]);
        $contextId=$this->contextIdByKey($key); if($contextId>0)$this->upsertMember($contextId,$accountId,$personId,$setId);
    }

    private function ensureProfileContexts(int $accountId,int $personId): void
    {
        $stmt=$this->pdo->prepare("SELECT id,profile_type FROM person_profiles WHERE person_id=? AND status='active' AND profile_type IN ('master','seller')");$stmt->execute([$personId]);
        foreach($stmt->fetchAll(PDO::FETCH_ASSOC)?:[] as $profile){
            $type=(string)$profile['profile_type'];$profileId=(int)$profile['id'];$setId=$this->capabilitySetId('profile.'.$type);$key='profile:'.$type.':'.$profileId;
            $ins=$this->pdo->prepare("INSERT INTO contexts(context_key,context_type,account_id,person_id,profile_id,capability_set_id,status) VALUES(?,'profile',?,?,?,?,'active') ON DUPLICATE KEY UPDATE account_id=VALUES(account_id),person_id=VALUES(person_id),profile_id=VALUES(profile_id),capability_set_id=VALUES(capability_set_id),status='active'");
            $ins->execute([$key,$accountId,$personId,$profileId,$setId?:null]);$contextId=$this->contextIdByKey($key);if($contextId>0)$this->upsertMember($contextId,$accountId,$personId,$setId);
        }
    }

    private function ensureOrganizationContexts(int $accountId,int $personId,string $phone): void
    {
        $u=$this->pdo->prepare("SELECT id FROM users WHERE phone=? LIMIT 1");$u->execute([$phone]);$legacyUserId=(int)($u->fetchColumn()?:0);if($legacyUserId<=0)return;
        $stmt=$this->pdo->prepare("SELECT om.organization_id,om.member_role,o.name,o.type FROM organization_members om JOIN organizations o ON o.id=om.organization_id WHERE om.user_id=? AND om.status='active' AND o.status='active'");$stmt->execute([$legacyUserId]);
        foreach($stmt->fetchAll(PDO::FETCH_ASSOC)?:[] as $member){
            $orgKey=(string)$member['organization_id'];$key='organization:'.$orgKey;$baseSet=$this->capabilitySetId('organization.member');
            $ins=$this->pdo->prepare("INSERT INTO contexts(context_key,context_type,organization_key,capability_set_id,status) VALUES(?,'organization',?,?,'active') ON DUPLICATE KEY UPDATE organization_key=VALUES(organization_key),capability_set_id=COALESCE(contexts.capability_set_id,VALUES(capability_set_id)),status='active'");
            $ins->execute([$key,$orgKey,$baseSet?:null]);$contextId=$this->contextIdByKey($key);if($contextId<=0)continue;
            $role=(string)$member['member_role'];$code=$role==='owner'?'organization.owner':($role==='master'?'organization.master':(in_array($role,['seller','manager'],true)?'organization.seller':'organization.member'));
            $this->upsertMember($contextId,$accountId,$personId,$this->capabilitySetId($code));
        }
    }

    private function persistCurrentContext(int $accountId,int $contextId,bool $audit): void
    {
        $fromId=0;$sessionId=null;$changedAt=date('Y-m-d H:i:s');
        if(is_array($this->resolvedSession)&&(int)($this->resolvedSession['account_id']??0)===$accountId){
            $fromId=(int)($this->resolvedSession['current_context_id']??0);$sessionId=(int)($this->resolvedSession['id']??0)?:null;
            $stmt=$this->pdo->prepare("UPDATE auth_sessions SET current_context_id=?,context_revision=context_revision+1,context_changed_at=NOW(),last_seen_at=NOW() WHERE id=? AND account_id=? AND revoked_at IS NULL");$stmt->execute([$contextId,$sessionId,$accountId]);
            $this->resolvedSession['current_context_id']=$contextId;$this->resolvedSession['context_revision']=(int)($this->resolvedSession['context_revision']??0)+1;$this->resolvedSession['context_changed_at']=$changedAt;
        }else{
            $fromId=(int)($_SESSION['kareta_identity_context_id']??0);$_SESSION['kareta_identity_context_id']=$contextId;$_SESSION['kareta_identity_context_revision']=(int)($_SESSION['kareta_identity_context_revision']??0)+1;$_SESSION['kareta_identity_context_changed_at']=$changedAt;
        }
        if(!$audit||$fromId===$contextId)return;
        $stmt=$this->pdo->prepare("INSERT INTO context_switch_audit(account_id,session_id,from_context_id,to_context_id,request_id,ip_prefix,user_agent_hash) VALUES(?,?,?,?,?,?,?)");
        $stmt->execute([$accountId,$sessionId,$fromId>0?$fromId:null,$contextId,defined('KARETA_REQUEST_ID')?KARETA_REQUEST_ID:null,$this->ipPrefix(),hash('sha256',(string)($_SERVER['HTTP_USER_AGENT']??''))]);
    }

    private function upsertMember(int $contextId,int $accountId,int $personId,int $setId): void { $stmt=$this->pdo->prepare("INSERT INTO context_members(context_id,account_id,person_id,capability_set_id,membership_status) VALUES(?,?,?,?, 'active') ON DUPLICATE KEY UPDATE person_id=VALUES(person_id),capability_set_id=COALESCE(VALUES(capability_set_id),context_members.capability_set_id),membership_status='active',updated_at=CURRENT_TIMESTAMP");$stmt->execute([$contextId,$accountId,$personId,$setId?:null]); }
    private function contextIdByKey(string $key): int { $stmt=$this->pdo->prepare("SELECT id FROM contexts WHERE context_key=? LIMIT 1");$stmt->execute([$key]);return (int)($stmt->fetchColumn()?:0); }
    private function capabilitySetId(string $code): int { $stmt=$this->pdo->prepare("SELECT id FROM capability_sets WHERE code=? LIMIT 1");$stmt->execute([$code]);return (int)($stmt->fetchColumn()?:0); }
    private function tableExists(string $table): bool { $stmt=$this->pdo->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?");$stmt->execute([$table]);return (int)$stmt->fetchColumn()>0; }
    private function columnExists(string $table,string $column): bool { $stmt=$this->pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");$stmt->execute([$table,$column]);return (int)$stmt->fetchColumn()>0; }

    private function accountPayload(array $row): array { return ['id'=>(int)($row['resolved_account_id']??$row['id']),'phone'=>(string)$row['phone'],'status'=>(string)($row['account_status']??$row['status']??'active'),'personId'=>(int)($row['person_id']??0)?:null,'fullname'=>(string)($row['fullname']??'')]; }
    private function contextPayload(array $row): array
    {
        $type=(string)$row['context_type'];$profileType=(string)($row['profile_type']??'');$label='Личный кабинет';
        if($type==='profile')$label=$profileType==='master'?'Работаю как мастер':($profileType==='seller'?'Работаю как продавец':ucfirst($profileType?:'Профиль'));
        if($type==='organization')$label=(string)($row['organization_name']?:('Организация '.($row['organization_key']??'')));
        $organizationKey=trim((string)($row['organization_key']??''));
        $organizationId=$organizationKey!==''?$organizationKey:((int)($row['organization_id']??0)?:null);
        return ['id'=>(int)$row['id'],'key'=>(string)$row['context_key'],'type'=>$type,'label'=>$label,'accountId'=>(int)($row['account_id']??0)?:null,'personId'=>(int)($row['person_id']??0)?:null,'profileId'=>(int)($row['profile_id']??0)?:null,'profileType'=>$profileType,'organizationId'=>$organizationId,'organizationKey'=>$organizationKey,'organizationType'=>(string)($row['organization_type']??''),'capabilitySetId'=>(int)($row['capability_set_id']??0)?:null,'capabilitySetCode'=>(string)($row['capability_set_code']??''),'accessMode'=>(string)($row['access_mode']??'member'),'status'=>(string)$row['status']];
    }
    private function ipPrefix(): string { $ip=(string)($_SERVER['REMOTE_ADDR']??'');if(filter_var($ip,FILTER_VALIDATE_IP,FILTER_FLAG_IPV4)){$parts=explode('.',$ip);return implode('.',array_slice($parts,0,3)).'.0/24';}if(filter_var($ip,FILTER_VALIDATE_IP,FILTER_FLAG_IPV6)){$parts=explode(':',$ip);return implode(':',array_slice($parts,0,4)).'::/64';}return ''; }
}
