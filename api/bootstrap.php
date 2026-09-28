<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/config.php';


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
$karetaTraceId = substr(trim((string)($_SERVER['HTTP_X_KARETA_TRACE_ID'] ?? '')), 0, 160);
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
header('Access-Control-Allow-Headers: Content-Type, X-Idempotency-Key, X-Request-Id');

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
        ['httpStatus' => $status, 'requestId' => defined('KARETA_REQUEST_ID') ? KARETA_REQUEST_ID : '', 'traceId' => substr(trim((string)($_SERVER['HTTP_X_KARETA_TRACE_ID'] ?? '')), 0, 160)]
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
    $dir = dirname(__DIR__) . '/storage/runtime'; // PLESK_SAFE_RUNTIME_V2
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
            kareta_db_set_failure_context('bootstrap.create_schema');
            kareta_create_schema($pdo);
            if (!defined('KARETA_DB_AUTO_MIGRATE') || KARETA_DB_AUTO_MIGRATE) {
                kareta_db_set_failure_context('bootstrap.migrate');
                kareta_migrate($pdo);
            }
            kareta_db_set_failure_context('bootstrap.ensure_schema.post_migration');
            kareta_ensure_schema_columns($pdo);
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
    $dir = dirname(__DIR__) . '/storage/runtime'; // PLESK_SAFE_RUNTIME_V2
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