<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$manager=(string)file_get_contents($root.'/js/next/context_manager.js');
$menu=(string)file_get_contents($root.'/js/next/shell_menu.js');
$app=(string)file_get_contents($root.'/js/next/app_next.js');
$logger=(string)file_get_contents($root.'/js/next/runtime_logger.js');
$asset=(string)file_get_contents($root.'/inc/asset_version.php');
$checks=[
 'menu has no eager context load'=>strpos($menu,'KaretaContextManager?.load()')===false,
 '401 is anonymous state'=>strpos($manager,'response.status===401')!==false && strpos($manager,'anonymous:true')!==false,
 'anonymous context reset exists'=>strpos($manager,'function resetAnonymous()')!==false,
 'contexts load after confirmed session'=>strpos($manager,"kareta:session-confirmed")!==false && strpos($manager,'if(event.detail?.user)load(true)')!==false,
 'boot emits confirmed session'=>strpos($app,"new CustomEvent('kareta:session-confirmed'")!==false,
 'boot emits anonymous session'=>strpos($app,"new CustomEvent('kareta:session-anonymous'")!==false,
 'logger marks expected guest response'=>strpos($logger,'expectedAnonymousContext')!==false,
 'guest fix asset version'=>preg_match('/work-contexts-r176-guestfix[1-9][0-9]*/',$asset)===1,
];
$failed=[];
foreach($checks as $name=>$ok){echo($ok?'[OK] ':'[FAIL] ').$name.PHP_EOL;if(!$ok)$failed[]=$name;}
exit($failed?1:0);
