<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$read=static fn(string $file):string=>(string)@file_get_contents($root.'/'.$file);
$has=static function(string $file,string $needle)use($read,&$fail):void{if(!str_contains($read($file),$needle))$fail[]=$file.': missing '.$needle;};
foreach(['docs/releases/changelog/CHANGELOG_R188_5_5_6_10.md','docs/releases/deploy/DEPLOY_R188_5_5_6_10.md','docs/releases/plans/PLAN_R188_5_5_6_11_ACCOUNT_TYPE_PROFILE_FORMS.md','css/next/account_type_catalog.css','tools/test_r1885570_account_type_catalog.js'] as $file)if(!is_file($root.'/'.$file))$fail[]='missing file: '.$file;
$release='r1885570-account-type-catalog-requests';
foreach(['inc/asset_version.php','sw.js','js/next/core/realtime_client.js'] as $file)$has($file,$release);
$has('index.php',"\$cacheEpoch = 'r1885570-account-type-catalog-requests'");
$has('inc/asset_registry.php',"'css/next/account_type_catalog.css'");
foreach([
  'public function listAccountTypes',
  'public function requestAccountType',
  'ensureApprovedLegacyEntities',
  "VALUES(?,?,'pending',?)",
  "'client'=>['label'=>'Клиент'",
  "'master'=>['label'=>'Мастер'",
  "'sto'=>['label'=>'СТО'",
  "'seller'=>['label'=>'Магазин'"
] as $needle)$has('api/identity/context_service.php',$needle);
foreach(['accountTypes','request-type','requestAccountType'] as $needle)$has('api/context.php',$needle);
foreach(['accountTypes:[]','payload?.accountTypes','accountTypes:state.accountTypes'] as $needle)$has('js/next/identity_frontend.js',$needle);
foreach(['Клиент, Мастер, СТО и Магазин','data-context-type-request','На проверке','requestType','k-context-account-note'] as $needle)$has('js/next/context_manager.js',$needle);
if(str_contains($read('js/next/context_manager.js'),'Доступен один рабочий режим'))$fail[]='old single-mode message still present';
if(str_contains($read('js/next/context_manager.js'),'href="#role:client:role"'))$fail[]='broken generic client link still present';
$css=$read('css/next/account_type_catalog.css');foreach(['is-available','is-pending','is-rejected','is-setup_required','k-context-account-note'] as $needle)if(!str_contains($css,$needle))$fail[]='release css missing '.$needle;
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.10 verifier OK".PHP_EOL;
