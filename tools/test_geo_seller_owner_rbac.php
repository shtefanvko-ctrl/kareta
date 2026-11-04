<?php
declare(strict_types=1);
/** Isolated SQLite RBAC negative/positive cases for the real Geo owner guard. */
if (!extension_loaded('pdo_sqlite')) { fwrite(STDERR, "BLOCKED: pdo_sqlite required\n"); exit(2); }
final class KaretaAuthResolution {
    public function __construct(
        public array $context,
        public array $capabilities=[],
        public array $deniedCapabilities=[]
    ) {}
}
require_once dirname(__DIR__) . '/api/geo_owner_access.php';
$pdo=new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
$pdo->exec("CREATE TABLE person_profiles(id INTEGER PRIMARY KEY,status TEXT,legacy_entity_type TEXT,legacy_entity_id TEXT);
CREATE TABLE organizations(id TEXT PRIMARY KEY,status TEXT,legacy_entity_type TEXT,legacy_entity_id TEXT);
CREATE TABLE organization_units(id TEXT PRIMARY KEY,organization_id TEXT,status TEXT);
INSERT INTO person_profiles VALUES(17,'active','seller_profile','91'),(18,'active','master','22'),(19,'suspended','seller_profile','92');
INSERT INTO organizations VALUES('org_shop_91','active','seller_profile','91'),('org_shop_92','suspended','seller_profile','92'),('org_sto_5','active','sto_profile','5');
INSERT INTO organization_units VALUES('unit91','org_shop_91','active'),('unit92','org_shop_92','active');");
$profile=new KaretaAuthResolution(['type'=>'profile','profileType'=>'seller','profileId'=>17],['profile.edit_own']);
$member=new KaretaAuthResolution(['type'=>'organization','organizationType'=>'parts_store','organizationKey'=>'org_shop_91'],['market.products.manage']);
$manager=new KaretaAuthResolution(['type'=>'organization','organizationType'=>'parts_store','organizationKey'=>'org_shop_91'],['profile.manage']);
$owner=new KaretaAuthResolution(['type'=>'organization','organizationType'=>'parts_store','organizationKey'=>'org_shop_91'],['*']);
$cases=[
    ['seller profile can edit its exact shop','shop','91',$profile,true],
    ['seller profile cannot edit other shop','shop','92',$profile,false],
    ['seller profile cannot edit STO','sto','5',$profile,false],
    ['seller profile cannot edit organization','organization','org_shop_91',$profile,false],
    ['products permission alone cannot move pickup','shop','91',$member,false],
    ['read-only role cannot edit org point','organization','org_shop_91',$member,false],
    ['store manager can edit own shop','shop','91',$manager,true],
    ['store manager cannot edit other shop','shop','92',$manager,false],
    ['store manager can edit own org','organization','org_shop_91',$manager,true],
    ['store manager cannot edit foreign org','organization','org_shop_92',$manager,false],
    ['store manager cannot edit unrelated STO','sto','5',$manager,false],
    ['owner can edit its own branch','organization_unit','unit91',$owner,true],
    ['owner cannot edit foreign branch','organization_unit','unit92',$owner,false],
    ['suspended org cannot edit shop','shop','92',new KaretaAuthResolution(['type'=>'organization','organizationType'=>'parts_store','organizationKey'=>'org_shop_92'],['profile.manage']),false],
    ['suspended profile cannot edit shop','shop','92',new KaretaAuthResolution(['type'=>'profile','profileType'=>'seller','profileId'=>19],['profile.edit_own']),false],
    ['denied geo capability overrides profile edit','shop','91',new KaretaAuthResolution($profile->context,['profile.edit_own'],['geo.upsert']),false],
    ['deny all overrides owner','shop','91',new KaretaAuthResolution($owner->context,['*'],['*']),false],
    ['no capability cannot edit','shop','91',new KaretaAuthResolution($profile->context,[]),false],
    ['invalid type cannot edit','invalid','91',$profile,false],
    ['empty owner ID cannot edit','shop','',$profile,false],
];
foreach($cases as [$label,$type,$ownerId,$actor,$expected]){
    $actual=geo_context_allows_owner($pdo,$actor,$type,$ownerId);
    if($actual!==$expected)throw new RuntimeException("FAIL: ".$label);
}
printf("GEO_SELLER_OWNER_RBAC: PASS %d cases\n",count($cases));
