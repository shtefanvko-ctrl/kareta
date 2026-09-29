<?php
declare(strict_types=1);

/**
 * Read-only audit for MARKET-SOT-001.
 *
 * It does not assume that seller_* and market_* rows are the same aggregate.
 * Exact product candidates are reported only when seller_user_id=owner_user_id
 * AND normalized SKU matches.
 *
 * Usage:
 *   php tools/audit_marketplace_dual_sot.php
 *   php tools/audit_marketplace_dual_sot.php --json=/tmp/marketplace_dual_sot.json
 */

$root=dirname(__DIR__);
$configFile=$root.'/config.php';
if(!is_file($configFile)){fwrite(STDERR,"config.php is missing\n");exit(2);}
require $configFile;

$db=defined('KARETA_DB')?constant('KARETA_DB'):($KARETA_DB??$GLOBALS['KARETA_DB']??[]);
if(!is_array($db)){fwrite(STDERR,"Database configuration is unavailable\n");exit(2);}
$name=(string)($db['database']??$db['dbname']??'');
if($name===''){fwrite(STDERR,"Database name is empty\n");exit(2);}

$pdo=new PDO(
    sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        (string)($db['host']??'localhost'),
        (int)($db['port']??3306),
        $name,
        (string)($db['charset']??'utf8mb4')
    ),
    (string)($db['username']??$db['user']??''),
    (string)($db['password']??$db['pass']??''),
    [
        PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES=>false,
        PDO::ATTR_TIMEOUT=>max(1,min(5,(int)($db['connect_timeout']??3))),
    ]
);

$tableExists=static function(PDO $pdo,string $table):bool{
    $st=$pdo->prepare("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? LIMIT 1");
    $st->execute([$table]);
    return (bool)$st->fetchColumn();
};
$columnExists=static function(PDO $pdo,string $table,string $column):bool{
    $st=$pdo->prepare("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=? LIMIT 1");
    $st->execute([$table,$column]);
    return (bool)$st->fetchColumn();
};
$count=static function(PDO $pdo,string $sql,array $args=[]):int{
    $st=$pdo->prepare($sql);$st->execute($args);return (int)($st->fetchColumn()?:0);
};
$histogram=static function(PDO $pdo,string $table,string $column):array{
    $sql="SELECT `{$column}` AS k,COUNT(*) AS n FROM `{$table}` GROUP BY `{$column}` ORDER BY n DESC,k";
    $rows=$pdo->query($sql)->fetchAll()?:[];$out=[];
    foreach($rows as $row)$out[(string)($row['k']??'')]=(int)($row['n']??0);
    return $out;
};

$tables=[
  'market_products','market_warehouses','market_stock','market_orders','market_order_items','market_stock_movements',
  'seller_products','seller_orders','seller_order_items','seller_profiles','used_market_listings'
];
$available=[];
foreach($tables as $table)$available[$table]=$tableExists($pdo,$table);

$required=['market_products','market_stock','seller_products'];
$missing=array_values(array_filter($required,static fn(string $t):bool=>empty($available[$t])));
if($missing){fwrite(STDERR,'Missing required tables: '.implode(',',$missing)."\n");exit(2);}

$summary=[];
foreach($tables as $table)$summary[$table]=$available[$table]?$count($pdo,"SELECT COUNT(*) FROM `{$table}`"):null;

$exactSql="SELECT
  s.id seller_id,s.seller_user_id,s.sku seller_sku,s.name seller_name,s.stock_qty seller_stock,s.status seller_status,
  m.id market_id,m.product_key,m.owner_user_id,m.organization_id,m.sku market_sku,m.title market_title,m.status market_status,
  COALESCE(SUM(ms.quantity),0) market_quantity,
  COALESCE(SUM(ms.reserved),0) market_reserved,
  COALESCE(SUM(ms.quantity-ms.reserved),0) market_available
 FROM seller_products s
 JOIN market_products m
   ON m.owner_user_id=s.seller_user_id
  AND UPPER(TRIM(m.sku))=UPPER(TRIM(s.sku))
 LEFT JOIN market_stock ms ON ms.product_id=m.id
 GROUP BY s.id,s.seller_user_id,s.sku,s.name,s.stock_qty,s.status,
          m.id,m.product_key,m.owner_user_id,m.organization_id,m.sku,m.title,m.status
 ORDER BY s.seller_user_id,s.sku";
$exact=$pdo->query($exactSql)->fetchAll()?:[];

$stockMismatch=[];
foreach($exact as $row){
    $seller=(float)($row['seller_stock']??0);
    $availableQty=(float)($row['market_available']??0);
    if(abs($seller-$availableQty)>0.0001){
        $stockMismatch[]=[
            'sellerId'=>(string)$row['seller_id'],
            'marketId'=>(int)$row['market_id'],
            'ownerUserId'=>(int)$row['seller_user_id'],
            'sku'=>(string)$row['seller_sku'],
            'sellerStock'=>$seller,
            'marketQuantity'=>(float)$row['market_quantity'],
            'marketReserved'=>(float)$row['market_reserved'],
            'marketAvailable'=>$availableQty,
        ];
    }
}

$sellerOnlySql="SELECT s.id,s.seller_user_id,s.sku,s.name,s.stock_qty,s.status
 FROM seller_products s
 WHERE NOT EXISTS(
   SELECT 1 FROM market_products m
   WHERE m.owner_user_id=s.seller_user_id
     AND UPPER(TRIM(m.sku))=UPPER(TRIM(s.sku))
 )
 ORDER BY s.seller_user_id,s.sku LIMIT 200";
$marketOnlySql="SELECT m.id,m.product_key,m.owner_user_id,m.organization_id,m.sku,m.title,m.status
 FROM market_products m
 WHERE NOT EXISTS(
   SELECT 1 FROM seller_products s
   WHERE s.seller_user_id=m.owner_user_id
     AND UPPER(TRIM(s.sku))=UPPER(TRIM(m.sku))
 )
 ORDER BY m.owner_user_id,m.sku LIMIT 200";
$sellerOnly=$pdo->query($sellerOnlySql)->fetchAll()?:[];
$marketOnly=$pdo->query($marketOnlySql)->fetchAll()?:[];

$ambiguousSku=$pdo->query("SELECT UPPER(TRIM(x.sku)) sku,
  SUM(x.source='seller') seller_rows,SUM(x.source='market') market_rows,
  COUNT(DISTINCT x.owner_id) owner_count
 FROM (
   SELECT 'seller' source,sku,CAST(seller_user_id AS CHAR) owner_id FROM seller_products WHERE TRIM(sku)<>''
   UNION ALL
   SELECT 'market' source,sku,CAST(owner_user_id AS CHAR) owner_id FROM market_products WHERE TRIM(sku)<>''
 ) x
 GROUP BY UPPER(TRIM(x.sku))
 HAVING seller_rows>0 AND market_rows>0 AND owner_count>1
 ORDER BY owner_count DESC,sku
 LIMIT 200")->fetchAll()?:[];

$marketStockWithoutMovement=0;
if($available['market_stock_movements']){
    $marketStockWithoutMovement=$count($pdo,"SELECT COUNT(*) FROM market_stock s
      WHERE (s.quantity<>0 OR s.reserved<>0)
        AND NOT EXISTS(SELECT 1 FROM market_stock_movements mv WHERE mv.warehouse_id=s.warehouse_id AND mv.product_id=s.product_id)");
}

$marketOrdersWithInvoice=0;
$marketOrdersWithoutInvoice=0;
if($available['market_orders']){
    $marketOrdersWithInvoice=$count($pdo,"SELECT COUNT(*) FROM market_orders WHERE COALESCE(invoice_key,'')<>''");
    $marketOrdersWithoutInvoice=$count($pdo,"SELECT COUNT(*) FROM market_orders WHERE COALESCE(invoice_key,'')=''");
}

$report=[
  'schema'=>'kareta.marketplace-dual-sot-audit.v1',
  'checkedAt'=>gmdate('c'),
  'readOnly'=>true,
  'summary'=>$summary,
  'productIdentity'=>[
    'candidateRule'=>'seller_user_id = owner_user_id AND normalized SKU',
    'exactCandidatePairs'=>count($exact),
    'sellerOnlyCount'=>$count($pdo,"SELECT COUNT(*) FROM seller_products s WHERE NOT EXISTS(SELECT 1 FROM market_products m WHERE m.owner_user_id=s.seller_user_id AND UPPER(TRIM(m.sku))=UPPER(TRIM(s.sku)))"),
    'marketOnlyCount'=>$count($pdo,"SELECT COUNT(*) FROM market_products m WHERE NOT EXISTS(SELECT 1 FROM seller_products s WHERE s.seller_user_id=m.owner_user_id AND UPPER(TRIM(s.sku))=UPPER(TRIM(m.sku)))"),
    'ambiguousSharedSkuCount'=>$count($pdo,"SELECT COUNT(*) FROM (
      SELECT UPPER(TRIM(x.sku)) sku
      FROM (
        SELECT sku,CAST(seller_user_id AS CHAR) owner_id,'seller' source FROM seller_products WHERE TRIM(sku)<>''
        UNION ALL
        SELECT sku,CAST(owner_user_id AS CHAR) owner_id,'market' source FROM market_products WHERE TRIM(sku)<>''
      ) x
      GROUP BY UPPER(TRIM(x.sku))
      HAVING SUM(x.source='seller')>0 AND SUM(x.source='market')>0 AND COUNT(DISTINCT x.owner_id)>1
    ) z"),
    'examples'=>[
      'sellerOnly'=>array_slice($sellerOnly,0,25),
      'marketOnly'=>array_slice($marketOnly,0,25),
      'ambiguousSku'=>array_slice($ambiguousSku,0,25),
    ],
  ],
  'stock'=>[
    'exactPairStockMismatchCount'=>count($stockMismatch),
    'examples'=>array_slice($stockMismatch,0,25),
    'marketStockRowsWithoutAnyMovement'=>$marketStockWithoutMovement,
    'warning'=>'seller stock_qty and market available quantity are different semantics; mismatch is diagnostic, not an automatic repair instruction.',
  ],
  'orders'=>[
    'marketStatus'=>$available['market_orders']?$histogram($pdo,'market_orders','status'):[],
    'sellerStatus'=>$available['seller_orders']?$histogram($pdo,'seller_orders','status'):[],
    'marketWithInvoice'=>$marketOrdersWithInvoice,
    'marketWithoutInvoice'=>$marketOrdersWithoutInvoice,
    'sellerFinanceLink'=>'No seller_orders.invoice_key column is assumed by this audit.',
    'warning'=>'Order IDs and lifecycles are not joined because no verified cross-model identity exists.',
  ],
  'usedListings'=>[
    'count'=>$available['used_market_listings']?$summary['used_market_listings']:null,
    'policy'=>'Separate resale aggregate; excluded from Product exact-pair calculations.',
  ],
  'status'=>'AUDIT_COMPLETE_NO_WRITES',
];

$json=json_encode($report,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT).PHP_EOL;
$jsonPath='';
foreach($argv as $arg)if(str_starts_with($arg,'--json='))$jsonPath=substr($arg,7);
if($jsonPath!=='')file_put_contents($jsonPath,$json);
echo $json;
