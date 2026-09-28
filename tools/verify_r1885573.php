<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$read=static fn(string $file):string=>(string)@file_get_contents($root.'/'.$file);
$has=static function(string $file,string $needle)use($read,&$fail):void{if(!str_contains($read($file),$needle))$fail[]=$file.': missing '.$needle;};
foreach(['docs/releases/changelog/CHANGELOG_R188_5_5_6_13.md','docs/releases/deploy/DEPLOY_R188_5_5_6_13.md','tools/test_r1885573_context_auto_activation.js'] as $file)if(!is_file($root.'/'.$file))$fail[]='missing file: '.$file;
foreach(['KARETA_ACCOUNT_TYPE_APPROVAL_MODE','account_type_approval_mode','test_auto','admin_review'] as $needle)$has('config.php',$needle);
foreach(['public function accountTypeApprovalMode','public function autoApprovePendingApplications',"\$autoApproved=\$approvalMode==='test_auto'","\$status=\$autoApproved?'approved':'pending'",'targetContextId','account_type_context_not_materialized'] as $needle)$has('api/identity/context_service.php',$needle);
foreach(['approvalMode','autoApproved','targetContextId'] as $needle)$has('api/context.php',$needle);
foreach(['payload?.request?.autoApproved','добавлен для тестирования и включён','{toast:false,closeMenu:false}'] as $needle)$has('js/next/context_manager.js',$needle);
$manager=$read('js/next/context_manager.js');if(substr_count($manager,"addEventListener('click',()=>load(true))")!==0)$fail[]='duplicate retry listener remains';
foreach(['inc/asset_version.php','sw.js','js/next/core/realtime_client.js','index.php'] as $file)$has($file,'r1885573-temporary-account-type-auto-activation');
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.13 verifier OK".PHP_EOL;
