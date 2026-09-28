<?php
$root=dirname(__DIR__);$errors=[];
$checks=[
 'service'=>is_file($root.'/api/identity/domain_ownership_service.php'),
 'migration'=>is_file($root.'/api/migrations/079_identity_domain_ownership.php'),
 'docs'=>is_file($root.'/docs/identity/STAGE_10_DOMAIN_OWNERSHIP.md'),
 'pipeline'=>str_contains((string)@file_get_contents($root.'/api/identity/authorization_pipeline.php'),'KaretaDomainOwnershipService'),
 'owner field'=>str_contains((string)@file_get_contents($root.'/api/migrations/079_identity_domain_ownership.php'),'owner_context_id'),
 'acl'=>str_contains((string)@file_get_contents($root.'/api/migrations/079_identity_domain_ownership.php'),'domain_entity_acl'),
 'db version'=>str_contains((string)@file_get_contents($root.'/config.php'),"KARETA_DB_VERSION', 79"),
 'asset version'=>str_contains((string)@file_get_contents($root.'/inc/asset_version.php'),'20260803-r1865-stage10-domain-ownership'),
];
foreach($checks as $name=>$ok)if(!$ok)$errors[]=$name;
if($errors){fwrite(STDERR,"Stage10 failed: ".implode(', ',$errors).PHP_EOL);exit(1);}echo "R186.5 Stage 10 verification passed\n";
