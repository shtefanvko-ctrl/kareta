<?php
declare(strict_types=1);

require_once __DIR__ . '/session_service.php';
require_once __DIR__ . '/context_service.php';
require_once __DIR__ . '/capability_service.php';
require_once __DIR__ . '/domain_ownership_service.php';
require_once __DIR__ . '/auth_resolver.php';

final class KaretaAuthorizationDecision
{
    public int $accountId;
    public int $personId;
    public int $contextId;
    public array $context;
    public array $capabilities;
    public string $capability;
    public ?array $resource;

    public function __construct(int $accountId,int $personId,int $contextId,array $context,array $capabilities,string $capability,?array $resource=null)
    {
        $this->accountId=$accountId;
        $this->personId=$personId;
        $this->contextId=$contextId;
        $this->context=$context;
        $this->capabilities=$capabilities;
        $this->capability=$capability;
        $this->resource=$resource;
    }
}

final class KaretaAuthorizationPipeline
{
    private KaretaSessionService $sessions;
    private KaretaIdentityContextService $contexts;
    private KaretaCapabilityService $capabilities;
    private KaretaDomainOwnershipService $ownership;

    public function __construct(private PDO $pdo)
    {
        $this->sessions = new KaretaSessionService($pdo);
        $this->contexts = new KaretaIdentityContextService($pdo);
        $this->capabilities = new KaretaCapabilityService($pdo, $this->contexts);
        $this->ownership = new KaretaDomainOwnershipService($pdo);
    }

    public function authorize(string $capability, array $resource = [], ?array $legacyUser = null): KaretaAuthorizationDecision
    {
        try { $auth=(new KaretaAuthResolver($this->pdo))->resolve(true); }
        catch (DomainException $e) { $this->audit(null,null,$capability,'deny',$e->getMessage(),$resource); throw $e; }
        $accountId=$auth->accountId; $personId=$auth->personId; $context=$auth->context; $contextId=(int)$context['id'];
        if (!$this->capabilities->can($accountId,$capability,$contextId,true,$resource)) {
            $this->audit($accountId,$contextId,$capability,'deny','capability_denied',$resource); throw new DomainException('capability_denied');
        }
        if ($resource !== []) $this->assertResourceAccess($accountId,$context,$resource);
        $this->audit($accountId,$contextId,$capability,'allow','authorized',$resource);
        return new KaretaAuthorizationDecision($accountId,$personId,$contextId,$context,['allowed'=>$auth->capabilities,'denied'=>$auth->deniedCapabilities],$capability,$resource ?: null);
    }

    private function assertResourceAccess(int $accountId,array $context,array $resource): void
    {
        $type=trim((string)($resource['type']??''));
        $key=trim((string)($resource['key']??''));
        if ($type==='' || $key==='') throw new DomainException('resource_reference_required');
        if (!empty($resource['ownerAccountId']) && (int)$resource['ownerAccountId'] === $accountId) return;
        $organizationKey=trim((string)($context['organizationKey']??$context['organization_id']??''));
        if (!empty($resource['organizationKey']) && $organizationKey!=='' && hash_equals((string)$resource['organizationKey'],$organizationKey)) return;
        if ($type==='domain_entity') {
            [$entityType,$entityKey]=array_pad(explode(':',$key,2),2,'');
            $permission=trim((string)($resource['permission']??'read')) ?: 'read';
            $this->ownership->require($entityType,$entityKey,$accountId,$context,$permission);
            return;
        }
        $this->audit($accountId,(int)($context['id']??0),'resource.access','deny','resource_access_denied',$resource);
        throw new DomainException('resource_access_denied');
    }

    private function legacyUserId(int $accountId): int
    {
        $st=$this->pdo->prepare("SELECT u.id FROM accounts a JOIN users u ON u.phone=a.phone WHERE a.id=? LIMIT 1");
        $st->execute([$accountId]);return (int)($st->fetchColumn()?:0);
    }

    private function audit(?int $accountId,?int $contextId,string $capability,string $decision,string $reason,array $resource): void
    {
        try{
            $st=$this->pdo->prepare("INSERT INTO authorization_pipeline_audit(account_id,context_id,capability_key,decision,reason,resource_type,resource_key,request_method,request_path,request_id) VALUES(?,?,?,?,?,?,?,?,?,?)");
            $st->execute([$accountId,$contextId,$capability,$decision,$reason,trim((string)($resource['type']??''))?:null,trim((string)($resource['key']??''))?:null,(string)($_SERVER['REQUEST_METHOD']??''),substr((string)($_SERVER['REQUEST_URI']??''),0,255),defined('KARETA_REQUEST_ID')?KARETA_REQUEST_ID:null]);
        }catch(Throwable $_e){}
    }
}

function kareta_authorize(PDO $pdo,string $capability,array $resource=[],?array $legacyUser=null): KaretaAuthorizationDecision
{
    $pipeline=new KaretaAuthorizationPipeline($pdo);
    return $pipeline->authorize($capability,$resource,$legacyUser);
}
