<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
foreach(['api/migrations/099_more_menu_arc_default.php','docs/releases/changelog/CHANGELOG_R188_5_4.md','docs/releases/plans/PLAN_R188_5_5.md','css/next/context_switcher_more_layouts.css','tools/test_r18854_context_layouts.js'] as $file)if(!is_file($root.'/'.$file))$fail[]='missing:'.$file;
$version=(string)@file_get_contents($root.'/inc/asset_version.php');if(!preg_match("/KARETA_ASSET_VERSION\s*=\s*'188\.5\.5\.6\.84\.[0-9]+'/",$version))$fail[]='asset_version';
$sw=(string)@file_get_contents($root.'/sw.js');if(!preg_match("/const RELEASE = '188\.5\.5\.6\.84\.[0-9]+'/",$sw))$fail[]='service_worker_version';
$config=(string)@file_get_contents($root.'/config.php');if(!preg_match("/KARETA_DB_VERSION',\s*(99|[1-9][0-9]{2,})/",$config))$fail[]='db_version';
$index=(string)@file_get_contents($root.'/index.php');if(substr_count($index,'id="k-context-switcher"')!==1)$fail[]='persistent_context_host';
$menu=(string)@file_get_contents($root.'/js/next/shell_menu.js');if(!str_contains($menu,"account.keys.push('cabinetSettings')"))$fail[]='burger_settings';
$identity=(string)@file_get_contents($root.'/js/next/identity_frontend.js');if(!str_contains($identity,'legacy-context-bridge'))$fail[]='legacy_context_bridge';
$preferences=(string)@file_get_contents($root.'/api/account_ui_preferences.php');if(!str_contains($preferences,'$auth instanceof KaretaAuthResolution'))$fail[]='preference_auth_resolution';
$hub=(string)@file_get_contents($root.'/js/next/smart_action_hub.js');if(!str_contains($hub,'KARETA_MORE_WINDOW_V1_2')||!str_contains($hub,"layout:'honeycomb'"))$fail[]='more_v12_contract';if(str_contains($hub,'class="k-smart-action-center"'))$fail[]='duplicate_more_center';
$assets=(string)@file_get_contents($root.'/inc/asset_registry.php');if(substr_count($assets,'css/next/context_switcher_more_layouts.css')!==1)$fail[]='r18854_css_asset';
if($fail){fwrite(STDERR,implode("\n",$fail)."\n");exit(1);}echo "R188.5.4 verifier OK\n";
