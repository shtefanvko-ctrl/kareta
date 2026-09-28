<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$asset=(string)file_get_contents($root.'/inc/asset_version.php');
$sw=(string)file_get_contents($root.'/sw.js');
$js=(string)file_get_contents($root.'/js/next/pages/work_feed.js');
$css=(string)file_get_contents($root.'/css/next/app_next.css');
$checks=[
 'asset version'=>str_contains($asset,'r1885594-exchange-mobile-card-simplification'),
 'service worker version'=>str_contains($sw,'r1885594-exchange-mobile-card-simplification'),
 'details card'=>str_contains($js,'k-exchange-card__details'),
 'mobile two tab columns'=>str_contains($css,'grid-template-columns:repeat(2,minmax(0,1fr))'),
];
$bad=[];foreach($checks as $k=>$v){if(!$v)$bad[]=$k;}
if($bad){fwrite(STDERR,'FAIL '.implode(', ',$bad).PHP_EOL);exit(1);}echo "OK R188.5.5.6.34 exchange mobile cards\n";
