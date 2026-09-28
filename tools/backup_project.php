<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR,"CLI only\n"); exit(1); }
$root=dirname(__DIR__);$dir=$root.'/storage/backups';if(!is_dir($dir)&&!mkdir($dir,0775,true)&&!is_dir($dir)){throw new RuntimeException('Cannot create backup dir');}
$stamp=date('Ymd_His');$out=$dir.'/kareta_project_'.$stamp.'.zip';
$deny=['config.private.php','storage/backups/','storage/logs/','storage/runtime/','.git/','node_modules/'];
$zip=new ZipArchive();if($zip->open($out,ZipArchive::CREATE|ZipArchive::OVERWRITE)!==true)throw new RuntimeException('Cannot create zip');
$files=[];$it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root,FilesystemIterator::SKIP_DOTS));
foreach($it as $f){if(!$f->isFile())continue;$rel=str_replace('\\','/',substr($f->getPathname(),strlen($root)+1));$skip=false;foreach($deny as $d){if($rel===$d||str_starts_with($rel,$d)){$skip=true;break;}}if($skip||preg_match('~(?:\.tmp$|~$|\.bak$|_old\.php$)~i',$rel))continue;$zip->addFile($f->getPathname(),$rel);$files[$rel]=hash_file('sha256',$f->getPathname());}
ksort($files);$manifest=['format'=>2,'createdAt'=>date(DATE_ATOM),'assetVersion'=>defined('KARETA_ASSET_VERSION')?KARETA_ASSET_VERSION:null,'fileCount'=>count($files),'files'=>$files,'excluded'=>$deny];
$zip->addFromString('_backup_manifest.json',json_encode($manifest,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT));$zip->close();echo $out.PHP_EOL;
