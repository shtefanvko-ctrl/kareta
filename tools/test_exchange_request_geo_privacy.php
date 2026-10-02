<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/production_dispatch.php';

function geo_privacy_expect(bool $condition,string $message): void {
    if(!$condition){fwrite(STDERR,"FAIL: {$message}\n");exit(1);}
}

geo_privacy_expect(kareta_dispatch_distance_km(49.9483,82.6285,49.9483,82.6285)===0.0,'same point distance');
geo_privacy_expect(kareta_dispatch_distance_km(91.0,82.0,49.0,82.0)===null,'invalid source latitude rejected');
geo_privacy_expect(kareta_dispatch_distance_km(49.0,181.0,49.0,82.0)===null,'invalid source longitude rejected');
geo_privacy_expect(kareta_dispatch_distance_km(49.0,82.0,-91.0,82.0)===null,'invalid request latitude rejected');

$notes="Шум при запуске\nГород: Усть-Каменогорск\nАдрес: ул. Пример, 10\nПосещение: Выезд мастера";
$safe=kareta_master_exchange_safe_notes($notes);
geo_privacy_expect(strpos($safe,'Адрес:')===false,'generated exact address removed from notes');
geo_privacy_expect(strpos($safe,'Шум при запуске')!==false,'problem text preserved');
geo_privacy_expect(strpos($safe,'Город: Усть-Каменогорск')!==false,'city remains visible');

$item=['notes'=>$notes,'geo'=>['address'=>'ул. Пример, 10','lat'=>49.9,'lng'=>82.6,'routeUrl'=>'secret-route','mapProvider'=>'provider']];
$hidden=kareta_master_exchange_sanitize_geo($item,4.2,false);
geo_privacy_expect(($hidden['geo']['hasPoint']??false)===true,'safe payload advertises point availability');
geo_privacy_expect(($hidden['geo']['distanceKm']??null)===4.2,'safe payload exposes distance');
geo_privacy_expect(($hidden['geo']['precision']??'')==='hidden','safe payload marks hidden precision');
geo_privacy_expect(!array_key_exists('lat',$hidden['geo']),'pre-accept latitude hidden');
geo_privacy_expect(!array_key_exists('lng',$hidden['geo']),'pre-accept longitude hidden');
geo_privacy_expect(!array_key_exists('address',$hidden['geo']),'pre-accept address hidden');
geo_privacy_expect(!array_key_exists('routeUrl',$hidden['geo']),'pre-accept route URL hidden');

$accepted=kareta_master_exchange_sanitize_geo($item,4.2,true);
geo_privacy_expect(isset($accepted['geo']['lat'],$accepted['geo']['lng']),'accepted request may retain exact geo');
geo_privacy_expect(strpos((string)$accepted['notes'],'Адрес:')===false,'duplicate generated address removed even after acceptance');

echo "EXCHANGE_REQUEST_GEO_PRIVACY: PASS\n";
