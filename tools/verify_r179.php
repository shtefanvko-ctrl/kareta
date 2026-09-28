<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$checks=[
 'release'=>str_contains((string)file_get_contents($root.'/inc/asset_version.php'),'20260803-r1861-realtime-stability'),
 'sw'=>str_contains((string)file_get_contents($root.'/sw.js'),'20260803-r1861-realtime-stability'),
 'engine'=>is_file($root.'/js/next/workflow_engine.js'),
 'page'=>is_file($root.'/js/next/pages/workflow.js'),
 'css'=>is_file($root.'/css/next/workflow.css'),
 'route'=>str_contains((string)file_get_contents($root.'/js/next/route_registry.js'),"#/workflow"),
 'registry'=>str_contains((string)file_get_contents($root.'/inc/asset_registry.php'),'js/next/workflow_engine.js'),
 'app'=>str_contains((string)file_get_contents($root.'/js/next/app_next.js'),'workflowPages.renderWorkflow'),
];
$failed=array_keys(array_filter($checks,fn($ok)=>!$ok));
foreach($checks as $name=>$ok) echo ($ok?'[OK] ':'[FAIL] ').$name.PHP_EOL;
exit($failed?1:0);
