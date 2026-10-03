<?php
declare(strict_types=1);
require_once __DIR__.'/../api/sto_workplace.php';
require_once __DIR__.'/../api/master_workplace.php';
require_once __DIR__.'/../api/master_shift_arrival.php';
require_once __DIR__.'/../api/production_dispatch.php';
set_error_handler(static function(int $s,string $m,string $f,int $l): never {throw new ErrorException($m,0,$s,$f,$l);});
final class PairResponse extends RuntimeException {public function __construct(public array $payload,public int $statusCode){parent::__construct('response');}}
function kareta_json(array $p,int $c=200): void {throw new PairResponse($p,$c);}
function kareta_session_user(): array {return ['id'=>1,'phone'=>'777'];}
function kareta_normalize_phone(string $p): string {return $p;}
function kareta_table_exists(PDO $db,string $t): bool {$sql=$db->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql'?"SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?":"SELECT name FROM sqlite_master WHERE type='table' AND name=?";$q=$db->prepare($sql);$q->execute([$t]);return (bool)$q->fetchColumn();}
function kareta_column_exists(PDO $db,string $t,string $c): bool {foreach($db->query($db->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql'?'SHOW COLUMNS FROM `'.$t.'`':'PRAGMA table_info('.$t.')')->fetchAll(PDO::FETCH_ASSOC) as $r)if(($r['name']??$r['Field'])===$c)return true;return false;}
function kareta_try_query_all(PDO $db,string $sql,array $args,array $fallback,string $tag): array {$q=$db->prepare($sql);$q->execute($args);return $q->fetchAll(PDO::FETCH_ASSOC);}
function kareta_tariff_master_usage(PDO $db,string $m,string $date,string $o): array {return ['canAccept'=>true];}
function kareta_tariff_master_guard(PDO $db,string $m,string $date,string $o,bool $respond): array {return ['canAccept'=>true];}
function kareta_tariff_record_master_acceptance(PDO $db,string $m,string $o,string $date,string $source): void {}
final class PairPDO extends PDO {
    public array $locks=[];
    public bool $failPlan=false;
    public function __construct(){
        $dsn=getenv('KARETA_PAIR_MYSQL_DSN')?:'sqlite::memory:';
        if(str_starts_with($dsn,'mysql:')&&(!str_contains($dsn,'dbname=kareta_dispatch_test;')||getenv('KARETA_PAIR_MYSQL_TEST')!=='1'))throw new RuntimeException('Only isolated kareta_dispatch_test database is permitted');
        parent::__construct($dsn,getenv('KARETA_PAIR_MYSQL_USER')?:null,getenv('KARETA_PAIR_MYSQL_PASSWORD')?:null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
        if($this->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite'){
            $this->sqliteCreateFunction('IF',static fn($c,$yes,$no)=>$c?$yes:$no);
            $this->sqliteCreateFunction('NOW',static fn()=>date('Y-m-d H:i:s'));
            $this->sqliteCreateFunction('GREATEST',static fn(...$v)=>max($v));
        }
    }
    public function prepare(string $sql,array $opts=[]): PDOStatement|false {
        if($this->failPlan&&str_starts_with($sql,'INSERT INTO master_order_plans'))throw new PDOException('injected_plan_write_failure');
        if(str_contains($sql,'FOR UPDATE')){
            if(!$this->inTransaction())throw new RuntimeException('Lock outside transaction');
            $this->locks[]=$sql;
            // Synchronize before the first locking read: MySQL may lock scanned
            // order rows for the BINARY predicate before reaching resource locks.
            if(getenv('KARETA_PAIR_WORKER')&&str_starts_with($sql,'SELECT * FROM orders')){
                $barrier=(string)getenv('KARETA_PAIR_BARRIER');$worker=(string)getenv('KARETA_PAIR_WORKER');
                file_put_contents($barrier.'/'.$worker,'ready');$deadline=microtime(true)+15;
                while(count(glob($barrier.'/*')?:[])<2){if(microtime(true)>$deadline)throw new RuntimeException('Worker barrier timeout');usleep(10000);}
            }
        }
        if($this->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite')$sql=preg_replace(['/\bBINARY\s+/i','/\s+FOR UPDATE/'],['',''],$sql);
        return parent::prepare($sql,$opts);
    }
}
$db=new PairPDO();
if(getenv('KARETA_PAIR_WORKER')){
    try{kareta_sto_assign_pair($db,['orderId'=>getenv('KARETA_PAIR_WORKER'),'masterId'=>getenv('KARETA_PAIR_MASTER'),'bayId'=>getenv('KARETA_PAIR_BAY')]);}
    catch(PairResponse $r){echo json_encode(['code'=>$r->statusCode,'payload'=>$r->payload]);exit(0);}
    throw new RuntimeException('Worker returned without response');
}
$ddl="CREATE TABLE sto_profiles(id TEXT PRIMARY KEY,user_id INTEGER,user_phone TEXT,contact_phone TEXT,city TEXT);
INSERT INTO sto_profiles VALUES('s',1,'777','777','Усть-Каменогорск');
CREATE TABLE masters(id TEXT PRIMARY KEY,name TEXT,user_id INTEGER,city TEXT,work_mode TEXT,active INTEGER,rating REAL,availability TEXT,sto_id TEXT);
INSERT INTO masters VALUES('m','Master',2,'Усть-Каменогорск','shop',1,5,'online','s'),('m2','Master2',3,'Усть-Каменогорск','shop',1,4,'online','s');
CREATE TABLE sto_master_links(sto_id TEXT,master_id TEXT,status TEXT);INSERT INTO sto_master_links VALUES('s','m','active'),('s','m2','active');
CREATE TABLE sto_service_bays(id TEXT PRIMARY KEY,sto_id TEXT,name TEXT,active INTEGER);INSERT INTO sto_service_bays VALUES('b','s','Bay',1),('b2','s','Bay2',1);
CREATE TABLE orders(id TEXT PRIMARY KEY,sto_id TEXT,status TEXT,master_id TEXT,master_user_id INTEGER,master_name TEXT,date TEXT,time TEXT,accepted_at TEXT,estimated_duration_min INTEGER,city TEXT,city_id TEXT,service_ids TEXT,service_names TEXT,client_car TEXT,vehicle_title TEXT);
CREATE TABLE service_offers(owner_type TEXT,owner_entity_id TEXT,service_id TEXT,active INTEGER,booking_enabled INTEGER,availability_status TEXT,moderation_status TEXT);
INSERT INTO service_offers VALUES('master','m','oil',1,1,'available','approved'),('master','m2','oil',1,1,'available','approved');
CREATE TABLE master_order_plans(id TEXT PRIMARY KEY,order_id TEXT UNIQUE,master_id TEXT,planned_start TEXT,planned_end TEXT,estimated_repair_min INTEGER,buffer_min INTEGER,status TEXT,source TEXT,updated_at TEXT);
CREATE TABLE sto_bay_assignments(id TEXT PRIMARY KEY,sto_id TEXT,bay_id TEXT,order_id TEXT UNIQUE,master_id TEXT,status TEXT,planned_start TEXT,planned_end TEXT,estimated_minutes INTEGER,priority_score INTEGER,updated_at TEXT);
CREATE TABLE master_schedules(master_id TEXT,work_date TEXT,start_time TEXT,end_time TEXT,is_day_off INTEGER,note TEXT);
INSERT INTO master_schedules VALUES('m','2026-10-05','09:00','18:00',0,''),('m2','2026-10-05','09:00','18:00',0,'');";
if($db->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql')$ddl=str_replace(' TEXT',' VARCHAR(255)',$ddl);
$db->exec($ddl);
$insert=$db->prepare("INSERT INTO orders(id,sto_id,status,master_id,date,time,estimated_duration_min,city,city_id,service_ids) VALUES(?,'s','accepted','','2026-10-05',?,60,'Усть-Каменогорск','kz:oskemen','[\"oil\"]')");
foreach([['o1','10:00'],['o2','10:00'],['o3','11:00'],['o4','08:00'],['o5','12:00'],['failure','16:00']] as $r)$insert->execute($r);
$n=0;
function pair_expect(bool $ok,string $m): void {global $n;$n++;if(!$ok)throw new RuntimeException($m);}
function assign_pair(PairPDO $db,string $order,string $master='m',string $bay='b'): PairResponse {try{kareta_sto_assign_pair($db,['orderId'=>$order,'masterId'=>$master,'bayId'=>$bay]);throw new RuntimeException('Missing response');}catch(PairResponse $r){pair_expect(!$db->inTransaction(),'Response has no open transaction');return $r;}}
$r=assign_pair($db,'o1');pair_expect($r->statusCode===200,'First assignment commits');
$r=assign_pair($db,'o1');pair_expect($r->statusCode===200,'Repeat identical assignment succeeds');pair_expect((int)$db->query('SELECT COUNT(*) FROM sto_bay_assignments')->fetchColumn()===1,'Repeat does not duplicate reservation');
$r=assign_pair($db,'o2');pair_expect($r->statusCode===409,'Second overlapping order is rejected');pair_expect($db->query("SELECT master_id FROM orders WHERE id='o2'")->fetchColumn()==='','Rejection leaves order unchanged');
$r=assign_pair($db,'o2','m2');pair_expect($r->statusCode===409&&in_array('bay_busy',array_column($r->payload['conflicts'],'type'),true),'Different master cannot bypass occupied bay');
$r=assign_pair($db,'o2','m','b2');pair_expect($r->statusCode===409&&in_array('order',array_column($r->payload['conflicts'],'type'),true),'Different bay cannot bypass occupied master');
$r=assign_pair($db,'o3');pair_expect($r->statusCode===200,'Adjacent half-open interval remains available');
$r=assign_pair($db,'o4');pair_expect($r->statusCode===409&&in_array('outside_hours',array_column($r->payload['conflicts'],'type'),true),'Shift bounds enforced');
$db->exec("UPDATE orders SET status='completed' WHERE id='o5'");$r=assign_pair($db,'o5');pair_expect($r->statusCode===409,'Completed order remains protected');
pair_expect(count(array_filter($db->locks,static fn($sql)=>str_contains($sql,'sto_service_bays')))>=6,'Bay resource row locks are issued');
pair_expect(count(array_filter($db->locks,static fn($sql)=>str_contains($sql,'sto_master_links')))>=6,'Master resource row locks are issued');
try{kareta_sto_pair_interval_conflicts($db,'s','m','b','o2','2026-10-05 10:00:00','2026-10-05 11:00:00',true);throw new RuntimeException('Expected transaction guard');}catch(LogicException $e){pair_expect(true,'Locked validation requires a transaction');}
$db->failPlan=true;
try{assign_pair($db,'failure');throw new RuntimeException('Expected injected write failure');}
catch(PDOException $e){pair_expect(!$db->inTransaction(),'Write failure rolls back transaction');}
$db->failPlan=false;
pair_expect($db->query("SELECT master_id FROM orders WHERE id='failure'")->fetchColumn()==='', 'Write failure rolls back order assignment');
$q=$db->prepare('SELECT COUNT(*) FROM sto_bay_assignments WHERE order_id=?');$q->execute(['failure']);pair_expect((int)$q->fetchColumn()===0,'Write failure leaves no reservation');
if($db->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql'){
    foreach([
        [['o6','m','b'],['o7','m','b'],'13:00'],
        [['o8','m','b'],['o9','m2','b'],'14:00'],
        [['o10','m','b'],['o11','m','b2'],'15:00'],
    ] as $round){
        $dir=sys_get_temp_dir().'/kareta-pair-'.bin2hex(random_bytes(8));mkdir($dir,0700);$processes=[];
        foreach([$round[0],$round[1]] as $candidate){
            [$id,$master,$bay]=$candidate;$insert->execute([$id,$round[2]]);
        }
        foreach([$round[0],$round[1]] as $candidate){
            [$id,$master,$bay]=$candidate;$env=getenv();$env['KARETA_PAIR_WORKER']=$id;$env['KARETA_PAIR_MASTER']=$master;$env['KARETA_PAIR_BAY']=$bay;$env['KARETA_PAIR_BARRIER']=$dir;
            $proc=proc_open([PHP_BINARY,__FILE__],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes,null,$env);
            if(!is_resource($proc))throw new RuntimeException('Cannot start worker');fclose($pipes[0]);$processes[]=[$proc,$pipes];
        }
        $codes=[];foreach($processes as [$proc,$pipes]){
            $stdout=stream_get_contents($pipes[1]);$stderr=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);$exit=proc_close($proc);
            if($exit!==0)throw new RuntimeException('Worker failed: '.$stderr.$stdout);
            $response=json_decode($stdout,true,512,JSON_THROW_ON_ERROR);$codes[]=$response['code'];
        }
        sort($codes);pair_expect($codes===[200,409],'Concurrent requests produce one acceptance and one conflict');
        $q=$db->prepare('SELECT COUNT(*) FROM sto_bay_assignments WHERE order_id IN (?,?)');$q->execute([$round[0][0],$round[1][0]]);pair_expect((int)$q->fetchColumn()===1,'Concurrent round persists exactly one reservation');
        foreach(glob($dir.'/*')?:[] as $file)unlink($file);rmdir($dir);
    }
    echo "STO_PAIR_MYSQL_CONCURRENCY: PASS ($n checks; three two-process master/bay collision rounds)\n";exit(0);
}
echo "STO_PAIR_TRANSACTION: PASS ($n checks; real handler/SQL on SQLite, lock statements observed, MySQL concurrency NOT RUN)\n";
