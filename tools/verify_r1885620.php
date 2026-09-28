<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];$read=static fn(string $f)=>(string)@file_get_contents($root.'/'.$f);
$need=['docs/releases/changelog/CHANGELOG_R188_5_5_6_60.md','api/migrations/115_used_market_listing_wizard.php','css/next/used_market_listing_wizard.css','tools/test_r1885620_used_market_listing_wizard.js','tools/shell_freeze_manifest_r1885603.json'];foreach($need as $f)if(!is_file($root.'/'.$f))$fail[]='missing '.$f;
$config=$read('config.php');$migration=$read('api/migrations/115_used_market_listing_wizard.php');$page=$read('js/next/pages/parts.js');$used=$read('api/used_market.php');$details=$read('js/next/pages/details.js');$css=$read('css/next/used_market_listing_wizard.css');$registry=$read('inc/asset_registry.php');$asset=$read('inc/asset_version.php');$sw=$read('sw.js');
if(!preg_match("/KARETA_DB_VERSION',\s*(\d+)/",$config,$m)||(int)$m[1]<115)$fail[]='DB version must be >=115';
foreach(["'version' => 115",'price_negotiable','defects_text','donor_vehicle_json','delivery_modes_json','delivery_note','draft_step','published_at'] as $t)if(!str_contains($migration,$t))$fail[]='migration 115 missing '.$t;
foreach(['data-listing-step-label','data-listing-progress','data-listing-gallery','data-listing-camera','data-listing-draft','data-listing-publish','listingStepTitle','ШАГ 8','compressListingImage','saveListingWizard','loadMine','data-donor-unknown','data-wizard-delivery'] as $t)if(!str_contains($page,$t))$fail[]='listing wizard missing '.$t;
if(preg_match('/<select\b/i',$page)||stripos($page,'swiper')!==false)$fail[]='parts wizard violates native UI contract';
foreach(['photo_required','delivery_required','defects_required','invalid_source_vehicle','price_negotiable','draft_step','publicationAction','source_vehicle_id','user_id=? OR user_phone=?'] as $t)if(!str_contains($used,$t))$fail[]='used market server missing '.$t;
foreach(['p.priceNegotiable','p.defects','p.deliveryModes','Пробег донора'] as $t)if(!str_contains($details,$t))$fail[]='product detail R60 missing '.$t;
foreach(['.k-parts-listing-wizard','.k-listing-photo-grid','.k-listing-progress','.k-listing-preview','height:100dvh'] as $t)if(!str_contains($css,$t))$fail[]='R60 CSS missing '.$t;
if(str_contains($css,'#k-mobile-nav')||str_contains($css,'#k-desktop-nav')||str_contains($css,'#k-menu-toggle'))$fail[]='R60 CSS alters Shell';
if(!str_contains($registry,'css/next/used_market_listing_wizard.css'))$fail[]='R60 CSS not registered';
if(!str_contains($asset,'r1885620-used-market-listing-wizard')||!str_contains($sw,'r1885620-used-market-listing-wizard'))$fail[]='R60 asset suffix missing';
$manifest=json_decode($read('tools/shell_freeze_manifest_r1885603.json'),true);foreach(($manifest['files']??[]) as $file=>$hash){$path=$root.'/'.$file;if(!is_file($path)){$fail[]='shell file missing '.$file;continue;}if(hash_file('sha256',$path)!==$hash)$fail[]='SHELL FREEZE VIOLATION '.$file;}
if($fail){fwrite(STDERR,implode(PHP_EOL,$fail).PHP_EOL);exit(1);}echo "R188.5.5.6.60 used/restored/exchange native listing wizard + drafts + migration 115 + Shell Freeze 2: OK\n";
