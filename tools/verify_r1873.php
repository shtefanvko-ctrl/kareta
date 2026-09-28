<?php
declare(strict_types=1);
$root=dirname(__DIR__);$errors=[];
$checks=[
 'hub_js'=>is_file($root.'/js/next/smart_action_hub.js'),
 'hub_css'=>is_file($root.'/css/next/smart_action_hub.css'),
 'migration'=>is_file($root.'/api/migrations/092_client_smart_action_hub.php'),
 'client_template'=>str_contains((string)@file_get_contents($root.'/js/next/navigation_core.js'),"['home','works','masters','parts','__more__']"),
 'layouts'=>str_contains((string)@file_get_contents($root.'/js/next/smart_action_hub.js'),'KARETA_MORE_WINDOW_V1_2')&&str_contains((string)@file_get_contents($root.'/js/next/smart_action_hub.js'),"layout:'honeycomb'"),
 'settings'=>str_contains((string)@file_get_contents($root.'/js/next/pages/cabinet.js'),'more_menu_layout'),
 'api'=>str_contains((string)@file_get_contents($root.'/api/client_cabinet.php'),'more_menu_layout'),
 'registry'=>str_contains((string)@file_get_contents($root.'/inc/asset_registry.php'),'smart_action_hub.js'),
 'db'=>preg_match("/KARETA_DB_VERSION',\s*(9[2-9]|[1-9][0-9]{2,})/",(string)@file_get_contents($root.'/config.php'))===1,
];foreach($checks as $k=>$ok){if(!$ok)$errors[]=$k;}if($errors){fwrite(STDERR,'R187.3 FAIL: '.implode(',',$errors).PHP_EOL);exit(1);}echo "R187.3 verifier OK\n";
