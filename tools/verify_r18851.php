<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
foreach(['docs/releases/changelog/CHANGELOG_R188_5_1.md','docs/releases/plans/PLAN_R188_5_2.md','tools/test_r18851_icon_rendering.js'] as $file)if(!is_file($root.'/'.$file))$fail[]='missing:'.$file;
$version=(string)@file_get_contents($root.'/inc/asset_version.php');if(!str_contains($version,'r18851-navigation-icon-hotfix')&&!str_contains($version,'r18852-migration-98-recovery')&&!str_contains($version,'r18853-more-menu-navigation-fix')&&!str_contains($version,'r18854-context-switcher-more-layouts')&&!str_contains($version,'r18855-client-community-navigation')&&!str_contains($version,'r188551-onboarding-identity-session')&&!str_contains($version,'r188552-legacy-role-picker-center-removal')&&!str_contains($version,'r188553-role-surface-chat-master-spacing')&&!str_contains($version,'r188554-role-e2e-recovery-chat-search')&&!str_contains($version,'r188555-runtime-dependency-bootstrap'))$fail[]='asset_version';
$icons=(string)@file_get_contents($root.'/js/next/ui_icons.js');foreach(['routeIcons','routeSvg','routeName','cabinetSettings'] as $needle)if(!str_contains($icons,$needle))$fail[]='icons:'.$needle;
$nav=(string)@file_get_contents($root.'/js/next/shell_nav.js');if(!str_contains($nav,'${route.iconHtml}')||str_contains($nav,'${esc(route.icon)}'))$fail[]='nav_svg_render';
$menu=(string)@file_get_contents($root.'/js/next/shell_menu.js');if(!str_contains($menu,'KaretaUIIcons?.routeSvg?.(key)'))$fail[]='menu_icon_map';
$css=(string)@file_get_contents($root.'/css/next/app_next.css');if(!str_contains($css,'nth-child(n+7)')||str_contains($css,'nth-child(n+6)'))$fail[]='sixth_mobile_item';
$standard=(string)@file_get_contents($root.'/css/next/icon_standard.css');foreach(['.k-nav-icon svg','.k-menu-link>span:first-child svg'] as $needle)if(!str_contains($standard,$needle))$fail[]='icon_css:'.$needle;
if($fail){fwrite(STDERR,implode("\n",$fail)."\n");exit(1);}echo "R188.5.1 verifier OK\n";
