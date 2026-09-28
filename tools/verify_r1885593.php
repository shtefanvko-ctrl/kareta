<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$js=(string)file_get_contents($root.'/js/next/pages/work_feed.js');
$css=(string)file_get_contents($root.'/css/next/app_next.css');
$asset=(string)file_get_contents($root.'/inc/asset_version.php');
$sw=(string)file_get_contents($root.'/sw.js');
$checks=[
 'simple toolbar'=>str_contains($js,'k-exchange-production-toolbar k-exchange-search-toolbar'),
 'filter panel'=>str_contains($js,'data-exchange-filter-panel') && str_contains($js,'data-exchange-filter-toggle'),
 'filters retained'=>str_contains($js,'data-exchange-distance') && str_contains($js,'data-exchange-price-min') && str_contains($js,'data-exchange-urgency') && str_contains($js,'data-exchange-sort'),
 'mobile compact css'=>str_contains($css,'.k-exchange-search-toolbar') && str_contains($css,'.k-exchange-filter-panel'),
 'asset version'=>str_contains($asset,'r1885593-exchange-client-search'),
 'service worker version'=>str_contains($sw,'r1885593-exchange-client-search'),
];
$bad=[];foreach($checks as $k=>$v){if(!$v)$bad[]=$k;}
if($bad){fwrite(STDERR,'FAIL '.implode(', ',$bad).PHP_EOL);exit(1);}echo "OK R188.5.5.6.33 exchange client-style search\n";
