<?php
declare(strict_types=1);

function kareta_context_decode_json($value): array
{
    if (is_array($value)) return array_values(array_unique(array_map('strval', $value)));
    if (!is_string($value) || trim($value) === '') return [];
    $decoded = json_decode($value, true);
    return is_array($decoded) ? array_values(array_unique(array_map('strval', $decoded))) : [];
}

function kareta_context_role_capabilities(string $role): array
{
    $normalized = kareta_normalize_role($role);
    $map = [
        'client' => ['orders.create','orders.readOwn','chats.use','parts.browse','masters.browse','domain.read','domain.event.create','calendar.manageOwn','payment.intent.create','finance.manageOwn','notifications.manageOwn'],
        'master' => ['orders.take','orders.read','orders.updateAssigned','services.manageOwn','chats.use','profile.master','parts.browse','domain.read','domain.event.create','calendar.manageOwn','payment.intent.create','finance.manageOwn','notifications.manageOwn'],
        'sto' => ['orders.manageService','orders.read','clients.read','masters.manageTeam','services.manage','chats.use','profile.sto','domain.read','domain.event.create','calendar.manageOrganization','payment.intent.create','finance.manageOwn','notifications.manageOwn'],
        'seller' => ['seller.products.manage','seller.stock.manage','seller.orders.manage','seller.profile.manage','parts.browse','domain.read','domain.event.create','calendar.manageOrganization','payment.intent.create','finance.manageOwn','notifications.manageOwn'],
        'admin' => ['*'],
        'owner' => ['*'],
    ];
    return $map[$normalized] ?? [];
}

function kareta_context_ui_role(array $context, string $fallbackRole = 'client'): string
{
    if (($context['type'] ?? '') === 'personal') return kareta_normalize_role((string)($context['role'] ?? $fallbackRole));
    $organizationType = (string)($context['organizationType'] ?? $context['role'] ?? '');
    if ($organizationType === 'service_station') return 'sto';
    if ($organizationType === 'parts_store') return 'seller';
    return kareta_normalize_role((string)($context['memberRole'] ?? $fallbackRole));
}

function kareta_context_effective_capabilities(PDO $pdo, int $userId, string $contextType, string $contextId, array $base): array
{
    $allow = array_fill_keys(array_values(array_unique(array_map('strval', $base))), true);
    $deny = [];
    $stmt = $pdo->prepare("SELECT capability,effect FROM user_capabilities
        WHERE user_id=? AND context_type=? AND context_id=?
          AND (expires_at IS NULL OR expires_at>NOW())");
    $stmt->execute([$userId, $contextType, $contextId]);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
        $capability = trim((string)($row['capability'] ?? ''));
        if ($capability === '') continue;
        if (($row['effect'] ?? 'allow') === 'deny') $deny[$capability] = true;
        else $allow[$capability] = true;
    }
    foreach ($deny as $capability => $_) unset($allow[$capability]);
    if (isset($deny['*'])) return [];
    return array_values(array_keys($allow));
}

function kareta_contexts_for_user(PDO $pdo, array $user): array
{
    $uid = (int)($user['id'] ?? 0);
    $role = kareta_normalize_role((string)($user['role'] ?? 'client'));
    $personalId = 'personal:' . $uid;
    $personalCaps = kareta_context_effective_capabilities($pdo, $uid, 'personal', $personalId, kareta_context_role_capabilities($role));
    $contexts = [[
        'type'=>'personal','id'=>$personalId,'label'=>(string)($user['name'] ?? 'Личный кабинет'),
        'role'=>$role,'uiRole'=>$role,'organizationId'=>null,'organizationType'=>null,'memberRole'=>$role,
        'capabilities'=>$personalCaps,
    ]];

    $stmt = $pdo->prepare("SELECT om.organization_id,om.member_role,om.position,om.status,om.permissions_json,
            o.type,o.name,o.city,o.legacy_entity_type,o.legacy_entity_id
        FROM organization_members om JOIN organizations o ON o.id=om.organization_id
        WHERE om.user_id=? AND om.status='active' AND o.status='active' ORDER BY o.name");
    $stmt->execute([$uid]);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
        $contextId = 'organization:' . (string)$row['organization_id'];
        $memberRole = (string)$row['member_role'];
        $base = kareta_context_decode_json($row['permissions_json']);
        if (!$base) $base = kareta_context_role_capabilities($memberRole);
        $context = [
            'type'=>'organization','id'=>$contextId,'label'=>(string)$row['name'],
            'role'=>(string)$row['type'],'organizationType'=>(string)$row['type'],
            'organizationId'=>(string)$row['organization_id'],'memberRole'=>$memberRole,
            'position'=>(string)$row['position'],'city'=>(string)$row['city'],
            'legacy'=>['type'=>(string)$row['legacy_entity_type'],'id'=>(string)$row['legacy_entity_id']],
        ];
        $context['uiRole'] = kareta_context_ui_role($context, $role);
        $context['capabilities'] = kareta_context_effective_capabilities($pdo, $uid, 'organization', (string)$row['organization_id'], $base);
        $contexts[] = $context;
    }
    return $contexts;
}

function kareta_context_selected(PDO $pdo, array $user, ?array $contexts = null): array
{
    $contexts = $contexts ?? kareta_contexts_for_user($pdo, $user);
    $available = [];
    foreach ($contexts as $context) $available[(string)$context['id']] = $context;
    $sessionContext = $_SESSION['kareta_context'] ?? null;
    if (is_array($sessionContext) && isset($available[(string)($sessionContext['id'] ?? '')])) {
        return $available[(string)$sessionContext['id']];
    }
    try {
        $stmt = $pdo->prepare("SELECT context_id FROM user_context_preferences WHERE user_id=? LIMIT 1");
        $stmt->execute([(int)$user['id']]);
        $stored = (string)($stmt->fetchColumn() ?: '');
        if ($stored !== '' && isset($available[$stored])) {
            $_SESSION['kareta_context'] = $available[$stored];
            return $available[$stored];
        }
    } catch (Throwable $_error) {}
    $selected = $contexts[0];
    $_SESSION['kareta_context'] = $selected;
    return $selected;
}

function kareta_context_save_selected(PDO $pdo, array $user, array $context): void
{
    $_SESSION['kareta_context'] = $context;
    $stmt = $pdo->prepare("INSERT INTO user_context_preferences(user_id,context_id,context_type,organization_id)
        VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE context_id=VALUES(context_id),context_type=VALUES(context_type),organization_id=VALUES(organization_id)");
    $stmt->execute([(int)$user['id'], (string)$context['id'], (string)$context['type'], $context['organizationId'] ?? null]);
}

function kareta_context_can(array $context, string $capability): bool
{
    $caps = array_map('strval', $context['capabilities'] ?? []);
    return in_array('*', $caps, true) || in_array($capability, $caps, true);
}

function kareta_require_capability(PDO $pdo, array $user, string $capability): array
{
    require_once __DIR__ . '/identity/authorization_pipeline.php';
    try {
        $decision = kareta_authorize($pdo, $capability, [], $user);
        $context = $decision->context;
        return [
            'id'=>(string)($context['context_key'] ?? $context['id'] ?? ''),
            'type'=>(string)($context['context_type'] ?? $context['type'] ?? 'personal'),
            'organizationId'=>$context['organization_key'] ?? $context['organization_id'] ?? null,
            'organizationKey'=>$context['organization_key'] ?? null,
            'capabilities'=>$decision->capabilities['allowed'] ?? [],
            'deniedCapabilities'=>$decision->capabilities['denied'] ?? [],
            'identityContextId'=>$decision->contextId,
        ];
    } catch (DomainException $e) {
        $error=$e->getMessage();
        $status=in_array($error,['session_required','identity_account_unavailable'],true)?401:403;
        kareta_json(['ok'=>false,'error'=>$error,'capability'=>$capability,'stage'=>9],$status);
    }
}

function kareta_require_resource_capability(PDO $pdo, array $user, string $capability, array $resource): array
{
    require_once __DIR__ . '/identity/authorization_pipeline.php';
    try {
        $decision=kareta_authorize($pdo,$capability,$resource,$user);
        return ['context'=>$decision->context,'accountId'=>$decision->accountId,'personId'=>$decision->personId,'capabilities'=>$decision->capabilities];
    } catch (DomainException $e) {
        $error=$e->getMessage();
        $status=$error==='resource_not_found'?404:(in_array($error,['session_required','identity_account_unavailable'],true)?401:403);
        kareta_json(['ok'=>false,'error'=>$error,'capability'=>$capability,'resource'=>$resource,'stage'=>9],$status);
    }
}
