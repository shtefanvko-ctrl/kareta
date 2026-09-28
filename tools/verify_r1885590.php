<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$read=static fn(string $p):string => (string)@file_get_contents($root.'/'.$p);
$nav=$read('js/next/navigation_state.js');
$exchange=$read('js/next/pages/work_feed.js');
$work=$read('js/next/pages/work_order.js');
$asset=$read('inc/asset_version.php');
$sw=$read('sw.js');
$checks=[
 'navigation release'=>str_contains($nav,'r1885590-full-page-session-state'),
 'cross document state'=>str_contains($nav,'DOCUMENT_ID')&&str_contains($nav,'MutationObserver'),
 'safe drafts'=>str_contains($nav,'isSensitive')&&str_contains($nav,'one-time-code'),
 'details and panels'=>str_contains($nav,'captureDetails')&&str_contains($nav,'captureExpanded'),
 'safe modal restore'=>str_contains($nav,'registerModalRestorer')&&str_contains($nav,'captureSafeModal'),
 'exchange state'=>str_contains($exchange,'exchange.search')&&str_contains($exchange,'master-exchange-response'),
 'work order async restore'=>str_contains($work,'restoreAfterAsync')&&str_contains($work,'openSafeModal'),
 'asset version'=>str_contains($asset,'r1885590-full-page-session-state'),
 'service worker version'=>str_contains($sw,'r1885590-full-page-session-state'),
];
$bad=[];foreach($checks as $name=>$ok)if(!$ok)$bad[]=$name;
if($bad){fwrite(STDERR,'FAIL '.implode(', ',$bad).PHP_EOL);exit(1);}echo "OK R188.5.5.6.30 full page session state\n";
