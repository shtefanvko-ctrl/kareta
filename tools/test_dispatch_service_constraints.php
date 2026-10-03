<?php
declare(strict_types=1);
require_once __DIR__.'/../api/production_dispatch.php';
set_error_handler(static function(int $severity,string $message,string $file,int $line): never {throw new ErrorException($message,0,$severity,$file,$line);});
final class DispatchTestPDO extends PDO {
    public function __construct(){
        parent::__construct('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
        $this->sqliteCreateFunction('GREATEST',static fn(...$v)=>max($v));
    }
    public function prepare(string $query,array $options=[]): PDOStatement|false {
        return parent::prepare(preg_replace('/\\bBINARY\\s+/i','',$query),$options);
    }
}
function kareta_table_exists(PDO $pdo,string $table): bool {
    $q=$pdo->prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?");$q->execute([$table]);return (bool)$q->fetchColumn();
}
function kareta_column_exists(PDO $pdo,string $table,string $column): bool {
    foreach($pdo->query('PRAGMA table_info('.$table.')')->fetchAll(PDO::FETCH_ASSOC) as $r)if($r['name']===$column)return true;return false;
}
function kareta_try_query_all(PDO $pdo,string $sql,array $args,array $fallback,string $tag): array {
    $q=$pdo->prepare($sql);$q->execute($args);return $q->fetchAll(PDO::FETCH_ASSOC);
}
function kareta_tariff_master_usage(PDO $pdo,string $id,string $date,string $orderId): array {return ['canAccept'=>$id!=='quota'];}
$checks=0;
function expect_dispatch(bool $ok,string $message): void {global $checks;$checks++;if(!$ok)throw new RuntimeException($message);}
$db=new DispatchTestPDO();
$db->exec("CREATE TABLE masters(id TEXT PRIMARY KEY,name TEXT,active INTEGER,rating REAL,availability TEXT,sto_id TEXT,city TEXT DEFAULT 'Усть-Каменогорск',work_mode TEXT DEFAULT 'shop');
CREATE TABLE service_offers(owner_type TEXT,owner_entity_id TEXT,service_id TEXT,active INTEGER,booking_enabled INTEGER,availability_status TEXT,moderation_status TEXT);
CREATE TABLE orders(master_id TEXT,status TEXT,estimated_duration_min INTEGER);");
$insert=$db->prepare('INSERT INTO masters(id,name,active,rating,availability,sto_id) VALUES(?,?,?,?,?,?)');
foreach(['partial','full','none','paused','unapproved','disabled','quota','inactive'] as $id)$insert->execute([$id,$id,$id==='inactive'?0:1,$id==='partial'?5:3,'online','sto']);
$offer=$db->prepare('INSERT INTO service_offers VALUES(?,?,?,?,?,?,?)');
foreach(['partial','full','quota','inactive'] as $id)$offer->execute(['master',$id,'oil',1,1,'available','approved']);
foreach(['full','quota','inactive'] as $id)$offer->execute(['master',$id,'brakes',1,1,'available','approved']);
foreach(['paused','unapproved','disabled'] as $id)foreach(['oil','brakes'] as $service)$offer->execute(['master',$id,$service,1,$id==='disabled'?0:1,$id==='paused'?'paused':'available',$id==='unapproved'?'pending':'approved']);
$order=['city'=>'Усть-Каменогорск','id'=>'test-order','service_ids'=>'["oil","brakes"]','priority'=>'urgent'];
$partial=kareta_dispatch_score_master_for_order($db,'partial',$order);
expect_dispatch(!$partial['eligible'],'Partial service coverage must not permit recommendation, even with high rating and urgency');
expect_dispatch($partial['eligibilityReason']==='services_incomplete','Partial coverage has an explicit reason');
expect_dispatch($partial['serviceMatch']===50.0,'Partial coverage remains visible as a diagnostic');
$full=kareta_dispatch_score_master_for_order($db,'full',$order);
expect_dispatch($full['eligibilityReason']==='services_covered','Complete coverage has an explicit reason');
expect_dispatch($full['eligible']&&$full['serviceMatch']===100.0,'All services permit recommendation');
$rank=kareta_dispatch_rank_order($db,$order);
expect_dispatch(array_column($rank,'masterId')===['full'],'Ranking excludes partial, unavailable, inactive and quota-blocked masters');
expect_dispatch($rank[0]['rank']===1,'Rank numbering preserved');
foreach(['none','paused','unapproved','disabled','inactive','quota'] as $id)expect_dispatch(!kareta_dispatch_score_master_for_order($db,$id,$order)['eligible'],$id.' must not qualify');
foreach(['[]','broken','null','{}','["oil",{}]'] as $ids){
    $result=kareta_dispatch_score_master_for_order($db,'full',['id'=>'unknown','service_ids'=>$ids]);
    expect_dispatch(!$result['eligible'],'Unknown or malformed requirements must not qualify: '.$ids);
}
$duplicate=kareta_dispatch_score_master_for_order($db,'full',['city'=>'Усть-Каменогорск','service_ids'=>'["oil","oil","brakes"]']);
expect_dispatch($duplicate['eligible']&&$duplicate['serviceMatch']===100.0,'Duplicate requirements are normalized');
$single=kareta_dispatch_score_master_for_order($db,'partial',['city'=>'Усть-Каменогорск','service_ids'=>'["oil"]']);
expect_dispatch($single['eligible'],'Single-service legacy order remains supported');
expect_dispatch(kareta_dispatch_score_master_for_order($db,'quota',['city'=>'Усть-Каменогорск','master_id'=>'quota','service_ids'=>'["oil","brakes"]'])['eligible'],'Existing assignment retains quota exception');
$db->exec('DROP TABLE service_offers');
expect_dispatch(!kareta_dispatch_score_master_for_order($db,'full',['city'=>'Усть-Каменогорск','service_ids'=>'["oil","brakes"]'])['eligible'],'Missing offer schema cannot establish eligibility');
echo "DISPATCH_SERVICE_CONSTRAINTS: PASS ($checks checks; SQLite fixture, no live MySQL)\n";
