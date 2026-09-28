<?php
declare(strict_types=1);
$root=dirname(__DIR__);$nav=file_get_contents($root.'/js/next/navigation_core.js');$hub=file_get_contents($root.'/js/next/smart_action_hub.js');$shell=file_get_contents($root.'/js/next/shell_nav.js');
$checks=[
 'master mobile template'=>str_contains($nav,"['home','orders','parts','cabinet','__more__']"),
 'master five limit'=>str_contains($nav,"['seller','admin','organization_store'].includes(kind) ? 6 : 5"),
 'master hub actions'=>str_contains($hub,'master:Object.freeze'),
 'account context switch'=>str_contains($hub,'data-context-switch'),
 'server preference api'=>is_file($root.'/api/account_ui_preferences.php'),
 'migration 093'=>is_file($root.'/api/migrations/093_master_navigation_account_preferences.php'),
 'svg more icon'=>str_contains($shell,"svg?.('more')")
];foreach($checks as $n=>$ok){echo ($ok?'OK ':'FAIL ').$n.PHP_EOL;if(!$ok)exit(1);}echo "R187.6 verifier OK\n";
