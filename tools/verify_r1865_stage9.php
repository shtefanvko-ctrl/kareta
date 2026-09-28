<?php
$root=dirname(__DIR__);$errors=[];
$checks=[
 'pipeline'=>is_file($root.'/api/identity/authorization_pipeline.php'),
 'migration'=>is_file($root.'/api/migrations/078_identity_api_authorization_pipeline.php'),
 'docs'=>is_file($root.'/docs/identity/STAGE_09_API_AUTHORIZATION_PIPELINE.md'),
 'adapter'=>str_contains((string)@file_get_contents($root.'/api/context_access.php'),'kareta_require_resource_capability'),
 'domain resource guard'=>str_contains((string)@file_get_contents($root.'/api/domain.php'),'kareta_require_resource_capability'),
 'db version'=>preg_match("/KARETA_DB_VERSION',\\s*(7[8-9]|[89][0-9]|[1-9][0-9]{2,})/",(string)@file_get_contents($root.'/config.php')),
 'asset version'=>str_contains((string)@file_get_contents($root.'/inc/asset_version.php'),'r1865-stage'),
];
foreach($checks as $name=>$ok)if(!$ok)$errors[]=$name;
if($errors){fwrite(STDERR,"Stage9 failed: ".implode(', ',$errors).PHP_EOL);exit(1);}echo "R186.5 Stage 9 verification passed\n";
