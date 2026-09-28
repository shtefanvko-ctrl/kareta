<?php
declare(strict_types=1);
$root=dirname(__DIR__);$errors=[];
$contract=(string)@file_get_contents($root.'/api/identity/schema_contract.php');
$health=(string)@file_get_contents($root.'/api/schema_health.php');
$bootstrap=(string)@file_get_contents($root.'/api/bootstrap.php');
$m91=(string)@file_get_contents($root.'/api/migrations/091_schema_contract_startup_recovery.php');
$config=(string)@file_get_contents($root.'/config.php');
$asset=(string)@file_get_contents($root.'/inc/asset_version.php');
if(!str_contains($contract,'final class KaretaSchemaContract'))$errors[]='contract class';
if(!str_contains($contract,"'context_members' => ['id','context_id','account_id','membership_status']"))$errors[]='context member contract';
if(!str_contains($health,'schema_contract_failed')&&!str_contains($health,"'schema'=>"))$errors[]='schema health endpoint';
if(!str_contains($bootstrap,"Post-migration schema contract failed"))$errors[]='post migration assertion';
if(!str_contains($m91,'schema_contract_audit'))$errors[]='audit migration';
if(!preg_match("~KARETA_DB_VERSION',\s*(\d+)~",$config,$m)||((int)$m[1])<91)$errors[]='db version';
if(!preg_match("~r(?:187[2-9]|18[8-9][0-9]*)-~",$asset))$errors[]='asset version';
if($errors){fwrite(STDERR,'R187.2 verifier failed: '.implode(', ',$errors).PHP_EOL);exit(1);} echo "R187.2 verifier OK\n";
