<?php
declare(strict_types=1);
$root = dirname(__DIR__);
$bootstrap = (string)file_get_contents($root . '/api/bootstrap.php');
$endpoint = (string)file_get_contents($root . '/api/runtime_diagnostics.php');
$logger = (string)file_get_contents($root . '/js/next/runtime_logger.js');
$checks = [
    'memory diagnostic buffer' => strpos($bootstrap, "KARETA_LAST_DB_DIAGNOSTIC") !== false,
    'exception message exposed safely' => strpos($bootstrap, "'message' => \$exceptionMessage") !== false,
    'sqlstate exposed' => strpos($bootstrap, "'sqlState'") !== false,
    'endpoint fallback diagnostic' => strpos($endpoint, 'diagnostic_unavailable') !== false,
    'console group expanded' => strpos($logger, 'console.group(`%c[KARETA][SERVER DIAGNOSTICS]') !== false,
    'console PDO message' => strpos($logger, "console.error('PDO/MySQL:'") !== false,
];
$failed=[];
foreach($checks as $name=>$ok){ echo ($ok?'[OK] ':'[FAIL] ').$name.PHP_EOL; if(!$ok)$failed[]=$name; }
exit($failed?1:0);
