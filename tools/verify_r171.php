<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$errors=[];
foreach(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS)) as $file){
    if(!$file->isFile() || strtolower($file->getExtension())!=='php' || $file->getPathname()===__FILE__) continue;
    $text=file_get_contents($file->getPathname());
    if(strpos($text, '...$')!==false) $errors[]='PHP 7.4 incompatible associative array unpack: '.substr($file->getPathname(), strlen($root)+1);
}
$bootstrap=file_get_contents($root.'/api/bootstrap.php');
foreach(['mb_strtolower','mb_strtoupper','mb_strlen','mb_substr'] as $fn){ if(strpos($bootstrap, "function {$fn}")===false) $errors[]="mbstring fallback missing: {$fn}"; }
$seller=file_get_contents($root.'/api/seller_shop.php');
if(substr_count($seller, 'array_merge(')<3) $errors[]='shop catalog fallback merge hardening missing';
$db=file_get_contents($root.'/api/db.php');
if(strpos($db, "db_pull_recovery(null, new RuntimeException('db_unavailable'))")===false) $errors[]='pull no-db recovery missing';
$version=require $root.'/inc/asset_version.php';
$sw=file_get_contents($root.'/sw.js');
if(strpos($sw, KARETA_ASSET_VERSION)===false) $errors[]='service worker version mismatch';
if($errors){fwrite(STDERR, implode("\n",$errors)."\n"); exit(1);}
echo "R171 server recovery checks: OK\n";
