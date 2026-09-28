<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$need=['docs/releases/changelog/CHANGELOG_R188_5_5_6_49.md','tools/test_r1885609_community_native_ui.js','tools/shell_freeze_manifest_r1885603.json'];
foreach($need as $f)if(!is_file($root.'/'.$f))$fail[]='missing '.$f;
$js=@file_get_contents($root.'/js/next/pages/community.js')?:'';
$css=@file_get_contents($root.'/css/next/community.css')?:'';
$asset=@file_get_contents($root.'/inc/asset_version.php')?:'';
if(str_contains($asset,'r188568449-community-social-platform-v2')){foreach(['k-community-stories','k-community-feed-tabs','k-community-composer','renderCommunityPost','#/community/groups','#/community/question/create','data-community-comments-sheet'] as $token)if(!str_contains($js,$token))$fail[]='community V2 missing '.$token;foreach(['k-community-v2','k-community-comments-sheet','k-community-story-overlay','k-community-media-grid'] as $token)if(!str_contains($css,$token))$fail[]='community V2 css missing '.$token;$manifest=json_decode((string)@file_get_contents($root.'/tools/shell_freeze_manifest_r1885603.json'),true);foreach(($manifest['files']??[]) as $file=>$hash){$path=$root.'/'.$file;if(!is_file($path))continue;if(hash_file('sha256',$path)!==$hash)$fail[]='SHELL FREEZE VIOLATION '.$file;}if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.84.49 community social platform supersedes catalog-only R49: OK\n";exit(0);}
foreach(['k-community-native-section','k-community-group-grid','data-community-filter-open','data-community-filter-dialog','Фильтры сообщества'] as $token)if(!str_contains($js,$token))$fail[]='community native missing '.$token;
foreach(['new window.Swiper','window.Swiper','data-community-group-slider','swiper-wrapper','swiper-pagination','k-community-stories','data-community-story-strip'] as $token)if(str_contains($js,$token))$fail[]='community slider token still active '.$token;
if(str_contains($js,'<select'))$fail[]='community render contains select';
foreach(['grid-template-columns:repeat(2,minmax(0,1fr))','k-community-filter-dialog','overflow:visible!important','k-community-feed{grid-template-columns:1fr!important}'] as $token)if(!str_contains($css,$token))$fail[]='community native css missing '.$token;
foreach(['inc/asset_version.php','sw.js'] as $f){$d=@file_get_contents($root.'/'.$f)?:'';if(!str_contains($d,'r1885609-community-native-ui'))$fail[]=$f.' version missing';}
$manifest=json_decode((string)@file_get_contents($root.'/tools/shell_freeze_manifest_r1885603.json'),true);
foreach(($manifest['files']??[]) as $file=>$hash){$path=$root.'/'.$file;if(!is_file($path)){$fail[]='shell file missing '.$file;continue;}if(hash_file('sha256',$path)!==$hash)$fail[]='SHELL FREEZE VIOLATION '.$file;}
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.49 community native UI + shell freeze: OK\n";
