<?php
$root=dirname(__DIR__);$errors=[];
$checks=[
 'api/migrations/065_domain_integration.php'=>'$domainTitle',
 'docs/releases/changelog/CHANGELOG_R181_3_1.md'=>'Data too long for column title',
 'inc/asset_version.php'=>'20260803-r1861-realtime-stability',
 'sw.js'=>'20260803-r1861-realtime-stability',
];
foreach($checks as $file=>$needle){$path=$root.'/'.$file;if(!is_file($path)){$errors[]="missing:$file";continue;}$body=file_get_contents($path);if(strpos($body,$needle)===false)$errors[]="needle:$file:$needle";}
if($errors){fwrite(STDERR,implode("\n",$errors)."\n");exit(1);}echo "R181.3.1 verification passed\n";
