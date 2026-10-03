<?php
declare(strict_types=1);
require_once __DIR__.'/../api/city_catalog.php';
require_once __DIR__.'/../api/production_dispatch.php';
$n=0;
function city_expect(bool $ok,string $message): void {global $n;$n++;if(!$ok)throw new RuntimeException($message);}
foreach(kareta_city_catalog() as $id=>$names)foreach($names as $name)city_expect(kareta_city_id($name)===$id,'Canonical alias: '.$name);
city_expect(kareta_city_id('  УСТЬ–КАМЕНОГОРСК ')==='kz:oskemen','Normalize city display punctuation');
city_expect(kareta_city_id('unknown')==='','Unknown city is not invented');
$s=kareta_order_city_snapshot(['city'=>'Алматы','cityId'=>'kz:almaty']);city_expect($s['cityId']==='kz:almaty','Explicit city and ID agree');
$s=kareta_order_city_snapshot(['notes'=>'Город: Өскемен']);city_expect($s['cityId']==='kz:oskemen','Legacy city resolves to stable ID');
$s=kareta_order_city_snapshot(['city'=>'Алматы'],['city'=>'Өскемен']);city_expect($s['cityId']==='kz:oskemen'&&$s['source']==='sto','Stationary destination uses selected STO city');
city_expect(kareta_dispatch_order_city(['city'=>$s['city'],'city_id'=>$s['cityId'],'notes'=>'Город: Алматы'])==='kz:oskemen','Stored destination snapshot outranks legacy customer-city note');
$s=kareta_order_city_snapshot(['city'=>'Алматы','fieldService'=>true],['city'=>'Өскемен']);city_expect($s['cityId']==='kz:almaty','Mobile service retains request city');
foreach([['city'=>'Алматы','cityId'=>'kz:astana'],['notes'=>"Город: Алматы\nГород: Астана"],['city'=>'unknown']] as $r){try{kareta_order_city_snapshot($r);throw new RuntimeException('Unexpected success');}catch(DomainException $e){city_expect($e->getMessage()==='request_city_invalid','Invalid/conflicting request rejected');}}
try{kareta_order_city_snapshot([],['city'=>'']);throw new RuntimeException('Unexpected STO success');}catch(DomainException $e){city_expect($e->getMessage()==='sto_city_unverified','Missing STO city rejected');}
city_expect(kareta_dispatch_order_city(['city'=>'Алматы','city_id'=>'kz:astana'])==='','Mismatched stored snapshot rejected');
final class CityMigrationPDO extends PDO {
    public function query(string $query,?int $fetchMode=null,mixed ...$args): PDOStatement|false {
        if($query==='SHOW COLUMNS FROM orders')$query="SELECT name AS Field FROM pragma_table_info('orders')";
        return parent::query($query);
    }
}
$db=new CityMigrationPDO('sqlite::memory:');$db->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);$db->exec('CREATE TABLE orders(id TEXT PRIMARY KEY)');$db->exec("INSERT INTO orders VALUES('old')");
$m=require __DIR__.'/../api/migrations/138_order_city_snapshot.php';($m['run'])($db);($m['run'])($db);
$r=$db->query('SELECT city,city_id FROM orders')->fetch(PDO::FETCH_ASSOC);city_expect($r===['city'=>'','city_id'=>''],'Migration is additive, repeatable and does not guess old cities');
// Validate and execute the actual modified INSERT shape with a generated empty fixture schema.
$source=file_get_contents(__DIR__.'/../api/db.php');$start=strpos($source,'function orders_create');preg_match('/INSERT INTO `orders`\s*\(([^)]+)\)\s*VALUES\(([^)]+)\)/',substr($source,$start),$match);
$columns=array_map('trim',explode(',',$match[1]));city_expect(count($columns)===substr_count($match[2],'?'),'Order INSERT parameter count');
$insertDb=new PDO('sqlite::memory:');$insertDb->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);$insertDb->exec('CREATE TABLE orders('.implode(',',array_map(static fn($c)=>'`'.$c.'` TEXT',$columns)).')');
$values=array_fill(0,count($columns),'');$values[array_search('city',$columns)]='Усть-Каменогорск';$values[array_search('city_id',$columns)]='kz:oskemen';
$insertDb->prepare('INSERT INTO orders('.$match[1].') VALUES('.$match[2].')')->execute($values);
city_expect($insertDb->query('SELECT city_id FROM orders')->fetchColumn()==='kz:oskemen','Actual INSERT SQL accepts the city snapshot');
echo "ORDER_CITY_SNAPSHOT: PASS ($n checks; SQLite migration/INSERT shape, not full create handler or live MySQL)\n";
