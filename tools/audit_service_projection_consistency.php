<?php
declare(strict_types=1);

/**
 * Read-only audit for PLATFORM-PROJECTION-001.
 *
 * Purpose:
 * - compare Service owner facts in orders/sto_workflows/order_events
 *   with Platform domain_entities/domain_relations projections;
 * - identify premature work_order projections and stale/missing projection state;
 * - never load api/bootstrap.php and never mutate schema or business data.
 *
 * Usage:
 *   php tools/audit_service_projection_consistency.php
 *   php tools/audit_service_projection_consistency.php --json=/tmp/service_projection_audit.json
 */

$root = dirname(__DIR__);
$configFile = $root . '/config.php';
if (!is_file($configFile)) {
    fwrite(STDERR, "config.php is missing\n");
    exit(2);
}
require $configFile;

$db = defined('KARETA_DB') ? constant('KARETA_DB') : ($KARETA_DB ?? $GLOBALS['KARETA_DB'] ?? []);
if (!is_array($db)) {
    fwrite(STDERR, "Database configuration is unavailable\n");
    exit(2);
}

$host = (string)($db['host'] ?? 'localhost');
$port = (int)($db['port'] ?? 3306);
$name = (string)($db['database'] ?? $db['dbname'] ?? '');
$charset = (string)($db['charset'] ?? 'utf8mb4');
$user = (string)($db['username'] ?? $db['user'] ?? '');
$pass = (string)($db['password'] ?? $db['pass'] ?? '');
if ($name === '') {
    fwrite(STDERR, "Database name is empty\n");
    exit(2);
}

$pdo = new PDO(
    sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $host, $port, $name, $charset),
    $user,
    $pass,
    [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_TIMEOUT => max(1, min(5, (int)($db['connect_timeout'] ?? 3))),
    ]
);

$tableExists = static function(PDO $pdo, string $table): bool {
    $st = $pdo->prepare("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? LIMIT 1");
    $st->execute([$table]);
    return (bool)$st->fetchColumn();
};
$columnExists = static function(PDO $pdo, string $table, string $column): bool {
    $st = $pdo->prepare("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=? LIMIT 1");
    $st->execute([$table,$column]);
    return (bool)$st->fetchColumn();
};

$required = ['orders','domain_entities'];
$missingRequired = array_values(array_filter($required, static fn(string $t): bool => !$tableExists($pdo,$t)));
if ($missingRequired) {
    fwrite(STDERR, 'Missing required tables: '.implode(',',$missingRequired)."\n");
    exit(2);
}

$hasAcceptedAt = $columnExists($pdo,'orders','accepted_at');
$hasWorkflow = $tableExists($pdo,'sto_workflows');
$hasOrderEvents = $tableExists($pdo,'order_events');
$hasRelations = $tableExists($pdo,'domain_relations');

$acceptedExpr = $hasAcceptedAt ? 'o.accepted_at' : 'NULL';
$workflowExpr = $hasWorkflow
    ? "(SELECT w.current_stage FROM sto_workflows w WHERE w.order_id=o.id LIMIT 1)"
    : "NULL";
$acceptanceEvents = [
    'master_accepted',
    'master_assigned',
    'executor_assigned',
    'sto_master_assigned',
    'sto_lead_accepted',
    'master_order_accepted',
];
$quotedEvents = implode(',', array_fill(0,count($acceptanceEvents),'?'));
$eventExpr = $hasOrderEvents
    ? "(SELECT oe.event_type FROM order_events oe WHERE oe.order_id=o.id AND oe.event_type IN ($quotedEvents) ORDER BY oe.created_at DESC,oe.id DESC LIMIT 1)"
    : "NULL";

$sql = "SELECT
          o.id,o.type,o.status,o.client_user_id,o.master_user_id,o.master_id,o.sto_id,o.source,
          {$acceptedExpr} AS accepted_at,
          {$workflowExpr} AS workflow_stage,
          {$eventExpr} AS acceptance_event,
          wr.owner_user_id AS wr_owner_user_id,wr.status AS wr_status,
          wo.owner_user_id AS wo_owner_user_id,wo.status AS wo_status
        FROM orders o
        LEFT JOIN domain_entities wr ON wr.entity_type='work_request' AND wr.entity_key=o.id
        LEFT JOIN domain_entities wo ON wo.entity_type='work_order' AND wo.entity_key=o.id
        ORDER BY o.created_at,o.id";
$st = $pdo->prepare($sql);
$st->execute($hasOrderEvents ? $acceptanceEvents : []);
$rows = $st->fetchAll() ?: [];

$produces = [];
if ($hasRelations) {
    $rs = $pdo->query("SELECT source_key,target_key FROM domain_relations WHERE source_type='work_request' AND target_type='work_order' AND relation_type='produces' AND status='active'");
    foreach ($rs->fetchAll() ?: [] as $row) {
        $source=(string)($row['source_key']??'');
        $target=(string)($row['target_key']??'');
        if ($source!=='' && $target!=='') $produces[$source.'|'.$target]=true;
    }
}

$serviceTypes = ['service_order'=>true,'request'=>true,'service'=>true];
$advancedStages = [
    'diagnostics'=>true,'estimate'=>true,'approval'=>true,'work_order'=>true,
    'parts_reservation'=>true,'in_progress'=>true,'quality_control'=>true,
    'payment'=>true,'delivery'=>true,'warranty'=>true,'completed'=>true,
];

$issues = [
    'non_service_work_request_projection'=>[],
    'non_service_work_order_projection'=>[],
    'request_projection_missing'=>[],
    'repair_projection_missing'=>[],
    'premature_repair_projection'=>[],
    'premature_produces_relation'=>[],
    'work_request_status_stale'=>[],
    'work_order_status_stale'=>[],
    'work_request_owner_mismatch'=>[],
    'work_order_owner_mismatch'=>[],
    'ambiguous_legacy_acceptance'=>[],
];

$summary = [
    'orders'=>count($rows),
    'serviceRows'=>0,
    'nonServiceRows'=>0,
    'repairDefinite'=>0,
    'requestOnly'=>0,
    'ambiguousLegacy'=>0,
];

foreach ($rows as $row) {
    $id=(string)$row['id'];
    $type=strtolower(trim((string)($row['type']??'')));
    $isService=isset($serviceTypes[$type]);
    $isParts=$type==='parts_request';
    if ($isService) $summary['serviceRows']++; else $summary['nonServiceRows']++;

    $acceptedAt=trim((string)($row['accepted_at']??''));
    $event=trim((string)($row['acceptance_event']??''));
    $stage=strtolower(trim((string)($row['workflow_stage']??'')));
    $masterId=trim((string)($row['master_id']??''));
    $masterUserId=(int)($row['master_user_id']??0);

    $repairSignal = $isService && (
        $acceptedAt!=='' ||
        $event!=='' ||
        isset($advancedStages[$stage])
    );
    $ambiguousLegacy = $isService
        && !$repairSignal
        && (($masterId!=='' && $masterId!=='0') || $masterUserId>0)
        && in_array((string)($row['status']??''),['process','done_pending_client','done','dispute'],true);

    if ($repairSignal) $summary['repairDefinite']++;
    elseif ($ambiguousLegacy) $summary['ambiguousLegacy']++;
    elseif ($isService) $summary['requestOnly']++;

    $hasWr=$row['wr_status']!==null;
    $hasWo=$row['wo_status']!==null;
    $hasProduces=isset($produces[$id.'|'.$id]);

    $compact=[
        'id'=>$id,
        'type'=>$type,
        'status'=>(string)($row['status']??''),
        'acceptedAt'=>$acceptedAt?:null,
        'acceptanceEvent'=>$event?:null,
        'workflowStage'=>$stage?:null,
        'masterId'=>$masterId?:null,
        'stoId'=>trim((string)($row['sto_id']??''))?:null,
        'source'=>trim((string)($row['source']??''))?:null,
    ];

    if (!$isService && $hasWr) $issues['non_service_work_request_projection'][]=$compact;
    if (!$isService && $hasWo) $issues['non_service_work_order_projection'][]=$compact;
    if ($isService && !$hasWr) $issues['request_projection_missing'][]=$compact;
    if ($repairSignal && !$hasWo) $issues['repair_projection_missing'][]=$compact;
    if ($isService && !$repairSignal && !$ambiguousLegacy && $hasWo) $issues['premature_repair_projection'][]=$compact;
    if ($isService && !$repairSignal && !$ambiguousLegacy && $hasProduces) $issues['premature_produces_relation'][]=$compact;
    if ($ambiguousLegacy) $issues['ambiguous_legacy_acceptance'][]=$compact;

    $owner=(int)($row['client_user_id']??0);
    if ($hasWr && (int)($row['wr_owner_user_id']??0)!==$owner) $issues['work_request_owner_mismatch'][]=$compact;
    if ($hasWo && (int)($row['wo_owner_user_id']??0)!==$owner) $issues['work_order_owner_mismatch'][]=$compact;
    if ($hasWr && (string)$row['wr_status']!==(string)($row['status']??'')) $issues['work_request_status_stale'][]=$compact;
    if ($hasWo && (string)$row['wo_status']!==(string)($row['status']??'')) $issues['work_order_status_stale'][]=$compact;

    // parts_request is intentionally non-Service in this audit. It may belong to
    // Marketplace/parts flow, but it must never silently instantiate RepairOrder.
    unset($isParts);
}

$issueCounts=[];
foreach ($issues as $name=>$items) $issueCounts[$name]=count($items);

$report=[
    'schema'=>'kareta.service-projection-consistency.v1',
    'checkedAt'=>gmdate('c'),
    'readOnly'=>true,
    'sourceOwner'=>'Service',
    'projectionOwner'=>'Platform',
    'serviceRequestPredicate'=>"orders.type IN ('service_order','request','service')",
    'repairOrderPredicate'=>[
        'serviceRequestPredicate'=>true,
        'acceptedAt'=>'orders.accepted_at IS NOT NULL',
        'acceptanceEvent'=>$hasOrderEvents?$acceptanceEvents:'order_events unavailable',
        'advancedWorkflowStage'=>$hasWorkflow?array_keys($advancedStages):'sto_workflows unavailable',
        'statusAloneIsNotAcceptance'=>true,
        'stoIdAloneIsNotAcceptance'=>true,
    ],
    'capabilities'=>[
        'orders.accepted_at'=>$hasAcceptedAt,
        'sto_workflows'=>$hasWorkflow,
        'order_events'=>$hasOrderEvents,
        'domain_relations'=>$hasRelations,
    ],
    'summary'=>$summary,
    'issueCounts'=>$issueCounts,
    'examples'=>array_map(static fn(array $items): array => array_slice($items,0,25),$issues),
    'status'=>array_sum($issueCounts)===0?'PASS':'MISMATCHES_FOUND',
];

$json=json_encode($report,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT).PHP_EOL;
$jsonArg='';
foreach ($argv as $arg) if (str_starts_with($arg,'--json=')) $jsonArg=substr($arg,7);
if ($jsonArg!=='') file_put_contents($jsonArg,$json);
echo $json;
exit(array_sum($issueCounts)===0?0:1);
