<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];$read=static fn($f)=>(string)@file_get_contents($root.'/'.$f);
$need=['docs/releases/changelog/CHANGELOG_R188_5_5_6_53.md','tools/test_r1885613_master_reviews_social_contract.js','js/next/pages/master_reviews.js','css/next/master_reviews_social.css','api/migrations/111_master_reviews_social_contract.php','tools/shell_freeze_manifest_r1885603.json'];
foreach($need as $f)if(!is_file($root.'/'.$f))$fail[]='missing '.$f;
if(!preg_match("/KARETA_DB_VERSION',\s*(\d+)/",$read('config.php'),$m)||((int)$m[1])<111)$fail[]='db version must be >=111';
$route=$read('js/next/route_registry.js');$app=$read('js/next/app_next.js');$page=$read('js/next/pages/master_reviews.js');$db=$read('api/db.php');$comments=$read('api/work_posts.php');$order=$read('js/next/pages/work_order.js');$detail=$read('js/next/pages/work_feed.js');$catalog=$read('api/catalog_details.php');$registry=$read('inc/asset_registry.php');
foreach(['masterReviews','#/master/reviews','providerReviews','#/masters/reviews'] as $t)if(!str_contains($route,$t))$fail[]='route missing '.$t;
foreach(['KaretaMasterReviewsPages','renderMasterReviews','mountMasterReviews','renderProviderReviews','mountProviderReviews'] as $t)if(!str_contains($app,$t))$fail[]='app missing '.$t;
foreach(['Отзывы клиентов','Ждут ответа','Ответить на отзыв','ПОДТВЕРЖДЁННАЯ РЕПУТАЦИЯ','masterReviews.reply'] as $t)if(!str_contains($page,$t))$fail[]='reviews UI missing '.$t;
if(str_contains($page,'<select')||str_contains($page,'Swiper'))$fail[]='reviews native UI violation';
foreach(['kareta_sync_verified_master_review','qualityRating','timingRating','neatnessRating','communicationRating','master_reply_at','JOIN orders o ON o.id=mr.order_id AND o.status=\'done\''] as $t)if(!str_contains($db,$t))$fail[]='verified review server missing '.$t;
foreach(['account_id','person_id','author_master_id','author_sto_id','isWorkAuthorReply','kareta_require_api_session'] as $t)if(!str_contains($comments,$t))$fail[]='comments contract missing '.$t;
foreach(["reviewRatingField('qualityRating'","reviewRatingField('timingRating'","reviewRatingField('neatnessRating'","reviewRatingField('communicationRating'",'input type="radio"'] as $t)if(!str_contains($order,$t))$fail[]='order review UI missing '.$t;
if(!str_contains($detail,'Автор работы'))$fail[]='work detail author reply badge missing';
if(!str_contains($catalog,"JOIN orders o ON o.id=mr.order_id AND o.status='done'"))$fail[]='public provider reviews are not verified by completed order';
foreach(['js/next/pages/master_reviews.js','css/next/master_reviews_social.css'] as $t)if(!str_contains($registry,$t))$fail[]='asset registry missing '.$t;
foreach(['inc/asset_version.php','sw.js'] as $f)if(!str_contains($read($f),'r1885613-master-reviews-social-contract'))$fail[]=$f.' release suffix missing';
$manifest=json_decode($read('tools/shell_freeze_manifest_r1885603.json'),true);foreach(($manifest['files']??[]) as $file=>$hash){$path=$root.'/'.$file;if(!is_file($path)){$fail[]='shell file missing '.$file;continue;}if(hash_file('sha256',$path)!==$hash)$fail[]='SHELL FREEZE VIOLATION '.$file;}
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.53 verified reviews + comments + native UI + shell freeze: OK\n";
