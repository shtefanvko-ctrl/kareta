<?php
declare(strict_types=1);

/** Stage 3 compatibility adapter. Legacy role checks stay active until Stage 15. */
function kareta_identity_capability_service(PDO $pdo): ?array
{
    static $resolved = null;
    if (is_array($resolved)) return $resolved;
    require_once __DIR__ . '/context_service.php';
    require_once __DIR__ . '/capability_service.php';
    $contextService = new KaretaIdentityContextService($pdo);
    $account = $contextService->resolveAccount(function_exists('kareta_current_user') ? (kareta_current_user() ?: []) : []);
    if (!$account) return null;
    return $resolved = ['account'=>$account,'contexts'=>$contextService,'capabilities'=>new KaretaCapabilityService($pdo,$contextService)];
}

function kareta_identity_can(PDO $pdo, string $capability, array $resource = []): bool
{
    $resolved = kareta_identity_capability_service($pdo);
    if (!$resolved) return false;
    return $resolved['capabilities']->can((int)$resolved['account']['id'],$capability,null,false,$resource);
}

function kareta_identity_require(PDO $pdo, string $capability, array $resource = []): void
{
    $resolved = kareta_identity_capability_service($pdo);
    if (!$resolved) throw new DomainException('identity_account_unavailable');
    $resolved['capabilities']->require((int)$resolved['account']['id'],$capability,null,$resource);
}
