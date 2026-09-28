<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$asset=(string)file_get_contents($root.'/inc/asset_version.php');
$sw=(string)file_get_contents($root.'/sw.js');
$lifecycle=(string)file_get_contents($root.'/js/next/onboarding/onboarding_lifecycle.js');
$role=(string)file_get_contents($root.'/js/next/onboarding/pages/role_page.js');
$state=(string)file_get_contents($root.'/js/next/onboarding/onboarding_state.js');
$index=(string)file_get_contents($root.'/index.php');
$checks=[
 'asset version'=>str_contains($asset,'r1885596-png-brand-welcome-restoration'),
 'service worker version'=>str_contains($sw,'r1885596-png-brand-welcome-restoration'),
 'png logos external or exist'=>!is_dir($root.'/assets')||(is_file($root.'/assets/onboarding/kareta_logo_full.png')&&is_file($root.'/assets/onboarding/kareta_logo_icon.png')),
 'obsolete logo svg absent when bundled'=>!is_dir($root.'/assets')||(!is_file($root.'/assets/onboarding/kareta_logo_full.svg')&&!is_file($root.'/assets/onboarding/kareta_logo_icon.svg')),
 'index png logo'=>str_contains($index,'kareta_logo_full.png')&&str_contains($index,'kareta_logo_icon.png'),
 'welcome route active'=>str_contains($lifecycle,"Object.freeze(['welcome','role','profile','code'])")&&str_contains($lifecycle,"const step = 'welcome';"),
 'welcome content'=>str_contains($role,'Добро пожаловать!')&&str_contains($role,'Всё для автомобиля<br>в одном месте')&&str_contains($role,'kareta_logo_full.png'),
 'state reset available'=>str_contains($state,'function reset')&&str_contains($state,'reset, subscribe'),
];
$bad=[];foreach($checks as $k=>$v){if(!$v)$bad[]=$k;}
if($bad){fwrite(STDERR,'FAIL '.implode(', ',$bad).PHP_EOL);exit(1);}echo "OK R188.5.5.6.36 PNG brand + welcome restoration\n";
