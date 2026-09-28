<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
foreach(['docs/releases/changelog/CHANGELOG_R188_5_5_2.md','docs/releases/plans/PLAN_R188_5_5_3_CONTEXT_ONBOARDING.md','css/next/legacy_role_picker_cleanup.css','tools/test_r188552_legacy_role_picker.js'] as $file)if(!is_file($root.'/'.$file))$fail[]='missing:'.$file;
$version=(string)@file_get_contents($root.'/inc/asset_version.php');if(!preg_match("/KARETA_ASSET_VERSION\s*=\s*'188\.5\.5\.6\.84\.[0-9]+'/",$version))$fail[]='asset_version';
$sw=(string)@file_get_contents($root.'/sw.js');if(!preg_match("/const RELEASE = '188\.5\.5\.6\.84\.[0-9]+'/",$sw))$fail[]='service_worker_version';
$hub=(string)@file_get_contents($root.'/js/next/smart_action_hub.js');if(str_contains($hub,'class="k-smart-action-center"')||!str_contains($hub,'class="k-more-window"'))$fail[]='smart_action_center_removal';
$legacyCss=(string)@file_get_contents($root.'/css/next/context_switcher_more_layouts.css');if(str_contains($legacyCss,'.k-smart-action-center'))$fail[]='obsolete_center_css';
$manager=(string)@file_get_contents($root.'/js/next/context_manager.js');
foreach(["key:'client'","key:'master'","key:'sto'","key:'seller'",'k-context-legacy-roles','data-context-role-create','data-context-switch-select',"KaretaOnboardingNavigation.to('role'",'legacy-context-picker'] as $needle)if(!str_contains($manager,$needle))$fail[]='legacy_picker:'.$needle;
if(str_contains($manager,'state.legacyUser.role=')||str_contains($manager,'document.documentElement.dataset.userRole='))$fail[]='unsafe_local_role_switch';
$assets=(string)@file_get_contents($root.'/inc/asset_registry.php');if(substr_count($assets,'css/next/legacy_role_picker_cleanup.css')!==1)$fail[]='r188552_css_asset';
if($fail){fwrite(STDERR,implode("\n",$fail)."\n");exit(1);}echo "R188.5.5.2 verifier OK\n";
