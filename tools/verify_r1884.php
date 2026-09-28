<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
foreach([
 'api/migrations/097_role_operational_navigation.php','docs/releases/changelog/CHANGELOG_R188_4.md','api/order_scope.php',
 'js/next/navigation_core.js','js/next/dynamic_navigation.js','js/next/shell_nav.js','js/next/smart_action_hub.js',
 'js/next/pages/request.js','js/next/pages/sto_workplace.js','js/next/pages/admin_workspaces.js'
] as $f) if(!is_file($root.'/'.$f)) $fail[]='missing:'.$f;
$config=(string)@file_get_contents($root.'/config.php');if(!preg_match("/KARETA_DB_VERSION',\s*(9[7-9]|[1-9][0-9]{2,})/",$config))$fail[]='db_version';
$version=(string)@file_get_contents($root.'/inc/asset_version.php');if(!str_contains($version,'r1884-role-operational-navigation')&&!str_contains($version,'r1885-role-workspaces-completion')&&!str_contains($version,'r18851-navigation-icon-hotfix')&&!str_contains($version,'r18852-migration-98-recovery')&&!str_contains($version,'r18853-more-menu-navigation-fix')&&!str_contains($version,'r18854-context-switcher-more-layouts')&&!str_contains($version,'r18855-client-community-navigation')&&!str_contains($version,'r188551-onboarding-identity-session')&&!str_contains($version,'r188552-legacy-role-picker-center-removal')&&!str_contains($version,'r188553-role-surface-chat-master-spacing')&&!str_contains($version,'r188554-role-e2e-recovery-chat-search')&&!str_contains($version,'r188555-runtime-dependency-bootstrap'))$fail[]='asset_version';
$nav=(string)@file_get_contents($root.'/js/next/navigation_core.js');
foreach([
 "admin: Object.freeze(['adminMonitoring','adminUsers','adminOrganizations','adminManagement','platform','__more__'])",
 "organization_service: Object.freeze(['stoDashboard','orders','masters','parts','__more__'])"
] as $needle) if(!str_contains($nav,$needle))$fail[]='navigation:'.$needle;
$shellNav=(string)@file_get_contents($root.'/js/next/shell_nav.js');$smartHub=(string)@file_get_contents($root.'/js/next/smart_action_hub.js');$detachedMore=(str_contains($version,'r18853-more-menu-navigation-fix')||str_contains($version,'r18854-context-switcher-more-layouts')||str_contains($version,'r18855-client-community-navigation')||str_contains($version,'r188551-onboarding-identity-session')||str_contains($version,'r188552-legacy-role-picker-center-removal')||str_contains($version,'r188553-role-surface-chat-master-spacing')||str_contains($version,'r188554-role-e2e-recovery-chat-search')||str_contains($version,'r188555-runtime-dependency-bootstrap'))&&str_contains($shellNav,'KaretaSmartActionHub?.toggle?.()')&&!str_contains($shellNav,'else window.KaretaShellMenu')&&str_contains($smartHub,'organization_service:Object.freeze')&&str_contains($smartHub,'admin:Object.freeze');if(!$detachedMore&&(!str_contains($shellNav,"'organization_service'")||!str_contains($shellNav,"'admin'")))$fail[]='smart_hub_mobile_more';
$dynamic=(string)@file_get_contents($root.'/js/next/dynamic_navigation.js');if(!str_contains($dynamic,"contextTypes:['personal','profile','organization']"))$fail[]='request_contexts';
$request=(string)@file_get_contents($root.'/js/next/pages/request.js');foreach(["kind==='master'","kind==='organization_service'","kind==='personal'||kind==='anonymous'"] as $x)if(!str_contains($request,$x))$fail[]='request_role:'.$x;
$scope=(string)@file_get_contents($root.'/api/order_scope.php');foreach(['kareta_scope_identity_actor','organizationKey','profileId','KaretaAuthResolver'] as $x)if(!str_contains($scope,$x))$fail[]='scope:'.$x;
$db=(string)@file_get_contents($root.'/api/db.php');if(!str_contains($db,"\$actorRole = kareta_normalize_role((string)(\$createScope['role']"))$fail[]='orders_create_scope_role';
$migration=(string)@file_get_contents($root.'/api/migrations/097_role_operational_navigation.php');foreach(['profile.master','organization.master','organization.member','order.create'] as $x)if(!str_contains($migration,$x))$fail[]='migration:'.$x;
$sto=(string)@file_get_contents($root.'/js/next/pages/sto_workplace.js');$r82=str_contains($sto,"STO_WORKSPACE_R82_CONTRACT='R188.5.5.6.82'");foreach(['#/workflow','#/crm','#/finance'] as $x)if(!str_contains($sto,$x))$fail[]='sto:'.$x;if(!$r82&&!str_contains($sto,"loadLayout?.('sto.main','organization'"))$fail[]='sto:dashboard_layout';
$admin=(string)@file_get_contents($root.'/js/next/pages/admin_workspaces.js');foreach(['k-admin-context-nav',"loadLayout?.('admin.main','admin'",'#/admin/monitoring'] as $x)if(!str_contains($admin,$x))$fail[]='admin:'.$x;
if($fail){fwrite(STDERR,implode("\n",$fail)."\n");exit(1);}echo "R188.4 verifier OK\n";
