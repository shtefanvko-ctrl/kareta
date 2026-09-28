<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$configSource=(string)file_get_contents($root.'/config.php');preg_match('/KARETA_DB_VERSION\',\s*(\d+)/',$configSource,$dbMatch);$dbVersion=(int)($dbMatch[1]??0);
$checks=[
 'db version remains 108'=>$dbVersion>=108,
 'desktop stability css'=>is_file($root.'/css/next/shell_session_stability.css'),
 'css registered'=>str_contains((string)file_get_contents($root.'/inc/asset_registry.php'),'shell_session_stability.css'),
 'existing account auth completion'=>str_contains((string)file_get_contents($root.'/js/next/onboarding/pages/role_page.js'),'KaretaOnboardingState?.markComplete?.'),
 'session confirmed recovery'=>str_contains((string)file_get_contents($root.'/js/next/onboarding/onboarding_lifecycle.js'),"kareta:session-confirmed"),
 'legacy bridge recovery'=>str_contains((string)file_get_contents($root.'/js/next/recovery_manager.js'),'allowLegacyBridge:true'),
 'identity context binding'=>str_contains((string)file_get_contents($root.'/api/identity_session.php'),'$ctx->resolveAccount([]);'),
 'shell overflow sync'=>str_contains((string)file_get_contents($root.'/js/next/shell_nav.js'),'syncDesktopLayout'),
 'asset version'=>str_contains((string)file_get_contents($root.'/inc/asset_version.php'),'r1885584-pc-header-session-resume-stability'),
 'service worker version'=>str_contains((string)file_get_contents($root.'/sw.js'),'r1885584-pc-header-session-resume-stability'),
];
$bad=array_keys(array_filter($checks,fn($v)=>!$v));
if($bad){fwrite(STDERR,'FAIL '.implode(', ',$bad).PHP_EOL);exit(1);}echo "OK R188.5.5.6.24 PC header + session resume stability\n";
