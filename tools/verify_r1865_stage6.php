<?php
declare(strict_types=1);
$root=dirname(__DIR__);$errors=[];
$must=['api/migrations/077_identity_context_switch.php','api/context.php','api/identity/context_service.php','docs/identity/STAGE_06_CONTEXT_SWITCH.md','docs/releases/changelog/CHANGELOG_R186_5_STAGE6.md'];
foreach($must as $f)if(!is_file($root.'/'.$f))$errors[]='missing '.$f;
$config=(string)@file_get_contents($root.'/config.php');if(!str_contains($config,"KARETA_DB_VERSION', 77"))$errors[]='db version';
$asset=(string)@file_get_contents($root.'/inc/asset_version.php');if(!str_contains($asset,'20260803-r1865-stage'))$errors[]='asset version';
$context=(string)@file_get_contents($root.'/api/identity/context_service.php');
foreach(['organization_key','context_revision','selectContextByKey','ensureProfileContexts','ensureOrganizationContexts'] as $needle)if(!str_contains($context,$needle))$errors[]='context service '.$needle;
$api=(string)@file_get_contents($root.'/api/context.php');foreach(['contextId','contextKey','deniedCapabilities','contextChanged'] as $needle)if(!str_contains($api,$needle))$errors[]='context api '.$needle;
$status=json_decode((string)@file_get_contents($root.'/docs/identity/implementation_status.json'),true);if((int)($status['currentStage']??0)<6)$errors[]='roadmap current stage';
if($errors){fwrite(STDERR,"R186.5 stage6 FAIL\n- ".implode("\n- ",$errors)."\n");exit(1);}echo "R186.5 stage6 OK\n";
