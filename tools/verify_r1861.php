<?php
$root=$argv[1]??dirname(__DIR__);
$checks=[
 'release'=>str_contains((string)file_get_contents($root.'/inc/asset_version.php'),'20260803-r1861-realtime-stability'),
 'account_cursor'=>str_contains((string)file_get_contents($root.'/js/next/core/realtime_client.js'),'cursor.${userId'),
 'leader_election'=>str_contains((string)file_get_contents($root.'/js/next/core/realtime_client.js'),'claimLeadership'),
 'broadcast'=>str_contains((string)file_get_contents($root.'/js/next/core/realtime_client.js'),'BroadcastChannel'),
 'broadcast_delivery'=>str_contains((string)file_get_contents($root.'/js/next/core/realtime_client.js'),"sourceName!=='broadcast'&&eventId<=cursor()"),
 'hidden_leader_release'=>str_contains((string)file_get_contents($root.'/js/next/core/realtime_client.js'),'stopTransport();releaseLeadership();'),
 'server_mode_validation'=>str_contains((string)file_get_contents($root.'/api/realtime.php'),'invalid_mode'),
 'reduced_polling'=>str_contains((string)file_get_contents($root.'/api/realtime.php'),'usleep(2000000)'),
 'cleanup'=>str_contains((string)file_get_contents($root.'/api/realtime.php'),'INTERVAL 30 DAY'),
];
$ok=true;foreach($checks as $name=>$pass){echo ($pass?'PASS ':'FAIL ').$name.PHP_EOL;$ok=$ok&&$pass;}exit($ok?0:1);
