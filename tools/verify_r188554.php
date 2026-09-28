<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
foreach(['docs/releases/changelog/CHANGELOG_R188_5_5_4.md','docs/releases/plans/PLAN_R188_5_5_5_MASTER_STO_SHELL.md','css/next/role_runtime_chats.css','tools/test_r188554_role_e2e_recovery.js'] as $file)if(!is_file($root.'/'.$file))$fail[]='missing:'.$file;
$version=(string)@file_get_contents($root.'/inc/asset_version.php');if(!str_contains($version,'r188554-role-e2e-recovery-chat-search')&&!str_contains($version,'r188555-runtime-dependency-bootstrap'))$fail[]='asset_version';
$sw=(string)@file_get_contents($root.'/sw.js');if(!str_contains($sw,'r188554-role-e2e-recovery-chat-search')&&!str_contains($sw,'r188555-runtime-dependency-bootstrap'))$fail[]='service_worker_version';
$realtime=(string)@file_get_contents($root.'/js/next/core/realtime_client.js');if(!str_contains($realtime,'r188554-role-e2e-recovery-chat-search')&&!str_contains($realtime,'r188555-runtime-dependency-bootstrap'))$fail[]='realtime_version';
$config=(string)@file_get_contents($root.'/config.php');if(!preg_match("/KARETA_DB_VERSION',\s*(10[1-9]|1[1-9][0-9])/",$config))$fail[]='db_version';
$assets=(string)@file_get_contents($root.'/inc/asset_registry.php');if(substr_count($assets,'css/next/role_runtime_chats.css')!==1)$fail[]='r188554_css_asset';
$identity=(string)@file_get_contents($root.'/js/next/identity_frontend.js');foreach(['let loadFlight = null','kareta:session-expired','kareta:context-lost','__KARETA_IDENTITY_FRONTEND_MODULE__'] as $needle)if(!str_contains($identity,$needle))$fail[]='identity:'.$needle;
$recovery=(string)@file_get_contents($root.'/js/next/recovery_manager.js');foreach(['RECOVERY_COOLDOWN_MS','context-fallback','session-recovery-anonymous','inFlight:!!recoveryFlight','__KARETA_RECOVERY_MANAGER_MODULE__'] as $needle)if(!str_contains($recovery,$needle))$fail[]='recovery:'.$needle;
$navigation=(string)@file_get_contents($root.'/js/next/navigation_core.js');if(!str_contains($navigation,'__KARETA_NAVIGATION_CORE_MODULE__'))$fail[]='navigation_guard';
$context=(string)@file_get_contents($root.'/js/next/context_manager.js');if(!str_contains($context,'__KARETA_CONTEXT_MANAGER_MODULE__'))$fail[]='context_guard';
$app=(string)@file_get_contents($root.'/js/next/app_next.js');if(!str_contains($app,'__KARETA_NEXT_APP_MODULE__'))$fail[]='app_guard';
$logger=(string)@file_get_contents($root.'/js/next/runtime_logger.js');foreach(['authLifecycleFailure','kareta:api-auth-failure','[KARETA][auth.lifecycle]'] as $needle)if(!str_contains($logger,$needle))$fail[]='logger:'.$needle;
$chats=(string)@file_get_contents($root.'/js/next/pages/chats.js');foreach(['data-chat-message-search','data-chat-search-next','role="log"','aria-current="true"','data-chat-send-status','data-chat-message-search-input','__KARETA'] as $needle)if(!str_contains($chats,$needle))$fail[]='chats:'.$needle;
if(str_contains($chats,'CSS.escape('))$fail[]='chat_css_escape_dependency';
if($fail){fwrite(STDERR,implode("\n",$fail)."\n");exit(1);}echo "R188.5.5.4 verifier OK\n";
