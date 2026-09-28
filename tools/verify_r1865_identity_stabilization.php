<?php
$root=dirname(__DIR__);$checks=[
'identity fallback'=>str_contains((string)file_get_contents($root.'/js/next/identity_frontend.js'),'requestWithFallback'),
'legacy switch'=>str_contains((string)file_get_contents($root.'/js/next/context_manager.js'),'k-context-legacy'),
'identity mode'=>str_contains((string)file_get_contents($root.'/js/next/app_next.js'),'identityMode'),
'version'=>str_contains((string)file_get_contents($root.'/inc/asset_version.php'),'20260803-r1865-identity-stabilization'),
];foreach($checks as $n=>$ok)echo ($ok?'[OK] ':'[FAIL] ').$n.PHP_EOL;exit(in_array(false,$checks,true)?1:0);
