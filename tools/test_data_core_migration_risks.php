<?php
declare(strict_types=1);
/** Offline tests on disposable filesystem fixtures. Never bootstraps an app or DB. */
$root=dirname(__DIR__);
$tmp=sys_get_temp_dir().'/kareta-risk-audit-'.getmypid().'-'.bin2hex(random_bytes(4));
@mkdir($tmp.'/api/migrations',0700,true);
@mkdir($tmp.'/docs',0700,true);
$manifest=require $root.'/api/migration_manifest.php';
file_put_contents($tmp.'/api/migration_manifest.php', "<?php return ".var_export($manifest,true).";\n");
copy($root.'/docs/data_core_migration_risks.json',$tmp.'/docs/data_core_migration_risks.json');
$registry=json_decode((string)file_get_contents($tmp.'/docs/data_core_migration_risks.json'),true);
foreach ($registry['entries'] as $entry) copy($root.'/api/migrations/'.$entry['file'],$tmp.'/api/migrations/'.$entry['file']);
$guard=__DIR__.'/check_data_core_migration_risks.php';
$check=static function(string $name,string $status,string $code='')use($tmp,$guard):void {
    $lines=[];$exit=0;
    exec(escapeshellarg(PHP_BINARY).' '.escapeshellarg($guard).' '.escapeshellarg('--root='.$tmp).' 2>&1',$lines,$exit);
    $json=json_decode(implode("\n",$lines),true);
    $codes=array_column($json['errors']??[],'code');
    if(($json['sourceGate']??null)!==$status || ($json['releaseReady']??true)!==false || ($status==='PASS'&&$exit!==0) || ($status==='FAIL'&&$exit===0) || ($code!==''&&!in_array($code,$codes,true))){
        throw new RuntimeException($name.': '.implode("\n",$lines));
    }
    echo "PASS: {$name}\n";
};
$delete=static function(string $dir) use (&$delete):void {
    foreach(scandir($dir)?:[] as $entry){if($entry==='.'||$entry==='..')continue;$path=$dir.'/'.$entry;if(is_dir($path))$delete($path);else unlink($path);}rmdir($dir);
};
try {
    $check('baseline source inventory','PASS');
    $p=$tmp.'/api/migrations/142_client_first_entry_three_steps.php';
    file_put_contents($p,"\n// unexpected edit\n",FILE_APPEND);
    $check('changed historical migration blocked','FAIL','SOURCE_CHANGED_REQUIRE_REVIEW');
    copy($root.'/api/migrations/142_client_first_entry_three_steps.php',$p);
    file_put_contents($tmp.'/api/migrations/145_unreviewed.php',"<?php return [];\n");
    $check('unreviewed future migration blocked','FAIL','UNREVIEWED_PENDING_MIGRATION');
    unlink($tmp.'/api/migrations/145_unreviewed.php');
    $modified=$registry;$modified['entries'][0]['manualReviewRequired']=false;
    file_put_contents($tmp.'/docs/data_core_migration_risks.json',json_encode($modified));
    $check('manual review declaration cannot be removed','FAIL','RISK_ENTRY_INCOMPLETE');
    copy($root.'/docs/data_core_migration_risks.json',$tmp.'/docs/data_core_migration_risks.json');
    unlink($tmp.'/api/migrations/140_identity_schema_reconciliation.php');
    $check('missing replay migration blocked','FAIL','SOURCE_FILE_MISSING');
    copy($root.'/api/migrations/140_identity_schema_reconciliation.php',$tmp.'/api/migrations/140_identity_schema_reconciliation.php');
    $changedManifest=$manifest;$changedManifest['version']=144;
    file_put_contents($tmp.'/api/migration_manifest.php',"<?php return ".var_export($changedManifest,true).";\n");
    $check('activation requires separate reviewed inventory','FAIL','REGISTERED_MIGRATION_NOT_PENDING');
} finally { $delete($tmp); }
