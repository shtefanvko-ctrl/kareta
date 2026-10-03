<?php
declare(strict_types=1);

require_once __DIR__.'/../api/used_market.php';
set_error_handler(static function(int $severity,string $message,string $file,int $line): never {
    throw new ErrorException($message,0,$severity,$file,$line);
});

$valid = [
    'title'=>'Стартер', 'description'=>'Рабочая деталь', 'city'=>'Өскемен',
    'images'=>['https://example.test/starter.jpg'], 'deliveryModes'=>['pickup'],
    'price'=>12000, 'priceNegotiable'=>false, 'listingType'=>'used',
    'exchangeNote'=>'', 'condition'=>'good', 'defects'=>'',
];
$checks = 0;
function publication_expect(array $listing, ?string $expected): void {
    global $checks;
    $actual = kareta_used_market_publication_error($listing)['error'] ?? null;
    if ($actual !== $expected) {
        throw new RuntimeException('Expected '.var_export($expected,true).', got '.var_export($actual,true));
    }
    $checks++;
}
publication_expect($valid, null);
publication_expect([], 'title_required');
foreach ([
    ['title','   ','title_required'],
    ['title',str_repeat('Я',181),'title_too_long'],
    ['price',-1,'invalid_price'],
    ['price',INF,'invalid_price'],
    ['price',NAN,'invalid_price'],
    ['description',' ','description_required'],
    ['city',' ','city_required'],
    ['images',[],'photo_required'],
    ['images',['javascript:alert(1)'],'photo_required'],
    ['deliveryModes',['unknown'],'delivery_required'],
    ['price',0,'price_required'],
    ['listingType','exchange','exchange_note_required'],
    ['condition','repair','defects_required'],
    ['condition','fair','defects_required'],
] as [$field,$value,$expected]) {
    publication_expect(array_replace($valid,[$field=>$value]),$expected);
}
publication_expect(array_replace($valid,['price'=>0,'priceNegotiable'=>true]),null);
publication_expect(array_replace($valid,['listingType'=>'exchange','price'=>0,'exchangeNote'=>'Меняю стартер на генератор']),null);
publication_expect(array_replace($valid,['condition'=>'repair','defects'=>'Не вращается']),null);

// Check that persisted drafts receive the same verdict as save input.
$row = [
    'id'=>'draft_test','seller_user_id'=>7,'title'=>$valid['title'],'category'=>'electrical',
    'listing_type'=>'used','price'=>12000,'price_negotiable'=>0,'city'=>$valid['city'],
    'condition_code'=>'good','brand'=>'Toyota','oem_number'=>'','vehicle'=>'Toyota Camry',
    'description'=>$valid['description'],'images_json'=>json_encode($valid['images']),
    'delivery_modes_json'=>json_encode($valid['deliveryModes']),'status'=>'draft',
    'views'=>0,'created_at'=>'2026-10-03 10:00:00','updated_at'=>'2026-10-03 10:00:00',
];
publication_expect(kareta_used_market_row($row,7),null);
publication_expect(kareta_used_market_row(array_replace($row,['images_json'=>'[]']),7),'photo_required');
publication_expect(kareta_used_market_row(array_replace($row,['listing_type'=>'exchange','price'=>0]),7),'exchange_note_required');
publication_expect(kareta_used_market_row(array_replace($row,['condition_code'=>'repair']),7),'defects_required');

// Execute the real status handler against a PDO test double. This proves
// handler control flow, not InnoDB locking or concurrent database behavior.
final class PublicationResponse extends RuntimeException {
    public function __construct(public array $payload, public int $statusCode) { parent::__construct('response'); }
}
function kareta_require_api_capability(PDO $pdo,string $capability,array $roles): void {}
function kareta_resolve_api_actor(PDO $pdo): array { return ['id'=>7]; }
function kareta_json(array $payload,int $code=200): void { throw new PublicationResponse($payload,$code); }
final class PublicationPDO extends PDO {
    public bool $transaction=false;
    public array $events=[];
    public function __construct(public array $listing,public bool $failUpdate=false) {}
    public function exec(string $statement): int|false { return 0; }
    public function prepare(string $query,array $options=[]): PDOStatement|false { return new PublicationStatement($this,$query); }
    public function beginTransaction(): bool { $this->events[]='begin';return $this->transaction=true; }
    public function inTransaction(): bool { return $this->transaction; }
    public function commit(): bool { $this->events[]='commit';$this->transaction=false;return true; }
    public function rollBack(): bool { $this->events[]='rollback';$this->transaction=false;return true; }
}
final class PublicationStatement extends PDOStatement {
    private array $params=[];
    public function __construct(private PublicationPDO $db,private string $sql) {}
    public function execute(?array $params=null): bool {
        $this->params=$params??[];
        if(str_starts_with($this->sql,'SELECT')) {
            if(!str_contains($this->sql,'seller_user_id=?')||!str_contains($this->sql,"status<>'deleted'")||!str_contains($this->sql,'FOR UPDATE'))throw new RuntimeException('Missing owner/deleted/locking guard');
            $this->db->events[]='select';
        } else {
            if(!$this->db->inTransaction())throw new RuntimeException('Update outside transaction');
            if($this->db->failUpdate)throw new RuntimeException('simulated write failure');
            $this->db->events[]='update';$this->db->listing['status']=$this->params[0];
        }
        return true;
    }
    public function fetch(int $mode=PDO::FETCH_DEFAULT,int $cursorOrientation=PDO::FETCH_ORI_NEXT,int $cursorOffset=0): mixed {
        $r=$this->db->listing;
        return $r['id']===$this->params[0]&&(int)$r['seller_user_id']===(int)$this->params[1]&&$r['status']!=='deleted'?$r:false;
    }
}
function status_expect(array $row,string $status,int $code,?string $error,array $events,bool $failUpdate=false): void {
    global $checks;
    $db=new PublicationPDO($row,$failUpdate);
    try { kareta_used_market_status($db,['id'=>$row['id'],'status'=>$status]);throw new RuntimeException('Missing response'); }
    catch(PublicationResponse $response) {
        if($response->statusCode!==$code||($response->payload['error']??null)!==$error)throw new RuntimeException('Unexpected status response');
    } catch(RuntimeException $failure) {
        if(!$failUpdate||$failure->getMessage()!=='simulated write failure')throw $failure;
    }
    if($db->events!==$events||$db->inTransaction())throw new RuntimeException('Unexpected transaction lifecycle');
    $checks++;
}
status_expect($row,'active',200,null,['begin','select','update','commit']);
status_expect(array_replace($row,['status'=>'active']),'active',200,null,['begin','select','commit']);
status_expect(array_replace($row,['images_json'=>'[]']),'active',422,'photo_required',['begin','select','rollback']);
status_expect(array_replace($row,['listing_type'=>'exchange']),'active',422,'exchange_note_required',['begin','select','rollback']);
status_expect(array_replace($row,['condition_code'=>'repair']),'active',422,'defects_required',['begin','select','rollback']);
status_expect(array_replace($row,['seller_user_id'=>8]),'active',404,'not_found',['begin','select','rollback']);
status_expect(array_replace($row,['status'=>'deleted']),'active',404,'not_found',['begin','select','rollback']);
status_expect(array_replace($row,['description'=>'']),'archived',200,null,['begin','select','update','commit']);
status_expect($row,'unknown',422,'invalid_status',[]);
status_expect($row,'active',500,null,['begin','select','rollback'],true);

echo "USED_MARKET_PUBLICATION: PASS ($checks validation/control-flow cases; no MySQL integration)\n";
