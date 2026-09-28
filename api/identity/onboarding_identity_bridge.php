<?php
declare(strict_types=1);

require_once __DIR__.'/account_service.php';
require_once __DIR__.'/profile_service.php';
require_once __DIR__.'/session_service.php';
require_once __DIR__.'/context_service.php';
require_once __DIR__.'/capability_service.php';

final class KaretaOnboardingIdentityBridge
{
    public function __construct(private PDO $pdo) {}

    public function establish(array $legacyUser, ?string $requestedEntryRole=null): array
    {
        $phone = function_exists('kareta_normalize_phone')
            ? kareta_normalize_phone((string)($legacyUser['phone'] ?? ''))
            : preg_replace('/\D+/', '', (string)($legacyUser['phone'] ?? ''));
        if ($phone === '') throw new InvalidArgumentException('invalid_phone');

        $fullname = trim((string)($legacyUser['name'] ?? $legacyUser['fullname'] ?? ''));
        $account = (new KaretaAccountService($this->pdo))->ensure($phone, $fullname);
        (new KaretaProfileService($this->pdo))->ensureClient((int)$account['personId']);

        $entryRole=$this->entryRole($requestedEntryRole,$legacyUser);
        $contexts = new KaretaIdentityContextService($this->pdo);
        $contexts->resolveAccount($legacyUser);

        // CLIENT/MASTER are the two public first-entry branches. After OTP the
        // selected branch must become the current context before the frontend
        // decides which onboarding surface to open.
        if(in_array($entryRole,['client','master'],true)){
            $currentContext=$contexts->activateEntryRoleForOnboarding((int)$account['id'],$entryRole,[
                'name'=>$fullname,
                'city'=>(string)($legacyUser['city']??''),
                'specialization'=>(string)($legacyUser['spec']??''),
            ]);
        }else{
            $contexts->reconcileContexts((int)$account['id']);
            $currentContext=$contexts->currentContext((int)$account['id']);
        }
        $available = $contexts->listContexts((int)$account['id']);

        $sessions = new KaretaSessionService($this->pdo);
        $currentSession = $sessions->current(false);
        if ($currentSession && (int)($currentSession['account_id'] ?? 0) !== (int)$account['id']) {
            $sessions->revokeCurrent();
            $currentSession = null;
        }

        // activateEntryRoleForOnboarding() has already persisted the selected
        // context into an existing identity session when one exists. Re-read it
        // so the returned metadata cannot advertise the previous PERSONAL context.
        if($currentSession){
            $fresh=$sessions->current(false);
            if($fresh)$currentSession=$fresh;
        }
        $session = $currentSession
            ? $this->sessionPayload($currentSession)
            : $sessions->create((int)$account['id'], (int)$currentContext['id']);
        $effective = (new KaretaCapabilityService($this->pdo, $contexts))
            ->effective((int)$account['id'], (int)$currentContext['id']);
        $postAuth=$this->postAuth($entryRole,$currentContext);

        $this->audit((int)$account['id'], (int)($session['id'] ?? 0), $currentSession ? 'session.onboarding.reused' : 'session.onboarding.created');

        return [
            'ok'=>true,
            'authenticated'=>true,
            'selectedRole'=>$entryRole,
            'entryRole'=>$entryRole,
            'account'=>[
                'id'=>(int)$account['id'],
                'phone'=>(string)$account['phone'],
                'personId'=>(int)$account['personId'],
                'fullname'=>$fullname,
            ],
            'session'=>$session,
            'contexts'=>$available,
            'currentContext'=>$currentContext,
            'capabilities'=>$effective['allowed'] ?? [],
            'deniedCapabilities'=>$effective['denied'] ?? [],
            'postAuth'=>$postAuth,
            'sessionContext'=>[
                'sessionId'=>(int)($session['id'] ?? 0) ?: null,
                'contextRevision'=>(int)($currentSession['context_revision'] ?? 0),
                'contextChangedAt'=>$currentSession['context_changed_at'] ?? null,
            ],
            'source'=>'onboarding-identity-bridge',
        ];
    }

    private function entryRole(?string $requested,array $legacyUser): string
    {
        $role=strtolower(trim((string)($requested??'')));
        if($role==='')$role=strtolower(trim((string)($legacyUser['entry_role']??$legacyUser['role']??'client')));
        return in_array($role,['client','master','sto','seller'],true)?$role:'client';
    }

    private function postAuth(string $entryRole,array $context): array
    {
        if($entryRole==='master' && strtolower((string)($context['type']??''))==='profile' && strtolower((string)($context['profileType']??''))==='master'){
            $status='not_started';$step=1;$view='master-profile';
            try{
                $q=$this->pdo->prepare("SELECT status,current_step,current_view FROM master_onboarding_state WHERE profile_id=? LIMIT 1");
                $q->execute([(int)($context['profileId']??0)]);
                $row=$q->fetch(PDO::FETCH_ASSOC)?:[];
                if(trim((string)($row['status']??''))!=='')$status=(string)$row['status'];
                $step=max(1,min(4,(int)($row['current_step']??1)));
                $view=trim((string)($row['current_view']??''))?:['1'=>'master-profile','2'=>'master-services','3'=>'master-work-place','4'=>'master-review'][(string)$step];
            }catch(Throwable $_e){}
            $required=$status!=='completed';
            return [
                'role'=>'master','firstEntryType'=>'master-profile','firstEntryRequired'=>$required,
                'onboardingStatus'=>$status,'step'=>$step,'view'=>$view,
                'redirectRoute'=>$required
                    ? '#/onboarding/master?step='.$step.'&view='.rawurlencode($view)
                    : '#/master',
            ];
        }
        if($entryRole==='client')return ['role'=>'client','firstEntryType'=>'client-garage','firstEntryRequired'=>null,'redirectRoute'=>'#/home'];
        if($entryRole==='sto')return ['role'=>'sto','firstEntryType'=>null,'firstEntryRequired'=>false,'redirectRoute'=>'#/sto'];
        if($entryRole==='seller')return ['role'=>'seller','firstEntryType'=>null,'firstEntryRequired'=>false,'redirectRoute'=>'#/seller'];
        return ['role'=>'client','firstEntryType'=>'client-garage','firstEntryRequired'=>null,'redirectRoute'=>'#/home'];
    }

    private function sessionPayload(array $row): array
    {
        return [
            'id'=>(int)$row['id'],
            'accountId'=>(int)$row['account_id'],
            'currentContextId'=>(int)($row['current_context_id'] ?? 0) ?: null,
            'expiresAt'=>(string)$row['expires_at'],
            'absoluteExpiresAt'=>(string)($row['absolute_expires_at'] ?? $row['expires_at']),
            'idleExpiresAt'=>(string)($row['idle_expires_at'] ?? $row['expires_at']),
            'rotated'=>false,
        ];
    }

    private function audit(int $accountId, int $sessionId, string $event): void
    {
        try {
            $stmt=$this->pdo->prepare("INSERT INTO identity_session_audit(account_id,auth_session_id,event_type,request_id,payload_json) VALUES(?,?,?,?,JSON_OBJECT('source','legacy_onboarding'))");
            $stmt->execute([$accountId,$sessionId?:null,$event,defined('KARETA_REQUEST_ID')?KARETA_REQUEST_ID:null]);
        } catch (Throwable $_error) {}
    }
}
