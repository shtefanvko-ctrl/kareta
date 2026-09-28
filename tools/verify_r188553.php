<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
foreach(['api/migrations/101_context_role_chat_state.php','docs/releases/changelog/CHANGELOG_R188_5_5_3.md','docs/releases/plans/PLAN_R188_5_5_4_ROLE_CHAT_E2E.md','css/next/role_surfaces_chat_spacing.css','tools/test_r188553_role_chat_spacing.js'] as $file)if(!is_file($root.'/'.$file))$fail[]='missing:'.$file;
$version=(string)@file_get_contents($root.'/inc/asset_version.php');if(!str_contains($version,'r188553-role-surface-chat-master-spacing')&&!str_contains($version,'r188554-role-e2e-recovery-chat-search')&&!str_contains($version,'r188555-runtime-dependency-bootstrap'))$fail[]='asset_version';
$sw=(string)@file_get_contents($root.'/sw.js');if(!str_contains($sw,'r188553-role-surface-chat-master-spacing')&&!str_contains($sw,'r188554-role-e2e-recovery-chat-search')&&!str_contains($sw,'r188555-runtime-dependency-bootstrap'))$fail[]='service_worker_version';
$config=(string)@file_get_contents($root.'/config.php');if(!preg_match("/KARETA_DB_VERSION',\s*(10[1-9]|1[1-9][0-9])/",$config))$fail[]='db_version';
$assets=(string)@file_get_contents($root.'/inc/asset_registry.php');if(substr_count($assets,'css/next/role_surfaces_chat_spacing.css')!==1)$fail[]='r188553_css_asset';
$navigation=(string)@file_get_contents($root.'/js/next/navigation_core.js');foreach(['function interfaceRole','function syncInterfaceContext','dataset.userRole','kareta:interface-context-changed','force:true'] as $needle)if(!str_contains($navigation,$needle))$fail[]='navigation:'.$needle;
$runtime=(string)@file_get_contents($root.'/js/next/route_runtime.js');if(!str_contains($runtime,'force:options.force === true'))$fail[]='route_force';
$identity=(string)@file_get_contents($root.'/js/next/identity_frontend.js');if(!str_contains($identity,"state.capabilities.includes('*')"))$fail[]='admin_compatibility_role';
$chats=(string)@file_get_contents($root.'/js/next/pages/chats.js');foreach(['data-chat-filter="unread"','data-chat-reply','data-chat-edit','api.updateMessage','kareta:realtime:event','state.scope+=1'] as $needle)if(!str_contains($chats,$needle))$fail[]='chats:'.$needle;
$db=(string)@file_get_contents($root.'/api/db.php');foreach(['function kareta_chat_actor','kareta_scope_identity_actor','unread_seller','read_seller_at'] as $needle)if(!str_contains($db,$needle))$fail[]='chat_api:'.$needle;
$details=(string)@file_get_contents($root.'/js/next/pages/details.js');if(!str_contains($details,'kareta.chat.prefill')||str_contains($details,'kareta.chat.draft'))$fail[]='provider_chat_prefill';
if($fail){fwrite(STDERR,implode("\n",$fail)."\n");exit(1);}echo "R188.5.5.3 verifier OK\n";
