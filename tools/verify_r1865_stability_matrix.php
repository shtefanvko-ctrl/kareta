<?php
declare(strict_types=1);
$root=dirname(__DIR__);$errors=[];
function check(bool $ok,string $name,array &$errors):void{if(!$ok)$errors[]=$name;}
$identity=(string)@file_get_contents($root.'/js/next/identity_frontend.js');
$app=(string)@file_get_contents($root.'/js/next/app_next.js');
$shell=(string)@file_get_contents($root.'/js/next/shell_nav.js');
$resolver=(string)@file_get_contents($root.'/api/identity/auth_resolver.php');
check(str_contains($identity,"mode:'anonymous'"),'identity state mode',$errors);
check(str_contains($identity,'mode:state.mode'),'identity snapshot mode',$errors);
check(substr_count($app,"snapshot?.()?.mode==='identity'")>=2,'app identity route mode',$errors);
check(str_contains($shell,"snapshot?.()?.mode==='identity'"),'shell identity route mode',$errors);
check(str_contains($resolver,'context_recovered'),'resolver context recovery',$errors);
check(str_contains($resolver,'freshIdentity'),'resolver re-read session',$errors);
check(is_file($root.'/tools/test_r1865_identity_frontend.js'),'frontend test file',$errors);
check((bool)preg_match('/(?:r186[5-9]|r18[7-9][0-9]*)-[a-z0-9-]+/',(string)@file_get_contents($root.'/inc/asset_version.php')),'asset version',$errors);
check((bool)preg_match('/(?:r186[5-9]|r18[7-9][0-9]*)-[a-z0-9-]+/',(string)@file_get_contents($root.'/sw.js')),'sw version',$errors);
if($errors){fwrite(STDERR,'FAIL: '.implode(', ',$errors).PHP_EOL);exit(1);}echo "R186.5 Stability Matrix OK\n";
