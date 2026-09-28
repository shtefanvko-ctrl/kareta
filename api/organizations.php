<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/request_logger.php';
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/context_access.php';

$pdo = kareta_pdo();
$user = kareta_current_user();
if (!$user) kareta_json(['ok'=>false,'error'=>'unauthorized'],401);
if (!$pdo instanceof PDO) kareta_json(['ok'=>false,'error'=>'database_unavailable'],503);

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$action = trim((string)($_GET['action'] ?? ''));

if ($method === 'GET' && ($action === '' || $action === 'contexts')) {
    $contexts = kareta_contexts_for_user($pdo, $user);
    $selected = kareta_context_selected($pdo, $user, $contexts);
    kareta_json(['ok'=>true,'contexts'=>$contexts,'selectedContext'=>$selected]);
}

if ($method === 'GET' && $action === 'capabilities') {
    $selected = kareta_context_selected($pdo, $user);
    kareta_json(['ok'=>true,'selectedContext'=>$selected,'capabilities'=>$selected['capabilities'] ?? []]);
}

if ($method === 'GET' && $action === 'members') {
    $orgId = trim((string)($_GET['organizationId'] ?? ''));
    if ($orgId === '') kareta_json(['ok'=>false,'error'=>'organization_id_required'],422);
    $contexts = kareta_contexts_for_user($pdo, $user);
    $allowed = false;
    foreach ($contexts as $context) {
        if (($context['organizationId'] ?? '') === $orgId && (kareta_context_can($context, 'masters.manageTeam') || kareta_context_can($context, '*'))) { $allowed = true; break; }
    }
    if (!$allowed && !in_array(kareta_normalize_role((string)$user['role']), ['admin','owner'], true)) kareta_json(['ok'=>false,'error'=>'forbidden'],403);
    $stmt = $pdo->prepare("SELECT id,user_id AS userId,entity_type AS entityType,entity_id AS entityId,member_role AS memberRole,position,status,branch_unit_id AS branchUnitId,permissions_json AS permissions,joined_at AS joinedAt,left_at AS leftAt FROM organization_members WHERE organization_id=? ORDER BY status,member_role,created_at");
    $stmt->execute([$orgId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    foreach ($rows as &$row) $row['permissions'] = kareta_context_decode_json($row['permissions']);
    unset($row);
    kareta_json(['ok'=>true,'organizationId'=>$orgId,'members'=>$rows]);
}

if ($method === 'POST' && $action === 'selectContext') {
    $body = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($body)) $body = [];
    $contextId = trim((string)($body['contextId'] ?? ''));
    $contexts = kareta_contexts_for_user($pdo, $user);
    $selected = null;
    foreach ($contexts as $context) {
        if (hash_equals((string)$context['id'], $contextId)) { $selected = $context; break; }
    }
    if (!$selected) kareta_json(['ok'=>false,'error'=>'context_not_available'],403);
    kareta_context_save_selected($pdo, $user, $selected);
    kareta_log_audit($pdo, 'organization.context.select', ['contextId'=>$contextId,'uiRole'=>$selected['uiRole'] ?? 'client']);
    kareta_json(['ok'=>true,'selectedContext'=>$selected]);
}

kareta_json(['ok'=>false,'error'=>'not_found'],404);
