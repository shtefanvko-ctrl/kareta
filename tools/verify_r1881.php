<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$need=['api/migrations/094_sto_workflow_engine.php','api/sto_workflow_engine.php','docs/identity/R188_1_STO_WORKFLOW_ENGINE.md'];
foreach($need as $f)if(!is_file($root.'/'.$f))$fail[]="missing:$f";
$db=file_get_contents($root.'/config.php');if(!preg_match("/KARETA_DB_VERSION',\s*(9[4-9]|[1-9][0-9]{2,})/",$db))$fail[]='db_version';
$api=file_get_contents($root.'/api/sto_workflow_engine.php');
foreach(['intake','diagnostics','estimate','approval','quality_control','payment','delivery','completed','FOR UPDATE','workflow_transition_not_allowed'] as $x)if(!str_contains($api,$x))$fail[]="contract:$x";
$dbapi=file_get_contents($root.'/api/db.php');foreach(['stoWorkflow.get','stoWorkflow.transition','stoWorkflow.approval'] as $x)if(!str_contains($dbapi,$x))$fail[]="route:$x";
if($fail){fwrite(STDERR,implode("\n",$fail)."\n");exit(1);}echo "R188.1 STO workflow verifier OK\n";
