<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$action = strtolower(trim((string)($_GET['action'] ?? 'config')));

if ($action === 'config' && $method === 'GET') {
    kareta_json([
        'ok' => true,
        'feature' => 'obd_remote_jobs',
        'delivery' => 'active_app_poll',
        'pollMinMs' => 15000,
        'supportedActions' => ['snapshot'],
        'rawElmCommands' => false,
        'pushConfigured' => false,
        'nativeApiMin' => 6,
    ]);
}

function kareta_obd_jobs_body(): array
{
    $raw = file_get_contents('php://input') ?: '{}';
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        kareta_json(['ok' => false, 'code' => 'INVALID_JSON'], 400);
    }
    return $body;
}

function kareta_obd_jobs_device_id(array $body): string
{
    $deviceId = trim((string)($body['deviceId'] ?? ''));
    if (!preg_match('/^[A-Za-z0-9._:-]{8,80}$/', $deviceId)) {
        kareta_json(['ok' => false, 'code' => 'DEVICE_ID_INVALID'], 422);
    }
    return $deviceId;
}

function kareta_obd_jobs_vehicle_owned(PDO $pdo, string $vehicleId, int $userId, string $phone): bool
{
    if ($vehicleId === '') return true;
    $st = $pdo->prepare("SELECT id,user_id,user_phone FROM client_vehicles WHERE id=? AND active=1 LIMIT 1");
    $st->execute([$vehicleId]);
    $vehicle = $st->fetch(PDO::FETCH_ASSOC);
    if (!$vehicle) return false;
    if ($userId > 0 && (int)($vehicle['user_id'] ?? 0) === $userId) return true;
    return $phone !== '' && hash_equals($phone, (string)($vehicle['user_phone'] ?? ''));
}

function kareta_obd_jobs_public_row(array $row): array
{
    $payload = json_decode((string)($row['payload_json'] ?? ''), true);
    return [
        'id' => (string)($row['id'] ?? ''),
        'vehicleId' => (string)($row['vehicle_id'] ?? ''),
        'requestKey' => (string)($row['request_key'] ?? ''),
        'action' => (string)($row['action'] ?? ''),
        'payload' => is_array($payload) ? $payload : [],
        'status' => (string)($row['status'] ?? ''),
        'claimedDeviceId' => (string)($row['claimed_device_id'] ?? ''),
        'resultSyncKey' => (string)($row['result_sync_key'] ?? ''),
        'errorCode' => (string)($row['error_code'] ?? ''),
        'errorMessage' => (string)($row['error_message'] ?? ''),
        'attemptCount' => (int)($row['attempt_count'] ?? 0),
        'expiresAt' => (string)($row['expires_at'] ?? ''),
        'claimedAt' => (string)($row['claimed_at'] ?? ''),
        'completedAt' => (string)($row['completed_at'] ?? ''),
        'createdAt' => (string)($row['created_at'] ?? ''),
        'updatedAt' => (string)($row['updated_at'] ?? ''),
    ];
}

function kareta_obd_jobs_fetch(PDO $pdo, int $accountId, string $jobId): ?array
{
    $st = $pdo->prepare("SELECT * FROM obd_diagnostic_jobs WHERE id=? AND account_id=? LIMIT 1");
    $st->execute([$jobId, $accountId]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    return is_array($row) ? $row : null;
}

$pdo = kareta_pdo();
$user = $_SESSION['kareta_user'] ?? null;
if (!is_array($user) || empty($user['phone'])) {
    kareta_json(['ok' => false, 'code' => 'AUTH_REQUIRED'], 401);
}
$phone = kareta_normalize_phone((string)$user['phone']);
$stmt = $pdo->prepare('SELECT id,status FROM accounts WHERE phone=? LIMIT 1');
$stmt->execute([$phone]);
$account = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$account || (string)($account['status'] ?? 'active') !== 'active') {
    kareta_json(['ok' => false, 'code' => 'ACCOUNT_NOT_ACTIVE'], 403);
}
$accountId = (int)$account['id'];
$actorUserId = (int)($user['id'] ?? 0);

if (!kareta_table_exists($pdo, 'obd_mobile_devices') || !kareta_table_exists($pdo, 'obd_diagnostic_jobs')) {
    kareta_json(['ok' => false, 'code' => 'OBD_REMOTE_SCHEMA_PENDING'], 503);
}

if ($action === 'register' && $method === 'POST') {
    $body = kareta_obd_jobs_body();
    $deviceId = kareta_obd_jobs_device_id($body);
    $platform = strtolower(trim((string)($body['platform'] ?? 'android')));
    if (!in_array($platform, ['android'], true)) $platform = 'android';
    $appVersion = substr(trim((string)($body['appVersion'] ?? '')), 0, 40);
    $nativeApiVersion = max(0, min(1000, (int)($body['nativeApiVersion'] ?? 0)));
    $capabilities = $body['capabilities'] ?? [];
    if (!is_array($capabilities)) $capabilities = [];
    $capabilities = array_values(array_unique(array_slice(array_filter(array_map(
        static fn($value): string => substr(trim((string)$value), 0, 80),
        $capabilities
    )), 0, 80)));

    $upsert = $pdo->prepare("INSERT INTO obd_mobile_devices(
        id,account_id,platform,app_version,native_api_version,capabilities_json,status,last_seen_at
      ) VALUES(?,?,?,?,?,?,'active',NOW())
      ON DUPLICATE KEY UPDATE
        account_id=VALUES(account_id),
        platform=VALUES(platform),
        app_version=VALUES(app_version),
        native_api_version=VALUES(native_api_version),
        capabilities_json=VALUES(capabilities_json),
        status='active',
        last_seen_at=NOW()");
    $upsert->execute([
        $deviceId,
        $accountId,
        $platform,
        $appVersion,
        $nativeApiVersion,
        json_encode($capabilities, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);
    kareta_json([
        'ok' => true,
        'deviceId' => $deviceId,
        'delivery' => 'active_app_poll',
        'pushConfigured' => false,
        'pollMinMs' => 15000,
    ]);
}

if ($action === 'create' && $method === 'POST') {
    $body = kareta_obd_jobs_body();
    $jobAction = strtolower(trim((string)($body['jobAction'] ?? 'snapshot')));
    if ($jobAction !== 'snapshot') {
        kareta_json(['ok' => false, 'code' => 'JOB_ACTION_DENIED'], 422);
    }

    $vehicleId = trim((string)($body['vehicleId'] ?? ''));
    if ($vehicleId !== '' && !kareta_obd_jobs_vehicle_owned($pdo, $vehicleId, $actorUserId, $phone)) {
        kareta_json(['ok' => false, 'code' => 'VEHICLE_FORBIDDEN'], 403);
    }

    $requestKey = trim((string)($body['requestKey'] ?? ''));
    if ($requestKey === '') $requestKey = 'req_' . bin2hex(random_bytes(12));
    $requestKey = substr((string)preg_replace('/[^A-Za-z0-9._:-]/', '_', $requestKey), 0, 120);
    if ($requestKey === '') {
        kareta_json(['ok' => false, 'code' => 'REQUEST_KEY_INVALID'], 422);
    }

    $ttlSeconds = max(60, min(900, (int)($body['ttlSeconds'] ?? 300)));
    $jobId = 'obdj_' . substr(hash('sha256', $accountId . '|' . $requestKey), 0, 40);
    $expiresAt = date('Y-m-d H:i:s', time() + $ttlSeconds);

    $insert = $pdo->prepare("INSERT INTO obd_diagnostic_jobs(
        id,account_id,requested_by_user_id,vehicle_id,request_key,action,payload_json,status,expires_at
      ) VALUES(?,?,?,?,?,?,?,'pending',?)
      ON DUPLICATE KEY UPDATE id=id");
    $insert->execute([
        $jobId,
        $accountId,
        $actorUserId,
        $vehicleId !== '' ? $vehicleId : null,
        $requestKey,
        $jobAction,
        '{}',
        $expiresAt,
    ]);

    $row = kareta_obd_jobs_fetch($pdo, $accountId, $jobId);
    kareta_json(['ok' => true, 'job' => $row ? kareta_obd_jobs_public_row($row) : null]);
}

if ($action === 'pull' && $method === 'POST') {
    $body = kareta_obd_jobs_body();
    $deviceId = kareta_obd_jobs_device_id($body);

    $device = $pdo->prepare("SELECT id FROM obd_mobile_devices WHERE id=? AND account_id=? AND status='active' LIMIT 1");
    $device->execute([$deviceId, $accountId]);
    if (!$device->fetchColumn()) {
        kareta_json(['ok' => false, 'code' => 'DEVICE_NOT_REGISTERED'], 403);
    }
    $pdo->prepare("UPDATE obd_mobile_devices SET last_seen_at=NOW() WHERE id=? AND account_id=?")
        ->execute([$deviceId, $accountId]);

    $pdo->beginTransaction();
    try {
        $pdo->prepare("UPDATE obd_diagnostic_jobs
            SET status='expired',completed_at=NOW()
            WHERE account_id=? AND status IN ('pending','claimed') AND expires_at<=NOW()")
            ->execute([$accountId]);

        $pdo->prepare("UPDATE obd_diagnostic_jobs
            SET status='pending',claimed_device_id=NULL,claimed_at=NULL
            WHERE account_id=? AND status='claimed'
              AND claimed_at<DATE_SUB(NOW(),INTERVAL 120 SECOND)
              AND expires_at>NOW() AND attempt_count<5")
            ->execute([$accountId]);

        $pdo->prepare("UPDATE obd_diagnostic_jobs
            SET status='failed',error_code='DELIVERY_RETRY_EXHAUSTED',
                error_message='Remote diagnostic delivery retry limit reached',completed_at=NOW()
            WHERE account_id=? AND status='pending' AND attempt_count>=5")
            ->execute([$accountId]);

        $select = $pdo->prepare("SELECT * FROM obd_diagnostic_jobs
            WHERE account_id=? AND status='pending' AND expires_at>NOW() AND attempt_count<5
            ORDER BY created_at ASC,id ASC
            LIMIT 1 FOR UPDATE");
        $select->execute([$accountId]);
        $row = $select->fetch(PDO::FETCH_ASSOC);

        if ($row) {
            $claim = $pdo->prepare("UPDATE obd_diagnostic_jobs
                SET status='claimed',claimed_device_id=?,claimed_at=NOW(),attempt_count=attempt_count+1
                WHERE id=? AND account_id=? AND status='pending'");
            $claim->execute([$deviceId, (string)$row['id'], $accountId]);
            $row = kareta_obd_jobs_fetch($pdo, $accountId, (string)$row['id']);
        }

        $pdo->commit();
        kareta_json(['ok' => true, 'job' => $row ? kareta_obd_jobs_public_row($row) : null]);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

if ($action === 'complete' && $method === 'POST') {
    $body = kareta_obd_jobs_body();
    $deviceId = kareta_obd_jobs_device_id($body);
    $jobId = trim((string)($body['jobId'] ?? ''));
    if (!preg_match('/^[A-Za-z0-9._:-]{8,80}$/', $jobId)) {
        kareta_json(['ok' => false, 'code' => 'JOB_ID_INVALID'], 422);
    }

    $row = kareta_obd_jobs_fetch($pdo, $accountId, $jobId);
    if (!$row) kareta_json(['ok' => false, 'code' => 'JOB_NOT_FOUND'], 404);

    $terminal = (string)($row['status'] ?? '');
    if (in_array($terminal, ['completed','failed','expired','cancelled'], true)) {
        kareta_json(['ok' => true, 'job' => kareta_obd_jobs_public_row($row), 'idempotent' => true]);
    }

    if ((string)($row['claimed_device_id'] ?? '') !== $deviceId || $terminal !== 'claimed') {
        kareta_json(['ok' => false, 'code' => 'JOB_NOT_CLAIMED_BY_DEVICE'], 409);
    }

    $outcome = strtolower(trim((string)($body['status'] ?? 'completed')));
    if (!in_array($outcome, ['completed','failed'], true)) {
        kareta_json(['ok' => false, 'code' => 'JOB_STATUS_INVALID'], 422);
    }

    $resultSyncKey = substr(trim((string)($body['resultSyncKey'] ?? '')), 0, 120);
    if ($outcome === 'completed' && $resultSyncKey === '') {
        kareta_json(['ok' => false, 'code' => 'RESULT_SYNC_KEY_REQUIRED'], 422);
    }

    $errorCode = substr((string)preg_replace('/[^A-Za-z0-9._:-]/', '_', trim((string)($body['errorCode'] ?? ''))), 0, 80);
    $errorMessage = substr(trim((string)($body['errorMessage'] ?? '')), 0, 500);

    $update = $pdo->prepare("UPDATE obd_diagnostic_jobs
        SET status=?,result_sync_key=?,error_code=?,error_message=?,completed_at=NOW()
        WHERE id=? AND account_id=? AND status='claimed' AND claimed_device_id=?");
    $update->execute([
        $outcome,
        $resultSyncKey,
        $outcome === 'failed' ? $errorCode : '',
        $outcome === 'failed' ? $errorMessage : '',
        $jobId,
        $accountId,
        $deviceId,
    ]);
    if ($update->rowCount() !== 1) {
        kareta_json(['ok' => false, 'code' => 'JOB_COMPLETE_CONFLICT'], 409);
    }
    $row = kareta_obd_jobs_fetch($pdo, $accountId, $jobId);
    kareta_json(['ok' => true, 'job' => $row ? kareta_obd_jobs_public_row($row) : null]);
}

if ($action === 'cancel' && $method === 'POST') {
    $body = kareta_obd_jobs_body();
    $jobId = trim((string)($body['jobId'] ?? ''));
    if (!preg_match('/^[A-Za-z0-9._:-]{8,80}$/', $jobId)) {
        kareta_json(['ok' => false, 'code' => 'JOB_ID_INVALID'], 422);
    }
    $update = $pdo->prepare("UPDATE obd_diagnostic_jobs
        SET status='cancelled',completed_at=NOW()
        WHERE id=? AND account_id=? AND status='pending'");
    $update->execute([$jobId, $accountId]);
    if ($update->rowCount() !== 1) {
        kareta_json(['ok' => false, 'code' => 'JOB_NOT_PENDING'], 409);
    }
    $row = kareta_obd_jobs_fetch($pdo, $accountId, $jobId);
    kareta_json(['ok' => true, 'job' => $row ? kareta_obd_jobs_public_row($row) : null]);
}

if ($action === 'list' && $method === 'GET') {
    $limit = max(1, min(50, (int)($_GET['limit'] ?? 20)));
    $st = $pdo->prepare("SELECT * FROM obd_diagnostic_jobs
        WHERE account_id=? ORDER BY created_at DESC,id DESC LIMIT {$limit}");
    $st->execute([$accountId]);
    $rows = $st->fetchAll(PDO::FETCH_ASSOC) ?: [];
    kareta_json(['ok' => true, 'jobs' => array_map('kareta_obd_jobs_public_row', $rows)]);
}

kareta_json(['ok' => false, 'code' => 'METHOD_NOT_ALLOWED'], 405);
