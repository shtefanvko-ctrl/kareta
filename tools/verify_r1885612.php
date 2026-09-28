<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
$need=['docs/releases/changelog/CHANGELOG_R188_5_5_6_52.md','tools/test_r1885612_master_verified_work_portfolio.js','js/next/pages/master_works.js','css/next/master_works_portfolio.css','api/migrations/110_work_portfolio_story.php','tools/shell_freeze_manifest_r1885603.json'];
foreach($need as $f)if(!is_file($root.'/'.$f))$fail[]='missing '.$f;
$read=static fn($f)=>(string)@file_get_contents($root.'/'.$f);
$config=$read('config.php');if(!preg_match("/KARETA_DB_VERSION',\s*(\d+)/",$config,$m)||((int)$m[1])<110)$fail[]='db version 110+ missing';
$route=$read('js/next/route_registry.js');$app=$read('js/next/app_next.js');$page=$read('js/next/pages/master_works.js');$work=$read('api/work_posts.php');$life=$read('api/master_order_lifecycle.php');$detail=$read('js/next/pages/work_feed.js');$css=$read('css/next/master_works_portfolio.css');$registry=$read('inc/asset_registry.php');
foreach(['masterWorks','#/master/works'] as $t)if(!str_contains($route,$t))$fail[]='route missing '.$t;
foreach(['KaretaMasterWorksPages','renderMasterWorks','mountMasterWorks'] as $t)if(!str_contains($app,$t))$fail[]='app missing '.$t;
foreach(['Готовы к публикации','Ожидают согласия','Опубликованные работы','data-master-work-publish','masterWorks.portfolio'] as $t)if(!str_contains($page,$t))$fail[]='portfolio UI missing '.$t;
foreach(['problem_text','diagnosis_text','parts_json','duration_minutes','price_visible','warranty_days','repair_not_completed','kareta_master_works_portfolio'] as $t)if(!str_contains($work,$t))$fail[]='work server missing '.$t;
foreach(['show_price','showPrice'] as $t)if(!str_contains($life,$t))$fail[]='publication consent missing '.$t;
if(str_contains($page,'<select')||str_contains($page,'Swiper'))$fail[]='owner portfolio native UI violation';
if(str_contains(substr($detail,strpos($detail,'async function mountWorkDetail'),strpos($detail,'window.KaretaWorkFeedPages')-strpos($detail,'async function mountWorkDetail')),'Swiper'))$fail[]='public work detail still uses Swiper';
foreach(['js/next/pages/master_works.js','css/next/master_works_portfolio.css'] as $t)if(!str_contains($registry,$t))$fail[]='asset registry missing '.$t;
foreach(['inc/asset_version.php','sw.js'] as $f)if(!str_contains($read($f),'r1885612-master-verified-work-portfolio'))$fail[]=$f.' release suffix missing';
$manifest=json_decode($read('tools/shell_freeze_manifest_r1885603.json'),true);foreach(($manifest['files']??[]) as $file=>$hash){$path=$root.'/'.$file;if(!is_file($path)){$fail[]='shell file missing '.$file;continue;}if(hash_file('sha256',$path)!==$hash)$fail[]='SHELL FREEZE VIOLATION '.$file;}
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.52 verified Master work portfolio + consent + native detail + shell freeze: OK\n";
