<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$migration=(string)file_get_contents($root.'/api/migrations/061_organization_core.php');
$endpoint=(string)file_get_contents($root.'/api/organizations.php');
$config=(string)file_get_contents($root.'/config.php');
$asset=(string)file_get_contents($root.'/inc/asset_version.php');
$checks=[
 'migration 61 exists'=>is_file($root.'/api/migrations/061_organization_core.php'),
 'organizations table'=>strpos($migration,'CREATE TABLE IF NOT EXISTS `organizations`')!==false,
 'memberships table'=>strpos($migration,'CREATE TABLE IF NOT EXISTS `organization_members`')!==false,
 'units table'=>strpos($migration,'CREATE TABLE IF NOT EXISTS `organization_units`')!==false,
 'relations table'=>strpos($migration,'CREATE TABLE IF NOT EXISTS `organization_relations`')!==false,
 'capabilities table'=>strpos($migration,'CREATE TABLE IF NOT EXISTS `user_capabilities`')!==false,
 'legacy STO backfill'=>strpos($migration,"'service_station'")!==false,
 'legacy shop backfill'=>strpos($migration,"'parts_store'")!==false,
 'legacy master links mirrored'=>strpos($migration,'FROM sto_master_links')!==false,
 'context endpoint'=>strpos($endpoint,"\$action==='contexts'")!==false,
 'context authorization'=>strpos($endpoint,'context_not_available')!==false,
 'db version 61'=>strpos($config,"KARETA_DB_VERSION', 61")!==false,
 'asset version R175'=>strpos($asset,'organization-core-r175')!==false,
];
$failed=[];foreach($checks as $name=>$ok){echo($ok?'[OK] ':'[FAIL] ').$name.PHP_EOL;if(!$ok)$failed[]=$name;}exit($failed?1:0);
