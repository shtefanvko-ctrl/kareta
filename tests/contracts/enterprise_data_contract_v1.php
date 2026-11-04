<?php
declare(strict_types=1);
require dirname(__DIR__,2).'/api/contracts/enterprise_data_v1.php';

$failures=[];
$expect=static function(bool $ok,string $name)use(&$failures):void{
    echo ($ok?'PASS ':'FAIL ').$name.PHP_EOL;
    if(!$ok)$failures[]=$name;
};

$dto=kareta_enterprise_data_v1_canonical_dto([
    'account_id'=>12,
    'client_vehicle_id'=>'veh_1',
    'order_id'=>'ord_1',
    'dtc_code'=>'P0300',
    'created_at'=>'2026-10-06T12:00:00Z',
]);
$expect(($dto['accountId']??null)===12,'account_id -> accountId');
$expect(($dto['vehicleId']??'')==='veh_1','client_vehicle_id -> vehicleId');
$expect(($dto['orderId']??'')==='ord_1','order_id -> orderId');
$expect(($dto['dtcCode']??'')==='P0300','dtc_code -> dtcCode');
$expect(($dto['schemaVersion']??'')==='1.0.0','schemaVersion injected');
$expect(!array_key_exists('client_vehicle_id',$dto),'canonical DTO removes mapped legacy key');

$compat=kareta_enterprise_data_v1_compat_payload(['vehicle_id'=>'veh_2','status'=>'confirmed']);
$expect(($compat['vehicle_id']??'')==='veh_2','compat keeps legacy field');
$expect(($compat['vehicleId']??'')==='veh_2','compat adds canonical field');
$expect(($compat['status']??'')==='confirmed','compat preserves English enum value');

$envelope=kareta_enterprise_data_v1_envelope(['vehicle_id'=>'veh_3'],['requestId'=>'req_test','idempotencyKey'=>'idem_test']);
$expect(($envelope['schemaVersion']??'')==='1.0.0','envelope schemaVersion');
$expect(($envelope['requestId']??'')==='req_test','envelope requestId');
$expect(($envelope['idempotencyKey']??'')==='idem_test','envelope idempotencyKey');
$expect(($envelope['data']['vehicleId']??'')==='veh_3','envelope canonical data');

exit($failures?1:0);
