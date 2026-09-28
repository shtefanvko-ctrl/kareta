<?php
declare(strict_types=1);
$root=dirname(__DIR__); $errors=[];
$required=[
 'api/migrations/074_identity_capability_engine.php',
 'api/identity/capability_service.php',
 'api/identity/capability_adapter.php',
 'api/capabilities.php',
 'docs/identity/STAGE_03_CAPABILITY_ENGINE.md',
 'docs/releases/changelog/CHANGELOG_R186_5_STAGE3.md',
];
foreach($required as $file) if(!is_file($root.'/'.$file)) $errors[]='missing:'.$file;
$config=(string)file_get_contents($root.'/config.php');
$asset=(string)file_get_contents($root.'/inc/asset_version.php');
$service=(string)file_get_contents($root.'/api/identity/capability_service.php');
$migration=(string)file_get_contents($root.'/api/migrations/074_identity_capability_engine.php');
if(!preg_match("/define\('KARETA_DB_VERSION',\s*(\d+)\);/",$config,$m)||((int)$m[1])<74) $errors[]='db_version';
if(!str_contains($asset,'20260803-r1865-stage')) $errors[]='asset_version';
foreach(['function can','function require','context_capability_overrides','capability_check_audit'] as $needle) {
    if(!str_contains($service.$migration,$needle)) $errors[]='missing_token:'.$needle;
}
if($errors){fwrite(STDERR,implode("\n",$errors)."\n");exit(1);} echo "R186.5 Stage 3 verification passed\n";
