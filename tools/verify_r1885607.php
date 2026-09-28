<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$files=['api/client_cabinet.php','api/identity/legacy_api_bridge.php','api/db.php','api/realtime.php','js/next/pages/cabinet.js'];
foreach($files as $f){if(!is_file($root.'/'.$f)){fwrite(STDERR,"missing $f\n");exit(1);}}
$asset=file_get_contents($root.'/inc/asset_version.php');$sw=file_get_contents($root.'/sw.js');
if(!str_contains($asset,'r1885607-identity-api-client-garage-recovery')||!str_contains($sw,'r1885607-identity-api-client-garage-recovery')){fwrite(STDERR,"version mismatch\n");exit(1);} 
echo "R188.5.5.6.47 verifier OK\n";
