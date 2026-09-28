<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$read=static fn(string $file):string=>(string)@file_get_contents($root.'/'.$file);
$has=static function(string $file,string $needle)use($read,&$fail):void{if(!str_contains($read($file),$needle))$fail[]=$file.': missing '.$needle;};
foreach([
  'docs/releases/changelog/CHANGELOG_R188_5_5_6_11.md','docs/releases/deploy/DEPLOY_R188_5_5_6_11.md','docs/releases/plans/PLAN_R188_5_5_6_12_ADMIN_APPROVAL.md',
  'storage/catalog/services.json','tools/test_r1885571_auto_approval_catalog_recovery.js'
] as $file)if(!is_file($root.'/'.$file))$fail[]='missing file: '.$file;
$release='r1885571-test-auto-approval-service-catalog-recovery';
foreach(['inc/asset_version.php','sw.js','js/next/core/realtime_client.js'] as $file)$has($file,$release);
$has('index.php',"\$cacheEpoch = 'r1885571-test-auto-approval-service-catalog-recovery'");
foreach([
  'KARETA_ACCOUNT_TYPE_APPROVAL_MODE','account_type_approval_mode','test_auto','admin_review'
] as $needle)$has('config.php',$needle);
$privateConfig=$read('config.private.example.php');
if(str_contains($privateConfig,"'environment' => 'production'"))$has('config.private.example.php',"'account_type_approval_mode' => 'admin_review'");
else $has('config.private.example.php',"'account_type_approval_mode' => 'test_auto'");
foreach([
  'public function accountTypeApprovalMode','autoApprovePendingApplications',
  "\$autoApproved=\$approvalMode==='test_auto'", "\$status=\$autoApproved?'approved':'pending'",
  'status=VALUES(status)', "ra.status='pending'", "ra.status='approved'"
] as $needle)$has('api/identity/context_service.php',$needle);
foreach(['approvalMode','autoApproved','request-type'] as $needle)$has('api/context.php',$needle);
foreach(['payload?.request?.autoApproved','добавлен для тестирования'] as $needle)$has('js/next/context_manager.js',$needle);
foreach([
  'incomingServices.length && snapshot.services.length','degraded/partial pull','serviceSource:snapshot.serviceSource'
] as $needle)$has('js/next/catalog/catalog_state.js',$needle);
foreach(['DB_PULL_RECOVERY_SERVICE_CATALOG','kareta_service_catalog_public_payload'] as $needle)$has('api/db.php',$needle);
foreach(['service_catalog_active_rows_missing','partial imports','expectedServices','expectedCategories'] as $needle)$has('api/catalog/service_catalog.php',$needle);
try{
  require_once $root.'/api/catalog/service_catalog.php';
  $source=kareta_service_catalog_load_source();
  $services=is_array($source['services']??null)?$source['services']:[];
  $categories=is_array($source['categories']??null)?$source['categories']:[];
  if(count($services)!==109)$fail[]='catalog services count '.count($services).' != 109';
  if(count($categories)!==20)$fail[]='catalog categories count '.count($categories).' != 20';
  $ids=[];foreach($services as $service){$id=(string)($service['id']??'');if($id===''||isset($ids[$id]))$fail[]='catalog duplicate/empty service id: '.$id;$ids[$id]=true;}
  $keys=[];foreach($categories as $category){$key=(string)($category['key']??'');if($key===''||isset($keys[$key]))$fail[]='catalog duplicate/empty category key: '.$key;$keys[$key]=true;}
  foreach($services as $service){if(!isset($keys[(string)($service['category']??'')]))$fail[]='service references unknown category: '.($service['id']??'');}
}catch(Throwable $e){$fail[]='catalog source validation failed: '.$e->getMessage();}
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.11 verifier OK".PHP_EOL;
