<?php
declare(strict_types=1);
require_once __DIR__.'/../api/used_market.php';
set_error_handler(static function(int $severity,string $message,string $file,int $line): never {throw new ErrorException($message,0,$severity,$file,$line);});
$viewerId=7;
function kareta_resolve_api_actor(PDO $pdo): array {global $viewerId;return $viewerId?['id'=>$viewerId]:[];}
function kareta_session_user(): array {return [];}
final class CatalogResponse extends RuntimeException {
    public function __construct(public array $payload,public int $statusCode){parent::__construct('response');}
}
function kareta_json(array $payload,int $code=200): void {throw new CatalogResponse($payload,$code);}
final class CatalogPDO extends PDO {
    public array $queries=[];
    public function __construct(){
        parent::__construct('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
        parent::exec("CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT,phone TEXT);
        INSERT INTO users VALUES(7,'Seller','777');
        CREATE TABLE used_market_favorites(user_id INTEGER,listing_id TEXT,PRIMARY KEY(user_id,listing_id));
        CREATE TABLE used_market_listings(id TEXT PRIMARY KEY,seller_user_id INTEGER,title TEXT,category TEXT,listing_type TEXT,price REAL,price_negotiable INTEGER DEFAULT 0,city TEXT,condition_code TEXT DEFAULT 'good',brand TEXT DEFAULT '',oem_number TEXT DEFAULT '',vehicle TEXT DEFAULT '',description TEXT DEFAULT 'Part',defects_text TEXT DEFAULT '',exchange_note TEXT DEFAULT '',images_json TEXT DEFAULT '[]',delivery_modes_json TEXT DEFAULT '[]',status TEXT,views INTEGER DEFAULT 0,created_at TEXT DEFAULT '2026-10-03',updated_at TEXT DEFAULT '2026-10-03');");
    }
    // Runtime MySQL DDL is intentionally bypassed. The actual list SELECTs run.
    public function exec(string $statement): int|false {return 0;}
    public function prepare(string $query,array $options=[]): PDOStatement|false {$this->queries[]=$query;return parent::prepare($query,$options);}
}
$db=new CatalogPDO();
$insert=$db->prepare('INSERT INTO used_market_listings(id,seller_user_id,title,category,listing_type,price,city,status) VALUES(?,?,?,?,?,?,?,?)');
for($i=1;$i<=205;$i++)$insert->execute([sprintf('u%03d',$i),7,$i===205?'Wanted starter':'Part '.$i,'engine','used',$i,'Өскемен','active']);
foreach([
    ['swap',7,'Swap starter','engine','exchange',0,'Өскемен','active'],
    ['restored',7,'Restored starter','engine','restored',250,'Өскемен','active'],
    ['new',7,'New starter','engine','new',300,'Өскемен','active'],
    ['other-city',8,'Wanted starter','electrical','used',400,'Алматы','active'],
    ['draft',7,'Draft starter','engine','used',1,'Өскемен','draft'],
    ['deleted',7,'Deleted starter','engine','used',1,'Өскемен','deleted'],
] as $row)$insert->execute($row);
$db->prepare('INSERT INTO used_market_favorites VALUES(?,?)')->execute([7,'u205']);
$cases=0;
function catalog(array $params,int $expectedCode=200): array {
    global $db,$cases;
    try{kareta_used_market_list($db,$params);throw new RuntimeException('Missing response');}
    catch(CatalogResponse $r){if($r->statusCode!==$expectedCode)throw new RuntimeException('Unexpected HTTP status');$cases++;return $r->payload;}
}
function check(bool $condition,string $message): void {if(!$condition)throw new RuntimeException($message);}
$first=catalog(['surface'=>'used','type'=>'used','city'=>'Өскемен','limit'=>50]);
check(count($first['items'])===50&&$first['matchedTotal']===205&&$first['nextOffset']===50,'First bounded page/count');
$ids=[];
for($offset=0;$offset<205;$offset+=50){
    $page=catalog(['surface'=>'used','type'=>'used','city'=>'Өскемен','limit'=>50,'offset'=>$offset]);
    array_push($ids,...array_column($page['items'],'id'));
    check($page['total']===count($page['items']),'Legacy total is page count');
}
check(count($ids)===205&&count(array_unique($ids))===205&&end($ids)==='u205','Stable pages reach beyond former 200-row cap');
$wanted=catalog(['surface'=>'used','search'=>'Wanted starter','category'=>'engine','city'=>'Өскемен']);
check(array_column($wanted['items'],'id')===['u205'],'Server filters find an item beyond first page');
$sale=catalog(['surface'=>'used','type'=>'sale']);
check($sale['matchedTotal']===207&&!in_array('swap',array_column($sale['items'],'id'),true),'Sale includes used/restored, excludes swaps/new');
$swap=catalog(['surface'=>'used','type'=>'exchange']);check(array_column($swap['items'],'id')===['swap'],'Swap mode');
$favorites=catalog(['surface'=>'used','favorites'=>'1']);check(array_column($favorites['items'],'id')===['u205']&&$favorites['items'][0]['favorite'],'Server favorite selection');
$mine=catalog(['mine'=>'1']);check(in_array('draft',array_column($mine['items'],'id'),true)&&!in_array('deleted',array_column($mine['items'],'id'),true),'Owner visibility includes draft, excludes deleted');
$negative=catalog(['limit'=>-3,'offset'=>-20]);check($negative['limit']===1&&$negative['offset']===0,'Bound negative pagination');
$large=catalog(['limit'=>999999,'offset'=>999999999999]);check($large['limit']===200&&$large['offset']===2000000000&&!$large['hasMore'],'Bound large pagination');
$empty=catalog(['search'=>"' OR 1=1 --"]);check($empty['items']===[]&&$empty['matchedTotal']===0,'Search remains parameterized');
$last=catalog(['surface'=>'used','type'=>'used','city'=>'Өскемен','offset'=>200,'limit'=>50]);check(count($last['items'])===5&&!$last['hasMore']&&$last['nextOffset']===null,'Last-page semantics');
$price=catalog(['surface'=>'used','type'=>'used','city'=>'Өскемен','sort'=>'price_desc','limit'=>1]);check($price['items'][0]['id']==='u205','Server price sorting before limit');
$viewerId=0;
check(catalog(['mine'=>'1'],401)['error']==='auth_required','Anonymous mine rejected');
check(catalog(['favorites'=>'1'],401)['error']==='auth_required','Anonymous favorites rejected');
echo "USED_MARKET_PAGINATION: PASS ($cases requests; real SELECTs on SQLite, no live MySQL)\n";
