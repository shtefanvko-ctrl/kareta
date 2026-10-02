<?php
declare(strict_types=1);

/**
 * Read-only audit for Service -> Platform domain projection consistency.
 *
 * Intentionally DOES NOT require api/bootstrap.php because bootstrap can run
 * schema bootstrap/recovery. This verifier must never mutate production data.
 *
 * Usage:
 *   php tools/audit_service_domain_projection.php
 *   php tools/audit_service_domain_projection.php --strict
 */
$root = dirname(__DIR__);
require_once $root . '/config.php';

function projection_audit_pdo(): PDO
{
    if (!defined('KARETA_DB') || !is_array(KARETA_DB)) {
        throw new RuntimeException('KARETA_DB config is unavailable');
    }
    $db = KARETA_DB;
    $charset = trim((string)($db['charset'] ?? 'utf8mb4')) ?: 'utf8mb4';
    $socket = trim((string)($db['socket'] ?? ''));
    $database = trim((string)($db['database'] ?? ''));
    if ($database === '') throw new RuntimeException('Database name is empty');

    if ($socket !== '') {
        $dsn = 'mysql:unix_socket=' . $socket . ';dbname=' . $database . ';charset=' . $charset;
    } else {
        $host = trim((string)($db['host'] ?? '127.0.0.1')) ?: '127.0.0.1';
        $port = max(1, (int)($db['port'] ?? 3306));
        $dsn = 'mysql:host=' . $host . ';port=' . $port . ';dbname=' . $database . ';charset=' . $charset;
    }

    return new PDO(
        $dsn,
        (string)($db['username'] ?? $db['user'] ?? ''),
        (string)($db['password'] ?? ''),
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
}

function projection_audit_table_exists(PDO $pdo, string $table): bool
{
    $st = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?'
    );
    $st->execute([$table]);
    return (int)$st->fetchColumn() > 0;
}

function projection_audit_nonempty_id($value): bool
{
    $value = trim((string)$value);
    return $value !== '' && $value !== '0';
}

function projection_audit_is_advanced_stage(string $stage): bool
{
    return in_array($stage, ['diagnostics','estimate','parts','work','quality','handover','completed'], true);
}

function projection_audit_sample(array &$bucket, string $id, int $limit = 25): void
{
    if (count($bucket) < $limit) $bucket[] = $id;
}

$strict = in_array('--strict', $argv ?? [], true);
$pdo = projection_audit_pdo();

foreach (['orders','domain_entities','domain_relations'] as $requiredTable) {
    if (!projection_audit_table_exists($pdo, $requiredTable)) {
        fwrite(STDERR, "Missing required table: {$requiredTable}\n");
        exit(2);
    }
}

$hasWorkflow = projection_audit_table_exists($pdo, 'sto_workflows');
$workflowJoin = $hasWorkflow
    ? ' LEFT JOIN sto_workflows sw ON sw.order_id = o.id '
    : '';
$workflowSelect = $hasWorkflow
    ? ", COALESCE(sw.current_stage,'') AS workflow_stage"
    : ", '' AS workflow_stage";

$orders = $pdo->query(
    "SELECT o.id,o.type,o.status,o.accepted_at,o.master_id,o.master_user_id,o.client_user_id,o.sto_id"
    . $workflowSelect .
    " FROM orders o" . $workflowJoin
)->fetchAll();

$entityRows = $pdo->query(
    "SELECT entity_type,entity_key,status,owner_user_id,organization_id
       FROM domain_entities
      WHERE entity_type IN ('work_request','work_order')"
)->fetchAll();

$relationRows = $pdo->query(
    "SELECT source_key,target_key,status
       FROM domain_relations
      WHERE source_type='work_request'
        AND relation_type='produces'
        AND target_type='work_order'"
)->fetchAll();

$workRequests = [];
$workOrders = [];
foreach ($entityRows as $row) {
    $type = (string)$row['entity_type'];
    $key = (string)$row['entity_key'];
    if ($type === 'work_request') $workRequests[$key] = $row;
    if ($type === 'work_order') $workOrders[$key] = $row;
}

$produces = [];
foreach ($relationRows as $row) {
    if ((string)($row['status'] ?? 'active') !== 'active') continue;
    $produces[(string)$row['source_key'] . '>' . (string)$row['target_key']] = true;
}

$knownOrderIds = [];
$counts = [
    'ordersTotal' => 0,
    'serviceCandidates' => 0,
    'partsRequests' => 0,
    'unknownTypes' => 0,
    'acceptedAtRepairs' => 0,
    'historicalRepairEvidenceWithoutAcceptedAt' => 0,
    'processWithoutAcceptanceEvidence' => 0,
    'missingWorkRequest' => 0,
    'requestOnlyHasWorkOrder' => 0,
    'acceptedRepairMissingWorkOrder' => 0,
    'partsRequestAsWorkRequest' => 0,
    'partsRequestAsWorkOrder' => 0,
    'missingProducesRelation' => 0,
    'producesWithoutRepairEvidence' => 0,
    'projectionStatusMismatch' => 0,
    'projectionOwnerMismatch' => 0,
    'projectionOrganizationMismatch' => 0,
    'orphanWorkRequest' => 0,
    'orphanWorkOrder' => 0,
];

$samples = [];
foreach (array_keys($counts) as $name) $samples[$name] = [];

foreach ($orders as $o) {
    $counts['ordersTotal']++;
    $id = (string)$o['id'];
    $knownOrderIds[$id] = true;
    $type = trim((string)($o['type'] ?? ''));
    $status = trim((string)($o['status'] ?? 'new'));
    $accepted = trim((string)($o['accepted_at'] ?? '')) !== '';
    $masterAssigned = projection_audit_nonempty_id($o['master_id'] ?? '')
        || ((int)($o['master_user_id'] ?? 0) > 0);
    $workflowStage = trim((string)($o['workflow_stage'] ?? ''));
    $advancedWorkflow = projection_audit_is_advanced_stage($workflowStage);

    $isParts = $type === 'parts_request';
    $isService = $type === 'service_order' || $type === '';
    if ($isParts) {
        $counts['partsRequests']++;
    } elseif ($isService) {
        $counts['serviceCandidates']++;
    } else {
        $counts['unknownTypes']++;
        projection_audit_sample($samples['unknownTypes'], $id . ':' . $type);
    }

    // Strict current acceptance signal: accepted_at is set by master claim,
    // admin/STO master assignment and masterOrder.accept.
    $strictRepair = $isService && $accepted;

    // Historical fallback evidence is audit-only. It must not silently become
    // the canonical predicate until legacy rows are classified.
    $historicalRepairEvidence = $isService && !$accepted
        && ($advancedWorkflow || ($masterAssigned && in_array($status, ['process','done'], true)));

    if ($strictRepair) $counts['acceptedAtRepairs']++;
    if ($historicalRepairEvidence) {
        $counts['historicalRepairEvidenceWithoutAcceptedAt']++;
        projection_audit_sample($samples['historicalRepairEvidenceWithoutAcceptedAt'], $id);
    }
    if ($isService && $status === 'process' && !$accepted && !$historicalRepairEvidence) {
        $counts['processWithoutAcceptanceEvidence']++;
        projection_audit_sample($samples['processWithoutAcceptanceEvidence'], $id);
    }

    $hasRequest = isset($workRequests[$id]);
    $hasWorkOrder = isset($workOrders[$id]);
    $hasProduces = isset($produces[$id . '>' . $id]);

    if ($isParts) {
        if ($hasRequest) {
            $counts['partsRequestAsWorkRequest']++;
            projection_audit_sample($samples['partsRequestAsWorkRequest'], $id);
        }
        if ($hasWorkOrder) {
            $counts['partsRequestAsWorkOrder']++;
            projection_audit_sample($samples['partsRequestAsWorkOrder'], $id);
        }
        continue;
    }

    if (!$isService) continue;

    if (!$hasRequest) {
        $counts['missingWorkRequest']++;
        projection_audit_sample($samples['missingWorkRequest'], $id);
    }

    $repairEvidence = $strictRepair || $historicalRepairEvidence;
    if (!$repairEvidence && $hasWorkOrder) {
        $counts['requestOnlyHasWorkOrder']++;
        projection_audit_sample($samples['requestOnlyHasWorkOrder'], $id);
    }
    if ($repairEvidence && !$hasWorkOrder) {
        $counts['acceptedRepairMissingWorkOrder']++;
        projection_audit_sample($samples['acceptedRepairMissingWorkOrder'], $id);
    }
    if ($repairEvidence && !$hasProduces) {
        $counts['missingProducesRelation']++;
        projection_audit_sample($samples['missingProducesRelation'], $id);
    }
    if (!$repairEvidence && $hasProduces) {
        $counts['producesWithoutRepairEvidence']++;
        projection_audit_sample($samples['producesWithoutRepairEvidence'], $id);
    }

    foreach ([$workRequests[$id] ?? null, $workOrders[$id] ?? null] as $projection) {
        if (!$projection) continue;
        if ((string)($projection['status'] ?? '') !== $status) {
            $counts['projectionStatusMismatch']++;
            projection_audit_sample($samples['projectionStatusMismatch'], $id . ':' . (string)$projection['entity_type']);
        }
        $expectedOwner = (int)($o['client_user_id'] ?? 0);
        if ($expectedOwner > 0 && (int)($projection['owner_user_id'] ?? 0) !== $expectedOwner) {
            $counts['projectionOwnerMismatch']++;
            projection_audit_sample($samples['projectionOwnerMismatch'], $id . ':' . (string)$projection['entity_type']);
        }
        $expectedOrg = trim((string)($o['sto_id'] ?? ''));
        $actualOrg = trim((string)($projection['organization_id'] ?? ''));
        if ($expectedOrg !== $actualOrg) {
            $counts['projectionOrganizationMismatch']++;
            projection_audit_sample($samples['projectionOrganizationMismatch'], $id . ':' . (string)$projection['entity_type']);
        }
    }
}

foreach ($workRequests as $id => $_row) {
    if (!isset($knownOrderIds[$id])) {
        $counts['orphanWorkRequest']++;
        projection_audit_sample($samples['orphanWorkRequest'], $id);
    }
}
foreach ($workOrders as $id => $_row) {
    if (!isset($knownOrderIds[$id])) {
        $counts['orphanWorkOrder']++;
        projection_audit_sample($samples['orphanWorkOrder'], $id);
    }
}

$blockingKeys = [
    'partsRequestAsWorkRequest',
    'partsRequestAsWorkOrder',
    'requestOnlyHasWorkOrder',
    'acceptedRepairMissingWorkOrder',
    'missingProducesRelation',
    'producesWithoutRepairEvidence',
    'projectionOwnerMismatch',
    'projectionOrganizationMismatch',
    'orphanWorkRequest',
    'orphanWorkOrder',
];
$blocking = 0;
foreach ($blockingKeys as $key) $blocking += (int)$counts[$key];

$out = [
    'ok' => $blocking === 0,
    'mode' => $strict ? 'strict' : 'report',
    'readOnly' => true,
    'repairOrderPredicate' => [
        'strict' => "order.type in ('service_order','legacy-empty') AND accepted_at IS NOT NULL",
        'historicalFallbackAuditOnly' => "advanced workflow OR assigned master + process/done when accepted_at is missing",
        'rejectedSignals' => ['orders.status=process alone','sto_workflows row existence alone','sto_id alone'],
        'partsRequest' => 'MUST NOT project as work_request/work_order',
    ],
    'hasStoWorkflowTable' => $hasWorkflow,
    'counts' => $counts,
    'blockingMismatchCount' => $blocking,
    'samples' => array_filter($samples, static fn(array $v): bool => !empty($v)),
    'generatedAt' => gmdate('c'),
];

echo json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), PHP_EOL;
if ($strict && $blocking > 0) exit(1);
