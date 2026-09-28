<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$js=(string)file_get_contents($root.'/js/next/pages/workflow.js');
$css=(string)file_get_contents($root.'/css/next/workflow.css');
$checks=[
 'stage icons'=>str_contains($js,'k-workflow-stage-icon')&&str_contains($js,"waiting_responses:'<svg")&&str_contains($js,"in_progress:'<svg"),
 'semantic stage tiles'=>str_contains($js,'k-workflow-column__meta')&&str_contains($js,'k-workflow-column__count'),
 'mobile two column grid'=>str_contains($css,'grid-template-columns:repeat(2,minmax(0,1fr))!important'),
 'mobile slider disabled'=>str_contains($css,'overflow:visible!important')&&str_contains($css,'scroll-snap-type:none!important'),
 'narrow mobile support'=>str_contains($css,'@media(max-width:360px)'),
 'asset version'=>str_contains((string)file_get_contents($root.'/inc/asset_version.php'),'r1885592-mobile-workflow-tile-grid'),
 'service worker version'=>str_contains((string)file_get_contents($root.'/sw.js'),'r1885592-mobile-workflow-tile-grid'),
];
$bad=array_keys(array_filter($checks,fn($v)=>!$v));
if($bad){fwrite(STDERR,'FAIL '.implode(', ',$bad).PHP_EOL);exit(1);}echo "OK R188.5.5.6.32 mobile workflow tile grid\n";
