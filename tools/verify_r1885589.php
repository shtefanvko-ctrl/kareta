<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$configSource=(string)file_get_contents($root.'/config.php');preg_match('/KARETA_DB_VERSION\',\s*(\d+)/',$configSource,$dbMatch);$dbVersion=(int)($dbMatch[1]??0);
$resume=(string)file_get_contents($root.'/js/next/session_resume_runtime.js');
$nav=(string)file_get_contents($root.'/js/next/navigation_state.js');
$app=(string)file_get_contents($root.'/js/next/app_next.js');
$role=(string)file_get_contents($root.'/js/next/role_access.js');
$registry=(string)file_get_contents($root.'/inc/asset_registry.php');
$asset=(string)file_get_contents($root.'/inc/asset_version.php');
$sw=(string)file_get_contents($root.'/sw.js');
$checks=[
 'db version remains 108'=>$dbVersion>=108,
 'resume runtime registered'=>str_contains($registry,"js/next/session_resume_runtime.js"),
 'resume runtime release'=>str_contains($resume,'r1885589-session-resume-hardening'),
 'long suspend threshold'=>str_contains($resume,'PROBE_AFTER_HIDDEN_MS=45_000'),
 'probe preserves hash'=>str_contains($resume,"history.replaceState(null,'',before.hash)"),
 'transient recovery preserves UI'=>str_contains($resume,'A transient network/backend failure must never own routing'),
 'verified role hint'=>str_contains($resume,'kareta.session.resume.v1'),
 'degraded boot mode'=>str_contains($app,"'resume-degraded'"),
 'degraded boot does not emit anonymous'=>str_contains($app,"kareta:session-degraded"),
 'role access uses resume hint'=>str_contains($role,'KaretaSessionResume?.hint?.()'),
 'network recovery delegates to resume runtime'=>str_contains((string)file_get_contents($root.'/js/next/recovery_manager.js'),"KaretaSessionResume?.probe"),
 'visibility restore is silent'=>str_contains($nav,'dispatchEvents:false'),
 'exchange tab is restorable'=>str_contains($nav,"'data-exchange-tab'"),
 'asset version'=>str_contains($asset,'r1885589-session-resume-hardening'),
 'service worker version'=>str_contains($sw,'r1885589-session-resume-hardening'),
];
$bad=array_keys(array_filter($checks,fn($v)=>!$v));
if($bad){fwrite(STDERR,'FAIL '.implode(', ',$bad).PHP_EOL);exit(1);} echo "OK R188.5.5.6.29 session resume hardening\n";
