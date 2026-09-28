<?php
$root=dirname(__DIR__);$checks=[
 'release'=>str_contains((string)file_get_contents($root.'/inc/asset_version.php'),'20260803-r1861-realtime-stability'),
 'migration'=>is_file($root.'/api/migrations/064_core_platform_hardening.php'),
 'capabilities'=>str_contains((string)file_get_contents($root.'/api/context_access.php'),'domain.event.create'),
 'idempotency'=>str_contains((string)file_get_contents($root.'/api/domain.php'),'kareta_idempotency_begin'),
 'ownership'=>str_contains((string)file_get_contents($root.'/api/domain.php'),'aggregate_access_denied'),
 'calendar_validation'=>str_contains((string)file_get_contents($root.'/api/domain.php'),'calendar_conflict'),
 'money_validation'=>str_contains((string)file_get_contents($root.'/api/domain.php'),'invalid_payment_method'),
 'state_guard'=>str_contains((string)file_get_contents($root.'/js/next/core/state_manager.js'),"typeof structuredClone==='function'"),
 'api_client'=>str_contains((string)file_get_contents($root.'/js/next/api_client.js'),'getDomainSnapshot'),
];foreach($checks as $name=>$ok)echo($ok?'[OK] ':'[FAIL] ').$name.PHP_EOL;exit(in_array(false,$checks,true)?1:0);
