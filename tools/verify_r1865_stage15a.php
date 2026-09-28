<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$checks=[
 'registry'=>is_file($root.'/api/identity/capability_registry.php'),
 'migration'=>is_file($root.'/api/migrations/086_identity_capability_normalization.php'),
 'table'=>str_contains((string)@file_get_contents($root.'/api/migrations/086_identity_capability_normalization.php'),'capability_aliases'),
 'service_registry'=>str_contains((string)@file_get_contents($root.'/api/identity/capability_service.php'),'KaretaCapabilityRegistry::canonical'),
 'deny_precedence'=>str_contains((string)@file_get_contents($root.'/api/identity/capability_service.php'),'unset($allow[$key])'),
 'frontend_canonical'=>str_contains((string)@file_get_contents($root.'/js/next/dynamic_navigation.js'),"'work_orders.read'"),
 'version'=>preg_match('/20260805-r1865-stage15[a-z0-9-]+/',(string)@file_get_contents($root.'/inc/asset_version.php'))===1,
 'db_version'=>preg_match("/KARETA_DB_VERSION',\s*(8[6-9]|9[0-9]|[1-9][0-9]{2,})/",(string)@file_get_contents($root.'/config.php'))===1,
 'docs'=>is_file($root.'/docs/identity/STAGE_15A_CAPABILITY_NORMALIZATION.md'),
];
$failed=array_keys(array_filter($checks,static fn($ok)=>!$ok));
if($failed){fwrite(STDERR,'Stage 15A failed: '.implode(', ',$failed).PHP_EOL);exit(1);} echo "R186.5 Stage 15A verifier OK\n";
