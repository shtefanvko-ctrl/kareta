<?php
declare(strict_types=1);
if(!defined('KARETA_CONFIG_LOADED'))require_once dirname(__DIR__).'/config.php';

if (!defined('KARETA_WEB_GUARD_LOADED')) {
    define('KARETA_WEB_GUARD_LOADED', true);
    if (!defined('KARETA_WEB_REQUEST_ID')) {
        define('KARETA_WEB_REQUEST_ID', substr(hash('sha256', microtime(true) . '|' . random_int(1, PHP_INT_MAX) . '|' . ($_SERVER['REQUEST_URI'] ?? 'web')), 0, 16));
    }

    if (ob_get_level() === 0) ob_start();

    $karetaWebLog = static function (string $channel, string $message): void {
        $dir = defined('KARETA_LOG_ROOT') ? KARETA_LOG_ROOT : dirname(__DIR__) . '/storage/logs';
        if (!is_dir($dir)) @mkdir($dir, 0775, true);
        @file_put_contents($dir . '/web_errors.log', '[' . date('Y-m-d H:i:s') . '] [' . $channel . '] [' . KARETA_WEB_REQUEST_ID . '] ' . $message . PHP_EOL, FILE_APPEND | LOCK_EX);
    };

    $karetaWebRecovery = static function (): void {
        while (ob_get_level() > 0) @ob_end_clean();
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: text/html; charset=utf-8');
            header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
            header('X-Content-Type-Options: nosniff');
            header('X-Kareta-Request-Id: ' . KARETA_WEB_REQUEST_ID);
        }
        $id = htmlspecialchars(KARETA_WEB_REQUEST_ID, ENT_QUOTES, 'UTF-8');
        echo '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KARETA.KZ — восстановление</title><style>body{margin:0;font-family:Arial,sans-serif;background:#f4f6f9;color:#111827;display:grid;min-height:100vh;place-items:center}.p{max-width:520px;margin:24px;padding:28px;background:#fff;border-radius:22px;box-shadow:0 18px 60px rgba(15,23,42,.14)}button{border:0;border-radius:12px;padding:12px 18px;background:#ff6b00;color:#fff;font-weight:700;cursor:pointer}.id{margin-top:16px;color:#64748b;font-size:12px}</style></head><body><main class="p"><h1>Приложение временно не загрузилось</h1><p>Ошибка перехвачена. Обновите страницу. Если сбой повторится, сообщите код обращения.</p><button type="button" onclick="location.reload()">Обновить</button><div class="id">Код: ' . $id . '</div></main></body></html>';
    };

    set_exception_handler(static function (Throwable $e) use ($karetaWebLog, $karetaWebRecovery): void {
        $karetaWebLog('UNCAUGHT', get_class($e) . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
        $karetaWebRecovery();
        exit;
    });

    register_shutdown_function(static function () use ($karetaWebLog, $karetaWebRecovery): void {
        $error = error_get_last();
        if (!$error || !in_array((int)$error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR], true)) return;
        $karetaWebLog('FATAL', ($error['message'] ?? 'fatal') . ' @ ' . ($error['file'] ?? '') . ':' . ($error['line'] ?? 0));
        $karetaWebRecovery();
    });
}
