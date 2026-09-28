<?php
declare(strict_types=1);

require_once __DIR__ . '/capability_registry.php';

final class KaretaCapabilityService
{
    private PDO $pdo;
    private KaretaIdentityContextService $contexts;
    private array $cache = [];

    public function __construct(PDO $pdo, KaretaIdentityContextService $contexts)
    {
        $this->pdo = $pdo;
        $this->contexts = $contexts;
    }

    public function current(int $accountId): array
    {
        $context = $this->contexts->currentContext($accountId);
        $effective = $this->effective($accountId, (int)$context['id']);
        return ['context'=>$context,'capabilities'=>$effective['allowed'],'denied'=>$effective['denied'],'sources'=>$effective['sources']];
    }

    public function effective(int $accountId, int $contextId): array
    {
        $cacheKey = $accountId . ':' . $contextId;
        if (isset($this->cache[$cacheKey])) return $this->cache[$cacheKey];

        $stmt = $this->pdo->prepare("SELECT c.id,c.context_type,c.profile_id,c.capability_set_id,cm.capability_set_id AS member_set_id
            FROM contexts c
            LEFT JOIN context_members cm ON cm.context_id=c.id AND cm.account_id=? AND cm.membership_status='active'
            WHERE c.id=? AND c.status='active' AND (c.account_id=? OR cm.account_id=?) LIMIT 1");
        $stmt->execute([$accountId,$contextId,$accountId,$accountId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) throw new DomainException('context_not_available');

        $setIds = array_values(array_unique(array_filter([(int)($row['capability_set_id'] ?? 0),(int)($row['member_set_id'] ?? 0)])));
        $allow = [];
        $deny = [];
        $sources = [];
        if ($setIds) {
            $marks = implode(',', array_fill(0, count($setIds), '?'));
            $stmt = $this->pdo->prepare("SELECT cs.code,c.capability_key,c.effect FROM capabilities c JOIN capability_sets cs ON cs.id=c.capability_set_id WHERE c.capability_set_id IN ($marks)");
            $stmt->execute($setIds);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $cap) {
                $rawKey = (string)$cap['capability_key'];
                $key = KaretaCapabilityRegistry::canonical($rawKey);
                $effect = (string)$cap['effect'];
                $sources[$key][] = 'set:' . (string)$cap['code'] . ($rawKey !== $key ? ':alias:' . $rawKey : '');
                if ($effect === 'deny') $deny[$key] = true; else $allow[$key] = true;
            }
        }

        $stmt = $this->pdo->prepare("SELECT capability_key,effect,account_id FROM context_capability_overrides
            WHERE context_id=? AND (account_id IS NULL OR account_id=?) AND (expires_at IS NULL OR expires_at>NOW())
            ORDER BY account_id IS NULL ASC,id ASC");
        $stmt->execute([$contextId,$accountId]);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $override) {
            $rawKey = (string)$override['capability_key'];
            $key = KaretaCapabilityRegistry::canonical($rawKey);
            $effect = (string)$override['effect'];
            $sources[$key][] = ((int)($override['account_id'] ?? 0) > 0 ? 'account_override' : 'context_override') . ':' . $effect . ($rawKey !== $key ? ':alias:' . $rawKey : '');
            if ($effect === 'deny') $deny[$key] = true; else $allow[$key] = true;
        }

        foreach (array_keys($deny) as $key) unset($allow[$key]);

        // MASTER first-entry is a blocking pre-work state. Existing masters are backfilled as completed by migration 128.
        // A newly created MASTER profile gets only onboarding capabilities until the server confirms completion.
        if ((string)($row['context_type'] ?? '') === 'profile' && (int)($row['profile_id'] ?? 0) > 0) {
            try {
                $profileId=(int)$row['profile_id'];
                $profile=$this->pdo->prepare("SELECT profile_type FROM person_profiles WHERE id=? LIMIT 1");
                $profile->execute([$profileId]);
                if (strtolower((string)$profile->fetchColumn()) === 'master') {
                    $status='not_started';
                    $exists=$this->pdo->query("SHOW TABLES LIKE 'master_onboarding_state'");
                    if ($exists && $exists->fetchColumn()) {
                        $q=$this->pdo->prepare("SELECT status FROM master_onboarding_state WHERE profile_id=? LIMIT 1");
                        $q->execute([$profileId]);
                        $stored=$q->fetchColumn();
                        if (is_string($stored) && $stored !== '') $status=$stored;
                    }
                    if ($status !== 'completed') {
                        $original=array_keys($allow);
                        $allow=[
                            'master.onboarding.view'=>true,
                            'master.onboarding.edit'=>true,
                            'master.onboarding.complete'=>true,
                        ];
                        foreach ($original as $key) $deny[$key]=true;
                        foreach (array_keys($allow) as $key) unset($deny[$key]);
                        $sources['master.onboarding.view'][]='master_onboarding_guard:'.$status;
                        $sources['master.onboarding.edit'][]='master_onboarding_guard:'.$status;
                        $sources['master.onboarding.complete'][]='master_onboarding_guard:'.$status;
                    }
                }
            } catch (Throwable $_e) {
                // Fail closed for MASTER first-entry. A backend lookup failure must never reopen work capabilities.
                $original=array_keys($allow);
                $allow=[
                    'master.onboarding.view'=>true,
                    'master.onboarding.edit'=>true,
                    'master.onboarding.complete'=>true,
                ];
                foreach ($original as $key) $deny[$key]=true;
                foreach (array_keys($allow) as $key) unset($deny[$key]);
                $sources['master.onboarding.view'][]='master_onboarding_guard:state_lookup_failed';
                $sources['master.onboarding.edit'][]='master_onboarding_guard:state_lookup_failed';
                $sources['master.onboarding.complete'][]='master_onboarding_guard:state_lookup_failed';
            }
        }
        ksort($allow); ksort($deny); ksort($sources);
        return $this->cache[$cacheKey] = [
            'allowed'=>array_keys($allow),
            'denied'=>array_keys($deny),
            'sources'=>$sources,
        ];
    }

    public function can(int $accountId, string $capability, ?int $contextId = null, bool $audit = false, array $resource = []): bool
    {
        $capability = KaretaCapabilityRegistry::canonical($capability);
        if ($capability === '') return false;
        if ($contextId === null) $contextId = (int)$this->contexts->currentContext($accountId)['id'];
        $effective = $this->effective($accountId, $contextId);
        $denied = $this->matchesAny($capability, $effective['denied']);
        $allowed = !$denied && $this->matchesAny($capability, $effective['allowed']);
        if ($audit || !$allowed) $this->audit($accountId,$contextId,$capability,$allowed,$resource);
        return $allowed;
    }

    public function require(int $accountId, string $capability, ?int $contextId = null, array $resource = []): void
    {
        if (!$this->can($accountId,$capability,$contextId,true,$resource)) throw new DomainException('capability_denied');
    }

    private function matchesAny(string $requested, array $rules): bool
    {
        foreach ($rules as $rule) {
            if ($rule === '*' || $rule === $requested) return true;
            if (substr($rule, -2) === '.*' && strpos($requested, substr($rule, 0, -1)) === 0) return true;
        }
        return false;
    }

    private function audit(int $accountId, int $contextId, string $capability, bool $allowed, array $resource): void
    {
        try {
            $stmt = $this->pdo->prepare("INSERT INTO capability_check_audit(account_id,context_id,capability_key,decision,source,resource_type,resource_key,request_id) VALUES(?,?,?,?,?,?,?,?)");
            $stmt->execute([$accountId,$contextId,$capability,$allowed?'allow':'deny','capability_engine',
                trim((string)($resource['type'] ?? '')) ?: null, trim((string)($resource['key'] ?? '')) ?: null,
                defined('KARETA_REQUEST_ID') ? KARETA_REQUEST_ID : null]);
        } catch (Throwable $_e) { /* audit must not break authorization */ }
    }
}
