<?php
declare(strict_types=1);
if(!defined('KARETA_CONFIG_LOADED'))require_once dirname(__DIR__).'/config.php';
if (!defined('KARETA_TRACE_ID')) {
    $incoming = preg_replace('~[^a-zA-Z0-9_.:-]~', '', (string)($_SERVER['HTTP_X_KARETA_TRACE_ID'] ?? '')) ?: '';
    define('KARETA_TRACE_ID', $incoming !== '' ? substr($incoming,0,120) : ('srv_' . bin2hex(random_bytes(8))));
}
$GLOBALS['kareta_request_log'] = [
    'started'=>microtime(true),
    'time'=>gmdate('c'),
    'traceId'=>KARETA_TRACE_ID,
    'method'=>(string)($_SERVER['REQUEST_METHOD'] ?? ''),
    'uri'=>substr((string)($_SERVER['REQUEST_URI'] ?? ''),0,1200),
    'ip'=>substr((string)($_SERVER['REMOTE_ADDR'] ?? ''),0,80),
    'action'=>'', 'phone'=>'',
];
header('X-Kareta-Trace-Id: ' . KARETA_TRACE_ID);
function kareta_request_log_context(array $context): void {
    foreach ($context as $key=>$value) $GLOBALS['kareta_request_log'][$key] = is_scalar($value) ? substr((string)$value,0,1000) : $value;
}
function kareta_request_log_write(array $extra=[]): void {
    static $written = false;
    if ($written) return;
    $written = true;
    $base = $GLOBALS['kareta_request_log'] ?? [];
    $base['durationMs'] = (int)round((microtime(true) - (float)($base['started'] ?? microtime(true))) * 1000);
    unset($base['started']);
    $base['status'] = http_response_code();
    $base['memoryPeak'] = memory_get_peak_usage(true);
    $entry = $base + $extra;
    $dir = defined('KARETA_LOG_ROOT') ? KARETA_LOG_ROOT : dirname(__DIR__) . '/storage/logs';
    if (!is_dir($dir)) @mkdir($dir,0775,true);
    @file_put_contents($dir . '/server_' . gmdate('Y-m-d') . '.jsonl', json_encode($entry, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES) . PHP_EOL, FILE_APPEND|LOCK_EX);
}
register_shutdown_function(static function(): void {
    $fatal = error_get_last();
    $extra = [];
    if ($fatal && in_array((int)$fatal['type'], [E_ERROR,E_PARSE,E_CORE_ERROR,E_COMPILE_ERROR,E_USER_ERROR], true)) {
        $extra['fatal'] = ['type'=>$fatal['type'],'message'=>$fatal['message'],'file'=>$fatal['file'],'line'=>$fatal['line']];
    }
    kareta_request_log_write($extra);
});
