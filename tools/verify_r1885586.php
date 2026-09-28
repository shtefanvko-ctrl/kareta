<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$read=static fn(string $file):string=>(string)@file_get_contents($root.'/'.$file);
foreach(['css/next/master_surfaces.css','tools/test_r1885586_master_surface_header_removal.js','docs/releases/changelog/CHANGELOG_R188_5_5_6_26.md'] as $file){if(!is_file($root.'/'.$file))$fail[]='missing '.$file;}
$r84=str_contains($read('inc/asset_version.php'),'r1885644-global-ux-cleanup-legacy-removal');$runtime=is_file($root.'/js/next/master_surface_runtime.js')?$read('js/next/master_surface_runtime.js'):'';$css=$read('css/next/master_surfaces.css');
if(str_contains($runtime,'k-master-surface-header')||str_contains($runtime,'data-master-surface-header'))$fail[]='master surface header still rendered';
if(str_contains($css,'.k-master-surface-header'))$fail[]='master surface header CSS still present';
if($r84){if($runtime!=='')$fail[]='R84 legacy master surface injector still exists';}else{foreach(['addOrdersSummary(page)','addRouteNote(page,routeKey)'] as $marker)if(!str_contains($runtime,$marker))$fail[]='missing runtime marker '.$marker;}
foreach(['inc/asset_version.php','sw.js'] as $file)if(!str_contains($read($file),'r1885586-master-surface-header-removal'))$fail[]=$file.' asset marker';
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "OK R188.5.5.6.26 master surface header removal\n";
