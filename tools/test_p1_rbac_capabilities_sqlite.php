<?php
declare(strict_types=1);
// In-memory-only fixtures; the real capability service is under test, no production DB or sessions.
$root=dirname(__DIR__);
require $root.'/api/identity/context_service.php';
require $root.'/api/identity/capability_service.php';
$db=new PDO('sqlite::memory:');
$db->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
$db->sqliteCreateFunction('NOW',static fn()=>gmdate('Y-m-d H:i:s')); 
$db->exec("CREATE TABLE contexts (id INTEGER PRIMARY KEY, account_id INTEGER, context_type TEXT, profile_id INTEGER, capability_set_id INTEGER, status TEXT);
CREATE TABLE context_members (context_id INTEGER, account_id INTEGER, capability_set_id INTEGER, membership_status TEXT);
CREATE TABLE capability_sets (id INTEGER PRIMARY KEY, code TEXT);
CREATE TABLE capabilities (capability_set_id INTEGER, capability_key TEXT, effect TEXT);
CREATE TABLE context_capability_overrides (id INTEGER PRIMARY KEY, context_id INTEGER, account_id INTEGER, capability_key TEXT, effect TEXT, expires_at TEXT);
CREATE TABLE person_profiles (id INTEGER PRIMARY KEY, profile_type TEXT, status TEXT);
INSERT INTO capability_sets VALUES (1,'client.basic'),(2,'master.basic'),(3,'sto.owner'),(4,'seller.owner');
INSERT INTO contexts VALUES (10,101,'personal',null,1,'active'),(20,202,'profile',220,2,'active'),(30,303,'organization',null,3,'active'),(40,404,'profile',440,4,'active');
INSERT INTO person_profiles VALUES (220,'master','active'),(440,'seller','active');
INSERT INTO capabilities VALUES (1,'requests.read','allow'),(1,'vehicles.read','allow'),(2,'requests.respond','allow'),(2,'work_orders.read','allow'),(3,'organization.read','allow'),(3,'work_orders.assign','allow'),(4,'market.products.manage','allow'),(4,'market.orders.read','allow');
");
$contexts=new KaretaIdentityContextService($db);
$engine=new KaretaCapabilityService($db,$contexts);
$roles=[101=>['client',10,'requests.read'],202=>['master',20,'master.onboarding.view'],303=>['sto',30,'organization.read'],404=>['seller',40,'market.products.manage']];
$passed=0; $failed=0;
function check(bool $ok,string $name):void {global $passed,$failed;echo ($ok?'PASS':'FAIL')." $name\n";if($ok)$passed++;else $failed++;}
foreach($roles as $account=>$role){
 [$name,$ownContext,$expected]=$role;
 $caps=$engine->effective($account,$ownContext);
 check(in_array($expected,$caps['allowed'],true),"$name own capability");
 foreach($roles as $otherAccount=>$other){
  if($account===$otherAccount)continue;
  try{$engine->effective($account,$other[1]);check(false,"$name cannot enter ".$other[0]." context");}
  catch(DomainException $e){check($e->getMessage()==='context_not_available',"$name cannot enter ".$other[0]." context");}
 }
}
$db->exec("INSERT INTO context_capability_overrides VALUES (1,30,303,'work_orders.assign','deny',null)");
$fresh=new KaretaCapabilityService($db,$contexts);
$sto=$fresh->effective(303,30);
check(!in_array('work_orders.assign',$sto['allowed'],true) && in_array('work_orders.assign',$sto['denied'],true),'STO explicit deny supersedes allow');
$db->exec("UPDATE contexts SET status='archived' WHERE id=20");
try {(new KaretaCapabilityService($db,$contexts))->effective(202,20);check(false,'archived master context denied');}
catch(DomainException $e){check($e->getMessage()==='context_not_available','archived master context denied');}
$db->exec("INSERT INTO context_members VALUES (30,202,3,'suspended')");
try {(new KaretaCapabilityService($db,$contexts))->effective(202,30);check(false,'suspended STO membership denied');}
catch(DomainException $e){check($e->getMessage()==='context_not_available','suspended STO membership denied');}
$db->exec("UPDATE context_members SET membership_status='active' WHERE account_id=202 AND context_id=30");
$authorized=(new KaretaCapabilityService($db,$contexts))->effective(202,30);
check(in_array('organization.read',$authorized['allowed'],true),'explicit active STO membership grants context');
echo "TOTAL ",$passed,"/",($passed+$failed),"\n";
exit($failed>0?1:0);
