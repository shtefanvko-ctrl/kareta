<?php
declare(strict_types=1);

/**
 * Admin control-plane identity boundary.
 * A successful capability decision alone must not promote an organization
 * owner to the platform admin/owner role. Validate the canonical DB role.
 * For legacy PHP sessions, the caller must supply kareta_current_user(),
 * never request parameters; verify the live DB role and phone again.
 */
function kareta_admin_actor_guard(PDO $pdo, int $identityAccountId, ?array $legacyUser): array
{
    $identityAccountId = max(0, $identityAccountId);
    if ($identityAccountId > 0) {
        $query = $pdo->prepare("SELECT u.id, u.phone, u.role, u.active, a.status AS account_status
            FROM accounts a INNER JOIN users u ON u.phone=a.phone
            WHERE a.id=? LIMIT 1");
        $query->execute([$identityAccountId]);
    } else {
        $legacyId = (int)($legacyUser['id'] ?? 0);
        $legacyPhone = (string)($legacyUser['phone'] ?? '');
        if ($legacyId <= 0 || $legacyPhone === '') throw new DomainException('admin_required');
        $query = $pdo->prepare('SELECT id,phone,role,active FROM users WHERE id=? LIMIT 1');
        $query->execute([$legacyId]);
    }
    $record = $query->fetch(PDO::FETCH_ASSOC);
    if (!is_array($record)) throw new DomainException('admin_required');
    if (!in_array(strtolower((string)($record['role'] ?? '')), ['admin','owner'], true)) {
        throw new DomainException('admin_required');
    }
    if ((int)($record['active'] ?? 0) !== 1) throw new DomainException('admin_required');
    if ($identityAccountId > 0 && (string)($record['account_status'] ?? '') !== 'active') {
        throw new DomainException('admin_required');
    }
    if ($identityAccountId === 0) {
        $serverPhone = function_exists('kareta_normalize_phone') ? kareta_normalize_phone((string)$record['phone']) : (string)$record['phone'];
        $sessionPhone = function_exists('kareta_normalize_phone') ? kareta_normalize_phone((string)$legacyUser['phone']) : (string)$legacyUser['phone'];
        if ($serverPhone === '' || $sessionPhone === '' || !hash_equals($serverPhone,$sessionPhone)) {
            throw new DomainException('admin_required');
        }
    }
    return ['account'=>$identityAccountId,'user'=>(int)$record['id']];
}
