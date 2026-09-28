<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$read=static fn(string $file):string=>(string)@file_get_contents($root.'/'.$file);
$has=static function(string $file,string $needle)use($read,&$fail):void{if(!str_contains($read($file),$needle))$fail[]=$file.': missing '.$needle;};
foreach(['docs/releases/changelog/CHANGELOG_R188_5_5_6_8.md','docs/releases/deploy/DEPLOY_R188_5_5_6_8.md','css/next/mobile_services_context_grid.css','tools/test_r1885568_mobile_two_column_grids.js'] as $file)if(!is_file($root.'/'.$file))$fail[]='missing file: '.$file;
$release='r1885568-mobile-two-column-grids';
foreach(['inc/asset_version.php','sw.js','js/next/core/realtime_client.js'] as $file)$has($file,$release);
$has('index.php',"\$cacheEpoch = 'r1885568-mobile-two-column-grids'");
$has('inc/asset_registry.php',"'css/next/mobile_services_context_grid.css'");
$css=$read('css/next/mobile_services_context_grid.css');
foreach([
  '#k-page-outlet .k-services-page .k-drill-grid',
  '#k-page-outlet .k-services-page .k-services-grid',
  '#k-context-switcher .k-context-buttons',
  '#k-context-switcher .k-context-legacy-roles',
  'grid-template-columns: repeat(2, minmax(0, 1fr)) !important;'
] as $needle)if(!str_contains($css,$needle))$fail[]='css missing '.$needle;
if(str_contains($css,'grid-template-columns: 1fr'))$fail[]='mobile release css contains one-column override';
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.8 verifier OK".PHP_EOL;
