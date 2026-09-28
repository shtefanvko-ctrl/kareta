<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$commands=[];
foreach([
 'verify_runtime.php','verify_registry.php','verify_connectivity.php',
 'verify_r1865_identity_stabilization2.php','verify_r1865_mobile_navigation.php',
 'verify_r1865_navigation_core.php','verify_r1865_system_stability.php',
 'verify_r1865_stage13.php','verify_r1865_stage14a.php','verify_r1865_stage14b.php','verify_r1865_stage14c.php',
 'verify_r1865_stability_matrix.php'
] as $file){if(is_file($root.'/tools/'.$file))$commands[]=['php',$root.'/tools/'.$file];}
if(trim((string)shell_exec('command -v node'))!=='')$commands[]=['node',$root.'/tools/test_r1865_identity_frontend.js'];
$failed=[];
foreach($commands as $parts){$cmd=implode(' ',array_map('escapeshellarg',$parts));passthru($cmd,$code);if($code!==0)$failed[]=$cmd;}
if($failed){fwrite(STDERR,"FAILED:\n".implode("\n",$failed)."\n");exit(1);}echo "Full R186.5 stability suite OK\n";
