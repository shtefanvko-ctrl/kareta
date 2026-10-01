<?php
declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('html_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('X-Content-Type-Options: nosniff');

$result = [
    'ok' => true,
    'version' => 'r84',
    'time' => gmdate('c'),
    'php' => PHP_VERSION,
    'checks' => [],
];

$check = static function (string $name, bool $ok, string $message = '', array $meta = []) use (&$result): void {
    $result['checks'][$name] = ['ok' => $ok, 'message' => $message] + $meta;
    if (!$ok && !($meta['advisory'] ?? false)) $result['ok'] = false;
};

try {
    $configFile = dirname(__DIR__) . '/config.php';
    if (!is_file($configFile)) {
        throw new RuntimeException('config.php is missing');
    }
    require $configFile;

    if (!defined('KARETA_DB') && !isset($GLOBALS['KARETA_DB']) && !isset($KARETA_DB)) {
        throw new RuntimeException('Database configuration is unavailable');
    }
    $db = defined('KARETA_DB') ? constant('KARETA_DB') : ($KARETA_DB ?? $GLOBALS['KARETA_DB'] ?? []);
    if (!is_array($db)) throw new RuntimeException('Invalid database configuration');

    $driverOk = class_exists('PDO') && in_array('mysql', PDO::getAvailableDrivers(), true);
    if (!$driverOk) throw new RuntimeException('pdo_mysql driver is unavailable');

    $host = (string)($db['host'] ?? 'localhost');
    $port = (int)($db['port'] ?? 3306);
    $name = (string)($db['database'] ?? $db['dbname'] ?? '');
    $charset = (string)($db['charset'] ?? 'utf8mb4');
    $socket = trim((string)($db['socket'] ?? ''));
    $user = (string)($db['username'] ?? $db['user'] ?? '');
    $pass = (string)($db['password'] ?? $db['pass'] ?? '');
    if ($name === '') throw new RuntimeException('Database name is empty');
    $dsn = $socket !== ''
        ? 'mysql:unix_socket=' . $socket . ';dbname=' . $name . ';charset=' . $charset
        : sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $host, $port, $name, $charset);

    // Health check deliberately does not load bootstrap.php: bootstrap performs schema
    // maintenance and content backfills, which must never run from a monitoring request.
    $pdo = new PDO(
        $dsn,
        $user,
        $pass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_TIMEOUT => max(1, min(3, (int)($db['connect_timeout'] ?? 2))),
        ]
    );
    $pdo->query('SELECT 1');
    $check('database', true, 'Соединение с БД установлено.');

    $requiredTables = ['users', 'orders'];
    $missing = [];
    foreach ($requiredTables as $table) {
        $quoted = $pdo->quote($table);
        $stmt = $pdo->query("SHOW TABLES LIKE {$quoted}");
        if (!$stmt || $stmt->fetchColumn() === false) $missing[] = $table;
    }
    $check('required_tables', $missing === [], $missing ? 'Не найдены базовые таблицы.' : 'Базовые таблицы доступны.', ['missing' => $missing]);
} catch (Throwable $e) {
    $check('database', false, 'Проверка БД временно недоступна.', ['error' => $e->getMessage(), 'advisory' => true]);
}

$check('php_compatibility', version_compare(PHP_VERSION, '8.1.0', '>='), 'Требуется PHP 8.1 или новее.', ['current' => PHP_VERSION, 'minimum' => '8.1.0']);

$root = dirname(__DIR__);
$requiredFiles = ['api/db.php','api/auth_session.php','inc/asset_registry.php','js/next/app_next.js','js/next/route_registry.js','css/next/app_next.css'];
$missingFiles = [];
foreach ($requiredFiles as $file) if (!is_file($root . '/' . $file)) $missingFiles[] = $file;
$check('runtime_files', $missingFiles === [], $missingFiles ? 'Отсутствуют runtime-файлы.' : 'Runtime-файлы доступны.', ['missing' => $missingFiles]);

// Diagnostic endpoint must never make the browser treat a healthy application as unavailable.
// Individual checks describe degraded components while transport remains HTTP 200.
$headerToken=trim((string)($_SERVER['HTTP_X_KARETA_DIAGNOSTICS_TOKEN']??''));
$configuredToken=defined('KARETA_DIAGNOSTICS_TOKEN')?trim((string)KARETA_DIAGNOSTICS_TOKEN):'';
$detailAuthorized=$configuredToken!==''&&strlen($configuredToken)>=32&&$headerToken!==''&&hash_equals($configuredToken,$headerToken);
if(!$detailAuthorized)$result=['ok'=>(bool)$result['ok'],'status'=>$result['ok']?'ready':'degraded','version'=>defined('KARETA_ASSET_VERSION')?KARETA_ASSET_VERSION:'','time'=>gmdate('c')];
http_response_code(200);
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
