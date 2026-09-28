<?php
$root=dirname(__DIR__);$errors=[];$client=(string)@file_get_contents($root.'/js/next/core/realtime_client.js');
$checks=[
 'migration'=>is_file($root.'/api/migrations/080_identity_context_realtime.php'),
 'server context'=>str_contains((string)@file_get_contents($root.'/api/realtime.php'),'current_context_id'),
 'context cursor'=>str_contains((string)@file_get_contents($root.'/api/realtime.php'),'realtime_context_cursors'),
 'client reconnect'=>str_contains($client,'kareta:context-changed'),
 'cursor scope'=>str_contains($client,"contextId||'legacy'"),
 'db version'=>preg_match("/KARETA_DB_VERSION',\s*(8[0-9]|[9][0-9]|[1-9][0-9]{2,})/",(string)@file_get_contents($root.'/config.php')),
];foreach($checks as $k=>$ok)if(!$ok)$errors[]=$k;
if($errors){fwrite(STDERR,"R186.5 Stage11 FAILED: ".implode(', ',$errors).PHP_EOL);exit(1);}echo "R186.5 Stage11 OK\n";
