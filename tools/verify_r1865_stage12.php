<?php
$root=dirname(__DIR__);$errors=[];
$checks=[
 'migration'=>is_file($root.'/api/migrations/081_identity_crm_profile_unification.php'),
 'service'=>is_file($root.'/api/identity/crm_profile_service.php'),
 'docs'=>is_file($root.'/docs/identity/STAGE_12_CRM_PROFILE_UNIFICATION.md'),
 'db version'=>str_contains((string)@file_get_contents($root.'/config.php'),"KARETA_DB_VERSION', 82"),
 'asset version'=>str_contains((string)@file_get_contents($root.'/inc/asset_version.php'),'r1865-'),
 'crm person api'=>str_contains((string)@file_get_contents($root.'/api/domain.php'),'identity_crm_person_links'),
 'crm profiles ui'=>str_contains((string)@file_get_contents($root.'/js/next/pages/crm.js'),'k-crm-profile-list'),
];foreach($checks as $k=>$ok)if(!$ok)$errors[]=$k;
if($errors){fwrite(STDERR,"R186.5 Stage 12 FAILED: ".implode(', ',$errors).PHP_EOL);exit(1);}echo "R186.5 Stage 12 OK\n";
