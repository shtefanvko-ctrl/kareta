<?php
$root=dirname(__DIR__);$checks=[
 'release'=>str_contains((string)file_get_contents($root.'/inc/asset_version.php'),'20260803-r1861-realtime-stability'),
 'migration'=>is_file($root.'/api/migrations/066_event_notification_core.php')&&str_contains((string)file_get_contents($root.'/api/migrations/066_event_notification_core.php'),"'version'=>66"),
 'recipients'=>str_contains((string)file_get_contents($root.'/api/domain.php'),'domain_event_recipients'),
 'delivery'=>str_contains((string)file_get_contents($root.'/api/domain.php'),'recipientsDelivered'),
 'notification_api'=>str_contains((string)file_get_contents($root.'/api/domain.php'),'notifications.list')&&str_contains((string)file_get_contents($root.'/api/domain.php'),'notification.readAll'),
 'frontend'=>str_contains((string)file_get_contents($root.'/js/next/pages/notifications.js'),'api/domain.php?action=notifications.list'),
];foreach($checks as $name=>$ok){echo ($ok?'[OK] ':'[FAIL] ').$name.PHP_EOL;if(!$ok)exit(1);}echo "R181.3 verification passed\n";
