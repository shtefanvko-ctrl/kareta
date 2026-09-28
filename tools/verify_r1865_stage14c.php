<?php
$root=dirname(__DIR__);$errors=[];
$checks=[
 'resolver'=>is_file($root.'/api/identity/auth_resolver.php'),
 'migration'=>is_file($root.'/api/migrations/085_identity_auth_resolver_unification.php'),
 'context resolver'=>str_contains((string)@file_get_contents($root.'/api/context.php'),'KaretaAuthResolver'),
 'cap resolver'=>str_contains((string)@file_get_contents($root.'/api/capabilities.php'),'KaretaAuthResolver'),
 'realtime resolver'=>str_contains((string)@file_get_contents($root.'/api/realtime.php'),'KaretaAuthResolver'),
 'pipeline resolver'=>str_contains((string)@file_get_contents($root.'/api/identity/authorization_pipeline.php'),'KaretaAuthResolver'),
 'db>=85'=>preg_match("/KARETA_DB_VERSION',\s*(8[5-9]|9[0-9]|[1-9][0-9]{2,})/",(string)@file_get_contents($root.'/config.php'))===1,
];foreach($checks as $k=>$v)if(!$v)$errors[]=$k;
if($errors){fwrite(STDERR,'FAIL: '.implode(', ',$errors).PHP_EOL);exit(1);}echo "R186.5 Stage14C OK\n";
