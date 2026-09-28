<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
foreach(['docs/releases/changelog/CHANGELOG_R188_5_5_5.md','docs/releases/deploy/DEPLOY_R188_5_5_5.md','docs/releases/plans/PLAN_R188_5_5_6_MASTER_STO_SHELL.md','js/next/runtime_dependencies.js','tools/test_r188555_runtime_dependencies.js'] as $file)if(!is_file($root.'/'.$file))$fail[]='missing:'.$file;
$release='r188555-runtime-dependency-bootstrap';
foreach(['inc/asset_version.php','sw.js','js/next/core/realtime_client.js'] as $file)if(!str_contains((string)@file_get_contents($root.'/'.$file),$release))$fail[]='release:'.$file;
$registry=(string)@file_get_contents($root.'/inc/asset_registry.php');foreach(['js/next/runtime_dependencies.js','data-kareta-script-order','data-kareta-release'] as $needle)if(!str_contains($registry,$needle))$fail[]='registry:'.$needle;
$runtime=(string)@file_get_contents($root.'/js/next/runtime_dependencies.js');foreach(['deferScript','requestRecovery','mixed_versions','invalid_script_order','karetaDependencyRetry'] as $needle)if(!str_contains($runtime,$needle))$fail[]='runtime:'.$needle;
foreach(['shell_nav.js'=>'shell_nav','shell_menu.js'=>'shell_menu','route_runtime.js'=>'route_runtime','app_next.js'=>'app_next'] as $file=>$module){$source=(string)@file_get_contents($root.'/js/next/'.$file);if(!str_contains($source,"deferScript('{$module}'"))$fail[]='defer:'.$file;}
$app=(string)@file_get_contents($root.'/js/next/app_next.js');foreach(['KaretaIdentityMigrationPages','KaretaAdminWorkspacePages','KaretaRouteAssetLoader','PAGE_BINDINGS'] as $needle)if(!str_contains($app,$needle))$fail[]='app:'.$needle;
$feed=(string)@file_get_contents($root.'/js/next/pages/work_feed.js');if(!str_contains($feed,'const communityPages=()=>window.KaretaCommunityPages'))$fail[]='community_late_binding';
$index=(string)@file_get_contents($root.'/index.php');foreach(['X-Kareta-Asset-Version','asset_manifest.php?runtime_probe','runtime_modules_incomplete'] as $needle)if(!str_contains($index,$needle))$fail[]='index:'.$needle;
if($fail){fwrite(STDERR,implode("\n",$fail)."\n");exit(1);}echo "R188.5.5.5 verifier OK\n";
