<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$errors=[];
$nav=file_get_contents($root.'/js/next/navigation_core.js');
$hub=file_get_contents($root.'/js/next/smart_action_hub.js');
$ver=file_get_contents($root.'/inc/asset_version.php');
$checks=[
  'atomic switch guard'=>str_contains($nav,"context_switch_in_progress"),
  'rollback'=>str_contains($nav,'restorePrevious'),
  'cross-tab channel'=>str_contains($nav,"kareta-account-context"),
  'start route navigation'=>str_contains($nav,"source:'account-context-switch'"),
  'phase events'=>str_contains($nav,'kareta:context-switch-phase'),
  'hub switching status'=>str_contains($hub,'data-account-switch-status'),
  'hub disabled buttons'=>str_contains($hub,"state.switching||active"),
  'release version'=>preg_match('/r(1877|188|188[1-9]|18[9-9][0-9])-/', $ver) === 1,
];
foreach($checks as $name=>$ok){if(!$ok)$errors[]=$name;}
if($errors){fwrite(STDERR,"R187.7 verifier failed: ".implode(', ',$errors).PHP_EOL);exit(1);}echo "R187.7 verifier OK\n";
