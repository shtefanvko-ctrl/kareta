<?php
declare(strict_types=1);

/**
 * Resolve the effective actor from the authoritative Identity context.
 * Falls back to the legacy session when the Identity layer is unavailable.
 */
function kareta_scope_identity_actor(PDO $pdo): array {
    static $cache = [];
    $cacheKey = spl_object_id($pdo);
    if (isset($cache[$cacheKey])) return $cache[$cacheKey];

    $legacy = kareta_session_user() ?: [];
    $legacyRole = kareta_normalize_role((string)($legacy['role'] ?? 'guest'));
    $result = [
        'role' => $legacyRole,
        'context' => null,
        'capabilities' => [],
        'legacyUser' => $legacy,
        'account' => null,
    ];

    try {
        require_once __DIR__ . '/identity/auth_resolver.php';
        $auth = (new KaretaAuthResolver($pdo))->resolve(false);
        if (!$auth) return $cache[$cacheKey] = $result;

        $context = is_array($auth->context) ? $auth->context : [];
        $caps = array_values(array_unique(array_map('strval', $auth->capabilities ?? [])));
        $type = strtolower((string)($context['type'] ?? $context['contextType'] ?? 'personal'));
        $profileType = strtolower((string)($context['profileType'] ?? $context['profile_type'] ?? ''));
        $organizationType = strtolower((string)($context['organizationType'] ?? $context['organization_type'] ?? ''));

        if (in_array('*', $caps, true)) {
            $role = $legacyRole === 'owner' ? 'owner' : 'admin';
        } elseif ($type === 'profile' && $profileType === 'master') {
            $role = 'master';
        } elseif ($type === 'profile' && $profileType === 'seller') {
            $role = 'seller';
        } elseif ($type === 'organization') {
            $role = in_array($organizationType, ['parts_store','shop','store'], true) ? 'seller' : 'sto';
        } elseif ($type === 'personal') {
            $role = 'client';
        } else {
            $role = $legacyRole;
        }

        $result = [
            'role' => $role,
            'context' => $context,
            'capabilities' => $caps,
            'legacyUser' => is_array($auth->legacyUser) ? $auth->legacyUser : $legacy,
            'account' => is_array($auth->account) ? $auth->account : null,
        ];
    } catch (Throwable $_error) {
        // Legacy fallback is intentional: order APIs must remain available during staged migrations.
    }

    return $cache[$cacheKey] = $result;
}

/** Resolve the current master entity from the selected profile context. */
function kareta_scope_current_master(PDO $pdo, ?array $context = null): ?array {
    $context = $context ?: (kareta_scope_identity_actor($pdo)['context'] ?? null);
    $profileId = (int)($context['profileId'] ?? $context['profile_id'] ?? 0);
    if ($profileId > 0) {
        try {
            $st = $pdo->prepare("SELECT legacy_entity_id FROM person_profiles WHERE id=? AND profile_type='master' AND status='active' LIMIT 1");
            $st->execute([$profileId]);
            $legacyId = trim((string)($st->fetchColumn() ?: ''));
            if ($legacyId !== '') {
                $master = $pdo->prepare("SELECT * FROM `masters` WHERE BINARY id=BINARY ? AND COALESCE(active,1)=1 LIMIT 1");
                $master->execute([$legacyId]);
                $row = $master->fetch(PDO::FETCH_ASSOC);
                if ($row) return $row;
            }
        } catch (Throwable $_error) {}
    }

    $u = kareta_session_user() ?: [];
    $uid = (int)($u['id'] ?? 0);
    $phone = kareta_normalize_phone((string)($u['phone'] ?? ''));
    if ($uid <= 0 && $phone === '') return null;
    $st = $pdo->prepare("SELECT * FROM `masters` WHERE user_id=? OR user_phone=? OR phone=? LIMIT 1");
    $st->execute([$uid ?: -1, $phone, $phone]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

/** Resolve the current STO entity from the selected organization context. */
function kareta_scope_current_sto(PDO $pdo, ?array $context = null): ?array {
    $context = $context ?: (kareta_scope_identity_actor($pdo)['context'] ?? null);
    $organizationKey = trim((string)($context['organizationKey'] ?? $context['organization_key'] ?? ''));
    if ($organizationKey !== '') {
        try {
            $st = $pdo->prepare("SELECT legacy_entity_id FROM organizations WHERE id=? AND type='service_station' AND status='active' LIMIT 1");
            $st->execute([$organizationKey]);
            $legacyId = trim((string)($st->fetchColumn() ?: ''));
            if ($legacyId !== '') {
                $sto = $pdo->prepare("SELECT * FROM `sto_profiles` WHERE BINARY id=BINARY ? AND COALESCE(active,1)=1 LIMIT 1");
                $sto->execute([$legacyId]);
                $row = $sto->fetch(PDO::FETCH_ASSOC);
                if ($row) return $row;
            }
        } catch (Throwable $_error) {}
    }

    $u = kareta_session_user() ?: [];
    $uid = (int)($u['id'] ?? 0);
    $phone = kareta_normalize_phone((string)($u['phone'] ?? ''));
    if ($uid <= 0 && $phone === '') return null;
    $st = $pdo->prepare("SELECT * FROM `sto_profiles` WHERE user_id=? OR user_phone=? OR contact_phone=? LIMIT 1");
    $st->execute([$uid ?: -1, $phone, $phone]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

/** Return the active STO link for a master, if any. */
function kareta_scope_master_sto(PDO $pdo, string $masterId): ?array {
    if ($masterId === '' || !kareta_table_exists($pdo, 'sto_master_links')) return null;
    $st = $pdo->prepare("SELECT s.* FROM `sto_master_links` l JOIN `sto_profiles` s ON BINARY s.id=BINARY l.sto_id WHERE BINARY l.master_id=BINARY ? AND l.status='active' AND s.active=1 ORDER BY l.accepted_at DESC,l.updated_at DESC LIMIT 1");
    $st->execute([$masterId]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

/** Build an immutable ownership scope for the current actor. */
function kareta_order_scope(PDO $pdo): array {
    $actor = kareta_scope_identity_actor($pdo);
    $u = is_array($actor['legacyUser'] ?? null) ? $actor['legacyUser'] : (kareta_session_user() ?: []);
    $account = is_array($actor['account'] ?? null) ? $actor['account'] : [];
    $role = kareta_normalize_role((string)($actor['role'] ?? $u['role'] ?? 'guest'));
    $context = is_array($actor['context'] ?? null) ? $actor['context'] : null;
    $scope = [
        'role'=>$role,
        'userId'=>(int)($u['id'] ?? 0),
        'accountId'=>(int)($account['id'] ?? 0),
        'phone'=>kareta_normalize_phone((string)($u['phone'] ?? $account['phone'] ?? '')),
        'context'=>$context,
        'masterId'=>'',
        'stoId'=>'',
    ];
    if ($role === 'master') {
        $m = kareta_scope_current_master($pdo, $context);
        if (!$m) kareta_json(['ok'=>false,'error'=>'master_profile_not_found'],404);
        $scope['masterId'] = (string)$m['id'];
        $sto = kareta_scope_master_sto($pdo, $scope['masterId']);
        $scope['stoId'] = (string)($sto['id'] ?? '');
    } elseif ($role === 'sto') {
        $sto = kareta_scope_current_sto($pdo, $context);
        if (!$sto) kareta_json(['ok'=>false,'error'=>'sto_profile_not_found'],404);
        $scope['stoId'] = (string)$sto['id'];
    }
    return $scope;
}

/** Check whether an order belongs to the current actor. */
function kareta_assert_order_access(PDO $pdo, array $order, bool $write = false): void {
    $scope = kareta_order_scope($pdo);
    $role = $scope['role'];
    if (in_array($role, ['admin','owner'], true)) return;
    if ($role === 'client') {
        $owned = ((int)($order['client_user_id'] ?? 0) > 0 && (int)$order['client_user_id'] === $scope['userId'])
            || ($scope['phone'] !== '' && kareta_normalize_phone((string)($order['client_phone'] ?? '')) === $scope['phone']);
        if (!$owned) kareta_json(['ok'=>false,'error'=>'forbidden_order_owner'],403);
        return;
    }
    if ($role === 'master') {
        if ((string)($order['master_id'] ?? '') !== $scope['masterId']) kareta_json(['ok'=>false,'error'=>'forbidden_order_master'],403);
        return;
    }
    if ($role === 'sto') {
        if ($scope['stoId'] === '' || (string)($order['sto_id'] ?? '') !== $scope['stoId']) kareta_json(['ok'=>false,'error'=>'forbidden_order_sto'],403);
        return;
    }
    if ($write || $role === 'seller') kareta_json(['ok'=>false,'error'=>'forbidden_order_role'],403);
}
