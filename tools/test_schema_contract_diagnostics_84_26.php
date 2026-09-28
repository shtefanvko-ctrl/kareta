<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/api/bootstrap.php';

$checks=[];
$expect=static function(string $name,bool $ok,string $detail='')use(&$checks):void{$checks[]=[$name,$ok,$detail];};
$diagnostic=[
    'category'=>'schema_or_migration_failed',
    'diagnosticCode'=>'test-schema-contract',
    'failureContext'=>[
        'stage'=>'migration.schema_contract',
        'migrationVersion'=>130,
        'migrationFile'=>'',
    ],
    'exception'=>[
        'message'=>'Post-migration schema contract failed: tables=account_types,client_first_entry_state; columns=person_profiles.publication_status,person_profiles.verification_status',
        'sqlState'=>'',
        'driverCode'=>'',
    ],
];
$meta=kareta_db_public_failure_meta($diagnostic);
$expect('schema contract reason',$meta['failureReason']==='schema_contract_failed',(string)$meta['failureReason']);
$expect('schema contract stage',$meta['failureStage']==='migration.schema_contract',(string)$meta['failureStage']);
$expect('schema contract version',(int)$meta['failedMigrationVersion']===130,(string)$meta['failedMigrationVersion']);
$expect('missing tables parsed',$meta['missingTables']===['account_types','client_first_entry_state'],json_encode($meta['missingTables']));
$expect('missing columns parsed',$meta['missingColumns']===['person_profiles.publication_status','person_profiles.verification_status'],json_encode($meta['missingColumns']));

$reconcile=$diagnostic;
$reconcile['failureContext']['stage']='migration.apply';
$reconcile['failureContext']['migrationVersion']=131;
$reconcile['failureContext']['migrationFile']='131_identity_schema_reconciliation.php';
$reconcile['exception']['message']='Schema reconciliation incomplete: tables=master_onboarding_state; columns=person_profiles.onboarding_status';
$meta2=kareta_db_public_failure_meta($reconcile);
$expect('reconciliation reason',$meta2['failureReason']==='schema_contract_failed',(string)$meta2['failureReason']);
$expect('reconciliation version',(int)$meta2['failedMigrationVersion']===131,(string)$meta2['failedMigrationVersion']);
$expect('reconciliation filename',$meta2['failedMigrationFile']==='131_identity_schema_reconciliation.php',(string)$meta2['failedMigrationFile']);
$expect('reconciliation missing table',$meta2['missingTables']===['master_onboarding_state'],json_encode($meta2['missingTables']));
$expect('reconciliation missing column',$meta2['missingColumns']===['person_profiles.onboarding_status'],json_encode($meta2['missingColumns']));

$failed=array_values(array_filter($checks,static fn($c)=>!$c[1]));
foreach($checks as [$name,$ok,$detail]) echo ($ok?'PASS ':'FAIL ').$name.($detail!==''?' — '.$detail:'').PHP_EOL;
echo 'RESULT '.(count($checks)-count($failed)).'/'.count($checks).PHP_EOL;
exit($failed?1:0);
