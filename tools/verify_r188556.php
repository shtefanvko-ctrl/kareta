<?php
declare(strict_types=1);

$root=dirname(__DIR__);
$fail=[];
$read=static fn(string $file):string=>(string)@file_get_contents($root.'/'.$file);
$has=static function(string $file,string $needle)use($read,&$fail):void{
    if(!str_contains($read($file),$needle))$fail[]=$file.': missing '.$needle;
};
$lacks=static function(string $file,string $needle)use($read,&$fail):void{
    if(str_contains($read($file),$needle))$fail[]=$file.': forbidden '.$needle;
};

foreach([
    'docs/releases/changelog/CHANGELOG_R188_5_5_6.md','docs/releases/deploy/DEPLOY_R188_5_5_6.md',
    'docs/security/SECURITY_R188_5_5_6.md','docs/releases/plans/PLAN_R188_5_5_7_MASTER_STO_PAGES.md',
    'api/migrations/102_security_hardening.php','api/chat_attachment.php',
    'tools/test_r188556_security.js',
] as $file)if(!is_file($root.'/'.$file))$fail[]='missing file: '.$file;

$release='r188556-security-hardening';
foreach(['inc/asset_version.php','sw.js','js/next/core/realtime_client.js'] as $file)$has($file,$release);
$configSource=$read('config.php');if(!preg_match("/define\('KARETA_DB_VERSION',\s*(10[2-9]|1[1-9][0-9])\);/",$configSource))$fail[]='config.php: KARETA_DB_VERSION must be >=102';
$has('config.php',"KARETA_SESSION_SECURITY_EPOCH");
$has('config.php',"dirname(KARETA_ROOT) . '/kareta-storage'");
$has('api/runtime_log.php','KARETA_LOG_ROOT');
$has('api/client_error.php','KARETA_STORAGE_ROOT');
$has('api/bootstrap.php',"KARETA_SESSION_SECURITY_EPOCH");
$has('api/migrations/102_security_hardening.php',"UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW())");

$lacks('api/auth_session.php',"\$_COOKIE['kareta_phone']");
$has('api/auth_session.php',"onboarding.verifyCode");
$has('api/auth_session.php','session_regenerate_id(true)');
$has('api/profile.php',"kareta_require_any_role(['client','master','sto','seller','admin','owner'])");
$has('api/profile.php',"\$profile['phone'] = (string)(\$sessionUser['phone'] ?? '')");

$has('api/identity/challenge_service.php','random_int(100000,999999)');
$has('api/identity/challenge_service.php',"/^\\d{6}$/");
$has('api/identity/challenge_service.php','request_ip_hash');
$has('api/identity/challenge_service.php','otp_delivery_unavailable');
$lacks('api/identity/challenge_service.php',"\$code='0000'");
$lacks('api/identity/challenge_service.php',"\$code = '0000'");

$has('api/db.php',"\$_GET['action'] ?? 'ping'");
$has('api/db.php',"if (\$action === 'pull')");
$has('api/db.php',"kareta_require_any_role(['client','master','sto','seller','admin','owner'])");
$has('api/db.php',"case 'clients.upsert':    kareta_require_any_role(['sto','admin','owner'])");
$has('api/db.php',"case 'vehicles.upsert':    kareta_assert_vehicle_mutation_scope");
$has('api/db.php',"if(!\$owns)kareta_json(['ok'=>false,'error'=>'not_your_order'],403)");
$has('api/db.php',"case 'chats.create':      kareta_require_any_role");
$has('api/db.php',"kareta_json(['ok'=>false,'error'=>'account_blocked'],403)");
$has('api/db.php',"KARETA_STORAGE_ROOT.'/uploads/chat/'");
$has('api/db.php',"new finfo(FILEINFO_MIME_TYPE)");
$has('api/db.php',"\$fileUrl='secure-chat/'");

$has('api/migrations/043_demo_accounts_and_relations.php','KARETA_DEMO_SEED');
$has('api/migrations/102_security_hardening.php','role_applications');
$has('api/migrations/102_security_hardening.php',"SET a.status=CASE WHEN u.active=1 THEN 'active' ELSE 'blocked' END");
$has('api/identity_session.php',"throw new DomainException('account_not_active')");
$has('api/identity/context_service.php',"status='approved'");
$has('api/identity/identity_migration_service.php',"status='approved'");

foreach(['runtime_diagnostics.php','readiness.php','release_check.php','deploy_check.php'] as $file)$has('api/'.$file,'kareta_diagnostics_authorized()');
$has('js/next/pages/chats.js','const esc=ui.escHtml');
$has('js/next/pages/chats.js','function safeAttachmentUrl');
$has('api/chat_attachment.php','chat_participants');
$has('api/chat_attachment.php',"if(!\$allowed)kareta_json(['ok'=>false,'error'=>'forbidden'],403)");

if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}
echo "R188.5.5.6 security verifier OK".PHP_EOL;
