<?php
declare(strict_types=1);
require_once __DIR__.'/test_dispatch_service_constraints.php';
$checks=0;
// Restore schema dropped by the service test before testing the cached master.
$db->exec("CREATE TABLE service_offers(owner_type TEXT,owner_entity_id TEXT,service_id TEXT,active INTEGER,booking_enabled INTEGER,availability_status TEXT,moderation_status TEXT)");
$wrongCity=kareta_dispatch_score_master_for_order($db,'full',['service_ids'=>'["oil","brakes"]','city'=>'Алматы']);
expect_dispatch(!$wrongCity['eligible'],'Complete service match cannot bypass another city');
expect_dispatch($wrongCity['eligibilityReason']==='city_mismatch','City rejection is explicit');
$legacy=kareta_dispatch_score_master_for_order($db,'full',['service_ids'=>'["oil","brakes"]','notes'=>"Ремонт\nГород: Усть-Каменогорск\nПосещение: В сервисе"]);
expect_dispatch($legacy['eligible'],'Generated legacy city line keeps matching local shop eligible');
expect_dispatch(!kareta_dispatch_score_master_for_order($db,'full',['service_ids'=>'["oil","brakes"]'])['eligible'],'Unknown city cannot be inferred');
$master=['city'=>'Усть-Каменогорск','work_mode'=>'shop'];
$local=['city'=>'Усть-Каменогорск','field_service'=>0];
$mobile=$local+['lat'=>49.95,'lng'=>82.63];$mobile['field_service']=1;
expect_dispatch(kareta_dispatch_location_eligibility($db,'test',$local,$master)['eligible'],'Local stationary work does not require GPS');
expect_dispatch(!kareta_dispatch_location_eligibility($db,'test',$mobile,$master)['eligible'],'Shop-only master cannot take mobile request');
foreach(['mobile','hybrid','both'] as $mode){
    $m=$master+['service_radius_km'=>5,'service_lat'=>49.9483,'service_lng'=>82.6285];$m['work_mode']=$mode;
    expect_dispatch(kareta_dispatch_location_eligibility($db,'test',$mobile,$m)['eligible'],$mode.' supports verified nearby mobile request');
    expect_dispatch(kareta_dispatch_location_eligibility($db,'test',$local,$m)['eligible']===($mode!=='mobile'),$mode.' stationary compatibility');
}
$m=['city'=>'Усть-Каменогорск','work_mode'=>'mobile','service_radius_km'=>1,'service_lat'=>0,'service_lng'=>0];
$edge=['city'=>'Усть-Каменогорск','field_service'=>1,'lat'=>0.00935,'lng'=>0];
expect_dispatch(kareta_dispatch_distance_km(0,0,0.00935,0)===1.0,'Boundary fixture rounds to radius for presentation');
expect_dispatch(kareta_dispatch_location_eligibility($db,'test',$edge,$m)['reason']==='outside_service_radius','Unrounded distance rejects actual overshoot');
foreach([null,0,-1,'bad',INF] as $radius){$m['service_radius_km']=$radius;expect_dispatch(!kareta_dispatch_location_eligibility($db,'test',$edge,$m)['eligible'],'Invalid/unknown radius is not replaced with preference');}
$m['service_radius_km']=5;
foreach([['lat'=>'bad','lng'=>0],['lat'=>91,'lng'=>0],['lng'=>0]] as $coords){$o=array_merge($edge,['lat'=>null,'lng'=>null],$coords);expect_dispatch(kareta_dispatch_location_eligibility($db,'test',$o,$m)['reason']==='service_distance_unverified','Invalid/missing request point rejected');}
$m['service_lat']='bad';expect_dispatch(kareta_dispatch_location_eligibility($db,'test',$edge,$m)['reason']==='service_distance_unverified','Malformed master coordinate is not cast to zero');
expect_dispatch(kareta_dispatch_order_city(['notes'=>"Город: Алматы\nГород: Астана"])==='','Ambiguous city lines rejected');
expect_dispatch(kareta_dispatch_order_city(['city'=>'Алматы','notes'=>'Город: Астана'])==='','Conflicting structured and legacy cities rejected');
expect_dispatch(kareta_dispatch_order_city(['notes'=>'Адрес: Алматы'])==='','Address text is not treated as a city');
expect_dispatch(kareta_dispatch_location_eligibility($db,'test',['city'=>'  УСТЬ–КАМЕНОГОРСК  '],$master)['eligible'],'City case/whitespace/dash normalization');
$db->exec("CREATE TABLE geo_points(owner_type TEXT,owner_id TEXT,kind TEXT,latitude REAL,longitude REAL,active INTEGER);
INSERT INTO geo_points VALUES('master','hybrid-point','service',0,0,1),('master','hybrid-point','mobile_origin',49.9483,82.6285,1)");
$hybrid=['city'=>'Усть-Каменогорск','work_mode'=>'hybrid','service_radius_km'=>5];
expect_dispatch(kareta_dispatch_location_eligibility($db,'hybrid-point',$mobile,$hybrid)['eligible'],'Hybrid mobile eligibility uses active mobile origin');
expect_dispatch(kareta_dispatch_master_origin($db,'hybrid-point',$hybrid,false)['kind']==='service','Stationary origin remains service point');
expect_dispatch(kareta_dispatch_master_order_distance($db,'hybrid-point',$mobile,$hybrid)<1,'Displayed distance uses the same mobile origin');
echo "DISPATCH_LOCATION_CONSTRAINTS: PASS ($checks checks; SQLite fixture, no live MySQL)\n";
