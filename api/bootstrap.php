<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/config.php';
require_once dirname(__DIR__) . '/inc/request_logger.php';


/* PHP 7.4 compatibility for production hosts. */
if (!function_exists('str_starts_with')) {
    function str_starts_with(string $haystack, string $needle): bool { return $needle === '' || strpos($haystack, $needle) === 0; }
}
if (!function_exists('str_contains')) {
    function str_contains(string $haystack, string $needle): bool { return $needle === '' || strpos($haystack, $needle) !== false; }
}
if (!function_exists('str_ends_with')) {
    function str_ends_with(string $haystack, string $needle): bool {
        if ($needle === '') return true;
        $length = strlen($needle);
        return $length <= strlen($haystack) && substr($haystack, -$length) === $needle;
    }
}
if (!function_exists('array_is_list')) {
    function array_is_list(array $array): bool {
        $index = 0;
        foreach ($array as $key => $_value) { if ($key !== $index++) return false; }
        return true;
    }
}

/* Minimal mbstring fallbacks for hosts where ext-mbstring is unavailable. */
if (!function_exists('mb_strtolower')) {
    function mb_strtolower(string $value, ?string $encoding = null): string { return strtolower($value); }
}
if (!function_exists('mb_strtoupper')) {
    function mb_strtoupper(string $value, ?string $encoding = null): string { return strtoupper($value); }
}
if (!function_exists('mb_strlen')) {
    function mb_strlen(string $value, ?string $encoding = null): int { return strlen($value); }
}
if (!function_exists('mb_substr')) {
    function mb_substr(string $value, int $start, ?int $length = null, ?string $encoding = null): string {
        return $length === null ? substr($value, $start) : substr($value, $start, $length);
    }
}

if (!defined('KARETA_REQUEST_ID')) {
    define('KARETA_REQUEST_ID', substr(hash('sha256', microtime(true) . '|' . mt_rand() . '|' . ($_SERVER['REQUEST_URI'] ?? 'cli')), 0, 16));
}
header('X-Kareta-Request-Id: ' . KARETA_REQUEST_ID);
$karetaTraceId = defined('KARETA_TRACE_ID') ? KARETA_TRACE_ID : substr(trim((string)($_SERVER['HTTP_X_KARETA_TRACE_ID'] ?? '')), 0, 160);
if ($karetaTraceId !== '') header('X-Kareta-Trace-Id: ' . $karetaTraceId);

/* ── Session ────────────────────────────────────────────────────────── */
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_name(KARETA_APP['session_name']);
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 24 * KARETA_APP['cookie_days'],
        'path'     => '/',
        'httponly' => true,
        'secure'   => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https',
        'samesite' => 'Lax',
    ]);
    session_start();
    // The previous release accepted an untrusted phone cookie as identity.
    // Never carry any PHP session created before the security epoch forward.
    if (!hash_equals((string)KARETA_SESSION_SECURITY_EPOCH, (string)($_SESSION['kareta_security_epoch'] ?? ''))) {
        $_SESSION=[];
        session_regenerate_id(true);
        $_SESSION['kareta_security_epoch']=(string)KARETA_SESSION_SECURITY_EPOCH;
    }
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Access-Control-Allow-Headers: Content-Type, X-Idempotency-Key, X-Request-Id, X-Kareta-Trace-Id, X-Kareta-Client-Version');

$karetaMethod = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if (!in_array($karetaMethod, ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], true)) {
    http_response_code(405);
    header('Allow: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    echo json_encode(['ok'=>false,'code'=>'METHOD_NOT_ALLOWED','message'=>'Метод запроса не поддерживается','requestId'=>KARETA_REQUEST_ID], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    exit;
}
if ($karetaMethod === 'OPTIONS') { http_response_code(204); exit; }

$contentLength = max(0, (int)($_SERVER['CONTENT_LENGTH'] ?? 0));
$maxBodyBytes = defined('KARETA_API_MAX_BODY_BYTES') ? KARETA_API_MAX_BODY_BYTES : 20971520;
if ($contentLength > $maxBodyBytes) {
    http_response_code(413);
    echo json_encode(['ok'=>false,'code'=>'PAYLOAD_TOO_LARGE','message'=>'Размер запроса превышает допустимый лимит','requestId'=>KARETA_REQUEST_ID], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    exit;
}

/* Reject cross-site state-changing requests when the browser supplies Origin/Referer. */
if (in_array($karetaMethod, ['POST','PUT','PATCH','DELETE'], true)) {
    $requestHost = preg_replace('/:\d+$/', '', strtolower((string)($_SERVER['HTTP_HOST'] ?? '')));
    $origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
    $referer = (string)($_SERVER['HTTP_REFERER'] ?? '');
    $sourceHost = $origin !== '' ? parse_url($origin, PHP_URL_HOST) : ($referer !== '' ? parse_url($referer, PHP_URL_HOST) : '');
    if ($sourceHost !== '' && $requestHost !== '' && strtolower((string)$sourceHost) !== $requestHost) {
        http_response_code(403);
        echo json_encode(['ok'=>false,'code'=>'CROSS_SITE_REQUEST_REJECTED','message'=>'Запрос отклонён системой защиты','requestId'=>KARETA_REQUEST_ID], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
        exit;
    }
}

set_exception_handler(function (Throwable $e): void {
    kareta_file_log_error('UNCAUGHT', KARETA_REQUEST_ID . ' ' . get_class($e) . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    $payload = ['ok'=>false,'error'=>'server_exception','message'=>'Внутренняя ошибка сервера.','requestId'=>KARETA_REQUEST_ID];
    if (kareta_api_debug_enabled()) $payload['_debug']=['type'=>get_class($e),'message'=>$e->getMessage(),'file'=>$e->getFile(),'line'=>$e->getLine()];
    kareta_json($payload, 500);
});

register_shutdown_function(function (): void {
    $error = error_get_last();
    if (!$error || !in_array((int)$error['type'], [E_ERROR,E_PARSE,E_CORE_ERROR,E_COMPILE_ERROR,E_USER_ERROR], true)) return;
    kareta_file_log_error('FATAL', KARETA_REQUEST_ID . ' ' . ($error['message'] ?? 'fatal') . ' @ ' . ($error['file'] ?? '') . ':' . ($error['line'] ?? 0));
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        header('X-Kareta-Request-Id: ' . KARETA_REQUEST_ID);
        http_response_code(500);
    }
    echo json_encode(['ok'=>false,'error'=>'php_fatal','message'=>'Внутренняя ошибка сервера.','requestId'=>KARETA_REQUEST_ID], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
});

/* ── Утилиты ─────────────────────────────────────────────────────────── */
function kareta_api_debug_enabled(): bool
{
    $env = getenv('KARETA_API_DEBUG');
    $envEnabled = $env !== false && filter_var($env, FILTER_VALIDATE_BOOLEAN);
    if (!$envEnabled) return false;
    $requested = (string)($_GET['debug'] ?? $_SERVER['HTTP_X_KARETA_DEBUG'] ?? '') === '1';
    if (!$requested) return false;
    $current = function_exists('kareta_session_user') ? kareta_session_user() : ($_SESSION['kareta_user'] ?? null);
    $role = (string)($current['role'] ?? 'guest');
    return in_array($role, ['admin', 'owner'], true);
}

function kareta_diagnostics_authorized(): bool
{
    $current = function_exists('kareta_session_user') ? kareta_session_user() : ($_SESSION['kareta_user'] ?? null);
    $role = kareta_normalize_role((string)($current['role'] ?? 'guest'));
    if (in_array($role, ['admin','owner'], true)) return true;
    $configured = defined('KARETA_DIAGNOSTICS_TOKEN') ? (string)KARETA_DIAGNOSTICS_TOKEN : '';
    $provided = trim((string)($_SERVER['HTTP_X_KARETA_DIAGNOSTICS_TOKEN'] ?? ''));
    return strlen($configured) >= 32 && strlen($provided) >= 32 && hash_equals($configured, $provided);
}

function kareta_strip_private_debug(array $d): array
{
    if (!kareta_api_debug_enabled() && array_key_exists('_debug', $d)) {
        unset($d['_debug']);
    }
    return $d;
}


function kareta_pdo_mysql_driver_available(): bool
{
    if (!class_exists('PDO')) return false;
    try { return in_array('mysql', PDO::getAvailableDrivers(), true); }
    catch (Throwable $_e) { return false; }
}

function kareta_pdo_build_options(string $charset, int $timeout): array
{
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_TIMEOUT => $timeout,
    ];
    if (defined('PDO::MYSQL_ATTR_INIT_COMMAND')) {
        $options[PDO::MYSQL_ATTR_INIT_COMMAND] = "SET NAMES {$charset} COLLATE utf8mb4_unicode_ci";
    }
    return $options;
}

function kareta_mysql_dsn(string $charset, ?string $database = null): string
{
    $socket = trim((string)(KARETA_DB['socket'] ?? ''));
    $db = $database === null ? trim((string)(KARETA_DB['database'] ?? '')) : trim($database);
    if ($socket !== '') {
        $dsn = 'mysql:unix_socket=' . $socket;
    } else {
        $dsn = sprintf('mysql:host=%s;port=%d', KARETA_DB['host'], (int)KARETA_DB['port']);
    }
    if ($db !== '') $dsn .= ';dbname=' . $db;
    return $dsn . ';charset=' . $charset;
}

function kareta_file_log_error(string $channel, string $message): void
{
    $dir = defined('KARETA_LOG_ROOT') ? KARETA_LOG_ROOT : dirname(__DIR__) . '/storage/logs';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    @file_put_contents($dir . '/db.log', '[' . date('Y-m-d H:i:s') . '] [' . $channel . '] ' . $message . PHP_EOL, FILE_APPEND);
}

function kareta_api_code(array $payload, int $status): string
{
    $existing = trim((string)($payload['code'] ?? ''));
    if ($existing !== '') return strtoupper(preg_replace('~[^A-Z0-9_]+~i', '_', $existing) ?? $existing);

    $error = trim((string)($payload['error'] ?? ''));
    if ($error !== '') return strtoupper(preg_replace('~[^A-Z0-9_]+~i', '_', $error) ?? $error);

    if ($status >= 400) return 'HTTP_' . $status;
    return 'OK';
}

function kareta_api_message(array $payload, bool $ok, string $code): string
{
    foreach (['message', 'msg', 'error_message'] as $key) {
        $value = trim((string)($payload[$key] ?? ''));
        if ($value !== '') return $value;
    }

    static $messages = [
        'AUTH_REQUIRED' => 'Требуется авторизация',
        'FORBIDDEN' => 'Недостаточно прав для выполнения операции',
        'NOT_FOUND' => 'Запрошенный объект не найден',
        'VALIDATION_FAILED' => 'Проверьте заполнение обязательных полей',
        'DB_UNAVAILABLE' => 'База данных временно недоступна',
        'DB_RUNTIME_FAILURE' => 'Внутренняя ошибка сервера',
        'IDEMPOTENCY_CONFLICT' => 'Повторный запрос отличается от исходного',
    ];
    if (isset($messages[$code])) return $messages[$code];
    return $ok ? 'Операция выполнена' : 'Не удалось выполнить операцию';
}

function kareta_api_envelope(array $payload, int $status): array
{
    $explicitOk = array_key_exists('ok', $payload) ? (bool)$payload['ok'] : null;
    $legacySuccess = array_key_exists('success', $payload) ? (bool)$payload['success'] : null;
    $legacyStatus = strtolower(trim((string)($payload['status'] ?? '')));
    $ok = $explicitOk ?? $legacySuccess ?? ($legacyStatus !== '' ? in_array($legacyStatus, ['ok','success','done'], true) : $status < 400);
    if ($status >= 400) $ok = false;

    $code = kareta_api_code($payload, $status);
    $payload['ok'] = $ok;
    $payload['code'] = $code;
    if (!isset($payload['message']) || trim((string)$payload['message']) === '') {
        $payload['message'] = kareta_api_message($payload, $ok, $code);
    }
    if (!$ok && !isset($payload['errors'])) $payload['errors'] = [];

    $requestId = trim((string)($payload['requestId'] ?? ($_SERVER['HTTP_X_REQUEST_ID'] ?? '')));
    if ($requestId !== '') $payload['requestId'] = $requestId;
    $payload['meta'] = array_merge(
        is_array($payload['meta'] ?? null) ? $payload['meta'] : [],
        ['httpStatus' => $status, 'requestId' => defined('KARETA_REQUEST_ID') ? KARETA_REQUEST_ID : '', 'traceId' => defined('KARETA_TRACE_ID') ? KARETA_TRACE_ID : substr(trim((string)($_SERVER['HTTP_X_KARETA_TRACE_ID'] ?? '')), 0, 160)]
    );
    return $payload;
}

function kareta_json(array $d, int $s = 200): void
{
    $d = kareta_strip_private_debug($d);
    $d = kareta_api_envelope($d, $s);
    if (function_exists('kareta_idempotency_complete')) {
        kareta_idempotency_complete($d, $s);
    }
    http_response_code($s);
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
    }
    echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function kareta_idempotency_extract_key(array $body): string
{
    $header = (string)($_SERVER['HTTP_X_IDEMPOTENCY_KEY'] ?? '');
    $bodyKey = (string)($body['idempotency_key'] ?? $body['idempotencyKey'] ?? '');
    $key = trim($header !== '' ? $header : $bodyKey);
    $key = preg_replace('~[^a-zA-Z0-9_.:-]~', '', $key) ?? '';
    return substr($key, 0, 128);
}

function kareta_idempotency_actor_hash(string $action): string
{
    $user = function_exists('kareta_session_user') ? (kareta_session_user() ?: []) : [];
    $id = (string)($user['id'] ?? '0');
    $role = (string)($user['role'] ?? 'guest');
    $phone = preg_replace('~\D+~', '', (string)($user['phone'] ?? '')) ?: '';
    $sessionId = session_id() ?: '';
    return hash('sha256', $action . '|' . $role . '|' . $id . '|' . $phone . '|' . $sessionId);
}

function kareta_idempotency_request_hash(array $body): string
{
    $copy = $body;
    unset($copy['idempotency_key'], $copy['idempotencyKey']);
    ksort($copy);
    return hash('sha256', json_encode($copy, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}

function kareta_idempotency_ensure_table(PDO $pdo): void
{
    static $done = false;
    if ($done) return;
    $done = true;
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `idempotency_keys` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            `action` VARCHAR(96) NOT NULL,
            `key_hash` CHAR(64) NOT NULL,
            `actor_hash` CHAR(64) NOT NULL,
            `request_hash` CHAR(64) NOT NULL DEFAULT '',
            `status` VARCHAR(24) NOT NULL DEFAULT 'processing',
            `response_status` SMALLINT UNSIGNED NULL,
            `response_json` MEDIUMTEXT NULL,
            `entity_type` VARCHAR(32) NOT NULL DEFAULT '',
            `entity_id` VARCHAR(96) NOT NULL DEFAULT '',
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY `uq_idempotency_scope` (`action`,`actor_hash`,`key_hash`),
            KEY `idx_idempotency_status` (`status`,`updated_at`),
            KEY `idx_idempotency_entity` (`entity_type`,`entity_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    } catch (Throwable $e) {
        if (function_exists('kareta_log_error')) kareta_log_error('IDEMPOTENCY', 'ensure_table: ' . $e->getMessage());
    }
}

function kareta_idempotency_begin(?PDO $pdo, string $action, array $body): void
{
    if (!$pdo) return;
    $key = kareta_idempotency_extract_key($body);
    if ($key === '') return;
    kareta_idempotency_ensure_table($pdo);
    $keyHash = hash('sha256', $key);
    $actorHash = kareta_idempotency_actor_hash($action);
    $requestHash = kareta_idempotency_request_hash($body);
    try {
        $st = $pdo->prepare("SELECT * FROM `idempotency_keys` WHERE `action`=? AND `actor_hash`=? AND `key_hash`=? LIMIT 1");
        $st->execute([$action, $actorHash, $keyHash]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        if ($row && (string)($row['status'] ?? '') === 'completed' && (string)($row['response_json'] ?? '') !== '') {
            header('X-Idempotency-Replayed: 1');
            http_response_code((int)($row['response_status'] ?? 200));
            echo (string)$row['response_json'];
            exit;
        }
        if ($row && (string)($row['status'] ?? '') === 'processing') {
            $updatedAt = strtotime((string)($row['updated_at'] ?? 'now')) ?: time();
            if ((time() - $updatedAt) < 120) {
                kareta_json(['ok'=>false,'error'=>'idempotency_request_processing','message'=>'Операция уже выполняется. Повторите проверку результата позже.'], 409);
            }
        }
        if ($row) {
            $pdo->prepare("UPDATE `idempotency_keys` SET `request_hash`=?, `status`='processing', `response_status`=NULL, `response_json`=NULL, `updated_at`=CURRENT_TIMESTAMP WHERE `id`=?")
                ->execute([$requestHash, (int)$row['id']]);
            $id = (int)$row['id'];
        } else {
            $pdo->prepare("INSERT INTO `idempotency_keys` (`action`,`key_hash`,`actor_hash`,`request_hash`,`status`) VALUES (?,?,?,?, 'processing')")
                ->execute([$action, $keyHash, $actorHash, $requestHash]);
            $id = (int)$pdo->lastInsertId();
        }
        $GLOBALS['KARETA_IDEMPOTENCY_CONTEXT'] = ['pdo'=>$pdo,'id'=>$id,'action'=>$action,'active'=>true];
        header('X-Idempotency-Key-Accepted: 1');
    } catch (Throwable $e) {
        if (function_exists('kareta_log_error')) kareta_log_error('IDEMPOTENCY', 'begin ' . $action . ': ' . $e->getMessage());
    }
}

function kareta_idempotency_complete(array $data, int $statusCode): void
{
    $ctx = $GLOBALS['KARETA_IDEMPOTENCY_CONTEXT'] ?? null;
    if (!$ctx || empty($ctx['active']) || empty($ctx['pdo']) || empty($ctx['id'])) return;
    $GLOBALS['KARETA_IDEMPOTENCY_CONTEXT']['active'] = false;
    /** @var PDO $pdo */
    $pdo = $ctx['pdo'];
    $ok = $statusCode >= 200 && $statusCode < 300 && (($data['ok'] ?? true) !== false);
    $responseJson = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $entityType = '';
    $entityId = '';
    $action = (string)($ctx['action'] ?? '');
    if ($action === 'orders.create') {
        $entityType = 'order';
        $entityId = (string)($data['order']['id'] ?? $data['id'] ?? '');
    } elseif ($action === 'messages.add') {
        $entityType = 'message';
        $entityId = (string)($data['id'] ?? '');
    } elseif ($action === 'publicReviews.submit') {
        $entityType = 'review';
        $entityId = (string)($data['id'] ?? '');
    } elseif (!empty($data['id'])) {
        $entityId = (string)$data['id'];
    }
    try {
        if ($ok && $responseJson !== false) {
            $pdo->prepare("UPDATE `idempotency_keys` SET `status`='completed', `response_status`=?, `response_json`=?, `entity_type`=?, `entity_id`=?, `updated_at`=CURRENT_TIMESTAMP WHERE `id`=?")
                ->execute([$statusCode, $responseJson, $entityType, substr($entityId,0,96), (int)$ctx['id']]);
        } else {
            $pdo->prepare("UPDATE `idempotency_keys` SET `status`='failed', `response_status`=?, `updated_at`=CURRENT_TIMESTAMP WHERE `id`=?")
                ->execute([$statusCode, (int)$ctx['id']]);
        }
    } catch (Throwable $e) {
        if (function_exists('kareta_log_error')) kareta_log_error('IDEMPOTENCY', 'complete: ' . $e->getMessage());
    }
}

function kareta_safe_step(PDO $pdo, string $channel, callable $fn): void
{
    try {
        $fn($pdo);
    } catch (Throwable $e) {
        kareta_log_error($channel, $e->getMessage());
    }
}


function kareta_safe_sync_user_entity(?PDO $pdo, string $phone): void
{
    if (!$pdo instanceof PDO) return;
    $phone = kareta_normalize_phone($phone);
    if ($phone === '') return;
    try {
        kareta_sync_user_entity($pdo, $phone);
    } catch (Throwable $e) {
        kareta_log_error('SYNC_USER_ENTITY', $e->getMessage());
    }
}

function kareta_runtime_maintenance_due(): bool
{
    $dir = defined('KARETA_STORAGE_ROOT') ? KARETA_STORAGE_ROOT . '/runtime' : dirname(__DIR__) . '/storage/runtime';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    $marker = $dir . '/maintenance.marker';
    $interval = defined('KARETA_RUNTIME_MAINTENANCE_INTERVAL') ? KARETA_RUNTIME_MAINTENANCE_INTERVAL : 900;
    $last = is_file($marker) ? (int)@filemtime($marker) : 0;
    if ($last > 0 && (time() - $last) < $interval) return false;
    @touch($marker);
    return true;
}

function kareta_schema_bootstrap_required(PDO $pdo): bool
{
    $expected = defined('KARETA_DB_VERSION') ? max(0, (int)KARETA_DB_VERSION) : 0;
    if ($expected <= 0) return true;

    try {
        $metaExists = (int)$pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='db_meta'")->fetchColumn() > 0;
        $migrationsExists = (int)$pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='db_migrations'")->fetchColumn() > 0;
        if (!$metaExists || !$migrationsExists) return true;

        $versionStmt = $pdo->prepare("SELECT `value` FROM `db_meta` WHERE `key`='schema_version' LIMIT 1");
        $versionStmt->execute();
        $current = (int)($versionStmt->fetchColumn() ?: 0);
        if ($current !== $expected) return true;

        // Verify only the canonical release history 1..KARETA_DB_VERSION.
        // A production database may contain a higher migration marker from an older
        // parallel branch. Such future markers are preserved for audit and ignored
        // by this release as long as the complete canonical prefix is intact.
        $historyStmt = $pdo->prepare("SELECT COUNT(*) AS c, COALESCE(MIN(`version`),0) AS min_v, COALESCE(MAX(`version`),0) AS max_v
            FROM `db_migrations` WHERE `version` BETWEEN 1 AND ?");
        $historyStmt->execute([$expected]);
        $history = $historyStmt->fetch(PDO::FETCH_ASSOC) ?: [];
        return (int)($history['c'] ?? 0) !== $expected
            || (int)($history['min_v'] ?? 0) !== 1
            || (int)($history['max_v'] ?? 0) !== $expected;
    } catch (Throwable $e) {
        // Any uncertainty falls back to the serialized repair path.
        kareta_file_log_error('SCHEMA_FAST_PATH', $e->getMessage());
        return true;
    }
}

function kareta_runtime_maintenance(PDO $pdo): void
{
    if (!kareta_runtime_maintenance_due()) return;
    kareta_safe_step($pdo, 'BOOTSTRAP_CATALOG', static function(PDO $pdo): void { kareta_ensure_catalog_content($pdo); });
    kareta_safe_step($pdo, 'BOOTSTRAP_PUBLIC', static function(PDO $pdo): void { kareta_ensure_public_content($pdo); });
    kareta_safe_step($pdo, 'BOOTSTRAP_SEED', static function(PDO $pdo): void { kareta_ensure_core_seed_integrity($pdo); });
    kareta_safe_step($pdo, 'BOOTSTRAP_RELATIONS', static function(PDO $pdo): void { kareta_backfill_relations($pdo); });
    kareta_safe_step($pdo, 'BOOTSTRAP_STATS', static function(PDO $pdo): void { kareta_rebuild_user_stats($pdo); });
}

function kareta_db_auto_upgrade_log(string $status, int $fromVersion, int $toVersion, string $detail = ''): void
{
    $dir = defined('KARETA_LOG_ROOT') ? KARETA_LOG_ROOT : dirname(__DIR__) . '/storage/logs';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    $payload = [
        'time'=>date('c'),
        'status'=>$status,
        'environment'=>defined('KARETA_ENVIRONMENT') ? KARETA_ENVIRONMENT : 'unknown',
        'assetVersion'=>defined('KARETA_ASSET_VERSION') ? KARETA_ASSET_VERSION : '',
        'fromVersion'=>$fromVersion,
        'toVersion'=>$toVersion,
        'detail'=>substr($detail, 0, 500),
    ];
    @file_put_contents(
        $dir . '/db_upgrade.log',
        json_encode($payload, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES) . PHP_EOL,
        FILE_APPEND
    );
}

function kareta_db_runtime_schema_version(PDO $pdo): int
{
    try {
        $exists = (int)$pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='db_meta'")->fetchColumn();
        if ($exists <= 0) return 0;
        $st = $pdo->prepare("SELECT `value` FROM `db_meta` WHERE `key`='schema_version' LIMIT 1");
        $st->execute();
        return max(0, (int)($st->fetchColumn() ?: 0));
    } catch (Throwable $_error) {
        return 0;
    }
}

function kareta_bootstrap_runtime(PDO $pdo): void
{
    static $done = false;
    if ($done) return;

    // Schema-changing work is serialized. Normal API requests first use
    // kareta_schema_bootstrap_required() and avoid this DDL path entirely when
    // production migration history already matches KARETA_DB_VERSION.
    $lockName = 'kareta_schema_bootstrap_' . substr(hash('sha256', (string)(KARETA_DB['database'] ?? 'default')), 0, 24);
    $lockAcquired = false;
    kareta_db_set_failure_context('bootstrap.lock');
    try {
        $lock = $pdo->prepare('SELECT GET_LOCK(?, 30)');
        $lock->execute([$lockName]);
        $lockAcquired = ((int)$lock->fetchColumn() === 1);
        if (!$lockAcquired) throw new RuntimeException('Schema bootstrap lock timeout');
        $GLOBALS['KARETA_SCHEMA_BOOTSTRAP_LOCK_HELD'] = true;

        // Another request can finish migrations while this request waits for the
        // lock. Re-check after lock acquisition and skip duplicate DDL if ready.
        if (kareta_schema_bootstrap_required($pdo)) {
            $autoUpgrade = defined('KARETA_DB_AUTO_UPGRADE') && KARETA_DB_AUTO_UPGRADE;
            $targetVersion = defined('KARETA_DB_VERSION') ? (int)KARETA_DB_VERSION : 0;
            $beforeVersion = kareta_db_runtime_schema_version($pdo);
            if ($autoUpgrade) {
                kareta_db_auto_upgrade_log('START', $beforeVersion, $targetVersion);
            }

            try {
                kareta_db_set_failure_context('bootstrap.create_schema');
                kareta_create_schema($pdo);
                if (!defined('KARETA_DB_AUTO_MIGRATE') || KARETA_DB_AUTO_MIGRATE) {
                    kareta_db_set_failure_context('bootstrap.migrate');
                    kareta_migrate($pdo);
                }
                kareta_db_set_failure_context('bootstrap.ensure_schema.post_migration');
                kareta_ensure_schema_columns($pdo);

                if ($autoUpgrade) {
                    $afterVersion = kareta_db_runtime_schema_version($pdo);
                    if ($targetVersion > 0 && $afterVersion !== $targetVersion) {
                        throw new RuntimeException('Automatic DB upgrade version mismatch: current=' . $afterVersion . ', expected=' . $targetVersion);
                    }
                    kareta_db_auto_upgrade_log('PASS', $beforeVersion, $afterVersion);
                }
            } catch (Throwable $upgradeError) {
                if ($autoUpgrade) {
                    kareta_db_auto_upgrade_log('FAIL', $beforeVersion, $targetVersion, $upgradeError->getMessage());
                }
                throw $upgradeError;
            }
        }
        kareta_db_clear_failure_context();
        $done = true;
    } finally {
        unset($GLOBALS['KARETA_SCHEMA_BOOTSTRAP_LOCK_HELD']);
        if ($lockAcquired) {
            try { $pdo->prepare('SELECT RELEASE_LOCK(?)')->execute([$lockName]); } catch (Throwable $_ignored) {}
        }
    }

    // Expensive repair/backfill operations are throttled and remain non-fatal.
    kareta_runtime_maintenance($pdo);
}

function kareta_log_error(string $channel, string $message): void
{
    static $writing = false;
    $dir = defined('KARETA_LOG_ROOT') ? KARETA_LOG_ROOT : dirname(__DIR__) . '/storage/logs';
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    $line = '[' . date('Y-m-d H:i:s') . '] [' . $channel . '] ' . $message . PHP_EOL;
    @file_put_contents($dir . '/db.log', $line, FILE_APPEND);

    // Never open a second PDO connection while the schema migration lock is held.
    // File logging above is sufficient during migrations and avoids bootstrap self-blocking.
    $failureContext = kareta_db_failure_context();
    if (str_starts_with((string)($failureContext['stage'] ?? ''), 'migration.')) {
        return;
    }

    if ($writing) {
        return;
    }
    $writing = true;
    try {
        static $logPdo = null;
        if (!$logPdo instanceof PDO) {
            $charset = (string)(KARETA_DB['charset'] ?: 'utf8mb4');
            $timeout = max(1, (int)(KARETA_DB['connect_timeout'] ?? 5));
            $options = kareta_pdo_build_options($charset, $timeout);
            $dsn = kareta_mysql_dsn($charset, (string)KARETA_DB['database']);
            $logPdo = new PDO($dsn, KARETA_DB['username'], KARETA_DB['password'], $options);
        }
        $exists = $logPdo->query("SHOW TABLES LIKE 'system_logs'")->fetchColumn();
        if ($exists) {
            $actor = is_array($_SESSION['kareta_user'] ?? null) ? $_SESSION['kareta_user'] : [];
            $logPdo->prepare("INSERT INTO `system_logs`(level,channel,message,context,actor_user_id,actor_phone,created_at) VALUES('error',?,?,?,?,?,CURRENT_TIMESTAMP)")
                ->execute([
                    $channel,
                    $message,
                    null,
                    (int)($actor['id'] ?? 0),
                    (string)($actor['phone'] ?? ''),
                ]);
        }
    } catch (Throwable $_e) {
    }
    $writing = false;
}

function kareta_read_json(): array
{
    $raw  = file_get_contents('php://input') ?: '';
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function kareta_db_ready(): bool { return kareta_pdo() instanceof PDO; }
function kareta_table_exists(PDO $pdo, string $table): bool
{
    $st = $pdo->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?");
    $st->execute([$table]);
    return (int)$st->fetchColumn() > 0;
}


function kareta_normalize_phone(string $p): string
{
    $d = preg_replace('/\D+/', '', $p) ?? '';
    if ($d === '') return '';
    if ($d[0] === '8') $d = '7' . substr($d, 1);
    if ($d[0] !== '7') $d = '7' . $d;
    $d = substr($d, 0, 11);
    return strlen($d) === 11 ? '+' . $d : '';
}


function kareta_normalize_datetime_value($value, string $fallback = 'now'): string
{
    $raw = is_string($value) ? trim($value) : '';
    if ($raw === '') {
        return $fallback === 'date' ? date('Y-m-d') : date('Y-m-d H:i:s');
    }

    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw)) {
        return $fallback === 'date' ? $raw : ($raw . ' 00:00:00');
    }

    if (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $raw)) {
        return $fallback === 'date' ? substr($raw, 0, 10) : $raw;
    }

    try {
        $dt = new DateTimeImmutable($raw);
        return $fallback === 'date'
            ? $dt->setTimezone(new DateTimeZone(date_default_timezone_get()))->format('Y-m-d')
            : $dt->setTimezone(new DateTimeZone(date_default_timezone_get()))->format('Y-m-d H:i:s');
    } catch (Throwable $e) {
        return $fallback === 'date' ? date('Y-m-d') : date('Y-m-d H:i:s');
    }
}


function kareta_user_id_by_phone(?PDO $pdo, string $phone): int
{
    if (!$pdo instanceof PDO) return 0;
    $norm = kareta_normalize_phone($phone);
    if ($norm === '') return 0;
    $st = $pdo->prepare("SELECT id FROM `users` WHERE phone=? LIMIT 1");
    $st->execute([$norm]);
    return (int)($st->fetchColumn() ?: 0);
}

function kareta_rebuild_user_stats(PDO $pdo): void
{
    $pdo->exec("CREATE TABLE IF NOT EXISTS `user_stats`(
        `user_id` BIGINT UNSIGNED NOT NULL PRIMARY KEY,
        `phone` VARCHAR(20) NOT NULL DEFAULT '',
        `role` VARCHAR(32) NOT NULL DEFAULT 'client',
        `orders_created` INT UNSIGNED NOT NULL DEFAULT 0,
        `orders_assigned` INT UNSIGNED NOT NULL DEFAULT 0,
        `orders_completed` INT UNSIGNED NOT NULL DEFAULT 0,
        `chats_total` INT UNSIGNED NOT NULL DEFAULT 0,
        `messages_sent` INT UNSIGNED NOT NULL DEFAULT 0,
        `audit_events` INT UNSIGNED NOT NULL DEFAULT 0,
        `last_order_at` TIMESTAMP NULL,
        `last_chat_at` TIMESTAMP NULL,
        `last_message_at` TIMESTAMP NULL,
        `last_audit_at` TIMESTAMP NULL,
        `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY `uq_user_stats_phone` (`phone`),
        KEY `idx_user_stats_role` (`role`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("INSERT INTO `user_stats`(`user_id`,`phone`,`role`)
        SELECT u.id, u.phone, u.role FROM `users` u
        ON DUPLICATE KEY UPDATE `phone`=VALUES(`phone`), `role`=VALUES(`role`)");

    $pdo->exec("UPDATE `user_stats` SET
        orders_created=0, orders_assigned=0, orders_completed=0,
        chats_total=0, messages_sent=0, audit_events=0,
        last_order_at=NULL, last_chat_at=NULL, last_message_at=NULL, last_audit_at=NULL");

    $pdo->exec("UPDATE `user_stats` s
        INNER JOIN (
            SELECT client_user_id AS user_id, COUNT(*) AS cnt, MAX(created_at) AS last_at
            FROM `orders` WHERE client_user_id IS NOT NULL GROUP BY client_user_id
        ) t ON t.user_id = s.user_id
        SET s.orders_created = t.cnt, s.last_order_at = t.last_at");

    $pdo->exec("UPDATE `user_stats` s
        INNER JOIN (
            SELECT master_user_id AS user_id,
                   COUNT(*) AS cnt,
                   SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) AS done_cnt,
                   MAX(created_at) AS last_at
            FROM `orders` WHERE master_user_id IS NOT NULL GROUP BY master_user_id
        ) t ON t.user_id = s.user_id
        SET s.orders_assigned = t.cnt,
            s.orders_completed = t.done_cnt,
            s.last_order_at = GREATEST(COALESCE(s.last_order_at,'1970-01-01'), COALESCE(t.last_at,'1970-01-01'))");

    $pdo->exec("UPDATE `user_stats` s
        INNER JOIN (
            SELECT user_id, COUNT(*) AS cnt, MAX(created_at) AS last_at
            FROM (
                SELECT client_user_id AS user_id, created_at FROM `chats` WHERE client_user_id IS NOT NULL
                UNION ALL
                SELECT master_user_id AS user_id, created_at FROM `chats` WHERE master_user_id IS NOT NULL
                UNION ALL
                SELECT assigned_admin_user_id AS user_id, created_at FROM `chats` WHERE assigned_admin_user_id IS NOT NULL
            ) x
            GROUP BY user_id
        ) t ON t.user_id = s.user_id
        SET s.chats_total = t.cnt, s.last_chat_at = t.last_at");

    $pdo->exec("UPDATE `user_stats` s
        INNER JOIN (
            SELECT author_user_id AS user_id, COUNT(*) AS cnt, MAX(created_at) AS last_at
            FROM `messages` WHERE author_user_id IS NOT NULL GROUP BY author_user_id
        ) t ON t.user_id = s.user_id
        SET s.messages_sent = t.cnt, s.last_message_at = t.last_at");

    $pdo->exec("UPDATE `user_stats` s
        INNER JOIN (
            SELECT actor_user_id AS user_id, COUNT(*) AS cnt, MAX(created_at) AS last_at
            FROM `audit_log` WHERE actor_user_id IS NOT NULL GROUP BY actor_user_id
        ) t ON t.user_id = s.user_id
        SET s.audit_events = t.cnt, s.last_audit_at = t.last_at");
}

function kareta_db_set_failure_context(string $stage, int $migrationVersion = 0, string $migrationFile = ''): void
{
    $GLOBALS['KARETA_DB_FAILURE_CONTEXT'] = [
        'stage' => preg_replace('/[^a-z0-9_.-]+/i', '_', $stage) ?: 'unknown',
        'migrationVersion' => max(0, $migrationVersion),
        'migrationFile' => $migrationFile !== '' ? basename($migrationFile) : '',
    ];
}

function kareta_db_clear_failure_context(): void
{
    unset($GLOBALS['KARETA_DB_FAILURE_CONTEXT']);
}

function kareta_db_failure_context(): array
{
    $context = $GLOBALS['KARETA_DB_FAILURE_CONTEXT'] ?? [];
    return is_array($context) ? $context : [];
}

function kareta_db_public_failure_meta(?array $diagnostic = null): array
{
    $diagnostic = is_array($diagnostic) ? $diagnostic : kareta_db_read_diagnostic();
    $context = is_array($diagnostic['failureContext'] ?? null) ? $diagnostic['failureContext'] : [];
    $exception = is_array($diagnostic['exception'] ?? null) ? $diagnostic['exception'] : [];
    return [
        'failureStage' => (string)($context['stage'] ?? ''),
        'failedMigrationVersion' => max(0, (int)($context['migrationVersion'] ?? 0)),
        'failedMigrationFile' => basename((string)($context['migrationFile'] ?? '')),
        'diagnosticCode' => (string)($diagnostic['diagnosticCode'] ?? ''),
        'failureCategory' => (string)($diagnostic['category'] ?? ''),
        'failureSqlState' => (string)($exception['sqlState'] ?? ''),
        'failureDriverCode' => (string)($exception['driverCode'] ?? ''),
    ];
}

function kareta_db_diagnostic_path(): string
{
    $dir = defined('KARETA_STORAGE_ROOT') ? KARETA_STORAGE_ROOT . '/runtime' : dirname(__DIR__) . '/storage/runtime';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    return $dir . '/db_diagnostic.json';
}

function kareta_db_error_category(string $message): array
{
    $m = strtolower($message);
    if (strpos($m, 'database configuration missing') !== false || strpos($m, 'configuration_missing') !== false) {
        return ['category'=>'configuration_missing','hint'=>'Восстановите защищённый config.private.php или переменные окружения базы данных.'];
    }
    if (strpos($m, 'access denied') !== false || strpos($m, '[1045]') !== false) {
        return ['category'=>'authentication_failed','hint'=>'Проверьте пользователя MySQL, пароль и права на базу.'];
    }
    if (strpos($m, 'unknown database') !== false || strpos($m, '[1049]') !== false) {
        return ['category'=>'database_missing','hint'=>'Указанная база не существует либо имя базы неверно.'];
    }
    if (strpos($m, 'connection refused') !== false || strpos($m, '[2002]') !== false) {
        return ['category'=>'connection_failed','hint'=>'Проверьте адрес MySQL, порт и доступность сервера базы данных.'];
    }
    if (strpos($m, 'could not find driver') !== false || strpos($m, 'pdo_mysql') !== false) {
        return ['category'=>'driver_missing','hint'=>'В PHP необходимо включить расширение pdo_mysql.'];
    }
    if (strpos($m, 'migration') !== false
        || strpos($m, 'schema history') !== false
        || strpos($m, 'sql syntax') !== false
        || (strpos($m, 'cannot drop index') !== false && strpos($m, 'foreign key constraint') !== false)
        || strpos($m, 'schema contract') !== false) {
        return ['category'=>'schema_or_migration_failed','hint'=>'Подключение установлено, но инициализация схемы или миграция завершилась ошибкой.'];
    }
    return ['category'=>'database_error','hint'=>'Смотрите безопасное сообщение ошибки и параметры подключения ниже.'];
}

function kareta_db_store_diagnostic(string $phase, string $message, ?Throwable $error = null): void
{
    $classification = kareta_db_error_category($message);
    $password = (string)(KARETA_DB['password'] ?? '');
    $safeMessage = preg_replace('/password\s*[=:]\s*[^\s;]+/i', 'password=[redacted]', $message) ?: $message;
    $safeMessage = str_replace($password !== '' ? $password : "\0", '[redacted]', $safeMessage);
    $snapshot = [
        'time' => date('c'),
        'requestId' => defined('KARETA_REQUEST_ID') ? KARETA_REQUEST_ID : (defined('KARETA_WEB_REQUEST_ID') ? KARETA_WEB_REQUEST_ID : ''),
        'traceId' => (string)($_SERVER['HTTP_X_KARETA_TRACE_ID'] ?? ''),
        'phase' => $phase,
        'category' => $classification['category'],
        'message' => $safeMessage,
        'hint' => $classification['hint'],
        'pdoMysqlDriver' => kareta_pdo_mysql_driver_available(),
        'config' => [
            'source' => defined('KARETA_DB_CONFIG_SOURCE') ? KARETA_DB_CONFIG_SOURCE : 'unknown',
            'privateConfigLoaded' => defined('KARETA_PRIVATE_CONFIG_LOADED') && KARETA_PRIVATE_CONFIG_LOADED,
            'missingFields' => function_exists('kareta_db_missing_config_fields') ? kareta_db_missing_config_fields() : [],
            'host' => (string)(KARETA_DB['host'] ?? ''),
            'port' => (int)(KARETA_DB['port'] ?? 0),
            'database' => (string)(KARETA_DB['database'] ?? ''),
            'username' => (string)(KARETA_DB['username'] ?? ''),
            'passwordConfigured' => $password !== '',
            'passwordLength' => strlen($password),
            'charset' => (string)(KARETA_DB['charset'] ?? ''),
            'autoCreate' => defined('KARETA_DB_AUTO_CREATE') && KARETA_DB_AUTO_CREATE,
            'autoMigrate' => !defined('KARETA_DB_AUTO_MIGRATE') || KARETA_DB_AUTO_MIGRATE,
        ],
        'php' => [
            'version' => PHP_VERSION,
            'sapi' => PHP_SAPI,
        ],
        'failureContext' => kareta_db_failure_context(),
        'diagnosticCode' => substr(hash('sha256', $classification['category'] . '|' . $phase . '|' . json_encode(kareta_db_failure_context()) . '|' . $safeMessage), 0, 16),
    ];
    if ($error) {
        $exceptionMessage = preg_replace('/password\s*[=:]\s*[^\s;]+/i', 'password=[redacted]', (string)$error->getMessage()) ?: (string)$error->getMessage();
        if ($password !== '') $exceptionMessage = str_replace($password, '[redacted]', $exceptionMessage);
        $snapshot['exception'] = [
            'type' => get_class($error),
            'code' => (string)$error->getCode(),
            'message' => $exceptionMessage,
            'file' => basename($error->getFile()),
            'line' => $error->getLine(),
        ];
        if ($error instanceof PDOException && is_array($error->errorInfo ?? null)) {
            $snapshot['exception']['sqlState'] = (string)($error->errorInfo[0] ?? '');
            $snapshot['exception']['driverCode'] = (string)($error->errorInfo[1] ?? '');
            $snapshot['exception']['driverMessage'] = (string)($error->errorInfo[2] ?? '');
        }
    }

    /* Always keep the latest diagnostic in memory. Files are only a secondary persistence layer. */
    $GLOBALS['KARETA_LAST_DB_DIAGNOSTIC'] = $snapshot;
    @file_put_contents(kareta_db_diagnostic_path(), json_encode($snapshot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), LOCK_EX);
}

function kareta_db_read_diagnostic(): array
{
    $memory = $GLOBALS['KARETA_LAST_DB_DIAGNOSTIC'] ?? null;
    if (is_array($memory) && $memory) return $memory;
    $path = kareta_db_diagnostic_path();
    if (!is_file($path)) return [];
    $decoded = json_decode((string)@file_get_contents($path), true);
    return is_array($decoded) ? $decoded : [];
}

function kareta_db_public_state(?PDO $pdo, ?array $diagnostic = null): string
{
    if ($pdo instanceof PDO) return 'ready';
    $configured = defined('KARETA_DB')
        && trim((string)(KARETA_DB['database'] ?? '')) !== ''
        && trim((string)(KARETA_DB['username'] ?? '')) !== ''
        && trim((string)(KARETA_DB['password'] ?? '')) !== '';
    if (!$configured) return 'configuration_missing';
    if (!kareta_pdo_mysql_driver_available()) return 'pdo_mysql_missing';
    $details = is_array($diagnostic) ? $diagnostic : kareta_db_read_diagnostic();
    return match ((string)($details['category'] ?? '')) {
        'configuration_missing' => 'configuration_missing',
        'authentication_failed' => 'credentials_rejected',
        'database_missing' => 'database_not_found',
        'connection_failed' => 'server_unreachable',
        'driver_missing' => 'pdo_mysql_missing',
        'schema_or_migration_failed' => 'schema_initialization_failed',
        default => 'connection_failed',
    };
}

function kareta_db_public_recovery_action(string $state): string
{
    return match ($state) {
        'ready' => 'none',
        'configuration_missing' => 'configure_private_database_settings',
        'pdo_mysql_missing' => 'enable_pdo_mysql',
        'credentials_rejected' => 'verify_database_credentials_and_grants',
        'database_not_found' => 'verify_database_name',
        'server_unreachable' => 'verify_database_host_port_and_firewall',
        'schema_initialization_failed' => 'repair_database_migrations',
        default => 'review_authorized_database_diagnostics',
    };
}

/* ── PDO Singleton ───────────────────────────────────────────────────── */
function kareta_pdo(): ?PDO
{
    static $pdo = false;
    if ($pdo instanceof PDO) return $pdo;
    if ($pdo === null) return null;

    $missingConfig = function_exists('kareta_db_missing_config_fields') ? kareta_db_missing_config_fields() : [];
    if ($missingConfig !== []) {
        $message = 'Database configuration missing fields: ' . implode(', ', $missingConfig);
        kareta_file_log_error('PDO_CONFIG', $message);
        kareta_db_store_diagnostic('configuration', $message);
        $pdo = null;
        return null;
    }

    if (!kareta_pdo_mysql_driver_available()) {
        kareta_file_log_error('PDO', 'pdo_mysql driver is not available');
        kareta_db_store_diagnostic('driver_check', 'pdo_mysql driver is not available');
        $pdo = null;
        return null;
    }

    $charset = (string)(KARETA_DB['charset'] ?: 'utf8mb4');
    $timeout = max(1, (int)(KARETA_DB['connect_timeout'] ?? 5));
    $options = kareta_pdo_build_options($charset, $timeout);
    $db = str_replace('`', '``', (string)KARETA_DB['database']);
    $dsn = kareta_mysql_dsn($charset, $db);

    try {
        $conn = new PDO($dsn, KARETA_DB['username'], KARETA_DB['password'], $options);
        $conn->exec("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");
        $pdo = $conn;
        if (kareta_schema_bootstrap_required($conn)) {
            kareta_bootstrap_runtime($conn);
        } else {
            kareta_db_clear_failure_context();
            kareta_runtime_maintenance($conn);
        }
        return $pdo;
    } catch (Throwable $directError) {
        $message = (string)$directError->getMessage();
        $unknownDb = stripos($message, 'Unknown database') !== false || stripos($message, '[1049]') !== false;
        if (!$unknownDb || !defined('KARETA_DB_AUTO_CREATE') || !KARETA_DB_AUTO_CREATE) {
            kareta_log_error('PDO', $message);
            $failureContext = kareta_db_failure_context();
            $diagnosticPhase = $failureContext !== [] ? 'bootstrap' : 'connect';
            kareta_db_store_diagnostic($diagnosticPhase, $message, $directError);
            error_log('[KARETA DB] ' . $message);
            $pdo = null;
            return null;
        }
        try {
            $adminDsn = kareta_mysql_dsn($charset, '');
            $admin = new PDO($adminDsn, KARETA_DB['username'], KARETA_DB['password'], $options);
            $admin->exec("CREATE DATABASE IF NOT EXISTS `{$db}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            $conn = new PDO($dsn, KARETA_DB['username'], KARETA_DB['password'], $options);
            $conn->exec("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");
            $pdo = $conn;
            if (kareta_schema_bootstrap_required($conn)) {
                kareta_bootstrap_runtime($conn);
            } else {
                kareta_db_clear_failure_context();
                kareta_runtime_maintenance($conn);
            }
            return $pdo;
        } catch (Throwable $e) {
            kareta_log_error('PDO', $e->getMessage());
            kareta_db_store_diagnostic('auto_create_or_connect', $e->getMessage(), $e);
            error_log('[KARETA DB] ' . $e->getMessage());
            $pdo = null;
            return null;
        }
    }
}

/* ═══════════════════════════════════════════════════════════════════════
   МИГРАЦИИ И МЯГКАЯ АВТО-ИНЪЕКЦИЯ
   ──────────────────────────────
   1. Пустая БД поднимается автоматически
   2. Существующие таблицы не пересоздаются и не удаляются
   3. Устаревшая БД мягко расширяется через versioned migration runner
   4. Живые данные не уничтожаются при несовпадении версии
   5. Актуальная версия фиксируется в db_meta и db_migrations
   ═══════════════════════════════════════════════════════════════════════ */
function kareta_prepare_migration_61_sto_master_links_compatibility(PDO $pdo): void
{
    if (!kareta_table_exists($pdo, 'sto_master_links')) return;
    if (!kareta_column_exists($pdo, 'sto_master_links', 'created_at')) {
        $pdo->exec("ALTER TABLE `sto_master_links` ADD COLUMN `created_at` TIMESTAMP NULL DEFAULT NULL AFTER `accepted_at`");
    }
    $pdo->exec("UPDATE `sto_master_links` SET `created_at`=COALESCE(`created_at`,`invited_at`,`updated_at`,CURRENT_TIMESTAMP) WHERE `created_at` IS NULL");
}

function kareta_prepare_migration_111_master_reviews_compatibility(PDO $pdo): void
{
    if (!kareta_table_exists($pdo, 'masters')) return;
    if (!kareta_column_exists($pdo, 'masters', 'reviews_count')) {
        $pdo->exec("ALTER TABLE `masters` ADD COLUMN `reviews_count` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `rating`");
    }
}

function kareta_prepare_migration_121_orders_accepted_at_compatibility(PDO $pdo): void
{
    if (!kareta_table_exists($pdo, 'orders')) return;
    if (!kareta_column_exists($pdo, 'orders', 'accepted_at')) {
        $pdo->exec("ALTER TABLE `orders` ADD COLUMN `accepted_at` DATETIME NULL AFTER `master_name`");
    }
}

function kareta_prepare_migration_82_context_member_compatibility(PDO $pdo): void
{
    try {
        $applied = (int)($pdo->query("SELECT COUNT(*) FROM `db_migrations` WHERE `version`=82")->fetchColumn() ?: 0);
        if ($applied > 0) return;

        $table = $pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='context_members'");
        if ((int)$table->fetchColumn() === 0) return;

        $columnStmt = $pdo->prepare("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='context_members' AND COLUMN_NAME IN ('membership_status','status')");
        $columnStmt->execute();
        $columns = array_fill_keys(array_map('strval', $columnStmt->fetchAll(PDO::FETCH_COLUMN)), true);
        if (!isset($columns['membership_status']) || isset($columns['status'])) return;

        $pdo->exec("ALTER TABLE `context_members` ADD COLUMN `status` ENUM('invited','active','suspended','revoked') NOT NULL DEFAULT 'active' AFTER `membership_status`");
        $pdo->exec("UPDATE `context_members` SET `status`=`membership_status`");
        kareta_log_error('MIGRATIONS', 'Applied temporary migration 82 context_members.status compatibility bridge');
    } catch (Throwable $e) {
        throw new RuntimeException('Migration 82 compatibility repair failed: ' . $e->getMessage(), 0, $e);
    }
}

function kareta_prepare_migration_99_more_menu_compatibility(PDO $pdo): void
{
    try {
        kareta_db_set_failure_context('migration.compatibility', 99, '099_more_menu_arc_default.php');
        foreach (['client_preferences','account_ui_preferences'] as $table) {
            $tableStmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?");
            $tableStmt->execute([$table]);
            if ((int)$tableStmt->fetchColumn() === 0) continue;
            $columnStmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME='more_menu_layout'");
            $columnStmt->execute([$table]);
            if ((int)$columnStmt->fetchColumn() === 0) continue;
            $quoted = '`' . str_replace('`', '``', $table) . '`';
            // Legacy non-strict writes could leave ENUM('') rows. MySQL refuses
            // ALTER ... MODIFY ENUM under strict mode until those rows are fixed.
            $pdo->exec("UPDATE {$quoted} SET `more_menu_layout`='arc' WHERE `more_menu_layout` IS NULL OR CAST(`more_menu_layout` AS CHAR) NOT IN ('grid','arc','hex')");
            $pdo->exec("ALTER TABLE {$quoted} MODIFY `more_menu_layout` ENUM('grid','arc','hex') NOT NULL DEFAULT 'arc'");
        }
    } catch (Throwable $e) {
        throw new RuntimeException('Migration 99 compatibility repair failed: ' . $e->getMessage(), 0, $e);
    }
}

function kareta_prepare_identity_collation_compatibility(PDO $pdo, int $migrationVersion): void
{
    try {
        kareta_db_set_failure_context('migration.compatibility', $migrationVersion, sprintf('%03d_identity_collation_compatibility.php', $migrationVersion));
        $targets = [
            ['users','phone',"VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL"],
            ['accounts','phone',"VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL"],
            ['users','role',"VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'client'"],
            ['person_profiles','profile_type',"VARCHAR(48) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL"],
        ];
        foreach ($targets as [$table,$column,$definition]) {
            $st = $pdo->prepare("SELECT COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");
            $st->execute([$table,$column]);
            $collation = strtolower((string)($st->fetchColumn() ?: ''));
            if ($collation === '' || $collation === 'utf8mb4_unicode_ci') continue;
            $quotedTable = '`' . str_replace('`', '``', $table) . '`';
            $quotedColumn = '`' . str_replace('`', '``', $column) . '`';
            $pdo->exec("ALTER TABLE {$quotedTable} MODIFY {$quotedColumn} {$definition}");
        }
    } catch (Throwable $e) {
        throw new RuntimeException('Identity collation compatibility repair failed before migration ' . $migrationVersion . ': ' . $e->getMessage(), 0, $e);
    }
}

function kareta_prepare_migration_98_dashboard_layout_compatibility(PDO $pdo): void
{
    try {
        kareta_db_set_failure_context('migration.compatibility', 98, '098_role_workspaces_completion.php');
        $table = $pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='dashboard_layout_preferences'");
        if ((int)$table->fetchColumn() === 0) return;

        $columnStmt = $pdo->prepare("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='dashboard_layout_preferences' AND COLUMN_NAME IN ('context_key','revision')");
        $columnStmt->execute();
        $columns = array_fill_keys(array_map('strval', $columnStmt->fetchAll(PDO::FETCH_COLUMN)), true);
        $repaired = false;
        if (!isset($columns['context_key'])) {
            $pdo->exec("ALTER TABLE `dashboard_layout_preferences` ADD COLUMN `context_key` VARCHAR(128) NOT NULL DEFAULT '' AFTER `context_kind`");
            $repaired = true;
        }
        if (!isset($columns['revision'])) {
            $pdo->exec("ALTER TABLE `dashboard_layout_preferences` ADD COLUMN `revision` INT UNSIGNED NOT NULL DEFAULT 1 AFTER `layout_json`");
            $repaired = true;
        }

        $indexColumns = static function (string $indexName) use ($pdo): string {
            $st = $pdo->prepare("SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='dashboard_layout_preferences' AND INDEX_NAME=?");
            $st->execute([$indexName]);
            return strtolower((string)($st->fetchColumn() ?: ''));
        };
        $quoteIdentifier = static function (string $identifier): string {
            return '`' . str_replace('`', '``', $identifier) . '`';
        };

        // MySQL 1553 is avoided deterministically by detaching the existing FK
        // before any supporting index is replaced. The exact FK rules are read
        // from information_schema and restored after the final indexes exist.
        $foreignKeys = [];
        $fkStmt = $pdo->query("SELECT k.CONSTRAINT_NAME,r.UPDATE_RULE,r.DELETE_RULE
            FROM information_schema.KEY_COLUMN_USAGE k
            JOIN information_schema.REFERENTIAL_CONSTRAINTS r
              ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.TABLE_NAME=k.TABLE_NAME AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME
            WHERE k.TABLE_SCHEMA=DATABASE() AND k.TABLE_NAME='dashboard_layout_preferences'
              AND k.COLUMN_NAME='account_id' AND k.REFERENCED_TABLE_NAME='accounts' AND k.REFERENCED_COLUMN_NAME='id'");
        foreach ($fkStmt->fetchAll() as $row) {
            $name = (string)($row['CONSTRAINT_NAME'] ?? '');
            if ($name === '') continue;
            $foreignKeys[$name] = [
                'update' => strtoupper((string)($row['UPDATE_RULE'] ?? 'RESTRICT')),
                'delete' => strtoupper((string)($row['DELETE_RULE'] ?? 'RESTRICT')),
            ];
        }
        foreach (array_keys($foreignKeys) as $constraintName) {
            $pdo->exec('ALTER TABLE `dashboard_layout_preferences` DROP FOREIGN KEY ' . $quoteIdentifier($constraintName));
            $repaired = true;
        }

        $accountIndex = 'idx_dashboard_layout_account_fk';
        $accountColumns = $indexColumns($accountIndex);
        if ($accountColumns !== 'account_id') {
            if ($accountColumns !== '') $pdo->exec('ALTER TABLE `dashboard_layout_preferences` DROP INDEX ' . $quoteIdentifier($accountIndex));
            $pdo->exec("ALTER TABLE `dashboard_layout_preferences` ADD KEY `idx_dashboard_layout_account_fk` (`account_id`)");
            $repaired = true;
        }

        // A previously interrupted migration may have left duplicate scoped
        // preferences while no unique index was present. Preserve every removed
        // row in a recovery table, then keep the highest revision/id per scope.
        $pdo->exec("CREATE TABLE IF NOT EXISTS `dashboard_layout_preferences_recovery` (
            `recovery_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `original_id` BIGINT UNSIGNED NOT NULL,
            `account_id` BIGINT UNSIGNED NOT NULL,
            `context_kind` VARCHAR(32) NOT NULL,
            `context_key` VARCHAR(128) NOT NULL DEFAULT '',
            `dashboard_key` VARCHAR(96) NOT NULL,
            `layout_json` JSON NOT NULL,
            `revision` INT UNSIGNED NOT NULL DEFAULT 1,
            `original_updated_at` DATETIME NULL,
            `reason` VARCHAR(64) NOT NULL,
            `recovered_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`recovery_id`),
            UNIQUE KEY `uq_dashboard_layout_recovery_row` (`original_id`,`reason`),
            KEY `idx_dashboard_layout_recovery_scope` (`account_id`,`context_kind`,`context_key`,`dashboard_key`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $duplicatePredicate = "older.account_id=newer.account_id
            AND older.context_kind=newer.context_kind
            AND older.context_key=newer.context_key
            AND older.dashboard_key=newer.dashboard_key
            AND (older.revision<newer.revision OR (older.revision=newer.revision AND older.id<newer.id))";
        $pdo->exec("INSERT IGNORE INTO `dashboard_layout_preferences_recovery`
            (`original_id`,`account_id`,`context_kind`,`context_key`,`dashboard_key`,`layout_json`,`revision`,`original_updated_at`,`reason`)
            SELECT older.id,older.account_id,older.context_kind,older.context_key,older.dashboard_key,older.layout_json,older.revision,older.updated_at,'migration_98_duplicate_scope'
            FROM `dashboard_layout_preferences` older
            JOIN `dashboard_layout_preferences` newer ON {$duplicatePredicate}");
        $deletedDuplicates = $pdo->exec("DELETE older FROM `dashboard_layout_preferences` older
            JOIN `dashboard_layout_preferences` newer ON {$duplicatePredicate}");
        if ((int)$deletedDuplicates > 0) $repaired = true;

        $scopeIndex = 'uq_dashboard_layout_scope';
        $expectedScope = 'account_id,context_kind,context_key,dashboard_key';
        $scopeColumns = $indexColumns($scopeIndex);
        if ($scopeColumns !== $expectedScope) {
            if ($scopeColumns !== '') $pdo->exec('ALTER TABLE `dashboard_layout_preferences` DROP INDEX ' . $quoteIdentifier($scopeIndex));
            $pdo->exec("ALTER TABLE `dashboard_layout_preferences` ADD UNIQUE KEY `uq_dashboard_layout_scope` (`account_id`,`context_kind`,`context_key`,`dashboard_key`)");
            $repaired = true;
        }

        // Finalize the index transition here while the FK is detached. The
        // historical migration then becomes idempotent and only applies its
        // capability grants before recording version 98.
        if ($indexColumns('uq_dashboard_layout') !== '') {
            $pdo->exec("ALTER TABLE `dashboard_layout_preferences` DROP INDEX `uq_dashboard_layout`");
            $repaired = true;
        }

        // If a previous PHP request or server restart stopped after the FK was
        // detached, information_schema no longer contains its metadata. Restore
        // the canonical migration-96 constraint and remove only invalid orphaned
        // preference rows after preserving them in the recovery table.
        if (!$foreignKeys) {
            $foreignKeys['fk_dashboard_layout_account'] = ['update'=>'RESTRICT','delete'=>'CASCADE'];
        }
        $pdo->exec("INSERT IGNORE INTO `dashboard_layout_preferences_recovery`
            (`original_id`,`account_id`,`context_kind`,`context_key`,`dashboard_key`,`layout_json`,`revision`,`original_updated_at`,`reason`)
            SELECT pref.id,pref.account_id,pref.context_kind,pref.context_key,pref.dashboard_key,pref.layout_json,pref.revision,pref.updated_at,'migration_98_orphan_account'
            FROM `dashboard_layout_preferences` pref
            LEFT JOIN `accounts` account_row ON account_row.id=pref.account_id
            WHERE account_row.id IS NULL");
        $deletedOrphans = $pdo->exec("DELETE pref FROM `dashboard_layout_preferences` pref
            LEFT JOIN `accounts` account_row ON account_row.id=pref.account_id
            WHERE account_row.id IS NULL");
        if ((int)$deletedOrphans > 0) $repaired = true;

        $allowedRules = ['RESTRICT','CASCADE','SET NULL','NO ACTION'];
        foreach ($foreignKeys as $constraintName => $rules) {
            $updateRule = in_array($rules['update'], $allowedRules, true) ? $rules['update'] : 'RESTRICT';
            $deleteRule = in_array($rules['delete'], $allowedRules, true) ? $rules['delete'] : 'RESTRICT';
            $pdo->exec('ALTER TABLE `dashboard_layout_preferences` ADD CONSTRAINT ' . $quoteIdentifier($constraintName)
                . ' FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON UPDATE ' . $updateRule . ' ON DELETE ' . $deleteRule);
        }
        if ($repaired) {
            kareta_log_error('MIGRATIONS', 'Finalized dashboard layout FK/index compatibility for migration 98');
        }
    } catch (Throwable $e) {
        throw new RuntimeException('Migration 98 compatibility repair failed: ' . $e->getMessage(), 0, $e);
    }
}

function kareta_migrate(PDO $pdo): void
{
    static $done = false;
    if ($done) return;

    $lockName = 'kareta_schema_migration_' . substr(hash('sha256', (string)(KARETA_DB['database'] ?? 'default')), 0, 24);
    $bootstrapLockHeld = !empty($GLOBALS['KARETA_SCHEMA_BOOTSTRAP_LOCK_HELD']);
    $lockAcquired = false;
    try {
        // When called from kareta_bootstrap_runtime() the outer schema lock already
        // serializes all DDL. Acquiring a second named lock is redundant and caused
        // avoidable migration=0 lock timeouts on some production MySQL/MariaDB setups.
        if (!$bootstrapLockHeld) {
            kareta_db_set_failure_context('migration.lock');
            $st = $pdo->prepare('SELECT GET_LOCK(?, 30)');
            $st->execute([$lockName]);
            $lockAcquired = ((int)$st->fetchColumn() === 1);
            if (!$lockAcquired) throw new RuntimeException('Migration lock timeout');
        }

        kareta_db_set_failure_context('migration.meta.ensure');
        $pdo->exec("CREATE TABLE IF NOT EXISTS `db_meta` (
            `key` VARCHAR(64) NOT NULL PRIMARY KEY,
            `value` TEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $pdo->exec("CREATE TABLE IF NOT EXISTS `db_migrations` (
            `version` INT NOT NULL PRIMARY KEY,
            `applied_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `note` VARCHAR(255) NOT NULL DEFAULT '',
            `checksum` CHAR(64) NOT NULL DEFAULT '',
            `execution_ms` INT UNSIGNED NOT NULL DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        foreach ([
            "ALTER TABLE `db_migrations` ADD COLUMN `checksum` CHAR(64) NOT NULL DEFAULT '' AFTER `note`",
            "ALTER TABLE `db_migrations` ADD COLUMN `execution_ms` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `checksum`",
        ] as $sql) {
            try { $pdo->exec($sql); } catch (Throwable $_ignored) {}
        }
        $pdo->exec("CREATE TABLE IF NOT EXISTS `db_migration_checksum_conflicts` (
            `version` INT NOT NULL,
            `recorded_checksum` CHAR(64) NOT NULL,
            `runtime_checksum` CHAR(64) NOT NULL,
            `first_seen_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `last_seen_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            `seen_count` INT UNSIGNED NOT NULL DEFAULT 1,
            PRIMARY KEY (`version`,`recorded_checksum`,`runtime_checksum`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        // R187.1 compatibility repair for databases blocked before migration 82.
        // Historical migration 82 referenced context_members.status while the canonical
        // column is membership_status. Do not edit the historical migration because its
        // checksum may already be recorded on other installations. The temporary bridge
        // is removed by migration 90 after the migration chain completes.
        kareta_db_set_failure_context('migration.compatibility', 82, '082_identity_marketplace_organization_membership.php');
        kareta_prepare_migration_82_context_member_compatibility($pdo);

        kareta_db_set_failure_context('migration.discover');
        $migrations = kareta_discover_migrations();
        kareta_db_set_failure_context('migration.history.read');
        $appliedRows = $pdo->query("SELECT `version`,`checksum` FROM `db_migrations` ORDER BY `version`")->fetchAll();
        $applied = [];
        foreach ($appliedRows as $row) $applied[(int)$row['version']] = (string)($row['checksum'] ?? '');

        foreach ($migrations as $migration) {
            $version = (int)$migration['version'];
            $checksum = (string)$migration['checksum'];
            if (array_key_exists($version, $applied)) {
                $known = trim($applied[$version]);
                if ($known !== '' && !hash_equals($known, $checksum)) {
                    // A deployed database may legitimately contain a checksum from
                    // an older full build. The migration has already run, so rerunning
                    // it is unsafe; blocking the whole application is also unsafe.
                    // Preserve both fingerprints for audit and continue to the schema
                    // contract without overwriting the recorded production checksum.
                    $pdo->prepare("INSERT INTO `db_migration_checksum_conflicts`
                        (`version`,`recorded_checksum`,`runtime_checksum`) VALUES(?,?,?)
                        ON DUPLICATE KEY UPDATE `last_seen_at`=CURRENT_TIMESTAMP,`seen_count`=`seen_count`+1")
                        ->execute([$version,$known,$checksum]);
                    kareta_log_error('MIGRATIONS', 'Recorded non-blocking checksum conflict for applied migration ' . $version);
                }
                if ($known === '') {
                    $pdo->prepare("UPDATE `db_migrations` SET `checksum`=? WHERE `version`=?")->execute([$checksum, $version]);
                }
                continue;
            }
            if ($version === 61) {
                kareta_db_set_failure_context('migration.compatibility', 61, basename((string)$migration['file']));
                kareta_prepare_migration_61_sto_master_links_compatibility($pdo);
            }
            if ($version === 82) {
                kareta_db_set_failure_context('migration.compatibility', 82, basename((string)$migration['file']));
                kareta_prepare_migration_82_context_member_compatibility($pdo);
            }
            if ($version === 111) {
                kareta_db_set_failure_context('migration.compatibility', 111, basename((string)$migration['file']));
                kareta_prepare_migration_111_master_reviews_compatibility($pdo);
            }
            if ($version === 121) {
                kareta_db_set_failure_context('migration.compatibility', 121, basename((string)$migration['file']));
                kareta_prepare_migration_121_orders_accepted_at_compatibility($pdo);
            }
            // R188.5.2 recovery: historical migration 98 drops an index whose
            // account_id prefix may currently support fk_dashboard_layout_account.
            // Prepare its replacement immediately before the migration so this also
            // works on fresh databases where migration 96 creates the table in-chain.
            if ($version === 98) {
                kareta_db_set_failure_context('migration.compatibility', 98, basename((string)$migration['file']));
                kareta_prepare_migration_98_dashboard_layout_compatibility($pdo);
            }
            if ($version === 99) {
                kareta_prepare_migration_99_more_menu_compatibility($pdo);
            }
            if ($version === 100 || $version === 102) {
                kareta_prepare_identity_collation_compatibility($pdo, $version);
            }
            kareta_db_set_failure_context('migration.apply', $version, basename((string)$migration['file']));
            kareta_apply_migration($pdo, $migration);
        }

        kareta_db_set_failure_context('migration.history.validate');
        $expectedVersions = array_map('intval', array_column($migrations, 'version'));
        $appliedVersions = array_map('intval', $pdo->query("SELECT `version` FROM `db_migrations` ORDER BY `version`")->fetchAll(PDO::FETCH_COLUMN));
        $missingApplied = array_values(array_diff($expectedVersions, $appliedVersions));
        $unexpectedApplied = array_values(array_diff($appliedVersions, $expectedVersions));
        $expectedVersion = $expectedVersions ? max($expectedVersions) : 0;

        // Only a broken/missing canonical prefix is fatal. Higher migration markers
        // can survive an overwrite deployment from another branch. Deleting them
        // automatically would destroy audit history and could cause unsafe reruns later,
        // so preserve them and continue this release against its pinned manifest.
        $unexpectedBlocking = array_values(array_filter(
            $unexpectedApplied,
            static fn(int $version): bool => $version <= $expectedVersion
        ));
        $futureApplied = array_values(array_filter(
            $unexpectedApplied,
            static fn(int $version): bool => $version > $expectedVersion
        ));

        if ($missingApplied || $unexpectedBlocking) {
            $currentVersion = kareta_get_max_applied_migration($pdo);
            throw new RuntimeException('Schema history mismatch: current=' . $currentVersion . ', expected=' . $expectedVersion . ', missing=' . implode(',', $missingApplied) . ', unexpected=' . implode(',', $unexpectedApplied));
        }

        if ($futureApplied) {
            kareta_log_error('MIGRATION_FUTURE_HISTORY', 'Preserved future migration markers: ' . implode(',', $futureApplied) . '; runtime_expected=' . $expectedVersion);
        }

        // db_meta describes the schema contract expected by this runtime, not the
        // highest audit marker ever recorded in db_migrations.
        $pdo->prepare("INSERT INTO `db_meta`(`key`,`value`) VALUES('schema_version',?) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`)")
            ->execute([(string)$expectedVersion]);

        kareta_db_set_failure_context('migration.schema_contract', $expectedVersion);
        require_once __DIR__ . '/identity/schema_contract.php';
        $schemaContract = KaretaSchemaContract::inspect($pdo);
        KaretaSchemaContract::record($pdo, $schemaContract, 'migration_runner');
        if (!$schemaContract['ok']) {
            throw new RuntimeException('Post-migration schema contract failed: tables=' . implode(',', $schemaContract['missingTables']) . '; columns=' . implode(',', $schemaContract['missingColumns']));
        }
        $done = true;
        kareta_db_clear_failure_context();
    } finally {
        if ($lockAcquired) {
            try { $pdo->prepare('SELECT RELEASE_LOCK(?)')->execute([$lockName]); } catch (Throwable $_ignored) {}
        }
    }
}

function kareta_discover_migrations(): array
{
    $dir = KARETA_API_ROOT . '/migrations';
    if (!is_dir($dir)) throw new RuntimeException('Migration directory is missing');

    $manifestPath = KARETA_API_ROOT . '/migration_manifest.php';
    if (is_file($manifestPath)) {
        $manifest = require $manifestPath;
        if (!is_array($manifest) || !is_array($manifest['files'] ?? null)) {
            throw new RuntimeException('Migration manifest is invalid');
        }
        $manifestVersion = max(0, (int)($manifest['version'] ?? 0));
        $declaredVersion = defined('KARETA_DB_VERSION') ? max(0, (int)KARETA_DB_VERSION) : 0;
        if ($manifestVersion <= 0 || ($declaredVersion > 0 && $manifestVersion !== $declaredVersion)) {
            throw new RuntimeException('Migration manifest version mismatch: manifest=' . $manifestVersion . ', declared=' . $declaredVersion);
        }

        $migrations = [];
        $allowedFiles = [];
        $expected = 1;
        foreach ($manifest['files'] as $manifestKey => $spec) {
            $version = (int)$manifestKey;
            if ($version !== $expected) {
                throw new RuntimeException('Migration manifest sequence gap before version ' . $version);
            }
            if (!is_array($spec)) throw new RuntimeException('Migration manifest entry is invalid: ' . $version);
            $fileName = basename(trim((string)($spec['file'] ?? '')));
            if ($fileName === '' || !preg_match('/^\d+_[a-zA-Z0-9_.-]+\.php$/', $fileName)) {
                throw new RuntimeException('Migration manifest filename is invalid: ' . $version);
            }
            $file = $dir . '/' . $fileName;
            if (!is_file($file)) {
                throw new RuntimeException('Migration manifest file is missing: ' . $fileName);
            }
            $expectedChecksum = strtolower(trim((string)($spec['checksum'] ?? '')));
            $runtimeChecksum = hash_file('sha256', $file) ?: '';
            if ($expectedChecksum !== '' && !hash_equals($expectedChecksum, $runtimeChecksum)) {
                throw new RuntimeException('Migration manifest checksum mismatch: ' . $fileName);
            }

            $loaded = require $file;
            if (is_callable($loaded)) {
                if (!preg_match('/^(\d+)_/', $fileName, $match)) throw new RuntimeException('Migration filename has no version: ' . $fileName);
                $migration = ['version'=>(int)$match[1], 'note'=>pathinfo($fileName, PATHINFO_FILENAME), 'run'=>$loaded];
            } elseif (is_array($loaded) && isset($loaded['version'], $loaded['run']) && is_callable($loaded['run'])) {
                $migration = $loaded;
            } else {
                throw new RuntimeException('Invalid migration file: ' . $fileName);
            }
            if ((int)$migration['version'] !== $version) {
                throw new RuntimeException('Migration manifest version/file mismatch: manifest=' . $version . ', file=' . (int)$migration['version'] . ', name=' . $fileName);
            }
            $migration['file'] = $file;
            $migration['checksum'] = $runtimeChecksum;
            $migrations[] = $migration;
            $allowedFiles[$fileName] = true;
            $expected++;
        }
        if (($expected - 1) !== $manifestVersion) {
            throw new RuntimeException('Migration manifest count mismatch: version=' . $manifestVersion . ', count=' . ($expected - 1));
        }

        // Full ZIP deployments are commonly extracted over an existing document root.
        // PHP files removed from a newer release can therefore remain on disk. They
        // must not become active migrations just because glob() can still see them.
        $stale = [];
        foreach (glob($dir . '/*.php') ?: [] as $candidate) {
            $base = basename($candidate);
            if (!isset($allowedFiles[$base])) $stale[] = $base;
        }
        if ($stale) {
            sort($stale, SORT_NATURAL);
            kareta_file_log_error('MIGRATION_STALE_FILES', 'Ignored stale migration files: ' . implode(', ', $stale));
        }
        return $migrations;
    }

    // Legacy fallback for old installations that do not yet ship a manifest.
    // R188.5.5.6.84.28 deployment hardening: full ZIPs are commonly extracted
    // over an existing document root. During that short window bootstrap.php can
    // become visible before migration_manifest.php, while future/stale migration
    // files from another build are still present. Never let those files become
    // active merely because the manifest is temporarily absent.
    $files = glob($dir . '/*.php') ?: [];
    sort($files, SORT_NATURAL);
    $declaredVersion = defined('KARETA_DB_VERSION') ? max(0, (int)KARETA_DB_VERSION) : 0;
    $migrations = [];
    $seen = [];
    $ignoredFuture = [];
    foreach ($files as $file) {
        $base = basename($file);
        if (!preg_match('/^(\d+)_/', $base, $match)) {
            throw new RuntimeException('Migration filename has no version: ' . $base);
        }
        $fileVersion = (int)$match[1];
        if ($declaredVersion > 0 && $fileVersion > $declaredVersion) {
            $ignoredFuture[] = $base;
            continue;
        }

        $loaded = require $file;
        if (is_callable($loaded)) {
            $migration = ['version'=>$fileVersion, 'note'=>pathinfo($file, PATHINFO_FILENAME), 'run'=>$loaded];
        } elseif (is_array($loaded) && isset($loaded['version'], $loaded['run']) && is_callable($loaded['run'])) {
            $migration = $loaded;
        } else {
            throw new RuntimeException('Invalid migration file: ' . $base);
        }
        $version = (int)$migration['version'];
        if ($version <= 0 || isset($seen[$version])) throw new RuntimeException('Duplicate or invalid migration version: ' . $version);
        if ($declaredVersion > 0 && $version > $declaredVersion) {
            $ignoredFuture[] = $base;
            continue;
        }
        $seen[$version] = true;
        $migration['file'] = $file;
        $migration['checksum'] = hash_file('sha256', $file) ?: '';
        $migrations[] = $migration;
    }
    if ($ignoredFuture) {
        sort($ignoredFuture, SORT_NATURAL);
        kareta_file_log_error('MIGRATION_FUTURE_FILES', 'Ignored future migration files during manifest fallback: ' . implode(', ', array_values(array_unique($ignoredFuture))) . '; runtime_declared=' . $declaredVersion);
    }
    usort($migrations, static fn(array $a, array $b): int => ((int)$a['version']) <=> ((int)$b['version']));
    $expected = 1;
    foreach ($migrations as $migration) {
        if ((int)$migration['version'] !== $expected) throw new RuntimeException('Migration sequence gap before version ' . (int)$migration['version']);
        $expected++;
    }
    return $migrations;
}

function kareta_get_max_applied_migration(PDO $pdo): int
{
    $max = $pdo->query("SELECT MAX(`version`) FROM `db_migrations`")->fetchColumn();
    return max(0, (int)$max);
}

function kareta_apply_migration(PDO $pdo, array $migration): void
{
    $version = (int)$migration['version'];
    $note = trim((string)($migration['note'] ?? ''));
    $checksum = (string)($migration['checksum'] ?? '');
    $runner = $migration['run'];
    $started = microtime(true);

    try {
        $runner($pdo);
        $elapsed = max(0, (int)round((microtime(true) - $started) * 1000));
        $pdo->prepare("INSERT INTO `db_migrations`(`version`,`note`,`checksum`,`execution_ms`) VALUES(?,?,?,?)")
            ->execute([$version, $note, $checksum, $elapsed]);
        $pdo->prepare("INSERT INTO `db_meta`(`key`,`value`) VALUES('schema_version',?) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`)")
            ->execute([(string)$version]);
    } catch (Throwable $e) {
        kareta_log_error('MIGRATIONS', 'Migration ' . $version . ' failed and blocked startup: ' . $e->getMessage());
        throw $e;
    }
}

function kareta_master_id_by_phone(PDO $pdo, string $phone): string
{
    $norm = kareta_normalize_phone($phone);
    if ($norm === '') return '';
    $st = $pdo->prepare("SELECT id FROM `masters` WHERE user_phone=? OR phone=? LIMIT 1");
    $st->execute([$norm, $norm]);
    return (string)($st->fetchColumn() ?: '');
}

function kareta_sto_id_by_phone(PDO $pdo, string $phone): string
{
    $norm = kareta_normalize_phone($phone);
    if ($norm === '') return '';
    $st = $pdo->prepare("SELECT id FROM `sto_profiles` WHERE user_phone=? OR contact_phone=? LIMIT 1");
    $st->execute([$norm, $norm]);
    return (string)($st->fetchColumn() ?: '');
}

function kareta_sync_user_entity(PDO $pdo, string $phone): void
{
    $norm = kareta_normalize_phone($phone);
    if ($norm === '') return;
    $user = kareta_profile_by_phone($pdo, $norm);
    if (!$user) return;

    $role = (string)($user['role'] ?? 'client');

    if ($role === 'master') {
        $masterId = kareta_master_id_by_phone($pdo, $norm);
        if ($masterId === '') {
            $masterId = 'ms_' . substr(md5($norm), 0, 8);
            $resume = is_array($user['resume'] ?? null) ? $user['resume'] : [];
            $pdo->prepare("INSERT INTO `masters`(id,user_id,user_phone,name,phone,initials,color,spec,city,work_mode,service_address,service_radius_km,location_visibility,active)
                           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                           ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),user_phone=VALUES(user_phone),name=VALUES(name),phone=VALUES(phone),initials=VALUES(initials),spec=VALUES(spec),active=VALUES(active)")
                ->execute([
                    $masterId,
                    ((int)($user['id'] ?? 0) ?: null),
                    $norm,
                    (string)($user['name'] ?? 'Мастер'),
                    $norm,
                    (string)($user['initials'] ?? ''),
                    '#60a5fa',
                    (string)($user['spec'] ?? $resume['spec'] ?? ''),
                    (string)($user['city'] ?? $resume['city'] ?? ''),
                    (string)($resume['workMode'] ?? $user['work_mode'] ?? 'shop'),
                    (string)($resume['address'] ?? $user['service_address'] ?? ''),
                    (int)($resume['serviceRadius'] ?? $user['service_radius_km'] ?? 0),
                    (string)($user['location_visibility'] ?? 'city'),
                    (int)($user['active'] ?? 1),
                ]);
        } else {
            $pdo->prepare("UPDATE `masters` SET user_id=?, user_phone=?, name=?, phone=?, initials=?, spec=?, active=? WHERE id=?")
                ->execute([
                    ((int)($user['id'] ?? 0) ?: null),
                    $norm,
                    (string)($user['name'] ?? 'Мастер'),
                    $norm,
                    (string)($user['initials'] ?? ''),
                    (string)($user['spec'] ?? ''),
                    (int)($user['active'] ?? 1),
                    $masterId,
                ]);
        }
        return;
    }

    if ($role === 'sto') {
        $stoId = kareta_sto_id_by_phone($pdo, $norm);
        if ($stoId === '') $stoId = 'sto_' . substr(md5($norm), 0, 10);
        $pdo->prepare("INSERT INTO `sto_profiles`(id,user_id,user_phone,name,contact_phone,country_code,city,address,work_hours,active) VALUES(?,?,?,?,?,?,?,?,?,?)
                       ON DUPLICATE KEY UPDATE user_id=VALUES(user_id), user_phone=VALUES(user_phone), name=VALUES(name), contact_phone=VALUES(contact_phone), country_code=VALUES(country_code), city=VALUES(city), active=VALUES(active)")
            ->execute([
                $stoId,
                ((int)($user['id'] ?? 0) ?: null),
                $norm,
                (string)($user['name'] ?? 'СТО'),
                $norm,
                (string)($user['country_code'] ?? 'KZ'),
                (string)($user['city'] ?? ''),
                '',
                '',
                (int)($user['active'] ?? 1),
            ]);
        return;
    }

    // Для client в entry-flow отдельная сущность не создаётся.
    // Клиент живёт только в users; clients остаётся для legacy-данных заказов.
    return;
}

function kareta_ensure_index(PDO $pdo, string $table, string $index, string $sql): void
{
    if (!kareta_table_exists($pdo, $table)) return;
    $st = $pdo->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?");
    $st->execute([$table, $index]);
    if ((int)$st->fetchColumn() > 0) return;
    try {
        $pdo->exec($sql);
    } catch (Throwable $e) {
        // Auxiliary indexes must not make the whole application unavailable.
        // Duplicate legacy values are retained and reported instead of deleting
        // business rows merely to satisfy a new performance/uniqueness index.
        kareta_log_error('ENSURE_INDEX', $table . '.' . $index . ': ' . $e->getMessage());
    }
}

function kareta_relax_legacy_blank_unique_indexes(PDO $pdo): void
{
    $targets = [
        ['clients','user_phone',['uq_user_phone','uq_clients_user_phone']],
        ['masters','user_phone',['uq_user_phone','uq_masters_user_phone']],
        ['parts_catalog','sku',['uq_parts_catalog_sku']],
    ];
    foreach ($targets as [$table,$column,$candidateNames]) {
        if (!kareta_table_exists($pdo, $table)) continue;
        foreach ($candidateNames as $indexName) {
            $st = $pdo->prepare("SELECT NON_UNIQUE,GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS columns_list
                FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?
                GROUP BY NON_UNIQUE");
            $st->execute([$table,$indexName]);
            $row = $st->fetch(PDO::FETCH_ASSOC);
            if (!$row || (int)$row['NON_UNIQUE'] !== 0 || strtolower((string)$row['columns_list']) !== strtolower($column)) continue;
            $quotedTable = '`' . str_replace('`','``',$table) . '`';
            $quotedIndex = '`' . str_replace('`','``',$indexName) . '`';
            $pdo->exec("ALTER TABLE {$quotedTable} DROP INDEX {$quotedIndex}");
            kareta_log_error('SCHEMA_RECOVERY', 'Relaxed legacy blank-sensitive unique index ' . $table . '.' . $indexName);
        }
    }
}

/**
 * Add a column to a table if it doesn't exist yet (idempotent).
 * Used both in migrations and in db_pull for on-the-fly schema evolution.
 */
function kareta_ensure_column(PDO $pdo, string $table, string $column, string $sql): void
{
    if (!kareta_column_exists($pdo, $table, $column)) {
        try { $pdo->exec($sql); } catch (\Throwable $e) {
            // Column may have been added by another request concurrently — ignore duplicate
            if (strpos($e->getMessage(), 'Duplicate column') === false) {
                kareta_log_error('ENSURE_COLUMN', "$table.$column: " . $e->getMessage());
            }
        }
    }
}

function kareta_column_exists(PDO $pdo, string $table, string $column): bool
{
    $st = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
    $st->execute([$table, $column]);
    return (int)$st->fetchColumn() > 0;
}

function kareta_fk_exists(PDO $pdo, string $table, string $constraintName): bool
{
    $st = $pdo->prepare("SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?");
    $st->execute([$table, $constraintName]);
    return (int)$st->fetchColumn() > 0;
}

function kareta_ensure_foreign_key(PDO $pdo, string $table, string $constraintName, string $sql): void
{
    if (!kareta_fk_exists($pdo, $table, $constraintName)) {
        $pdo->exec($sql);
    }
}

function kareta_ensure_schema_columns(PDO $pdo): void
{
    kareta_relax_legacy_blank_unique_indexes($pdo);

    $pdo->exec("CREATE TABLE IF NOT EXISTS `seller_profiles` (
        `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        `user_id` BIGINT UNSIGNED NULL,
        `user_phone` VARCHAR(20) NOT NULL DEFAULT '',
        `store_name` VARCHAR(191) NOT NULL DEFAULT '',
        `legal_name` VARCHAR(191) NOT NULL DEFAULT '',
        `bin_iin` VARCHAR(12) NOT NULL DEFAULT '',
        `contact_phone` VARCHAR(20) NOT NULL DEFAULT '',
        `email` VARCHAR(191) NOT NULL DEFAULT '',
        `country_code` VARCHAR(8) NOT NULL DEFAULT 'KZ',
        `city` VARCHAR(120) NOT NULL DEFAULT '',
        `warehouse_address` VARCHAR(255) NOT NULL DEFAULT '',
        `description` TEXT NULL,
        `assortment` VARCHAR(255) NOT NULL DEFAULT '',
        `category_tags` JSON NULL,
        `delivery_modes` JSON NULL,
        `payment_methods` JSON NULL,
        `minimum_order` VARCHAR(64) NOT NULL DEFAULT '',
        `return_days` SMALLINT UNSIGNED NOT NULL DEFAULT 14,
        `return_policy` VARCHAR(1000) NOT NULL DEFAULT '',
        `moderation_status` VARCHAR(24) NOT NULL DEFAULT 'pending',
        `moderation_reason` VARCHAR(500) NOT NULL DEFAULT '',
        `active` TINYINT(1) NOT NULL DEFAULT 1,
        `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY `uq_seller_user_phone` (`user_phone`),
        UNIQUE KEY `uq_seller_user_id` (`user_id`),
        KEY `idx_seller_city_active` (`city`,`active`),
        KEY `idx_seller_moderation` (`moderation_status`,`active`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS `seller_products` (
        `id` VARCHAR(64) NOT NULL PRIMARY KEY,
        `seller_user_id` BIGINT UNSIGNED NOT NULL,
        `seller_phone` VARCHAR(20) NOT NULL DEFAULT '',
        `sku` VARCHAR(64) NOT NULL DEFAULT '',
        `oem_number` VARCHAR(96) NOT NULL DEFAULT '',
        `name` VARCHAR(191) NOT NULL DEFAULT '',
        `category` VARCHAR(64) NOT NULL DEFAULT 'other',
        `brand` VARCHAR(120) NOT NULL DEFAULT '',
        `price` DECIMAL(12,2) NOT NULL DEFAULT 0,
        `old_price` DECIMAL(12,2) NOT NULL DEFAULT 0,
        `stock_qty` INT NOT NULL DEFAULT 0,
        `status` VARCHAR(24) NOT NULL DEFAULT 'draft',
        `description` TEXT NULL,
        `image_url` TEXT NULL,
        `fitment_json` JSON NULL,
        `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY `uq_seller_product_sku` (`seller_user_id`,`sku`),
        KEY `idx_seller_products_owner` (`seller_user_id`,`status`,`updated_at`),
        KEY `idx_seller_products_catalog` (`category`,`status`,`stock_qty`),
        KEY `idx_seller_products_oem` (`oem_number`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS `seller_orders` (
        `id` VARCHAR(64) NOT NULL PRIMARY KEY,
        `seller_user_id` BIGINT UNSIGNED NOT NULL,
        `seller_phone` VARCHAR(20) NOT NULL DEFAULT '',
        `client_user_id` BIGINT UNSIGNED NULL,
        `customer_name` VARCHAR(191) NOT NULL DEFAULT '',
        `customer_phone` VARCHAR(20) NOT NULL DEFAULT '',
        `status` VARCHAR(24) NOT NULL DEFAULT 'new',
        `payment_status` VARCHAR(24) NOT NULL DEFAULT 'pending',
        `delivery_type` VARCHAR(32) NOT NULL DEFAULT 'pickup',
        `delivery_address` VARCHAR(255) NOT NULL DEFAULT '',
        `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0,
        `delivery_price` DECIMAL(12,2) NOT NULL DEFAULT 0,
        `total` DECIMAL(12,2) NOT NULL DEFAULT 0,
        `comment` TEXT NULL,
        `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY `idx_seller_orders_owner` (`seller_user_id`,`status`,`created_at`),
        KEY `idx_seller_orders_customer` (`customer_phone`,`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS `seller_order_items` (
        `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        `order_id` VARCHAR(64) NOT NULL,
        `product_id` VARCHAR(64) NOT NULL,
        `sku` VARCHAR(64) NOT NULL DEFAULT '',
        `name` VARCHAR(191) NOT NULL DEFAULT '',
        `qty` INT UNSIGNED NOT NULL DEFAULT 1,
        `price` DECIMAL(12,2) NOT NULL DEFAULT 0,
        `total` DECIMAL(12,2) NOT NULL DEFAULT 0,
        KEY `idx_seller_order_items_order` (`order_id`),
        KEY `idx_seller_order_items_product` (`product_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS `master_exchange_responses` (
        `id` VARCHAR(64) NOT NULL PRIMARY KEY,
        `request_id` VARCHAR(64) NOT NULL,
        `master_id` VARCHAR(64) NOT NULL DEFAULT '',
        `master_user_id` BIGINT UNSIGNED NULL,
        `request_title` VARCHAR(191) NOT NULL DEFAULT '',
        `price_type` VARCHAR(16) NOT NULL DEFAULT 'fixed',
        `price_from` INT NOT NULL DEFAULT 0,
        `price_to` INT NOT NULL DEFAULT 0,
        `start_time` VARCHAR(64) NOT NULL DEFAULT '',
        `work_format` VARCHAR(120) NOT NULL DEFAULT '',
        `includes_text` TEXT NULL,
        `extra_costs` TEXT NULL,
        `need_diagnostics` VARCHAR(8) NOT NULL DEFAULT 'no',
        `duration_text` VARCHAR(120) NOT NULL DEFAULT '',
        `warranty_text` VARCHAR(120) NOT NULL DEFAULT '',
        `arrival_time` VARCHAR(64) NOT NULL DEFAULT '',
        `field_service_price` INT NOT NULL DEFAULT 0,
        `need_tow` VARCHAR(8) NOT NULL DEFAULT 'no',
        `can_fix_on_site` VARCHAR(8) NOT NULL DEFAULT 'yes',
        `comment` TEXT NULL,
        `response_status` VARCHAR(24) NOT NULL DEFAULT 'pending',
        `active` TINYINT(1) NOT NULL DEFAULT 1,
        `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY `uq_master_exchange_response` (`request_id`,`master_id`),
        KEY `idx_master_exchange_response_master` (`master_id`,`created_at`),
        KEY `idx_master_exchange_response_user` (`master_user_id`,`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS `master_exchange_saved` (
        `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        `request_id` VARCHAR(64) NOT NULL,
        `master_id` VARCHAR(64) NOT NULL DEFAULT '',
        `master_user_id` BIGINT UNSIGNED NULL,
        `active` TINYINT(1) NOT NULL DEFAULT 1,
        `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY `uq_master_exchange_saved` (`request_id`,`master_id`),
        KEY `idx_master_exchange_saved_master` (`master_id`,`created_at`),
        KEY `idx_master_exchange_saved_user` (`master_user_id`,`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS `master_exchange_hidden` (
        `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        `request_id` VARCHAR(64) NOT NULL,
        `master_id` VARCHAR(64) NOT NULL DEFAULT '',
        `master_user_id` BIGINT UNSIGNED NULL,
        `active` TINYINT(1) NOT NULL DEFAULT 1,
        `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY `uq_master_exchange_hidden` (`request_id`,`master_id`),
        KEY `idx_master_exchange_hidden_master` (`master_id`,`created_at`),
        KEY `idx_master_exchange_hidden_user` (`master_user_id`,`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS `master_wall_posts`(
        `id` VARCHAR(64) NOT NULL PRIMARY KEY,
        `master_id` VARCHAR(64) NOT NULL DEFAULT '',
        `master_user_id` BIGINT UNSIGNED NULL,
        `master_name` VARCHAR(191) NOT NULL DEFAULT '',
        `order_id` VARCHAR(32) NOT NULL DEFAULT '',
        `post_type` VARCHAR(32) NOT NULL DEFAULT 'note',
        `stage_code` VARCHAR(32) NOT NULL DEFAULT '',
        `category` VARCHAR(64) NULL DEFAULT 'repair_story',
        `preview` TEXT NULL,
        `title` VARCHAR(191) NOT NULL DEFAULT '',
        `text` MEDIUMTEXT NULL,
        `links_json` JSON NULL,
        `photos_json` JSON NULL,
        `files_json` JSON NULL,
        `steps_json` JSON NULL,
        `parts_json` JSON NULL,
        `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        `active` TINYINT(1) NOT NULL DEFAULT 1,
        KEY `idx_master_wall_master_id` (`master_id`),
        KEY `idx_master_wall_master_user_id` (`master_user_id`),
        KEY `idx_master_wall_order_id` (`order_id`),
        KEY `idx_master_wall_active_created` (`active`,`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $checks = [
        ['users', 'active', "ALTER TABLE `users` ADD COLUMN `active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `email`"],
        ['orders', 'category', "ALTER TABLE `orders` ADD COLUMN `category` VARCHAR(64) NOT NULL DEFAULT 'service' AFTER `priority`"],
        ['orders', 'source', "ALTER TABLE `orders` ADD COLUMN `source` VARCHAR(64) NOT NULL DEFAULT '' AFTER `category`"],
        ['orders', 'type', "ALTER TABLE `orders` ADD COLUMN `type` VARCHAR(32) NOT NULL DEFAULT 'service_order' AFTER `priority`"],
        ['orders', 'completed_at', "ALTER TABLE `orders` ADD COLUMN `completed_at` TIMESTAMP NULL AFTER `created_at`"],
        ['orders', 'deferred', "ALTER TABLE `orders` ADD COLUMN `deferred` TINYINT(1) NOT NULL DEFAULT 0 AFTER `type`"],
        ['clients', 'notes', "ALTER TABLE `clients` ADD COLUMN `notes` TEXT NULL AFTER `car`"],
        ['clients', 'user_id', "ALTER TABLE `clients` ADD COLUMN `user_id` BIGINT UNSIGNED NULL AFTER `id`"],
        ['clients', 'user_phone', "ALTER TABLE `clients` ADD COLUMN `user_phone` VARCHAR(20) NOT NULL DEFAULT '' AFTER `user_id`"],
        ['masters', 'user_id', "ALTER TABLE `masters` ADD COLUMN `user_id` BIGINT UNSIGNED NULL AFTER `id`"],
        ['masters', 'user_phone', "ALTER TABLE `masters` ADD COLUMN `user_phone` VARCHAR(20) NOT NULL DEFAULT '' AFTER `user_id`"],
        ['masters', 'resume', "ALTER TABLE `masters` ADD COLUMN `resume` JSON NULL DEFAULT NULL AFTER `active`"],
        ['masters', 'city', "ALTER TABLE `masters` ADD COLUMN `city` VARCHAR(120) NOT NULL DEFAULT '' AFTER `spec`"],
        ['masters', 'experience_label', "ALTER TABLE `masters` ADD COLUMN `experience_label` VARCHAR(64) NOT NULL DEFAULT '' AFTER `spec`"],
        ['sto_profiles', 'primary_specialization', "ALTER TABLE `sto_profiles` ADD COLUMN `primary_specialization` VARCHAR(191) NOT NULL DEFAULT '' AFTER `work_hours`"],
        ['masters', 'offer_text', "ALTER TABLE `masters` ADD COLUMN `offer_text` VARCHAR(255) NULL DEFAULT NULL AFTER `city`"],
        ['masters', 'work_mode', "ALTER TABLE `masters` ADD COLUMN `work_mode` VARCHAR(32) NULL DEFAULT NULL AFTER `offer_text`"],
        ['masters', 'district', "ALTER TABLE `masters` ADD COLUMN `district` VARCHAR(120) NULL DEFAULT NULL AFTER `work_mode`"],
        ['masters', 'primary_services', "ALTER TABLE `masters` ADD COLUMN `primary_services` JSON NULL DEFAULT NULL AFTER `district`"],
        ['masters', 'availability', "ALTER TABLE `masters` ADD COLUMN `availability` VARCHAR(24) NOT NULL DEFAULT 'online' AFTER `primary_services`"],
        ['masters', 'profile_visible', "ALTER TABLE `masters` ADD COLUMN `profile_visible` TINYINT(1) NOT NULL DEFAULT 1 AFTER `availability`"],
        ['masters', 'service_address', "ALTER TABLE `masters` ADD COLUMN `service_address` VARCHAR(255) NULL DEFAULT NULL AFTER `profile_visible`"],
        ['masters', 'service_radius_km', "ALTER TABLE `masters` ADD COLUMN `service_radius_km` INT NOT NULL DEFAULT 0 AFTER `service_address`"],
        ['masters', 'service_lat', "ALTER TABLE `masters` ADD COLUMN `service_lat` DECIMAL(10,7) NULL DEFAULT NULL AFTER `service_radius_km`"],
        ['masters', 'service_lng', "ALTER TABLE `masters` ADD COLUMN `service_lng` DECIMAL(10,7) NULL DEFAULT NULL AFTER `service_lat`"],
        ['masters', 'location_source', "ALTER TABLE `masters` ADD COLUMN `location_source` VARCHAR(16) NOT NULL DEFAULT 'manual' AFTER `service_lng`"],
        ['masters', 'location_visibility', "ALTER TABLE `masters` ADD COLUMN `location_visibility` VARCHAR(16) NOT NULL DEFAULT 'city' AFTER `location_source`"],
        ['masters', 'address', "ALTER TABLE `masters` ADD COLUMN `address` VARCHAR(255) NULL DEFAULT NULL AFTER `location_visibility`"],
        ['masters', 'org_name', "ALTER TABLE `masters` ADD COLUMN `org_name` VARCHAR(255) NULL DEFAULT NULL AFTER `address`"],
        ['masters', 'business_type', "ALTER TABLE `masters` ADD COLUMN `business_type` VARCHAR(16) NULL DEFAULT NULL AFTER `org_name`"],
        ['masters', 'sto_id', "ALTER TABLE `masters` ADD COLUMN `sto_id` VARCHAR(64) NOT NULL DEFAULT '' AFTER `business_type`"],
        ['masters', 'sto_name', "ALTER TABLE `masters` ADD COLUMN `sto_name` VARCHAR(191) NOT NULL DEFAULT '' AFTER `sto_id`"],
        ['orders', 'client_user_id', "ALTER TABLE `orders` ADD COLUMN `client_user_id` BIGINT UNSIGNED NULL AFTER `client_id`"],
        ['orders', 'master_user_id', "ALTER TABLE `orders` ADD COLUMN `master_user_id` BIGINT UNSIGNED NULL AFTER `master_id`"],
        ['orders', 'assigned_admin_user_id', "ALTER TABLE `orders` ADD COLUMN `assigned_admin_user_id` BIGINT UNSIGNED NULL AFTER `master_user_id`"],
        ['orders', 'time_mode', "ALTER TABLE `orders` ADD COLUMN `time_mode` VARCHAR(16) NOT NULL DEFAULT 'exact' AFTER `time`"],
        ['chats', 'client_user_id', "ALTER TABLE `chats` ADD COLUMN `client_user_id` BIGINT UNSIGNED NULL AFTER `client_id`"],
        ['chats', 'master_user_id', "ALTER TABLE `chats` ADD COLUMN `master_user_id` BIGINT UNSIGNED NULL AFTER `master_id`"],
        ['chats', 'assigned_admin_user_id', "ALTER TABLE `chats` ADD COLUMN `assigned_admin_user_id` BIGINT UNSIGNED NULL AFTER `master_user_id`"],
        ['chats', 'created_at', "ALTER TABLE `chats` ADD COLUMN `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `unread_admin`"],
        ['messages', 'author_user_id', "ALTER TABLE `messages` ADD COLUMN `author_user_id` BIGINT UNSIGNED NULL AFTER `from_role`"],
        ['messages', 'order_id', "ALTER TABLE `messages` ADD COLUMN `order_id` VARCHAR(16) NOT NULL DEFAULT '' AFTER `chat_id`"],
        ['audit_log', 'actor_user_id', "ALTER TABLE `audit_log` ADD COLUMN `actor_user_id` BIGINT UNSIGNED NULL AFTER `action`"],
        ['notifications', 'recipient_user_id', "ALTER TABLE `notifications` ADD COLUMN `recipient_user_id` BIGINT UNSIGNED NULL AFTER `id`"],
        ['notifications', 'recipient_phone', "ALTER TABLE `notifications` ADD COLUMN `recipient_phone` VARCHAR(20) NOT NULL DEFAULT '' AFTER `recipient_user_id`"],
        ['notifications', 'recipient_role', "ALTER TABLE `notifications` ADD COLUMN `recipient_role` VARCHAR(32) NOT NULL DEFAULT '' AFTER `recipient_phone`"],
        ['notifications', 'event_type', "ALTER TABLE `notifications` ADD COLUMN `event_type` VARCHAR(64) NOT NULL DEFAULT '' AFTER `recipient_role`"],
        ['notifications', 'entity_type', "ALTER TABLE `notifications` ADD COLUMN `entity_type` VARCHAR(32) NOT NULL DEFAULT '' AFTER `event_type`"],
        ['notifications', 'entity_id', "ALTER TABLE `notifications` ADD COLUMN `entity_id` VARCHAR(64) NOT NULL DEFAULT '' AFTER `entity_type`"],
        ['notifications', 'title', "ALTER TABLE `notifications` ADD COLUMN `title` VARCHAR(191) NOT NULL DEFAULT '' AFTER `entity_id`"],
        ['notifications', 'body', "ALTER TABLE `notifications` ADD COLUMN `body` TEXT NULL AFTER `title`"],
        ['notifications', 'action_url', "ALTER TABLE `notifications` ADD COLUMN `action_url` VARCHAR(255) NOT NULL DEFAULT '' AFTER `body`"],
        ['notifications', 'is_read', "ALTER TABLE `notifications` ADD COLUMN `is_read` TINYINT(1) NOT NULL DEFAULT 0 AFTER `action_url`"],
        ['notifications', 'read_at', "ALTER TABLE `notifications` ADD COLUMN `read_at` TIMESTAMP NULL AFTER `is_read`"],
        ['notifications', 'meta', "ALTER TABLE `notifications` ADD COLUMN `meta` JSON NULL AFTER `read_at`"],
        ['notifications', 'created_at', "ALTER TABLE `notifications` ADD COLUMN `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `meta`"],
        ['master_schedules', 'master_id', "ALTER TABLE `master_schedules` ADD COLUMN `master_id` VARCHAR(64) NOT NULL DEFAULT '' AFTER `id`"],
        ['users', 'entry_role', "ALTER TABLE `users` ADD COLUMN `entry_role` VARCHAR(32) NOT NULL DEFAULT 'client' AFTER `role`"],
        ['users', 'onboarding_stage', "ALTER TABLE `users` ADD COLUMN `onboarding_stage` VARCHAR(32) NOT NULL DEFAULT '' AFTER `entry_role`"],
        ['users', 'onboarded', "ALTER TABLE `users` ADD COLUMN `onboarded` TINYINT(1) NOT NULL DEFAULT 0 AFTER `onboarding_stage`"],
        ['users', 'country_code', "ALTER TABLE `users` ADD COLUMN `country_code` VARCHAR(8) NOT NULL DEFAULT 'KZ' AFTER `onboarded`"],
        ['users', 'city', "ALTER TABLE `users` ADD COLUMN `city` VARCHAR(120) NOT NULL DEFAULT '' AFTER `country_code`"],
        ['masters', 'response_time_label', "ALTER TABLE `masters` ADD COLUMN `response_time_label` VARCHAR(64) NULL DEFAULT NULL AFTER `service_radius_km`"],
        ['masters', 'starting_price', "ALTER TABLE `masters` ADD COLUMN `starting_price` INT NULL DEFAULT NULL AFTER `response_time_label`"],
        ['masters', 'guarantee', "ALTER TABLE `masters` ADD COLUMN `guarantee` VARCHAR(120) NULL DEFAULT NULL AFTER `starting_price`"],
        ['masters', 'min_check', "ALTER TABLE `masters` ADD COLUMN `min_check` VARCHAR(64) NULL DEFAULT NULL AFTER `guarantee`"],
        ['masters', 'payment_methods', "ALTER TABLE `masters` ADD COLUMN `payment_methods` VARCHAR(255) NULL DEFAULT NULL AFTER `min_check`"],
        ['masters', 'updated_at', "ALTER TABLE `masters` ADD COLUMN `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `payment_methods`"],
        ['master_schedules', 'updated_at', "ALTER TABLE `master_schedules` ADD COLUMN `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `note`"],
        ['master_wall_posts', 'master_user_id', "ALTER TABLE `master_wall_posts` ADD COLUMN `master_user_id` BIGINT UNSIGNED NULL AFTER `master_id`"],
        ['master_wall_posts', 'order_id', "ALTER TABLE `master_wall_posts` ADD COLUMN `order_id` VARCHAR(32) NOT NULL DEFAULT '' AFTER `master_name`"],
        ['master_wall_posts', 'post_type', "ALTER TABLE `master_wall_posts` ADD COLUMN `post_type` VARCHAR(32) NOT NULL DEFAULT 'note' AFTER `order_id`"],
        ['master_wall_posts', 'stage_code', "ALTER TABLE `master_wall_posts` ADD COLUMN `stage_code` VARCHAR(32) NOT NULL DEFAULT '' AFTER `post_type`"],
        ['master_wall_posts', 'active', "ALTER TABLE `master_wall_posts` ADD COLUMN `active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `updated_at`"],
    ];
    foreach ($checks as [$table, $column, $sql]) {
        if (!kareta_table_exists($pdo, $table)) {
            continue;
        }
        $st = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
        $st->execute([$table, $column]);
        if ((int)$st->fetchColumn() === 0) {
            $pdo->exec($sql);
        }
    }

    kareta_ensure_index($pdo, 'orders', 'idx_type_status', "ALTER TABLE `orders` ADD INDEX `idx_type_status` (`type`, `status`)");
    kareta_ensure_index($pdo, 'orders', 'idx_type_deferred_status', "ALTER TABLE `orders` ADD INDEX `idx_type_deferred_status` (`type`, `deferred`, `status`)");
    kareta_ensure_index($pdo, 'orders', 'idx_date_time', "ALTER TABLE `orders` ADD INDEX `idx_date_time` (`date`, `time`)");
    kareta_ensure_index($pdo, 'messages', 'idx_chat_created', "ALTER TABLE `messages` ADD INDEX `idx_chat_created` (`chat_id`, `created_at`)");
    kareta_ensure_index($pdo, 'clients', 'idx_phone_created', "ALTER TABLE `clients` ADD INDEX `idx_phone_created` (`phone`, `created_at`)");
    kareta_ensure_index($pdo, 'users', 'idx_role_active', "ALTER TABLE `users` ADD INDEX `idx_role_active` (`role`, `active`)");
    kareta_ensure_index($pdo, 'clients', 'idx_clients_user_phone', "ALTER TABLE `clients` ADD INDEX `idx_clients_user_phone` (`user_phone`)");
    kareta_ensure_index($pdo, 'masters', 'idx_masters_user_phone', "ALTER TABLE `masters` ADD INDEX `idx_masters_user_phone` (`user_phone`)");
    kareta_ensure_index($pdo, 'orders', 'idx_client_user_id', "ALTER TABLE `orders` ADD INDEX `idx_client_user_id` (`client_user_id`)");
    kareta_ensure_index($pdo, 'orders', 'idx_master_user_id', "ALTER TABLE `orders` ADD INDEX `idx_master_user_id` (`master_user_id`)");
    kareta_ensure_index($pdo, 'orders', 'idx_assigned_admin_user_id', "ALTER TABLE `orders` ADD INDEX `idx_assigned_admin_user_id` (`assigned_admin_user_id`)");
    kareta_ensure_index($pdo, 'chats', 'idx_client_user_id', "ALTER TABLE `chats` ADD INDEX `idx_client_user_id` (`client_user_id`)");
    kareta_ensure_index($pdo, 'chats', 'idx_master_user_id', "ALTER TABLE `chats` ADD INDEX `idx_master_user_id` (`master_user_id`)");
    kareta_ensure_index($pdo, 'chats', 'idx_assigned_admin_user_id', "ALTER TABLE `chats` ADD INDEX `idx_assigned_admin_user_id` (`assigned_admin_user_id`)");
    kareta_ensure_index($pdo, 'messages', 'idx_author_user_id', "ALTER TABLE `messages` ADD INDEX `idx_author_user_id` (`author_user_id`)");
    kareta_ensure_index($pdo, 'messages', 'idx_order_id', "ALTER TABLE `messages` ADD INDEX `idx_order_id` (`order_id`)");
    kareta_ensure_index($pdo, 'audit_log', 'idx_actor_user_id', "ALTER TABLE `audit_log` ADD INDEX `idx_actor_user_id` (`actor_user_id`)");
    kareta_ensure_index($pdo, 'notifications', 'idx_recipient_user_id', "ALTER TABLE `notifications` ADD INDEX `idx_recipient_user_id` (`recipient_user_id`)");
    kareta_ensure_index($pdo, 'notifications', 'idx_recipient_phone', "ALTER TABLE `notifications` ADD INDEX `idx_recipient_phone` (`recipient_phone`)");
    kareta_ensure_index($pdo, 'notifications', 'idx_recipient_role_read', "ALTER TABLE `notifications` ADD INDEX `idx_recipient_role_read` (`recipient_role`, `is_read`, `created_at`)");
    kareta_ensure_index($pdo, 'notifications', 'idx_entity', "ALTER TABLE `notifications` ADD INDEX `idx_entity` (`entity_type`, `entity_id`)");

    if (kareta_table_exists($pdo, 'orders')) {
        $pdo->exec("UPDATE `orders` SET `type`='parts_request' WHERE (`type` IS NULL OR `type`='' OR `type`='service_order') AND (TRIM(COALESCE(`service_names`,''))='Запрос запчасти' OR `notes` LIKE 'Запрос запчасти:%')");
        $pdo->exec("UPDATE `orders` SET `type`='service_order' WHERE `type` IS NULL OR `type`=''");
        $pdo->exec("UPDATE `orders` SET `deferred`=1 WHERE `deferred`=0 AND (`notes` LIKE '[ОТЛОЖЕНО] %' OR `notes` LIKE '[HOLD] %')");
        $pdo->exec("UPDATE `orders` SET `notes`=TRIM(REPLACE(REPLACE(COALESCE(`notes`,''), '[ОТЛОЖЕНО] ', ''), '[HOLD] ', '')) WHERE `deferred`=1 AND (`notes` LIKE '[ОТЛОЖЕНО] %' OR `notes` LIKE '[HOLD] %')");
    }

    if (kareta_table_exists($pdo, 'parts_catalog')) {
        kareta_ensure_column($pdo, 'parts_catalog', 'cat', "ALTER TABLE `parts_catalog` ADD COLUMN `cat` VARCHAR(64) NOT NULL DEFAULT 'electrical' AFTER `id`");
        kareta_ensure_column($pdo, 'parts_catalog', 'name', "ALTER TABLE `parts_catalog` ADD COLUMN `name` VARCHAR(191) NOT NULL DEFAULT '' AFTER `cat`");
        kareta_ensure_column($pdo, 'parts_catalog', 'sku', "ALTER TABLE `parts_catalog` ADD COLUMN `sku` VARCHAR(64) NOT NULL DEFAULT '' AFTER `name`");
        kareta_ensure_column($pdo, 'parts_catalog', 'price_label', "ALTER TABLE `parts_catalog` ADD COLUMN `price_label` VARCHAR(64) NOT NULL DEFAULT '' AFTER `sku`");
        kareta_ensure_column($pdo, 'parts_catalog', 'stock', "ALTER TABLE `parts_catalog` ADD COLUMN `stock` VARCHAR(64) NOT NULL DEFAULT '' AFTER `price_label`");
        kareta_ensure_column($pdo, 'parts_catalog', 'note', "ALTER TABLE `parts_catalog` ADD COLUMN `note` VARCHAR(500) NOT NULL DEFAULT '' AFTER `stock`");
        kareta_ensure_column($pdo, 'parts_catalog', 'sort', "ALTER TABLE `parts_catalog` ADD COLUMN `sort` INT NOT NULL DEFAULT 0 AFTER `note`");
        kareta_ensure_column($pdo, 'parts_catalog', 'active', "ALTER TABLE `parts_catalog` ADD COLUMN `active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `sort`");
        kareta_ensure_column($pdo, 'parts_catalog', 'created_at', "ALTER TABLE `parts_catalog` ADD COLUMN `created_at` DATE NOT NULL DEFAULT '2026-01-01' AFTER `active`");
        kareta_ensure_index($pdo, 'parts_catalog', 'idx_parts_catalog_sku', "ALTER TABLE `parts_catalog` ADD INDEX `idx_parts_catalog_sku` (`sku`)");
        kareta_ensure_index($pdo, 'parts_catalog', 'idx_parts_catalog_cat_active_sort', "ALTER TABLE `parts_catalog` ADD INDEX `idx_parts_catalog_cat_active_sort` (`cat`,`active`,`sort`)");
    }
}

function kareta_backfill_relations(PDO $pdo): void
{
    $pdo->exec("INSERT IGNORE INTO `clients`(`id`,`name`,`phone`,`car`,`orders_count`,`total_spent`,`created_at`)
        SELECT
            CONCAT('cli_', LOWER(HEX(SHA2(TRIM(o.client_phone), 256)))) AS id,
            COALESCE(NULLIF(o.client_name, ''), 'Клиент') AS name,
            o.client_phone,
            COALESCE(o.client_car, ''),
            0,
            0,
            DATE(COALESCE(o.created_at, CURRENT_TIMESTAMP))
        FROM `orders` o
        WHERE TRIM(COALESCE(o.client_phone, '')) <> ''");

    $pdo->exec("UPDATE `orders` o
        INNER JOIN `clients` c ON c.phone = o.client_phone
        SET o.client_id = c.id
        WHERE (o.client_id IS NULL OR o.client_id = '') AND TRIM(COALESCE(o.client_phone, '')) <> ''");

    $pdo->exec("UPDATE `orders` o
        SET o.master_name = COALESCE((
            SELECT NULLIF(mm.name, '') FROM `masters` mm WHERE mm.id = o.master_id LIMIT 1
        ), o.master_name)
        WHERE o.master_id IS NOT NULL AND o.master_id <> ''");

    $pdo->exec("UPDATE `clients` c
        INNER JOIN (
            SELECT client_id,
                   COUNT(*) AS cnt,
                   COALESCE(SUM(price), 0) AS total
            FROM `orders`
            WHERE TRIM(COALESCE(client_id, '')) <> ''
            GROUP BY client_id
        ) t ON t.client_id = c.id
        SET c.orders_count = t.cnt,
            c.total_spent = t.total");

    $pdo->exec("UPDATE `clients` c INNER JOIN `users` u ON u.phone = c.user_phone SET c.user_id = u.id WHERE c.user_id IS NULL AND TRIM(COALESCE(c.user_phone,'')) <> ''");
    $pdo->exec("UPDATE `masters` m INNER JOIN `users` u ON u.phone = m.user_phone SET m.user_id = u.id WHERE m.user_id IS NULL AND TRIM(COALESCE(m.user_phone,'')) <> ''");
    $pdo->exec("UPDATE `orders` o INNER JOIN `users` u ON u.phone = o.client_phone SET o.client_user_id = u.id WHERE o.client_user_id IS NULL AND TRIM(COALESCE(o.client_phone,'')) <> ''");
    $pdo->exec("UPDATE `orders` o INNER JOIN `masters` m ON m.id = o.master_id INNER JOIN `users` u ON u.phone = m.user_phone SET o.master_user_id = u.id WHERE o.master_id IS NOT NULL AND o.master_id <> '' AND o.master_user_id IS NULL");
    $pdo->exec("UPDATE `chats` c INNER JOIN `users` u ON u.phone = c.client_phone SET c.client_user_id = u.id WHERE c.client_user_id IS NULL AND TRIM(COALESCE(c.client_phone,'')) <> ''");
    $pdo->exec("UPDATE `chats` c INNER JOIN `masters` m ON m.id = c.master_id INNER JOIN `users` u ON u.phone = m.user_phone SET c.master_user_id = u.id WHERE c.master_id IS NOT NULL AND c.master_id <> '' AND c.master_user_id IS NULL");
    $pdo->exec("UPDATE `chats` c INNER JOIN `orders` o ON o.id = c.order_id SET c.assigned_admin_user_id = o.assigned_admin_user_id WHERE c.assigned_admin_user_id IS NULL AND o.assigned_admin_user_id IS NOT NULL");
    $pdo->exec("UPDATE `messages` m INNER JOIN `chats` c ON c.id = m.chat_id SET m.order_id = c.order_id WHERE TRIM(COALESCE(m.order_id,'')) = ''");
    $pdo->exec("UPDATE `messages` m INNER JOIN `users` u ON u.role = m.from_role SET m.author_user_id = u.id WHERE m.author_user_id IS NULL AND m.from_role IN ('owner','admin')");
    $pdo->exec("UPDATE `audit_log` a INNER JOIN `users` u ON u.phone = a.actor_phone SET a.actor_user_id = u.id WHERE a.actor_user_id IS NULL AND TRIM(COALESCE(a.actor_phone,'')) <> ''");
    kareta_rebuild_user_stats($pdo);
}

/* ── Схема ───────────────────────────────────────────────────────────── */
function kareta_create_schema(PDO $pdo): void
{
    $pdo->exec("CREATE TABLE IF NOT EXISTS `db_meta`(
        `key`   VARCHAR(64) NOT NULL PRIMARY KEY,
        `value` TEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `users`(
        id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        phone      VARCHAR(20)  NOT NULL UNIQUE,
        name       VARCHAR(191) NOT NULL DEFAULT '',
        role       VARCHAR(32)  NOT NULL DEFAULT 'client',
        entry_role VARCHAR(32)  NOT NULL DEFAULT 'client',
        onboarding_stage VARCHAR(32) NOT NULL DEFAULT '',
        onboarded  TINYINT(1)   NOT NULL DEFAULT 0,
        onboarded_at DATETIME NULL DEFAULT NULL,
        country_code VARCHAR(8) NOT NULL DEFAULT 'KZ',
        city       VARCHAR(120) NOT NULL DEFAULT '',
        initials   VARCHAR(16)  NOT NULL DEFAULT '',
        car        VARCHAR(191) NOT NULL DEFAULT '',
        spec       VARCHAR(191) NOT NULL DEFAULT '',
        email      VARCHAR(191) NOT NULL DEFAULT '',
        active     TINYINT(1)   NOT NULL DEFAULT 1,
        created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_role(role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `services`(
        id         VARCHAR(32)  NOT NULL PRIMARY KEY,
        icon       VARCHAR(16)  NOT NULL DEFAULT '',
        name       VARCHAR(191) NOT NULL DEFAULT '',
        cat        VARCHAR(64)  NOT NULL DEFAULT 'electrical',
        base_price INT UNSIGNED NOT NULL DEFAULT 0,
        avg_time   VARCHAR(64)  NOT NULL DEFAULT '',
        active     TINYINT(1)   NOT NULL DEFAULT 1,
        sort       INT          NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `masters`(
        id       VARCHAR(32)  NOT NULL PRIMARY KEY,
        user_id  BIGINT UNSIGNED NULL,
        user_phone VARCHAR(20)  NOT NULL DEFAULT '',
        name     VARCHAR(191) NOT NULL DEFAULT '',
        phone    VARCHAR(20)  NOT NULL DEFAULT '',
        initials VARCHAR(16)  NOT NULL DEFAULT '',
        color    VARCHAR(16)  NOT NULL DEFAULT '#34d399',
        spec     VARCHAR(191) NOT NULL DEFAULT '',
        active   TINYINT(1)   NOT NULL DEFAULT 1,
        sto_id   VARCHAR(64) NOT NULL DEFAULT '',
        sto_name VARCHAR(191) NOT NULL DEFAULT '',
        INDEX idx_user_id(user_id),
        INDEX idx_phone(phone),
        INDEX idx_user_phone(user_phone)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `sto_profiles`(
        id           VARCHAR(64)  NOT NULL PRIMARY KEY,
        user_id      BIGINT UNSIGNED NULL,
        user_phone   VARCHAR(20)  NOT NULL DEFAULT '',
        name         VARCHAR(191) NOT NULL DEFAULT '',
        contact_phone VARCHAR(20) NOT NULL DEFAULT '',
        country_code VARCHAR(8)   NOT NULL DEFAULT 'KZ',
        city         VARCHAR(120) NOT NULL DEFAULT '',
        address      VARCHAR(255) NOT NULL DEFAULT '',
        work_hours   VARCHAR(191) NOT NULL DEFAULT '',
        reception_status VARCHAR(24) NOT NULL DEFAULT 'open',
        active       TINYINT(1)   NOT NULL DEFAULT 1,
        created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_id(user_id),
        INDEX idx_city(city),
        UNIQUE KEY uq_user_phone(user_phone)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    try { kareta_ensure_column($pdo, 'sto_profiles', 'reception_status', "ALTER TABLE `sto_profiles` ADD COLUMN `reception_status` VARCHAR(24) NOT NULL DEFAULT 'open' AFTER `work_hours`"); } catch (Throwable $_) {}

    $pdo->exec("CREATE TABLE IF NOT EXISTS `sto_master_links`(
        sto_id      VARCHAR(64) NOT NULL,
        master_id   VARCHAR(64) NOT NULL,
        status      VARCHAR(24) NOT NULL DEFAULT 'active',
        invited_at  TIMESTAMP NULL DEFAULT NULL,
        accepted_at TIMESTAMP NULL DEFAULT NULL,
        updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (sto_id, master_id),
        INDEX idx_master_id(master_id),
        INDEX idx_status(status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `clients`(
        id           VARCHAR(64)  NOT NULL PRIMARY KEY,
        user_id      BIGINT UNSIGNED NULL,
        user_phone   VARCHAR(20)  NOT NULL DEFAULT '',
        name         VARCHAR(191) NOT NULL DEFAULT '',
        phone        VARCHAR(20)  NOT NULL DEFAULT '',
        car          VARCHAR(191) NOT NULL DEFAULT '',
        notes        TEXT,
        orders_count INT UNSIGNED NOT NULL DEFAULT 0,
        total_spent  INT UNSIGNED NOT NULL DEFAULT 0,
        created_at   DATE         NOT NULL,
        INDEX idx_user_id(user_id),
        INDEX idx_phone(phone),
        INDEX idx_user_phone(user_phone)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `client_vehicles`(
        id            VARCHAR(64)  NOT NULL PRIMARY KEY,
        user_id       BIGINT UNSIGNED NULL,
        user_phone    VARCHAR(20)  NOT NULL DEFAULT '',
        client_id     VARCHAR(64)  NOT NULL DEFAULT '',
        title         VARCHAR(191) NOT NULL DEFAULT '',
        brand         VARCHAR(80)  NOT NULL DEFAULT '',
        model         VARCHAR(80)  NOT NULL DEFAULT '',
        year_label    VARCHAR(16)  NOT NULL DEFAULT '',
        plate         VARCHAR(32)  NOT NULL DEFAULT '',
        vin           VARCHAR(64)  NOT NULL DEFAULT '',
        color         VARCHAR(32)  NOT NULL DEFAULT '',
        icon          VARCHAR(8)   NOT NULL DEFAULT '🚗',
        note          VARCHAR(255) NOT NULL DEFAULT '',
        is_default    TINYINT(1)   NOT NULL DEFAULT 0,
        active        TINYINT(1)   NOT NULL DEFAULT 1,
        created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_cv_user_id(user_id),
        INDEX idx_cv_phone(user_phone),
        INDEX idx_cv_client_id(client_id),
        INDEX idx_cv_default(is_default),
        INDEX idx_cv_active(active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `orders`(
        id            VARCHAR(16)  NOT NULL PRIMARY KEY,
        num           INT UNSIGNED NOT NULL DEFAULT 0,
        status        VARCHAR(32)  NOT NULL DEFAULT 'new',
        priority      VARCHAR(32)  NOT NULL DEFAULT 'normal',
        category      VARCHAR(64)  NOT NULL DEFAULT 'service',
        source        VARCHAR(64)  NOT NULL DEFAULT '',
        type          VARCHAR(32)  NOT NULL DEFAULT 'service_order',
        deferred      TINYINT(1)   NOT NULL DEFAULT 0,
        client_id     VARCHAR(64)  NOT NULL DEFAULT '',
        client_user_id BIGINT UNSIGNED NULL,
        client_vehicle_id VARCHAR(64) NULL,
        vehicle_title VARCHAR(191) NOT NULL DEFAULT '',
        client_name   VARCHAR(191) NOT NULL DEFAULT '',
        client_phone  VARCHAR(20)  NOT NULL DEFAULT '',
        client_car    VARCHAR(191) NOT NULL DEFAULT '',
        master_id     VARCHAR(32)  NULL,
        master_user_id BIGINT UNSIGNED NULL,
        assigned_admin_user_id BIGINT UNSIGNED NULL,
        master_name   VARCHAR(191) NOT NULL DEFAULT '—',
        service_ids   JSON         NULL,
        service_names VARCHAR(500) NOT NULL DEFAULT '',
        price         INT UNSIGNED NOT NULL DEFAULT 0,
        date          VARCHAR(32)  NOT NULL DEFAULT '',
        time          VARCHAR(16)  NOT NULL DEFAULT '',
        time_mode     VARCHAR(16)  NOT NULL DEFAULT 'exact',
        notes         TEXT,
        stages        JSON         NULL,
        reports       JSON         NULL,
        created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at  TIMESTAMP    NULL,
        INDEX idx_status(status),
        INDEX idx_type_status(type,status),
        INDEX idx_type_deferred_status(type,deferred,status),
        INDEX idx_master(master_id),
        INDEX idx_client_id(client_id),
        INDEX idx_client_user_id(client_user_id),
        INDEX idx_client_vehicle_id(client_vehicle_id),
        INDEX idx_master_user_id(master_user_id),
        INDEX idx_assigned_admin_user_id(assigned_admin_user_id),
        INDEX idx_client_phone(client_phone),
        INDEX idx_created(created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    try { $pdo->exec("ALTER TABLE `orders` ADD COLUMN `category` VARCHAR(64) NOT NULL DEFAULT 'service' AFTER `priority`"); } catch (Throwable $_e) {}
    try { $pdo->exec("ALTER TABLE `orders` ADD COLUMN `source` VARCHAR(64) NOT NULL DEFAULT '' AFTER `category`"); } catch (Throwable $_e) {}
    try { $pdo->exec("ALTER TABLE `orders` ADD COLUMN `client_vehicle_id` VARCHAR(64) NULL AFTER `client_user_id`"); } catch (Throwable $_e) {}
    try { $pdo->exec("ALTER TABLE `orders` ADD COLUMN `vehicle_title` VARCHAR(191) NOT NULL DEFAULT '' AFTER `client_vehicle_id`"); } catch (Throwable $_e) {}
    try { $pdo->exec("ALTER TABLE `orders` ADD INDEX `idx_client_vehicle_id` (`client_vehicle_id`)"); } catch (Throwable $_e) {}
    try { $pdo->exec("ALTER TABLE `orders` ADD COLUMN `time_mode` VARCHAR(16) NOT NULL DEFAULT 'exact' AFTER `time`"); } catch (Throwable $_e) {}
    // Legacy vehicle generation text is part of the existing vehicle DTO and is
    // a prerequisite for migration 144, which adds generation_id AFTER generation.
    // Keep this pre-migration bridge idempotent for both fresh and older databases.
    try { $pdo->exec("ALTER TABLE `client_vehicles` ADD COLUMN `generation` VARCHAR(64) NULL DEFAULT NULL AFTER `year_label`"); } catch (Throwable $_e) {}
    try { $pdo->exec("ALTER TABLE `client_vehicles` ADD COLUMN `mileage_km` INT NOT NULL DEFAULT 0 AFTER `note`"); } catch (Throwable $_e) {}
    try { $pdo->exec("ALTER TABLE `client_vehicles` ADD COLUMN `service_at` DATETIME NULL AFTER `mileage_km`"); } catch (Throwable $_e) {}
    try { $pdo->exec("ALTER TABLE `client_vehicles` ADD COLUMN `service_note` VARCHAR(191) NOT NULL DEFAULT '' AFTER `service_at`"); } catch (Throwable $_e) {}

    $pdo->exec("CREATE TABLE IF NOT EXISTS `master_schedules`(
        `id` VARCHAR(64) NOT NULL PRIMARY KEY,
        `master_id` VARCHAR(64) NOT NULL,
        `work_date` DATE NOT NULL,
        `start_time` TIME NULL,
        `end_time` TIME NULL,
        `is_day_off` TINYINT(1) NOT NULL DEFAULT 0,
        `note` VARCHAR(191) NOT NULL DEFAULT '',
        `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY `uniq_master_work_date` (`master_id`,`work_date`),
        KEY `idx_master_work_date` (`master_id`,`work_date`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `shops`(
        id          VARCHAR(64)  NOT NULL PRIMARY KEY,
        master_id   VARCHAR(32)  NOT NULL,
        master_name VARCHAR(191) NOT NULL DEFAULT '',
        name        VARCHAR(191) NOT NULL DEFAULT '',
        `desc`      TEXT,
        active      TINYINT(1)   NOT NULL DEFAULT 1,
        created_at  DATE         NOT NULL,
        INDEX idx_master(master_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `parts_catalog`(
        id          VARCHAR(64)  NOT NULL PRIMARY KEY,
        cat         VARCHAR(64)  NOT NULL DEFAULT 'electrical',
        name        VARCHAR(191) NOT NULL DEFAULT '',
        sku         VARCHAR(64)  NOT NULL DEFAULT '',
        price_label VARCHAR(64)  NOT NULL DEFAULT '',
        stock       VARCHAR(64)  NOT NULL DEFAULT '',
        note        VARCHAR(500) NOT NULL DEFAULT '',
        sort        INT          NOT NULL DEFAULT 0,
        active      TINYINT(1)   NOT NULL DEFAULT 1,
        created_at  DATE         NOT NULL,
        UNIQUE KEY uq_parts_catalog_sku(sku),
        INDEX idx_parts_catalog_cat_active_sort(cat,active,sort)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `shop_parts`(
        id         VARCHAR(64)  NOT NULL PRIMARY KEY,
        shop_id    VARCHAR(64)  NOT NULL,
        master_id  VARCHAR(32)  NOT NULL,
        name       VARCHAR(191) NOT NULL DEFAULT '',
        sku        VARCHAR(64)  NOT NULL DEFAULT '',
        cat        VARCHAR(32)  NOT NULL DEFAULT 'other',
        price      INT UNSIGNED NOT NULL DEFAULT 0,
        stock      TINYINT(1)   NOT NULL DEFAULT 1,
        stock_qty  INT          NOT NULL DEFAULT 0,
        note       VARCHAR(500) NOT NULL DEFAULT '',
        img        TEXT         NULL,
        created_at DATE         NOT NULL,
        INDEX idx_shop(shop_id),
        INDEX idx_master(master_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `chats`(
        id            VARCHAR(64)  NOT NULL PRIMARY KEY,
        order_id      VARCHAR(16)  NOT NULL DEFAULT '',
        client_id     VARCHAR(64)  NOT NULL DEFAULT '',
        client_user_id BIGINT UNSIGNED NULL,
        client_name   VARCHAR(191) NOT NULL DEFAULT '',
        client_phone  VARCHAR(20)  NOT NULL DEFAULT '',
        client_init   VARCHAR(8)   NOT NULL DEFAULT '',
        master_id     VARCHAR(32)  NULL,
        master_user_id BIGINT UNSIGNED NULL,
        assigned_admin_user_id BIGINT UNSIGNED NULL,
        master_name   VARCHAR(191) NOT NULL DEFAULT '',
        master_init   VARCHAR(8)   NOT NULL DEFAULT '',
        order_title   VARCHAR(500) NOT NULL DEFAULT '',
        car           VARCHAR(191) NOT NULL DEFAULT '',
        status        VARCHAR(32)  NOT NULL DEFAULT 'new',
        unread_client SMALLINT     NOT NULL DEFAULT 0,
        unread_master SMALLINT     NOT NULL DEFAULT 0,
        unread_admin  SMALLINT     NOT NULL DEFAULT 0,
        created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_order(order_id),
        INDEX idx_phone(client_phone),
        INDEX idx_master(master_id),
        INDEX idx_client_user_id(client_user_id),
        INDEX idx_master_user_id(master_user_id),
        INDEX idx_assigned_admin_user_id(assigned_admin_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    try { $pdo->exec("ALTER TABLE `chats` ADD COLUMN `chat_type` VARCHAR(24) NOT NULL DEFAULT 'order' AFTER `id`"); } catch (Throwable $_) {}
    try { $pdo->exec("ALTER TABLE `chats` ADD COLUMN `title` VARCHAR(191) NOT NULL DEFAULT '' AFTER `chat_type`"); } catch (Throwable $_) {}
    $pdo->exec("CREATE TABLE IF NOT EXISTS `chat_participants`(
        chat_id VARCHAR(64) NOT NULL, user_id BIGINT UNSIGNED NOT NULL, role VARCHAR(32) NOT NULL,
        unread_count INT UNSIGNED NOT NULL DEFAULT 0, joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_read_at DATETIME NULL, left_at DATETIME NULL,
        PRIMARY KEY(chat_id,user_id), INDEX idx_cp_user(user_id,left_at), INDEX idx_cp_chat(chat_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `messages`(
        id          VARCHAR(64)  NOT NULL PRIMARY KEY,
        chat_id     VARCHAR(64)  NOT NULL,
        order_id    VARCHAR(16)  NOT NULL DEFAULT '',
        from_role   VARCHAR(32)  NOT NULL DEFAULT 'system',
        author_user_id BIGINT UNSIGNED NULL,
        type        VARCHAR(32)  NOT NULL DEFAULT 'text',
        text        TEXT,
        file_name   VARCHAR(255) NULL,
        file_type   VARCHAR(64)  NULL,
        file_data   MEDIUMTEXT   NULL,
        meta        JSON         NULL,
        time        VARCHAR(32)  NOT NULL DEFAULT '',
        created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_chat(chat_id),
        INDEX idx_order_id(order_id),
        INDEX idx_author_user_id(author_user_id),
        INDEX idx_created(created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `notifications`(
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        recipient_user_id BIGINT UNSIGNED NULL,
        recipient_phone VARCHAR(20) NOT NULL DEFAULT '',
        recipient_role VARCHAR(32) NOT NULL DEFAULT '',
        event_type VARCHAR(64) NOT NULL DEFAULT '',
        entity_type VARCHAR(32) NOT NULL DEFAULT '',
        entity_id VARCHAR(64) NOT NULL DEFAULT '',
        title VARCHAR(191) NOT NULL DEFAULT '',
        body TEXT NULL,
        action_url VARCHAR(255) NOT NULL DEFAULT '',
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        read_at TIMESTAMP NULL,
        meta JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_recipient_user_id(recipient_user_id),
        INDEX idx_recipient_phone(recipient_phone),
        INDEX idx_recipient_role_read(recipient_role,is_read,created_at),
        INDEX idx_entity(entity_type,entity_id),
        INDEX idx_created(created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");


    $pdo->exec("CREATE TABLE IF NOT EXISTS `master_wall_posts`(
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        master_id VARCHAR(64) NOT NULL DEFAULT '',
        master_user_id BIGINT UNSIGNED NULL,
        master_name VARCHAR(191) NOT NULL DEFAULT '',
        order_id VARCHAR(32) NOT NULL DEFAULT '',
        post_type VARCHAR(32) NOT NULL DEFAULT 'note',
        stage_code VARCHAR(32) NOT NULL DEFAULT '',
        category VARCHAR(64) NULL DEFAULT 'repair_story',
        preview TEXT NULL,
        title VARCHAR(191) NOT NULL DEFAULT '',
        text MEDIUMTEXT NULL,
        links_json JSON NULL,
        photos_json JSON NULL,
        files_json JSON NULL,
        steps_json JSON NULL,
        parts_json JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        active TINYINT(1) NOT NULL DEFAULT 1,
        INDEX idx_master_wall_master_id(master_id),
        INDEX idx_master_wall_master_user_id(master_user_id),
        INDEX idx_master_wall_order_id(order_id),
        INDEX idx_master_wall_active_created(active,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `audit_log`(
        id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        action      VARCHAR(64)  NOT NULL,
        actor_user_id BIGINT UNSIGNED NULL,
        actor_phone VARCHAR(20)  NOT NULL DEFAULT '',
        actor_role  VARCHAR(32)  NOT NULL DEFAULT '',
        actor_name  VARCHAR(191) NOT NULL DEFAULT '',
        meta        JSON         NULL,
        created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_action(action),
        INDEX idx_actor_user_id(actor_user_id),
        INDEX idx_created(created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `system_logs`(
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        level VARCHAR(16) NOT NULL DEFAULT 'info',
        channel VARCHAR(64) NOT NULL DEFAULT 'system',
        message TEXT NOT NULL,
        context JSON NULL,
        actor_user_id BIGINT UNSIGNED NULL,
        actor_phone VARCHAR(20) NOT NULL DEFAULT '',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_level(level),
        INDEX idx_channel(channel),
        INDEX idx_actor_user_id(actor_user_id),
        INDEX idx_created(created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `user_stats`(
        user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
        phone VARCHAR(20) NOT NULL DEFAULT '',
        role VARCHAR(32) NOT NULL DEFAULT 'client',
        orders_created INT UNSIGNED NOT NULL DEFAULT 0,
        orders_assigned INT UNSIGNED NOT NULL DEFAULT 0,
        orders_completed INT UNSIGNED NOT NULL DEFAULT 0,
        chats_total INT UNSIGNED NOT NULL DEFAULT 0,
        messages_sent INT UNSIGNED NOT NULL DEFAULT 0,
        audit_events INT UNSIGNED NOT NULL DEFAULT 0,
        last_order_at TIMESTAMP NULL,
        last_chat_at TIMESTAMP NULL,
        last_message_at TIMESTAMP NULL,
        last_audit_at TIMESTAMP NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_stats_phone(phone),
        KEY idx_user_stats_role(role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}


function kareta_seed_users_registry(): array
{
    if (!defined('KARETA_DEMO_SEED') || !KARETA_DEMO_SEED) return [];
    return [
        ['phone'=>'+7 700 000 0001','role'=>'client'],
        ['phone'=>'+7 700 000 0002','role'=>'master'],
        ['phone'=>'+7 702 555 00 99','role'=>'master'],
    ];
}

function kareta_seed_role_for_phone(string $phone): string
{
    $norm = kareta_normalize_phone($phone);
    if ($norm === '') return 'client';
    foreach (kareta_seed_users_registry() as $row) {
        if (kareta_normalize_phone((string)($row['phone'] ?? '')) === $norm) {
            $role = (string)($row['role'] ?? 'client');
            return in_array($role, ['client','master','sto','seller','admin','owner'], true) ? $role : 'client';
        }
    }
    return 'client';
}

/* ── Seed данных ─────────────────────────────────────────────────────── */
function kareta_seed(PDO $pdo): void
{
    if (!defined('KARETA_DEMO_SEED') || !KARETA_DEMO_SEED) return;
    // users
    $u = $pdo->prepare("INSERT INTO `users`(phone,name,role,initials,car,spec,email) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `role`=VALUES(`role`), `initials`=VALUES(`initials`), `car`=VALUES(`car`), `spec`=VALUES(`spec`), `email`=VALUES(`email`), `active`=1");
    foreach ([
        ['+7 700 000 0001','Алексей Иванов','client','АИ','Toyota Camry 2018','',''],
        ['+7 700 000 0002','Артём Сергеев','master','АС','','Генераторы, стартеры',''],
        ['+7 702 555 00 99','Руслан Касымов','master','РК','','Сигнализации, проводка',''],
    ] as $r) $u->execute($r);

    // services
    $sv = $pdo->prepare("INSERT INTO `services`(id,icon,name,cat,base_price,avg_time,sort) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE `icon`=VALUES(`icon`), `name`=VALUES(`name`), `cat`=VALUES(`cat`), `base_price`=VALUES(`base_price`), `avg_time`=VALUES(`avg_time`), `sort`=VALUES(`sort`), `active`=1");
    foreach ([
        ['gen','⚡','Ремонт генератора','electrical',8000,'1–3 ч',0],
        ['start','🔧','Ремонт стартера','electrical',6000,'1–3 ч',1],
        ['wire','🔌','Ремонт проводки','electrical',5000,'2–5 ч',2],
        ['alarm','🔒','Установка сигнализации','security',18000,'2–4 ч',3],
        ['diag','🔍','Диагностика','electrical',3000,'30 мин',4],
        ['diode','⚡','Замена диодного моста','electrical',5000,'1–2 ч',5],
        ['brush','⚡','Замена щёток','electrical',3500,'1 ч',6],
        ['reg','⚡','Замена регулятора','electrical',4000,'1 ч',7],
    ] as $r) $sv->execute($r);

    // masters
    $ms = $pdo->prepare("INSERT INTO `masters`(id,user_id,user_phone,name,phone,initials,color,spec) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE `user_id`=VALUES(`user_id`), `user_phone`=VALUES(`user_phone`), `name`=VALUES(`name`), `phone`=VALUES(`phone`), `initials`=VALUES(`initials`), `color`=VALUES(`color`), `spec`=VALUES(`spec`), `active`=1");
    $uidMaster1 = kareta_user_id_by_phone($pdo, '+7 700 000 0002');
    $uidMaster2 = kareta_user_id_by_phone($pdo, '+7 702 555 00 99');
    $ms->execute(['ms_001',$uidMaster1 ?: null,'+7 700 000 0002','Артём Сергеев','+7 700 000 0002','АС','#34d399','Генераторы, стартеры']);
    $ms->execute(['ms_002',$uidMaster2 ?: null,'+7 702 555 00 99','Руслан Касымов','+7 702 555 00 99','РК','#60a5fa','Сигнализации, проводка']);

    // clients
    $cl = $pdo->prepare("INSERT INTO `clients`(id,user_id,user_phone,name,phone,car,orders_count,total_spent,created_at) VALUES(?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE `user_id`=VALUES(`user_id`), `user_phone`=VALUES(`user_phone`), `name`=VALUES(`name`), `phone`=VALUES(`phone`), `car`=VALUES(`car`), `orders_count`=GREATEST(`orders_count`, VALUES(`orders_count`)), `total_spent`=GREATEST(`total_spent`, VALUES(`total_spent`)), `created_at`=LEAST(`created_at`, VALUES(`created_at`))");
    foreach ([
        ['cl_001', (kareta_user_id_by_phone($pdo, '+7 700 000 0001') ?: null), '+7 700 000 0001', 'Алексей Иванов', '+7 700 000 0001', 'Toyota Camry 2018', 3, 26000, '2024-10-01'],
        ['cl_002', null, '+7 701 987 65 43', 'Марина Дова', '+7 701 987 65 43', 'Hyundai Sonata 2019', 1, 18000, '2025-01-15'],
        ['cl_003', null, '+7 702 555 11 22', 'Нурлан Асан', '+7 702 555 11 22', 'Kia Sportage 2020', 2, 9500, '2025-02-01'],
        ['cl_004', null, '+7 705 333 44 55', 'Дмитрий Волков', '+7 705 333 44 55', 'BMW 3 Series 2017', 1, 3000, '2025-02-10'],
        ['cl_005', null, '+7 707 222 33 44', 'Светлана Жук', '+7 707 222 33 44', 'Volkswagen Polo 2021', 1, 12000, '2025-03-01'],
        ['cl_006', null, '+7 778 444 55 66', 'Руслан Тасов', '+7 778 444 55 66', 'Mazda 6 2016', 1, 0, '2025-03-05'],
    ] as $r) $cl->execute($r);

    // orders
    $ord = $pdo->prepare("INSERT IGNORE INTO `orders`
        (id,num,status,priority,client_id,client_name,client_phone,client_car,
         master_id,master_name,service_ids,service_names,price,date,time,notes,
         stages,reports,created_at,completed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    $ord->execute(['ORD-042',42,'process','normal','cl_001','Алексей Иванов','+7 700 000 0001','Toyota Camry 2018',
        'ms_001','Артём Сергеев','["diag","gen"]','Диагностика, Ремонт генератора',11000,'2025-03-10','10:00','Не заряжает АКБ',
        '[{"id":"accepted","icon":"📝","label":"Заявка принята","doneAt":"2025-03-10T09:30:00"},{"id":"started","icon":"🔧","label":"Диагностика начата","doneAt":"2025-03-10T10:05:00"}]',
        '[{"id":"stable","text":"Окисление клемм АКБ. Очистка выполнена.","parts":"","nextStep":"Продолжение ремонта","masterName":"Артём С.","createdAt":"2025-03-10T11:00:00"}]',
        '2025-03-10 09:00:00',null]);
    $ord->execute(['ORD-041',41,'new','high','cl_002','Марина Дова','+7 701 987 65 43','Hyundai Sonata 2019',
        'ms_002','Руслан Касымов','["alarm"]','Установка сигнализации',18000,'2025-03-10','12:00','Starline A93 с автозапуском',
        '[]','[]','2025-03-10 08:00:00',null]);
    $ord->execute(['ORD-040',40,'done','normal','cl_003','Нурлан Асан','+7 702 555 11 22','Kia Sportage 2020',
        'ms_001','Артём Сергеев','["start"]','Ремонт стартера',6500,'2025-03-09','14:00','',
        '[{"id":"accepted","icon":"📝","label":"Заявка принята","doneAt":"2025-03-09T13:15:00"},{"id":"done","icon":"✅","label":"Работа завершена","doneAt":"2025-03-09T17:00:00"}]',
        '[{"id":"stable","text":"Бендикс заменён.","parts":"Бендикс STA-001","nextStep":"Готово","masterName":"Артём С.","createdAt":"2025-03-09T16:30:00"}]',
        '2025-03-09 13:00:00','2025-03-09 17:00:00']);
    $ord->execute(['ORD-039',39,'done','normal','cl_004','Дмитрий Волков','+7 705 333 44 55','BMW 3 Series 2017',
        'ms_001','Артём Сергеев','["diag","wire"]','Диагностика, Ремонт проводки',8000,'2025-03-09','11:00','',
        '[{"id":"done","icon":"✅","label":"Работа завершена","doneAt":"2025-03-09T13:30:00"}]',
        '[]','2025-03-09 10:00:00','2025-03-09 13:30:00']);
    $ord->execute(['ORD-038',38,'done','normal','cl_005','Светлана Жук','+7 707 222 33 44','Volkswagen Polo 2021',
        'ms_002','Руслан Касымов','["wire"]','Ремонт проводки',12000,'2025-03-08','15:00','',
        '[{"id":"done","icon":"✅","label":"Завершено","doneAt":"2025-03-08T19:00:00"}]',
        '[]','2025-03-08 14:00:00','2025-03-08 19:00:00']);
    $ord->execute(['ORD-037',37,'cancelled','normal','cl_006','Руслан Тасов','+7 778 444 55 66','Mazda 6 2016',
        null,'—','["brush"]','Замена щёток генератора',3500,'2025-03-07','10:00','Клиент не приехал',
        '[]','[]','2025-03-07 09:00:00',null]);

    // shops
    $sh = $pdo->prepare("INSERT INTO `shops`(id,master_id,master_name,name,`desc`,created_at) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE `master_id`=VALUES(`master_id`), `master_name`=VALUES(`master_name`), `name`=VALUES(`name`), `desc`=VALUES(`desc`), `active`=1");
    $sh->execute(['shop_ms_001','ms_001','Артём Сергеев','Запчасти от Артёма','Оригинальные запчасти для генераторов и стартеров','2025-01-10']);
    $sh->execute(['shop_ms_002','ms_002','Руслан Касымов','Сигнализации и проводка','Охранные системы Starline.','2025-02-01']);

    // shop_parts
    $pt = $pdo->prepare("INSERT INTO `shop_parts`(id,shop_id,master_id,name,sku,cat,price,stock,stock_qty,note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE `shop_id`=VALUES(`shop_id`), `master_id`=VALUES(`master_id`), `name`=VALUES(`name`), `sku`=VALUES(`sku`), `cat`=VALUES(`cat`), `price`=VALUES(`price`), `stock`=VALUES(`stock`), `stock_qty`=VALUES(`stock_qty`), `note`=VALUES(`note`), `created_at`=VALUES(`created_at`)");
    foreach ([
        ['sp_001','shop_ms_001','ms_001','Щётки генератора (пара)','GEN-001','gen',900,1,15,'Подбор по марке авто','2025-01-10'],
        ['sp_002','shop_ms_001','ms_001','Диодный мост генератора','GEN-002','gen',4500,1,8,'','2025-01-10'],
        ['sp_003','shop_ms_001','ms_001','Регулятор напряжения','GEN-003','gen',2200,1,10,'','2025-01-10'],
        ['sp_004','shop_ms_001','ms_001','Подшипник генератора передний','GEN-004','gen',1200,1,20,'','2025-01-10'],
        ['sp_005','shop_ms_001','ms_001','Бендикс стартера','STA-001','start',3200,1,6,'','2025-01-12'],
        ['sp_006','shop_ms_001','ms_001','Втягивающее реле стартера','STA-002','start',2800,0,0,'3–5 дней','2025-01-12'],
        ['sp_007','shop_ms_001','ms_001','Щётки коллектора стартера','STA-003','start',600,1,12,'','2025-01-15'],
        ['sp_101','shop_ms_002','ms_002','Starline A93 2CAN+2LIN','ALM-001','alarm',28000,1,3,'Установка включена','2025-02-01'],
        ['sp_102','shop_ms_002','ms_002','Starline A96 2CAN','ALM-002','alarm',22000,1,2,'С установкой','2025-02-01'],
        ['sp_103','shop_ms_002','ms_002','GPS-трекер FM001','ALM-003','alarm',12000,0,0,'+ подписка','2025-02-05'],
        ['sp_104','shop_ms_002','ms_002','Реле поворотов','WIR-001','wire',700,1,10,'','2025-02-10'],
        ['sp_105','shop_ms_002','ms_002','Предохранители (набор)','WIR-002','wire',350,1,25,'10–40А ассорти','2025-02-10'],
    ] as $r) $pt->execute($r);

    // chats
    $ch = $pdo->prepare("INSERT INTO `chats`
        (id,order_id,client_id,client_name,client_phone,client_init,master_id,master_name,master_init,order_title,car,status,unread_client,unread_master,unread_admin)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE `order_id`=VALUES(`order_id`), `client_id`=VALUES(`client_id`), `client_name`=VALUES(`client_name`), `client_phone`=VALUES(`client_phone`), `client_init`=VALUES(`client_init`), `master_id`=VALUES(`master_id`), `master_name`=VALUES(`master_name`), `master_init`=VALUES(`master_init`), `order_title`=VALUES(`order_title`), `car`=VALUES(`car`), `status`=VALUES(`status`)");
    $ch->execute(['ch_ord042','ORD-042','cl_001','Алексей Иванов','+7 700 000 0001','АИ','ms_001','Артём С.','АС','Диагностика, Ремонт генератора','Toyota Camry 2018','process',1,0,0]);
    $ch->execute(['ch_ord041','ORD-041','cl_002','Марина Дова','+7 701 987 65 43','МД','ms_002','Руслан К.','РК','Установка сигнализации','Hyundai Sonata 2019','new',0,1,1]);
    $ch->execute(['ch_ord040','ORD-040','cl_003','Нурлан Асан','+7 702 555 11 22','НА','ms_001','Артём С.','АС','Ремонт стартера','Kia Sportage 2020','done',0,0,0]);

    // messages
    $mg = $pdo->prepare("INSERT IGNORE INTO `messages`(id,chat_id,from_role,type,text,time,created_at) VALUES(?,?,?,?,?,?,?)");
    foreach ([
        ['m042_1','ch_ord042','system','event','Заявка ORD-042 создана','09:00','2025-03-10 09:00:00'],
        ['m042_2','ch_ord042','system','stage','Этап выполнен: Заявка принята','09:30','2025-03-10 09:30:00'],
        ['m042_3','ch_ord042','master','text','Здравствуйте! Принял заявку, готовлю стенд.','09:35','2025-03-10 09:35:00'],
        ['m042_4','ch_ord042','client','text','Здравствуйте! Когда примерно будет готово?','09:40','2025-03-10 09:40:00'],
        ['m042_5','ch_ord042','master','text','Примерно к 14:00.','09:42','2025-03-10 09:42:00'],
        ['m042_6','ch_ord042','system','stage','Этап выполнен: Диагностика начата','10:05','2025-03-10 10:05:00'],
        ['m042_7','ch_ord042','master','text','Нашёл окисленные клеммы.','10:20','2025-03-10 10:20:00'],
        ['m041_1','ch_ord041','system','event','Заявка ORD-041 создана','08:00','2025-03-10 08:00:00'],
        ['m041_2','ch_ord041','client','text','Starline A93 с автозапуском — подойдёт для Hyundai?','08:05','2025-03-10 08:05:00'],
        ['m040_1','ch_ord040','system','event','Заявка ORD-040 создана','13:00','2025-03-09 13:00:00'],
        ['m040_2','ch_ord040','master','text','Принял, приступаю к ремонту стартера.','14:10','2025-03-09 14:10:00'],
        ['m040_3','ch_ord040','master','text','Всё готово! Можно забирать.','17:05','2025-03-09 17:05:00'],
        ['m040_4','ch_ord040','client','text','Спасибо! Приеду после 16:00.','17:40','2025-03-09 17:40:00'],
        ['m040_5','ch_ord040','master','text','Ждём! Хорошей дороги 🚗','17:41','2025-03-09 17:41:00'],
    ] as $r) $mg->execute($r);
}

function kareta_ensure_core_seed_integrity(PDO $pdo): void
{
    static $done = false;
    if ($done) return;
    $done = true;

    kareta_seed($pdo);
    kareta_backfill_relations($pdo);
    kareta_rebuild_user_stats($pdo);
}

/* ── Auth / RBAC helpers ─────────────────────────────────────────────── */
function kareta_normalize_role(string $role): string
{
    $value = mb_strtolower(trim($role));
    $aliases = [
        'клиент' => 'client',
        'customer' => 'client',
        'user' => 'client',
        'мастер' => 'master',
        'mechanic' => 'master',
        'исполнитель' => 'master',
        'сто' => 'sto',
        'service' => 'sto',
        'service_station' => 'sto',
        'seller' => 'seller',
        'продавец' => 'seller',
        'administrator' => 'admin',
        'администратор' => 'admin',
        'владелец' => 'owner',
    ];
    $value = $aliases[$value] ?? $value;
    return in_array($value, ['guest','client','master','sto','seller','admin','owner'], true)
        ? $value
        : 'guest';
}

function kareta_infer_linked_role(PDO $pdo, array $user): ?string
{
    $userId = (int)($user['id'] ?? 0);
    $phone = kareta_normalize_phone((string)($user['phone'] ?? ''));
    if ($userId <= 0 && $phone === '') return null;

    $matches = [];
    $checks = [
        'master' => ['table'=>'masters', 'phoneColumns'=>['user_phone','phone']],
        'sto' => ['table'=>'sto_profiles', 'phoneColumns'=>['user_phone','contact_phone']],
        'seller' => ['table'=>'seller_profiles', 'phoneColumns'=>['user_phone','contact_phone']],
    ];
    foreach ($checks as $role => $meta) {
        if (!kareta_table_exists($pdo, $meta['table'])) continue;
        $conditions = [];
        $params = [];
        if ($userId > 0) {
            $conditions[] = '`user_id`=?';
            $params[] = $userId;
        }
        if ($phone !== '') {
            foreach ($meta['phoneColumns'] as $column) {
                $conditions[] = "`{$column}`=?";
                $params[] = $phone;
            }
        }
        if (!$conditions) continue;
        try {
            $st = $pdo->prepare("SELECT 1 FROM `{$meta['table']}` WHERE (" . implode(' OR ', $conditions) . ") AND COALESCE(`active`,1)=1 LIMIT 1");
            $st->execute($params);
            if ($st->fetchColumn()) $matches[] = $role;
        } catch (Throwable $e) {
        }
    }
    $matches = array_values(array_unique($matches));
    return count($matches) === 1 ? $matches[0] : null;
}

function kareta_refresh_session_user(?PDO $pdo = null): ?array
{
    $sessionUser = $_SESSION['kareta_user'] ?? null;
    if (!is_array($sessionUser)) return null;

    $sessionUser['role'] = kareta_normalize_role((string)($sessionUser['role'] ?? 'guest'));
    if (isset($sessionUser['entry_role'])) {
        $sessionUser['entry_role'] = kareta_normalize_role((string)$sessionUser['entry_role']);
    }

    $pdo = $pdo instanceof PDO ? $pdo : kareta_pdo();
    if ($pdo instanceof PDO) {
        try {
            $fresh = null;
            $userId = (int)($sessionUser['id'] ?? 0);
            $phone = kareta_normalize_phone((string)($sessionUser['phone'] ?? ''));
            if ($userId > 0) {
                $fresh = kareta_profile_by_id($pdo, $userId);
            }
            if (!$fresh && $phone !== '') {
                $fresh = kareta_profile_by_phone($pdo, $phone);
            }
            if (is_array($fresh)) {
                $fresh['role'] = kareta_normalize_role((string)($fresh['role'] ?? 'client'));
                $fresh['entry_role'] = kareta_normalize_role((string)($fresh['entry_role'] ?? $fresh['role']));
                if ((int)($fresh['active'] ?? 1) !== 1) return null;

                $sessionUser = array_replace($sessionUser, $fresh);
            }
        } catch (Throwable $e) {
            // Do not break a valid session when the database is temporarily unavailable.
        }
    }

    $_SESSION['kareta_user'] = $sessionUser;
    return $sessionUser;
}

function kareta_current_user(): ?array
{
    return kareta_refresh_session_user();
}

function kareta_session_user(): ?array
{
    return kareta_refresh_session_user();
}

function kareta_role_level(string $role): int
{
    $role = kareta_normalize_role($role);
    return [
        'guest' => 0,
        'client' => 1,
        'master' => 2,
        'sto' => 2,
        'seller' => 1,
        'admin' => 3,
        'owner' => 4,
    ][$role] ?? 0;
}

function kareta_has_role(string $role): bool
{
    $user = kareta_session_user();
    return $user ? kareta_role_level((string)($user['role'] ?? 'guest')) >= kareta_role_level($role) : false;
}

function kareta_has_exact_role(string $role): bool
{
    $user = kareta_session_user();
    if (!$user) return false;
    $current = kareta_normalize_role((string)($user['role'] ?? 'guest'));
    $required = kareta_normalize_role($role);
    return $current === $required || in_array($current, ['admin','owner'], true);
}

function kareta_require_exact_role(string $role): array
{
    $user = kareta_session_user();
    if (!$user || !kareta_has_exact_role($role)) {
        kareta_json(['ok'=>false,'error'=>'forbidden','needExactRole'=>$role], 403);
    }
    return $user;
}

function kareta_require_role(string $role): array
{
    $user = kareta_session_user();
    $required = kareta_normalize_role($role);
    $current = $user ? kareta_normalize_role((string)($user['role'] ?? 'guest')) : 'guest';

    // Role-bound endpoints must never rely on numeric role levels. Master and
    // STO are parallel roles, not an inheritance chain. Only admin/owner may
    // override a concrete application role.
    if (!$user || !($current === $required || in_array($current, ['admin','owner'], true))) {
        kareta_json([
            'ok' => false,
            'error' => 'forbidden',
            'needRole' => $required,
            'currentRole' => $current,
        ], 403);
    }
    return $user;
}

function kareta_require_any_role(array $roles): array
{
    $user = kareta_session_user();
    if (!$user) {
        kareta_json(['ok' => false, 'error' => 'forbidden', 'needRole' => $roles], 403);
    }
    $current = kareta_normalize_role((string)($user['role'] ?? 'guest'));
    $allowed = array_values(array_unique(array_map(static fn($role): string => kareta_normalize_role((string)$role), $roles)));
    if (in_array($current, $allowed, true) || in_array($current, ['admin','owner'], true)) {
        return $user;
    }
    kareta_json(['ok'=>false,'error'=>'forbidden','needRole'=>array_values($roles),'currentRole'=>$current,'userId'=>(int)($user['id']??0)],403);
}

function kareta_log_audit(?PDO $pdo, string $action, array $meta = []): void
{
    if (!$pdo instanceof PDO) return;
    $actor = kareta_session_user() ?? [];
    try {
        $pdo->prepare("INSERT INTO `audit_log`(action,actor_user_id,actor_phone,actor_role,actor_name,meta) VALUES(?,?,?,?,?,?)")
            ->execute([
                $action,
                (int)($actor['id'] ?? 0) ?: null,
                (string)($actor['phone'] ?? ''),
                (string)($actor['role'] ?? ''),
                (string)($actor['name'] ?? ''),
                $meta ? json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
            ]);
        kareta_rebuild_user_stats($pdo);
    } catch (Throwable $_e) {
    }
}

/* ── Profile helpers ─────────────────────────────────────────────────── */
function kareta_profile_by_phone(?PDO $pdo, string $phone): ?array
{
    if (!$pdo instanceof PDO) return null;
    $norm = kareta_normalize_phone($phone);
    if ($norm === '') return null;
    $st = $pdo->prepare("SELECT id,phone,name,role,entry_role,onboarding_stage,onboarded,onboarded_at,country_code,city,initials,car,spec,email,active FROM `users` WHERE phone=? LIMIT 1");
    $st->execute([$norm]);
    $row = $st->fetch();
    if (!$row) return null;
    return $row;
}

function kareta_profile_by_id(?PDO $pdo, int $id): ?array
{
    if (!$pdo instanceof PDO || $id <= 0) return null;
    $st = $pdo->prepare("SELECT id,phone,name,role,entry_role,onboarding_stage,onboarded,onboarded_at,country_code,city,initials,car,spec,email,active FROM `users` WHERE id=? LIMIT 1");
    $st->execute([$id]);
    $row = $st->fetch();
    return $row ?: null;
}


function kareta_upsert_seller_profile(?PDO $pdo, array $user, array $seller): ?array
{
    if (!$pdo instanceof PDO) return null;
    $userId = (int)($user['id'] ?? 0);
    $phone = kareta_normalize_phone((string)($user['phone'] ?? ''));
    if ($userId <= 0 || $phone === '') return null;
    $json = static function($value): string {
        return json_encode(is_array($value) ? array_values($value) : [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '[]';
    };
    $storeName = trim((string)($seller['storeName'] ?? $seller['store_name'] ?? $user['name'] ?? 'Магазин запчастей'));
    $bin = preg_replace('~\D+~', '', (string)($seller['binIin'] ?? $seller['bin_iin'] ?? '')) ?: '';
    $bin = substr($bin, 0, 12);
    $data = [
        'user_id'=>$userId, 'user_phone'=>$phone, 'store_name'=>$storeName ?: 'Магазин запчастей',
        'legal_name'=>trim((string)($seller['legalName'] ?? $seller['legal_name'] ?? '')), 'bin_iin'=>$bin,
        'contact_phone'=>$phone, 'email'=>trim((string)($seller['email'] ?? $user['email'] ?? '')),
        'country_code'=>strtoupper(trim((string)($user['country_code'] ?? 'KZ'))) ?: 'KZ',
        'city'=>trim((string)($user['city'] ?? '')), 'warehouse_address'=>trim((string)($seller['warehouseAddress'] ?? $seller['warehouse_address'] ?? '')),
        'description'=>trim((string)($seller['description'] ?? '')), 'assortment'=>trim((string)($seller['assortment'] ?? $user['spec'] ?? '')),
        'category_tags'=>$json($seller['categoryTags'] ?? $seller['category_tags'] ?? []), 'delivery_modes'=>$json($seller['deliveryModes'] ?? $seller['delivery_modes'] ?? []),
        'payment_methods'=>$json($seller['paymentMethods'] ?? $seller['payment_methods'] ?? []), 'minimum_order'=>trim((string)($seller['minimumOrder'] ?? $seller['minimum_order'] ?? '')),
        'return_days'=>max(0,min(30,(int)($seller['returnDays'] ?? $seller['return_days'] ?? 14))), 'return_policy'=>trim((string)($seller['returnPolicy'] ?? $seller['return_policy'] ?? '')), 'moderation_status'=>'pending', 'active'=>1,
    ];
    $pdo->prepare("INSERT INTO `seller_profiles` (`user_id`,`user_phone`,`store_name`,`legal_name`,`bin_iin`,`contact_phone`,`email`,`country_code`,`city`,`warehouse_address`,`description`,`assortment`,`category_tags`,`delivery_modes`,`payment_methods`,`minimum_order`,`return_days`,`return_policy`,`moderation_status`,`active`)
        VALUES (:user_id,:user_phone,:store_name,:legal_name,:bin_iin,:contact_phone,:email,:country_code,:city,:warehouse_address,:description,:assortment,:category_tags,:delivery_modes,:payment_methods,:minimum_order,:return_days,:return_policy,:moderation_status,:active)
        ON DUPLICATE KEY UPDATE `store_name`=VALUES(`store_name`),`legal_name`=VALUES(`legal_name`),`bin_iin`=VALUES(`bin_iin`),`contact_phone`=VALUES(`contact_phone`),`email`=VALUES(`email`),`country_code`=VALUES(`country_code`),`city`=VALUES(`city`),`warehouse_address`=VALUES(`warehouse_address`),`description`=VALUES(`description`),`assortment`=VALUES(`assortment`),`category_tags`=VALUES(`category_tags`),`delivery_modes`=VALUES(`delivery_modes`),`payment_methods`=VALUES(`payment_methods`),`minimum_order`=VALUES(`minimum_order`),`return_days`=VALUES(`return_days`),`return_policy`=VALUES(`return_policy`),`active`=1")
        ->execute($data);
    $st=$pdo->prepare("SELECT * FROM `seller_profiles` WHERE `user_id`=? LIMIT 1"); $st->execute([$userId]);
    $row=$st->fetch();
    foreach (['category_tags','delivery_modes','payment_methods'] as $field) { if ($row) $row[$field]=json_decode((string)($row[$field] ?? '[]'),true) ?: []; }
    return $row ?: null;
}

function kareta_upsert_profile(?PDO $pdo, array $profile): array
{
    $phone = kareta_normalize_phone((string)($profile['phone'] ?? ''));
    if ($phone === '') throw new InvalidArgumentException('Phone required');

    $existing = kareta_profile_by_phone($pdo, $phone) ?? [];
    $sessionUser = kareta_session_user();
    $canManage = $sessionUser && kareta_has_role('admin');

    $name     = trim((string)($profile['name'] ?? ($existing['name'] ?? 'Клиент')));
    $role     = (string)($existing['role'] ?? 'client');
    if (!$existing) $role = 'client';
    $requestedRole = trim((string)($profile['role'] ?? '')) ?: '';
    $requestedEntryRole = trim((string)($profile['entry_role'] ?? $requestedRole)) ?: '';
    if ($canManage && $requestedRole !== '') {
        if (kareta_role_level($requestedRole) < kareta_role_level((string)($sessionUser['role'] ?? 'guest'))) {
            $role = $requestedRole;
        }
    }
    $entryRole = (string)($existing['entry_role'] ?? $role);
    if ($requestedEntryRole !== '' && in_array($requestedEntryRole, ['client','master','sto','seller'], true)) {
        // entry_role records the requested interface only. users.role remains the
        // authoritative, moderated role used by RBAC and Identity contexts.
        if ($canManage || !$existing || $role === 'client') $entryRole = $requestedEntryRole;
    }
    if ($entryRole === '') $entryRole = $role;
    $initials = trim((string)($profile['initials'] ?? ($existing['initials'] ?? '')));
    $car      = trim((string)($profile['car'] ?? ($existing['car'] ?? '')));
    $spec     = trim((string)($profile['spec'] ?? ($existing['spec'] ?? '')));
    $email    = trim((string)($profile['email'] ?? ($existing['email'] ?? '')));
    $countryCode = strtoupper(trim((string)($profile['country_code'] ?? ($existing['country_code'] ?? 'KZ')))) ?: 'KZ';
    $city = trim((string)($profile['city'] ?? ($existing['city'] ?? '')));
    $active   = (int)($existing['active'] ?? 1);
    if ($canManage && array_key_exists('active', $profile)) {
        $active = (int)(bool)$profile['active'];
    }
    $onboardingStage = trim((string)($profile['onboarding_stage'] ?? ($existing['onboarding_stage'] ?? '')));
    $onboarded = (int)($existing['onboarded'] ?? 0);
    if (array_key_exists('onboarded', $profile)) {
        $onboarded = (int)(($profile['onboarded'] ?? false) ? 1 : 0);
    }
    if ($onboardingStage === '') {
        $onboardingStage = $onboarded ? 'done' : ($existing ? 'auth' : 'role');
    }
    if ($initials === '' && $name !== '') {
        $parts = preg_split('/\s+/u', $name, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $initials = mb_substr($parts[0] ?? '', 0, 1) . mb_substr($parts[1] ?? '', 0, 1);
    }
    $onboardedAt = ($existing['onboarded_at'] ?? null);
    if ($onboarded && !$onboardedAt) {
        $onboardedAt = date('Y-m-d H:i:s');
    }
    if (!$onboarded) {
        $onboardedAt = null;
    }
    $clean = [
        'phone' => $phone,
        'name' => $name,
        'role' => $role,
        'entry_role' => $entryRole,
        'onboarding_stage' => $onboardingStage,
        'onboarded' => $onboarded,
        'onboarded_at' => $onboardedAt,
        'country_code' => $countryCode,
        'city' => $city,
        'initials' => $initials,
        'car' => $car,
        'spec' => $spec,
        'email' => $email,
        'active' => $active,
    ];
    if (!$pdo instanceof PDO) return $clean;
    $pdo->prepare("INSERT INTO `users`(phone,name,role,entry_role,onboarding_stage,onboarded,onboarded_at,country_code,city,initials,car,spec,email,active)
                   VALUES(:phone,:name,:role,:entry_role,:onboarding_stage,:onboarded,:onboarded_at,:country_code,:city,:initials,:car,:spec,:email,:active)
                   ON DUPLICATE KEY UPDATE
                   name=VALUES(name),role=VALUES(role),entry_role=VALUES(entry_role),onboarding_stage=VALUES(onboarding_stage),onboarded=VALUES(onboarded),onboarded_at=VALUES(onboarded_at),country_code=VALUES(country_code),city=VALUES(city),initials=VALUES(initials),
                   car=VALUES(car),spec=VALUES(spec),email=VALUES(email),active=VALUES(active)")
        ->execute($clean);
    $saved = kareta_profile_by_phone($pdo, $phone) ?? $clean;
    if (!$canManage && in_array($requestedRole, ['master','sto','seller'], true) && $requestedRole !== (string)($saved['role'] ?? 'client')) {
        try {
            $pdo->prepare("INSERT INTO `role_applications`(user_id,requested_role,status,payload_json)
                           VALUES(?,?,'pending',?)
                           ON DUPLICATE KEY UPDATE payload_json=VALUES(payload_json),updated_at=CURRENT_TIMESTAMP")
                ->execute([(int)($saved['id'] ?? 0), $requestedRole, json_encode(['source'=>'onboarding'], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
        } catch (Throwable $error) {
            kareta_log_error('ROLE_APPLICATION', $error->getMessage());
        }
    }
    return $saved;
}
