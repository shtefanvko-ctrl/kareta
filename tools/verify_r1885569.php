<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$read=static fn(string $file):string=>(string)@file_get_contents($root.'/'.$file);
foreach(['docs/releases/changelog/CHANGELOG_R188_5_5_6_9.md','docs/releases/deploy/DEPLOY_R188_5_5_6_9.md','tools/test_r1885569_smart_action_account.js'] as $file)if(!is_file($root.'/'.$file))$fail[]='missing file: '.$file;
$js=$read('js/next/smart_action_hub.js');
foreach(["MORE_WINDOW_CONTRACT='KARETA_MORE_WINDOW_V1_2'","layout:'honeycomb'",'class="k-more-window"','class="k-more-window-profile"','data-smart-action-route="cabinet"','class="k-more-window-hub"','class="k-more-window-support"'] as $needle)if(!str_contains($js,$needle))$fail[]='smart_action_hub.js missing '.$needle;
if(str_contains($js,"new Set(['grid','arc','hex'])")||str_contains($js,"layout:'arc'"))$fail[]='legacy More layouts returned';
if(is_file($root.'/css/next/smart_action_account.css'))$fail[]='legacy smart_action_account.css must be removed';
$assets=$read('inc/asset_registry.php');if(str_contains($assets,'smart_action_account.css'))$fail[]='legacy smart_action_account.css still registered';
if(!str_contains($assets,"'css/next/smart_action_hub.css'"))$fail[]='smart_action_hub.css missing from registry';
$css=$read('css/next/smart_action_hub.css');foreach(['.k-more-window-hub','.k-more-window-action--6','.k-more-window-core','.k-more-window-support'] as $needle)if(!str_contains($css,$needle))$fail[]='smart_action_hub.css missing '.$needle;
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.9 verifier OK (V1.2 override)".PHP_EOL;
