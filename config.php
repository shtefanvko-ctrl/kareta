<?php
declare(strict_types=1);

if (!defined('KARETA_CONFIG_LOADED')) {
    define('KARETA_CONFIG_LOADED', true);

    date_default_timezone_set('Asia/Almaty');

    define('KARETA_ROOT',         __DIR__);
    define('KARETA_PUBLIC_ROOT',  KARETA_ROOT);
    define('KARETA_API_ROOT',     KARETA_ROOT . '/api');

    $kareta_private_config = [];
    $kareta_private_config_source = 'missing';
    $kareta_private_candidates = [];

    // A deployment may replace the public document root. Allow the secret
    // configuration to live outside it so full ZIP updates cannot delete it.
    $kareta_explicit_private_file = trim((string)($_ENV['KARETA_PRIVATE_CONFIG_FILE']
        ?? $_SERVER['KARETA_PRIVATE_CONFIG_FILE']
        ?? getenv('KARETA_PRIVATE_CONFIG_FILE')
        ?: ''));
    if ($kareta_explicit_private_file !== '') {
        $kareta_private_candidates[] = ['path'=>$kareta_explicit_private_file, 'source'=>'explicit_external_file'];
    }
    $kareta_private_candidates[] = ['path'=>KARETA_ROOT . '/config.private.php', 'source'=>'document_root_private_file'];
    $kareta_private_candidates[] = ['path'=>dirname(KARETA_ROOT) . '/config.private.php', 'source'=>'parent_private_file'];
    $kareta_private_candidates[] = ['path'=>dirname(KARETA_ROOT) . '/.kareta/config.private.php', 'source'=>'parent_kareta_private_file'];

    $kareta_seen_private_paths = [];
    foreach ($kareta_private_candidates as $kareta_private_candidate) {
        $candidatePath = trim((string)($kareta_private_candidate['path'] ?? ''));
        if ($candidatePath === '' || isset($kareta_seen_private_paths[$candidatePath])) continue;
        $kareta_seen_private_paths[$candidatePath] = true;
        if (!is_file($candidatePath) || !is_readable($candidatePath)) continue;
        $kareta_private_loaded = require $candidatePath;
        if (!is_array($kareta_private_loaded)) continue;
        $kareta_private_config = $kareta_private_loaded;
        $kareta_private_config_source = (string)($kareta_private_candidate['source'] ?? 'private_file');
        break;
    }
    define('KARETA_PRIVATE_CONFIG_LOADED', $kareta_private_config !== []);
    define('KARETA_PRIVATE_CONFIG_SOURCE', $kareta_private_config_source);

    if (!function_exists('kareta_env')) {
        function kareta_env(string $key, $default = null) {
            $value = $_ENV[$key] ?? $_SERVER[$key] ?? getenv($key);
            return ($value === false || $value === null || $value === '') ? $default : $value;
        }
    }

    if (!function_exists('kareta_private_config_value')) {
        function kareta_private_config_value(string $key, $default = null) {
            global $kareta_private_config;
            return is_array($kareta_private_config) && array_key_exists($key, $kareta_private_config)
                ? $kareta_private_config[$key]
                : $default;
        }
    }

    if (!function_exists('kareta_config_value')) {
        function kareta_config_value(string $envKey, string $privateKey, $default = null) {
            $private = kareta_private_config_value($privateKey, $default);
            return kareta_env($envKey, $private);
        }
    }

    if (!function_exists('kareta_env_first')) {
        function kareta_env_first(array $keys, $default = null) {
            foreach ($keys as $key) {
                $value = kareta_env((string)$key, null);
                if ($value !== null && $value !== '') return $value;
            }
            return $default;
        }
    }

    // Private uploads and logs must not be served by the public document root.
    // Production should set an absolute storage_root (for example /var/lib/kareta).
    $kareta_storage_root = rtrim(trim((string) kareta_config_value(
        'KARETA_STORAGE_ROOT',
        'storage_root',
        dirname(KARETA_ROOT) . '/kareta-storage'
    )), '/\\');
    if ($kareta_storage_root === '') $kareta_storage_root = dirname(KARETA_ROOT) . '/kareta-storage';

    /*
     * Plesk/open_basedir compatibility.
     * Some migrated installations still point storage_root at /var/lib/kareta,
     * while PHP is restricted to DOCROOT + /tmp. Detect that configuration
     * before any filesystem call so warnings cannot corrupt JSON responses.
     * storage/.htaccess denies direct HTTP access to this fallback directory.
     */
    $kareta_open_basedir = trim((string) ini_get('open_basedir'));
    if ($kareta_open_basedir !== '') {
        $candidate = str_replace('\\', '/', $kareta_storage_root);
        $allowed = false;
        foreach (explode(PATH_SEPARATOR, $kareta_open_basedir) as $base) {
            $base = rtrim(str_replace('\\', '/', trim($base)), '/');
            if ($base === '') continue;
            if ($candidate === $base || strpos($candidate . '/', $base . '/') === 0) {
                $allowed = true;
                break;
            }
        }
        if (!$allowed) {
            $kareta_storage_root = KARETA_ROOT . '/storage';
        }
    }

    define('KARETA_STORAGE_ROOT', $kareta_storage_root);
    define('KARETA_LOG_ROOT', KARETA_STORAGE_ROOT . '/logs');

    define('KARETA_APP', [
        'name'          => (string) kareta_config_value('KARETA_APP_NAME', 'app_name', 'KARETA.KZ'),
        'base_url'      => (string) kareta_config_value('KARETA_BASE_URL', 'base_url', '/'),
        'cookie_prefix' => (string) kareta_config_value('KARETA_COOKIE_PREFIX', 'cookie_prefix', 'kareta_'),
        'cookie_days'   => (int) kareta_config_value('KARETA_COOKIE_DAYS', 'cookie_days', 180),
        'session_name'  => (string) kareta_config_value('KARETA_SESSION_NAME', 'session_name', 'KARETASESSID'),
        'booking_phone' => (string) kareta_config_value('KARETA_BOOKING_PHONE', 'booking_phone', '+77072980649'),
    ]);

    // Public map tiles are loaded only after the user opens an inline map.
    // The URL is deployment-configurable so KARETA can move from the OSM
    // community service to a commercial/self-hosted provider without a code release.
    define('KARETA_GEO_MAP', [
        'tile_url' => (string) kareta_config_value(
            'KARETA_GEO_TILE_URL',
            'geo_tile_url',
            'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
        ),
        'attribution_label' => (string) kareta_config_value(
            'KARETA_GEO_ATTRIBUTION_LABEL',
            'geo_attribution_label',
            '© OpenStreetMap contributors'
        ),
        'attribution_url' => (string) kareta_config_value(
            'KARETA_GEO_ATTRIBUTION_URL',
            'geo_attribution_url',
            'https://www.openstreetmap.org/copyright'
        ),
        'min_zoom' => max(3, (int) kareta_config_value('KARETA_GEO_MIN_ZOOM', 'geo_min_zoom', 8)),
        'max_zoom' => min(19, (int) kareta_config_value('KARETA_GEO_MAX_ZOOM', 'geo_max_zoom', 17)),
        'default_zoom' => (int) kareta_config_value('KARETA_GEO_DEFAULT_ZOOM', 'geo_default_zoom', 13),
    ]);

    $kareta_db_host = kareta_config_value('KARETA_DB_HOST', 'db_host', null);
    if ($kareta_db_host === null || $kareta_db_host === '') {
        $kareta_db_host = kareta_env_first(['DB_HOST', 'MYSQL_HOST'], '127.0.0.1');
    }
    $kareta_db_port = kareta_config_value('KARETA_DB_PORT', 'db_port', null);
    if ($kareta_db_port === null || $kareta_db_port === '') {
        $kareta_db_port = kareta_env_first(['DB_PORT', 'MYSQL_PORT'], 3306);
    }
    $kareta_db_name = kareta_config_value('KARETA_DB_NAME', 'db_name', null);
    if ($kareta_db_name === null || $kareta_db_name === '') {
        $kareta_db_name = kareta_env_first(['DB_DATABASE', 'MYSQL_DATABASE'], '');
    }
    $kareta_db_user = kareta_config_value('KARETA_DB_USER', 'db_user', null);
    if ($kareta_db_user === null || $kareta_db_user === '') {
        $kareta_db_user = kareta_env_first(['DB_USERNAME', 'DB_USER', 'MYSQL_USER'], '');
    }
    $kareta_db_password = kareta_config_value('KARETA_DB_PASS', 'db_pass', null);
    if ($kareta_db_password === null || $kareta_db_password === '') {
        $kareta_db_password = kareta_env_first(['KARETA_DB_PASSWORD', 'DB_PASSWORD', 'MYSQL_PASSWORD'], '');
    }
    $kareta_db_socket = kareta_config_value('KARETA_DB_SOCKET', 'db_socket', null);
    if ($kareta_db_socket === null || $kareta_db_socket === '') {
        $kareta_db_socket = kareta_env_first(['DB_SOCKET', 'MYSQL_UNIX_PORT'], '');
    }

    define('KARETA_DB', [
        'host'            => trim((string)$kareta_db_host),
        'port'            => (int)$kareta_db_port,
        'database'        => trim((string)$kareta_db_name),
        'username'        => trim((string)$kareta_db_user),
        'password'        => (string)$kareta_db_password,
        'socket'          => trim((string)$kareta_db_socket),
        'charset'         => (string) kareta_config_value('KARETA_DB_CHARSET', 'db_charset', 'utf8mb4'),
        'connect_timeout' => (int) kareta_config_value('KARETA_DB_TIMEOUT', 'db_timeout', 5),
    ]);

    if (!function_exists('kareta_db_missing_config_fields')) {
        function kareta_db_missing_config_fields(): array {
            $missing = [];
            if (trim((string)(KARETA_DB['database'] ?? '')) === '') $missing[] = 'database';
            if (trim((string)(KARETA_DB['username'] ?? '')) === '') $missing[] = 'username';
            if (trim((string)(KARETA_DB['socket'] ?? '')) === '' && (string)(KARETA_DB['password'] ?? '') === '') $missing[] = 'password';
            return $missing;
        }
    }
    $kareta_db_environment_configured = kareta_env_first([
        'KARETA_DB_NAME','KARETA_DB_USER','KARETA_DB_PASS','KARETA_DB_PASSWORD',
        'DB_DATABASE','DB_USERNAME','DB_USER','DB_PASSWORD','MYSQL_DATABASE','MYSQL_USER','MYSQL_PASSWORD'
    ], null) !== null;
    define('KARETA_DB_CONFIG_SOURCE', KARETA_PRIVATE_CONFIG_LOADED
        ? KARETA_PRIVATE_CONFIG_SOURCE
        : ($kareta_db_environment_configured ? 'environment' : 'missing'));
    define('KARETA_DB_CONFIGURED', kareta_db_missing_config_fields() === []);

    /*
     * KARETA_DB_VERSION — актуальная версия migration runner.
     * Версию увеличивать при добавлении новой migration file.
     */
    define('KARETA_DB_VERSION', 137);

    $kareta_environment = strtolower(trim((string) kareta_config_value('KARETA_ENVIRONMENT', 'environment', 'production')));
    if (!in_array($kareta_environment, ['production','staging','development','test'], true)) {
        $kareta_environment = 'production';
    }
    define('KARETA_ENVIRONMENT', $kareta_environment);
    $kareta_is_production = KARETA_ENVIRONMENT === 'production';

    define('KARETA_DB_AUTO_CREATE', filter_var(kareta_config_value('KARETA_DB_AUTO_CREATE', 'db_auto_create', false), FILTER_VALIDATE_BOOLEAN));
    $kareta_db_auto_migrate = filter_var(kareta_config_value('KARETA_DB_AUTO_MIGRATE', 'db_auto_migrate', false), FILTER_VALIDATE_BOOLEAN);
    // R188.5.5.6.84.79: web requests must not mutate production schema. A deployment
    // may open an explicit maintenance window with KARETA_DB_RUNTIME_MIGRATION_WINDOW=1.
    if ($kareta_is_production && !filter_var(getenv('KARETA_DB_RUNTIME_MIGRATION_WINDOW') ?: false, FILTER_VALIDATE_BOOLEAN)) {
        $kareta_db_auto_migrate = false;
    }
    define('KARETA_DB_AUTO_MIGRATE', $kareta_db_auto_migrate);
    define('KARETA_RUNTIME_MAINTENANCE_INTERVAL', max(60, (int) kareta_config_value('KARETA_RUNTIME_MAINTENANCE_INTERVAL', 'runtime_maintenance_interval', 900)));
    define('KARETA_API_MAX_BODY_BYTES', max(1048576, (int) kareta_config_value('KARETA_API_MAX_BODY_BYTES', 'api_max_body_bytes', 20971520)));

    // Production lock: professional account types may never auto-approve from
    // deployment configuration. test_auto is accepted only outside production.
    $kareta_account_type_approval_mode = strtolower(trim((string) kareta_config_value(
        'KARETA_ACCOUNT_TYPE_APPROVAL_MODE',
        'account_type_approval_mode',
        $kareta_is_production ? 'admin_review' : 'test_auto'
    )));
    if (!in_array($kareta_account_type_approval_mode, ['test_auto','admin_review'], true)) {
        $kareta_account_type_approval_mode = 'admin_review';
    }
    if ($kareta_is_production) {
        $kareta_account_type_approval_mode = 'admin_review';
    }
    define('KARETA_ACCOUNT_TYPE_APPROVAL_MODE', $kareta_account_type_approval_mode);
    define('KARETA_DEMO_SEED', filter_var(kareta_config_value('KARETA_DEMO_SEED', 'demo_seed', false), FILTER_VALIDATE_BOOLEAN));

    $kareta_otp_transport = strtolower(trim((string) kareta_config_value(
        'KARETA_OTP_TRANSPORT',
        'otp_transport',
        $kareta_is_production ? 'webhook' : 'test_static'
    )));
    $kareta_otp_test_code = preg_replace('/\D+/', '', (string) kareta_config_value(
        'KARETA_OTP_TEST_CODE',
        'otp_test_code',
        $kareta_is_production ? '' : '0000'
    )) ?: '';
    $kareta_otp_allow_test_fallback = filter_var(kareta_config_value(
        'KARETA_OTP_ALLOW_TEST_FALLBACK',
        'otp_allow_test_fallback',
        !$kareta_is_production
    ), FILTER_VALIDATE_BOOLEAN);

    // R188.5.5.6.84.79 commissioning bridge.
    // The owner explicitly requested code 0000 until the SMS provider is connected.
    // It is now manual-off instead of date-based: set KARETA_OTP_TEMP_STATIC_ENABLED=0
    // (or otp_temp_static_enabled=false in private config) when the provider is ready.
    // An optional deadline can still be supplied through KARETA_OTP_TEMP_STATIC_UNTIL.
    $kareta_otp_temp_static_until = trim((string) kareta_config_value(
        'KARETA_OTP_TEMP_STATIC_UNTIL',
        'otp_temp_static_until',
        ''
    ));
    $kareta_otp_temp_static_enabled = filter_var(kareta_config_value(
        'KARETA_OTP_TEMP_STATIC_ENABLED',
        'otp_temp_static_enabled',
        false
    ), FILTER_VALIDATE_BOOLEAN);
    $kareta_otp_temp_static_deadline = $kareta_otp_temp_static_until !== '' ? strtotime($kareta_otp_temp_static_until) : false;
    $kareta_otp_temp_static_within_window = $kareta_otp_temp_static_until === ''
        || ($kareta_otp_temp_static_deadline !== false && time() < (int)$kareta_otp_temp_static_deadline);
    $kareta_otp_temp_static_active = $kareta_is_production
        && $kareta_otp_temp_static_enabled
        && $kareta_otp_temp_static_within_window;

    if ($kareta_is_production) {
        $kareta_otp_allow_test_fallback = false;
        if ($kareta_otp_temp_static_active) {
            $kareta_otp_transport = 'test_static';
            $kareta_otp_test_code = '0000';
        } else {
            // Production is fail-closed when the commissioning override is disabled.
            $kareta_otp_transport = 'webhook';
            $kareta_otp_test_code = '';
        }
    }
    define('KARETA_OTP', [
        'transport' => $kareta_otp_transport,
        'test_code' => $kareta_otp_test_code,
        'allow_test_fallback' => $kareta_otp_allow_test_fallback,
        'temporary_static' => $kareta_otp_temp_static_active,
        'temporary_static_until' => $kareta_otp_temp_static_until,
        'webhook_url' => trim((string) kareta_config_value('KARETA_OTP_WEBHOOK_URL', 'otp_webhook_url', '')),
        'webhook_token' => trim((string) kareta_config_value('KARETA_OTP_WEBHOOK_TOKEN', 'otp_webhook_token', '')),
        'sender' => trim((string) kareta_config_value('KARETA_OTP_SENDER', 'otp_sender', 'KARETA')),
    ]);
    // R188.5.5.6.84.86: omnichannel Messaging Core. Provider secrets are read only
    // from environment/private config and are never serialized to the frontend.
    $kareta_messaging_public_url = rtrim(trim((string) kareta_config_value(
        'KARETA_MESSAGING_PUBLIC_URL',
        'messaging_public_url',
        'https://kareta.kz'
    )), '/');
    $kareta_telegram_token = trim((string) kareta_config_value('KARETA_TELEGRAM_BOT_TOKEN', 'telegram_bot_token', ''));
    $kareta_telegram_username = ltrim(trim((string) kareta_config_value('KARETA_TELEGRAM_BOT_USERNAME', 'telegram_bot_username', '')), '@');
    $kareta_telegram_webhook_secret = trim((string) kareta_config_value('KARETA_TELEGRAM_WEBHOOK_SECRET', 'telegram_webhook_secret', ''));
    $kareta_whatsapp_access_token = trim((string) kareta_config_value('KARETA_WHATSAPP_ACCESS_TOKEN', 'whatsapp_access_token', ''));
    $kareta_whatsapp_phone_number_id = trim((string) kareta_config_value('KARETA_WHATSAPP_PHONE_NUMBER_ID', 'whatsapp_phone_number_id', ''));
    $kareta_whatsapp_business_phone = preg_replace('/\\D+/', '', (string) kareta_config_value('KARETA_WHATSAPP_BUSINESS_PHONE', 'whatsapp_business_phone', '')) ?: '';
    $kareta_whatsapp_verify_token = trim((string) kareta_config_value('KARETA_WHATSAPP_VERIFY_TOKEN', 'whatsapp_verify_token', ''));
    $kareta_whatsapp_app_secret = trim((string) kareta_config_value('KARETA_WHATSAPP_APP_SECRET', 'whatsapp_app_secret', ''));
    $kareta_whatsapp_graph_base = rtrim(trim((string) kareta_config_value(
        'KARETA_WHATSAPP_GRAPH_BASE_URL',
        'whatsapp_graph_base_url',
        'https://graph.facebook.com/v23.0'
    )), '/');
    $kareta_whatsapp_template_name = trim((string) kareta_config_value('KARETA_WHATSAPP_TEMPLATE_NAME', 'whatsapp_template_name', ''));
    $kareta_whatsapp_template_language = trim((string) kareta_config_value('KARETA_WHATSAPP_TEMPLATE_LANGUAGE', 'whatsapp_template_language', 'ru')) ?: 'ru';
    define('KARETA_MESSAGING', [
        'enabled' => filter_var(kareta_config_value('KARETA_MESSAGING_ENABLED', 'messaging_enabled', true), FILTER_VALIDATE_BOOLEAN),
        'public_url' => $kareta_messaging_public_url,
        'worker_batch' => max(1, min(100, (int) kareta_config_value('KARETA_MESSAGING_WORKER_BATCH', 'messaging_worker_batch', 25))),
        'auto_schema' => filter_var(kareta_config_value('KARETA_MESSAGING_AUTO_SCHEMA', 'messaging_auto_schema', false), FILTER_VALIDATE_BOOLEAN),
        'telegram' => [
            'enabled' => filter_var(kareta_config_value('KARETA_TELEGRAM_ENABLED', 'telegram_enabled', $kareta_telegram_token !== ''), FILTER_VALIDATE_BOOLEAN),
            'bot_token' => $kareta_telegram_token,
            'bot_username' => $kareta_telegram_username,
            'webhook_secret' => $kareta_telegram_webhook_secret,
        ],
        'whatsapp' => [
            'enabled' => filter_var(kareta_config_value('KARETA_WHATSAPP_ENABLED', 'whatsapp_enabled', $kareta_whatsapp_access_token !== '' && $kareta_whatsapp_phone_number_id !== ''), FILTER_VALIDATE_BOOLEAN),
            'access_token' => $kareta_whatsapp_access_token,
            'phone_number_id' => $kareta_whatsapp_phone_number_id,
            'business_phone' => $kareta_whatsapp_business_phone,
            'verify_token' => $kareta_whatsapp_verify_token,
            'app_secret' => $kareta_whatsapp_app_secret,
            'graph_base_url' => $kareta_whatsapp_graph_base,
            'template_name' => $kareta_whatsapp_template_name,
            'template_language' => $kareta_whatsapp_template_language,
        ],
    ]);
    define('KARETA_DIAGNOSTICS_TOKEN', trim((string) kareta_config_value('KARETA_DIAGNOSTICS_TOKEN', 'diagnostics_token', '')));
    define('KARETA_SESSION_SECURITY_EPOCH', '20260806-r188556');

    // Версия ассетов задаётся в inc/asset_version.php и используется фронтом/API.
    if (!defined('KARETA_ASSET_VERSION')) {
        require_once KARETA_ROOT . '/inc/asset_version.php';
    }
    define('APP_VER', defined('KARETA_ASSET_VERSION') ? KARETA_ASSET_VERSION : 'stable');
}
