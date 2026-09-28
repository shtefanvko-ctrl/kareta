<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$asset=(string)file_get_contents($root.'/inc/asset_version.php');
$sw=(string)file_get_contents($root.'/sw.js');
$js=(string)file_get_contents($root.'/js/next/pages/work_feed.js');
$css=(string)file_get_contents($root.'/css/next/app_next.css');
$r71=str_contains($js,"MASTER_UI_R71_CONTRACT='R188.5.5.6.71'");
$checks=[
 'asset version'=>str_contains($asset,'r1885595-exchange-card-visual-states'),
 'service worker version'=>str_contains($sw,'r1885595-exchange-card-visual-states'),
 'semantic states'=>str_contains($js,'data-exchange-card-state="${cardState}"'),
 'semantic icons'=>$r71?(str_contains($js,"uiSvg('car')")&&str_contains($js,"uiSvg('services')")):(str_contains($js,"exchangeCardIcon('vehicle')")&&str_contains($js,"exchangeCardIcon('service')")),
 'mobile visual states'=>str_contains($css,'.k-exchange-card--dispatch.is-responded::before')&&str_contains($css,'.k-exchange-card--dispatch.is-won::before'),
 'compact quick response'=>str_contains($css,'@media(min-width:390px) and (max-width:700px)'),
];
$bad=[];foreach($checks as $k=>$v){if(!$v)$bad[]=$k;}
if($bad){fwrite(STDERR,'FAIL '.implode(', ',$bad).PHP_EOL);exit(1);}echo "OK R188.5.5.6.35 exchange card visual states\n";
