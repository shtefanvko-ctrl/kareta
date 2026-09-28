<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){fwrite(STDERR,"CLI only\n");exit(1);} $path=$argv[1]??'';if($path===''||!is_file($path)){fwrite(STDERR,"Usage: php tools/verify_backup.php <backup.zip>\n");exit(2);} 
$zip=new ZipArchive();if($zip->open($path)!==true){fwrite(STDERR,"Cannot open backup\n");exit(1);} $raw=$zip->getFromName('_backup_manifest.json');if($raw===false){fwrite(STDERR,"Missing manifest\n");exit(1);} $m=json_decode($raw,true);if(!is_array($m)||!isset($m['files'])||!is_array($m['files'])){fwrite(STDERR,"Invalid manifest\n");exit(1);} $errors=[];
foreach($m['files'] as $name=>$hash){$data=$zip->getFromName((string)$name);if($data===false){$errors[]="missing:$name";continue;}if(!hash_equals((string)$hash,hash('sha256',$data)))$errors[]="hash:$name";}
foreach(['config.private.php','storage/logs/','storage/runtime/'] as $bad){for($i=0;$i<$zip->numFiles;$i++){$n=(string)$zip->getNameIndex($i);if($n===$bad||str_starts_with($n,$bad))$errors[]="forbidden:$n";}}
$zip->close();if($errors){fwrite(STDERR,implode("\n",array_slice($errors,0,50))."\n");exit(1);}echo "Backup verified: ".count($m['files'])." files\n";
