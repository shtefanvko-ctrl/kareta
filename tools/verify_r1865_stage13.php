<?php
$root=dirname(__DIR__);$errors=[];
$checks=[
'migration'=>is_file($root.'/api/migrations/082_identity_marketplace_organization_membership.php'),
'docs'=>is_file($root.'/docs/identity/STAGE_13_MARKETPLACE_ORGANIZATION_MEMBERSHIP.md'),
'db version'=>preg_match("/KARETA_DB_VERSION',\s*(8[2-9]|9[0-9]|[1-9][0-9]{2,})/",(string)@file_get_contents($root.'/config.php')),
'asset version'=>preg_match('/(?:r186[5-9]|r18[7-9][0-9]*)-/',(string)@file_get_contents($root.'/inc/asset_version.php'))===1,
'org context guard'=>str_contains((string)@file_get_contents($root.'/api/domain.php'),'organization_context_required'),
'context ownership'=>str_contains((string)@file_get_contents($root.'/api/migrations/082_identity_marketplace_organization_membership.php'),'owner_context_id'),
];foreach($checks as $k=>$ok)if(!$ok)$errors[]=$k;if($errors){fwrite(STDERR,"Stage 13 FAILED: ".implode(', ',$errors).PHP_EOL);exit(1);}echo "Stage 13 OK
";
