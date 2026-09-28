<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];$read=static fn(string $f)=>(string)@file_get_contents($root.'/'.$f);
$need=[
 'docs/releases/changelog/CHANGELOG_R188_5_5_6_54.md',
 'tools/test_r1885614_master_social_wall.js',
 'api/master_social_wall.php',
 'api/migrations/112_master_social_wall.php',
 'js/next/pages/master_wall.js',
 'css/next/master_social_wall.css',
 'tools/shell_freeze_manifest_r1885603.json'
];
foreach($need as $f)if(!is_file($root.'/'.$f))$fail[]='missing '.$f;
$config=$read('config.php');$migration=$read('api/migrations/112_master_social_wall.php');$server=$read('api/master_social_wall.php');$db=$read('api/db.php');$route=$read('js/next/route_registry.js');$dynamic=$read('js/next/dynamic_navigation.js');$role=$read('js/next/role_access.js');$icons=$read('js/next/ui_icons.js');$app=$read('js/next/app_next.js');$page=$read('js/next/pages/master_wall.js');$details=$read('js/next/pages/details.js');$community=$read('js/next/pages/community.js');$registry=$read('inc/asset_registry.php');
if(!preg_match("/KARETA_DB_VERSION',\s*(\d+)/",$config,$dbv)||((int)$dbv[1])<112)$fail[]='db version must be >=112';
if(!str_contains($migration,"'version' => 112"))$fail[]='migration 112 missing';
foreach(['visibility','linked_product_id','video_url','published_at','master_wall_reactions','master_wall_saved','master_wall_comments_social'] as $t)if(!str_contains($migration,$t))$fail[]='migration contract missing '.$t;
if(!str_contains($db,"require_once __DIR__ . '/master_social_wall.php'"))$fail[]='master wall server not required';
foreach(['masterSocialWall.feed','masterSocialWall.community','masterSocialWall.mine','masterSocialWall.comments','masterSocialWall.save','masterSocialWall.delete','masterSocialWall.like','masterSocialWall.saveState','masterSocialWall.comment','masterSocialWall.commentDelete'] as $t)if(!str_contains($db,$t))$fail[]='API action missing '.$t;
foreach(['note','advice','news','video','part'] as $t)if(!str_contains($server,"'{$t}'"))$fail[]='wall type missing '.$t;
foreach(['work_posts','news_articles','master_wall_posts','master_wall_reactions','master_wall_saved','master_wall_comments_social','profile.manage'] as $t)if(!str_contains($server,$t))$fail[]='wall server contract missing '.$t;
if(str_contains($server,"['note','advice','news','video','part','work']"))$fail[]='verified work must not become generic editable wall type';
foreach(['masterWallOwner','#/master/wall'] as $t)if(!str_contains($route,$t))$fail[]='route missing '.$t;
if(!str_contains($dynamic,"{ key:'masterWallOwner'")||!str_contains($dynamic,"profile.manage"))$fail[]='hidden Master wall capability route missing';
if(!str_contains($role,"'masterWallOwner'"))$fail[]='role access missing master wall';
if(!str_contains($icons,"masterWallOwner:'community'"))$fail[]='master wall icon missing';
foreach(['KaretaMasterWallPages','masterWallOwner:masterWallPages.renderMasterWall','masterWallOwner:masterWallPages.mountMasterWall'] as $t)if(!str_contains($app,$t))$fail[]='app integration missing '.$t;
foreach(['Моя Стена','Новая публикация','Публикация','Совет','Новость','Видео','Запчасть','Опубликовать','Черновик','masterSocialWall.save'] as $t)if(!str_contains($page,$t))$fail[]='owner wall UI missing '.$t;
if(str_contains($page,'<select')||str_contains($page,'Swiper'))$fail[]='owner wall Native UI violation';
foreach(['masterSocialWall.feed','masterSocialWall.comments','masterSocialWall.like','masterSocialWall.saveState'] as $t)if(!str_contains($details,$t))$fail[]='public Master wall missing '.$t;
foreach(['masterSocialWall.community','Публикации Мастеров','masterSocialWall.comment','masterSocialWall.like','masterSocialWall.saveState'] as $t)if(!str_contains($community,$t))$fail[]='Community wall integration missing '.$t;
foreach(['js/next/pages/master_wall.js','css/next/master_social_wall.css'] as $t)if(!str_contains($registry,$t))$fail[]='asset registry missing '.$t;
foreach(['inc/asset_version.php','sw.js'] as $f)if(!str_contains($read($f),'r1885614-master-social-wall'))$fail[]=$f.' release suffix missing';
foreach(['js/next/pages/master_profile_owner.js','js/next/pages/cabinet.js','js/next/pages/community.js'] as $f){$s=$read($f);if(!str_contains($s,'#/master/wall'))$fail[]=$f.' does not surface unified wall';}$workplace=$read('js/next/pages/master_workplace.js');if(!str_contains($workplace,"NATIVE_WORKPLACE_CONTRACT='R188.5.5.6.55'")&&!str_contains($workplace,'#/master/wall'))$fail[]='legacy workplace does not surface unified wall';
$manifest=json_decode($read('tools/shell_freeze_manifest_r1885603.json'),true);foreach(($manifest['files']??[]) as $file=>$hash){$path=$root.'/'.$file;if(!is_file($path)){$fail[]='shell file missing '.$file;continue;}if(hash_file('sha256',$path)!==$hash)$fail[]='SHELL FREEZE VIOLATION '.$file;}
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.54 unified Master social wall + Community + Native UI + shell freeze: OK\n";
