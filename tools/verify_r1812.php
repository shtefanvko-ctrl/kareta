<?php
$root=dirname(__DIR__);$checks=[
 'release'=>str_contains((string)file_get_contents($root.'/inc/asset_version.php'),'20260803-r1861-realtime-stability'),
 'migration'=>is_file($root.'/api/migrations/065_domain_integration.php')&&str_contains((string)file_get_contents($root.'/api/migrations/065_domain_integration.php'),"'version'=>65"),
 'repository'=>is_file($root.'/js/next/core/domain_repository.js'),
 'registry'=>str_contains((string)file_get_contents($root.'/inc/asset_registry.php'),'js/next/core/domain_repository.js'),
 'entity_api'=>str_contains((string)file_get_contents($root.'/api/domain.php'),"action === 'entity.get'"),
 'timeline'=>str_contains((string)file_get_contents($root.'/js/next/pages/core_platform.js'),'Timeline'),
 'changelog'=>is_file($root.'/docs/releases/changelog/CHANGELOG_R181_2.md'),
];$failed=array_keys(array_filter($checks,fn($v)=>!$v));echo json_encode(['ok'=>!$failed,'checks'=>$checks,'failed'=>$failed],JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE).PHP_EOL;exit($failed?1:0);
