<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$pdo = kareta_pdo();
$action = strtolower(trim((string)($_GET['action'] ?? 'status')));
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($action === 'config' && $method === 'GET') {
    kareta_json([
        'ok' => true,
        'platform' => 'android',
        'nativeApiVersion' => 5,
        'minAppVersion' => '1.4.0',
        'baseUrl' => 'https://s.kareta.kz/',
        'features' => [
            'push' => true,
            'camera' => true,
            'microphone' => true,
            'location' => true,
            'fileUpload' => true,
            'downloads' => true,
            'deepLinks' => true,
            'pullToRefresh' => true,
            'qrVinScanner' => true,
            'actionSheet' => true,
            'pushRouting' => true,
            'brandAssets' => true,
            'contacts' => true,
            'imagePermissions' => true,
            'contactPicker' => true,
            'bluetooth' => true,
            'elm327' => true,
            'obdDiagnostics' => true,
            'offlineDiagnostics' => true,
            'offlineAutoSync' => true,
            'elmLiveData' => true,
            'elmReconnectLast' => true,
            'obdVehicleBinding' => true,
        ],
    ]);
}

$user = $_SESSION['kareta_user'] ?? null;
if (!is_array($user) || empty($user['phone'])) {
    kareta_json(['ok' => false, 'code' => 'AUTH_REQUIRED'], 401);
}
$phone = kareta_normalize_phone((string)$user['phone']);
if ($phone === '') kareta_json(['ok' => false, 'code' => 'AUTH_REQUIRED'], 401);

$accountStmt = $pdo->prepare('SELECT id,status FROM accounts WHERE phone=? LIMIT 1');
$accountStmt->execute([$phone]);
$account = $accountStmt->fetch(PDO::FETCH_ASSOC);
if (!$account || (string)($account['status'] ?? 'active') !== 'active') {
    kareta_json(['ok' => false, 'code' => 'ACCOUNT_NOT_ACTIVE'], 403);
}
$accountId = (int)$account['id'];

$pdo->exec("CREATE TABLE IF NOT EXISTS mobile_push_tokens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    account_id BIGINT UNSIGNED NOT NULL,
    token VARCHAR(512) NOT NULL,
    token_hash CHAR(64) NOT NULL,
    device_id VARCHAR(80) NOT NULL DEFAULT '',
    platform VARCHAR(24) NOT NULL DEFAULT 'android',
    app_version VARCHAR(32) NOT NULL DEFAULT '',
    device_model VARCHAR(191) NOT NULL DEFAULT '',
    sdk INT NOT NULL DEFAULT 0,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_seen_at DATETIME NULL,
    UNIQUE KEY uq_mobile_push_account_token (account_id, token_hash),
    KEY idx_mobile_push_enabled (account_id, enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
if ($method === 'GET' && $action === 'status') {
    $stmt = $pdo->prepare("SELECT device_id AS deviceId,platform,app_version AS appVersion,
        device_model AS deviceModel,sdk,enabled,updated_at AS updatedAt,last_seen_at AS lastSeenAt
        FROM mobile_push_tokens WHERE account_id=? ORDER BY updated_at DESC LIMIT 20");
    $stmt->execute([$accountId]);
    kareta_json(['ok' => true, 'devices' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

if ($method !== 'POST') {
    kareta_json(['ok' => false, 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$raw = file_get_contents('php://input') ?: '{}';
$body = json_decode($raw, true);
if (!is_array($body)) kareta_json(['ok' => false, 'code' => 'INVALID_JSON'], 400);

$token = trim((string)($body['token'] ?? ''));
if (strlen($token) < 20 || strlen($token) > 512) {
    kareta_json(['ok' => false, 'code' => 'INVALID_PUSH_TOKEN'], 422);
}
$tokenHash = hash('sha256', $token);
if ($action === 'unregister') {
    $stmt = $pdo->prepare("UPDATE mobile_push_tokens SET enabled=0,last_seen_at=NOW()
        WHERE account_id=? AND token_hash=?");
    $stmt->execute([$accountId, $tokenHash]);
    kareta_json(['ok' => true, 'disabled' => $stmt->rowCount()]);
}

if ($action !== 'register') {
    kareta_json(['ok' => false, 'code' => 'UNKNOWN_ACTION'], 404);
}

$deviceId = substr(trim((string)($body['deviceId'] ?? '')), 0, 80);
$appVersion = substr(trim((string)($body['appVersion'] ?? '')), 0, 32);
$model = substr(trim((string)($body['model'] ?? '')), 0, 191);
$sdk = max(0, min(999, (int)($body['sdk'] ?? 0)));

$stmt = $pdo->prepare("INSERT INTO mobile_push_tokens
    (account_id,token,token_hash,device_id,platform,app_version,device_model,sdk,enabled,last_seen_at)
    VALUES(?,?,?,?,?,?,?,?,1,NOW())
    ON DUPLICATE KEY UPDATE token=VALUES(token),device_id=VALUES(device_id),
    platform=VALUES(platform),app_version=VALUES(app_version),device_model=VALUES(device_model),
    sdk=VALUES(sdk),enabled=1,last_seen_at=NOW()");
$stmt->execute([$accountId,$token,$tokenHash,$deviceId,'android',$appVersion,$model,$sdk]);

kareta_json([
    'ok' => true,
    'registered' => true,
    'accountId' => $accountId,
    'deviceId' => $deviceId,
]);
