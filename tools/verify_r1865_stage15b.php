<?php
$root=dirname(__DIR__);$e=[];
$checks=[
 'bridge'=>is_file($root.'/api/identity/legacy_api_bridge.php'),
 'migration'=>is_file($root.'/api/migrations/087_identity_api_legacy_bridge.php'),
 'db87'=>preg_match("/KARETA_DB_VERSION',\s*(8[7-9]|9[0-9]|[1-9][0-9]{2,})/",(string)@file_get_contents($root.'/config.php'))===1,
 'version'=>preg_match('/20260805-r1865-stage15[b-z0-9-]+/',(string)@file_get_contents($root.'/inc/asset_version.php'))===1,
 'db bridge include'=>str_contains((string)@file_get_contents($root.'/api/db.php'),'legacy_api_bridge.php'),
 'canonical work orders'=>str_contains((string)@file_get_contents($root.'/api/db.php'),"'work_orders.read'"),
 'canonical requests'=>str_contains((string)@file_get_contents($root.'/api/db.php'),"'requests.respond'"),
 'audit table'=>str_contains((string)@file_get_contents($root.'/api/migrations/087_identity_api_legacy_bridge.php'),'api_legacy_bridge_audit'),
];foreach($checks as $k=>$v)if(!$v)$e[]=$k;
if($e){fwrite(STDERR,'Stage15B FAIL: '.implode(', ',$e).PHP_EOL);exit(1);}echo "R186.5 Stage15B verifier OK\n";
