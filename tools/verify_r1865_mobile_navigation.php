<?php
$root=dirname(__DIR__);$checks=[
'version'=>preg_match('/(?:r186[5-9]|r18[7-9][0-9]*)-/',(string)@file_get_contents($root.'/inc/asset_version.php'))===1,
'max5'=>str_contains(file_get_contents($root.'/js/next/dynamic_navigation.js'),'candidates.slice(0,4)'),
'more'=>str_contains(file_get_contents($root.'/js/next/shell_nav.js'),'data-mobile-more'),
'css'=>str_contains(file_get_contents($root.'/css/next/app_next.css'),'--k-mobile-nav-count'),
'aliases'=>str_contains(file_get_contents($root.'/js/next/dynamic_navigation.js'),'CAPABILITY_ALIASES'),
];foreach($checks as $k=>$v){echo $k.': '.($v?'OK':'FAIL').PHP_EOL;if(!$v)exit(1);}echo 'R186.5 mobile navigation hardening verification passed'.PHP_EOL;
