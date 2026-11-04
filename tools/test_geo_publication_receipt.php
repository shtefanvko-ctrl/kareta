<?php
declare(strict_types=1);
/** Isolated DB-free execution of the actual Geo upsert privacy/receipt code. */
function kareta_table_exists(PDO $pdo,string $table): bool { return $table==='geo_points'; }
require_once dirname(__DIR__).'/api/geo_core.php';
class GeoCaptureStatement extends PDOStatement {
    public array $last=[];
    public function __construct(){}
    public function execute(?array $params=null): bool { $this->last=$params??[]; return true; }
}
class GeoCapturePDO extends PDO {
    public GeoCaptureStatement $statement;
    public function __construct(){ $this->statement=new GeoCaptureStatement(); }
    public function prepare(string $query,array $options=[]): PDOStatement|false { return $this->statement; }
}
function assertGeo(bool $ok,string $why): void { if(!$ok)throw new RuntimeException('FAIL: '.$why); }
$pdo=new GeoCapturePDO();
$base=['ownerType'=>'shop','ownerId'=>'91','kind'=>'pickup','label'=>'Pickup',
    'city'=>'Test city','address'=>'Pickup address','latitude'=>49.9,'longitude'=>82.6,
    'visibility'=>'exact','metadata'=>['geoExactConsentRecordedAt'=>'FORGED']];
$check=static function(array $row,string $expectedVisibility,bool $expectReceipt=false)use($pdo): void{
    $saved=kareta_geo_upsert_point($pdo,$row);
    assertGeo($saved['visibility']===$expectedVisibility,'upsert visibility');
    assertGeo(($pdo->statement->last[11]??null)===$expectedVisibility,'actual SQL visibility');
    $data=(string)($pdo->statement->last[12]??'');
    $meta=$data!==''?json_decode($data,true):[];
    assertGeo(is_array($meta),'metadata JSON');
    assertGeo(($meta['geoExactConsentRecordedAt']??null)!=='FORGED','client forged consent must be stripped');
    assertGeo(!empty($meta['geoExactConsentRecordedAt'])===$expectReceipt,'server consent receipt');
};
$check($base,'hidden');
$check(array_merge($base,['publishExact'=>'true']),'hidden');
$check(array_merge($base,['publishExact'=>'false']),'hidden');
$check(array_merge($base,['publishExact'=>false]),'hidden');
$check(array_merge($base,['publishExact'=>1]),'hidden');
$check(array_merge($base,['publishExact'=>true]),'exact',true);
$check(array_merge($base,['visibility'=>'hidden','publishExact'=>true]),'hidden');
$check(array_merge($base,['kind'=>'warehouse','publishExact'=>true]),'hidden');
$check(array_merge($base,['kind'=>'mobile_origin','publishExact'=>false]),'city');
$check(array_merge($base,['kind'=>'mobile_origin','publishExact'=>true]),'exact',true);
$invalid=false;
try { kareta_geo_upsert_point($pdo,array_merge($base,['latitude'=>900])); }
catch(InvalidArgumentException $error){ $invalid=$error->getMessage()==='invalid_geo_coordinates'; }
assertGeo($invalid,'invalid coordinates blocked');
echo "GEO_PUBLICATION_RECEIPT: PASS 11 scenarios, no database access\n";
