<?php
declare(strict_types=1);

require_once __DIR__ . '/catalog/product_categories.php';
require_once __DIR__ . '/geo_core.php';

function seller_decode_json_field($value): array {
    if (is_array($value)) return array_values($value);
    $decoded = json_decode((string)($value ?? '[]'), true);
    return is_array($decoded) ? array_values($decoded) : [];
}
function seller_actor(PDO $pdo, array $requiredCapabilities = ['market.products.manage','market.orders.read']): array {
    try {
        $auth=(new KaretaAuthResolver($pdo))->resolve(false);
        if($auth){
            $context=$auth->context;$type=strtolower((string)($context['type']??''));$profile=strtolower((string)($context['profileType']??''));$organizationType=strtolower((string)($context['organizationType']??''));
            $sellerContext=($type==='profile'&&$profile==='seller')||($type==='organization'&&in_array($organizationType,['parts_store','shop','store'],true));
            $legacyRole=strtolower((string)($auth->legacyUser['role']??''));
            if(!$sellerContext&&$auth->mode==='legacy-compatible'&&$legacyRole==='seller')return $auth->legacyUser;
            if(!$sellerContext)kareta_json(['ok'=>false,'error'=>'seller_context_required'],403);
            $allowed=array_map('strval',$auth->capabilities);
            $authorized=in_array('*',$allowed,true);
            foreach($requiredCapabilities as $capability)if(in_array((string)$capability,$allowed,true)){$authorized=true;break;}
            if(!$authorized)kareta_json(['ok'=>false,'error'=>'seller_capability_required','requiredAny'=>array_values($requiredCapabilities)],403);
            $sellerUserId=0;
            if($type==='profile'&&!empty($context['profileId'])){
                $st=$pdo->prepare("SELECT sp.user_id FROM person_profiles pp JOIN seller_profiles sp ON pp.legacy_entity_type='seller_profile' AND BINARY CAST(sp.id AS CHAR)=BINARY CAST(pp.legacy_entity_id AS CHAR) WHERE pp.id=? AND pp.status='active' LIMIT 1");$st->execute([(int)$context['profileId']]);$sellerUserId=(int)($st->fetchColumn()?:0);
            }
            if($type==='organization'){
                $organizationKey=(string)($context['organizationKey']??'');
                $st=$pdo->prepare("SELECT sp.user_id FROM organizations o JOIN seller_profiles sp ON o.legacy_entity_type='seller_profile' AND BINARY CAST(sp.id AS CHAR)=BINARY o.legacy_entity_id WHERE BINARY o.id=BINARY ? AND o.status='active' LIMIT 1");$st->execute([$organizationKey]);$sellerUserId=(int)($st->fetchColumn()?:0);
            }
            if($sellerUserId<=0){$st=$pdo->prepare('SELECT u.id FROM accounts a JOIN users u ON u.phone=a.phone JOIN seller_profiles sp ON sp.user_id=u.id AND COALESCE(sp.active,1)=1 WHERE a.id=? LIMIT 1');$st->execute([$auth->accountId]);$sellerUserId=(int)($st->fetchColumn()?:0);}
            if($sellerUserId<=0)kareta_json(['ok'=>false,'error'=>'seller_profile_not_found'],404);
            $st=$pdo->prepare('SELECT id,phone,role,name FROM users WHERE id=? LIMIT 1');$st->execute([$sellerUserId]);$user=$st->fetch(PDO::FETCH_ASSOC);if(!$user)kareta_json(['ok'=>false,'error'=>'seller_user_missing'],422);$user['_context']=$context;$user['_capabilities']=$allowed;return $user;
        }
    } catch (DomainException $error) {
        if(!in_array($error->getMessage(),['session_required','identity_account_unavailable'],true))kareta_json(['ok'=>false,'error'=>$error->getMessage()],403);
    }
    return kareta_require_exact_role('seller');
}
function seller_profile_row(PDO $pdo, int $userId): ?array {
    $st=$pdo->prepare("SELECT * FROM `seller_profiles` WHERE user_id=? LIMIT 1"); $st->execute([$userId]); $row=$st->fetch();
    if(!$row) return null;
    foreach(['category_tags','delivery_modes','payment_methods'] as $f) $row[$f]=seller_decode_json_field($row[$f]??null);
    $row['geoPoints']=kareta_table_exists($pdo,'geo_points')?kareta_geo_owner_points($pdo,'shop',(string)($row['id']??''),false):[];
    $row['pickupPoint']=null;$row['warehousePoint']=null;
    foreach($row['geoPoints'] as $point){
        if(($point['kind']??'')==='pickup'&&$row['pickupPoint']===null)$row['pickupPoint']=$point;
        if(($point['kind']??'')==='warehouse'&&$row['warehousePoint']===null)$row['warehousePoint']=$point;
    }
    return $row;
}

function seller_require_actor_id(array $user): int {
    $userId = (int)($user['id'] ?? 0);
    if ($userId <= 0) kareta_json(['ok'=>false,'error'=>'seller_user_missing'],422);
    return $userId;
}
function seller_clean_profile_input(array $input): array {
    $bin = preg_replace('~\D+~', '', (string)($input['binIin'] ?? $input['bin_iin'] ?? '')) ?: '';
    $storeName = trim((string)($input['storeName'] ?? $input['store_name'] ?? ''));
    $warehouse = trim((string)($input['warehouseAddress'] ?? $input['warehouse_address'] ?? ''));
    if (strlen($bin) !== 12) kareta_json(['ok'=>false,'error'=>'seller_bin_required'],422);
    if ($storeName === '') kareta_json(['ok'=>false,'error'=>'seller_store_name_required'],422);
    if ($warehouse === '') kareta_json(['ok'=>false,'error'=>'seller_warehouse_required'],422);
    $input['binIin'] = $bin;
    $input['storeName'] = mb_substr($storeName, 0, 191, 'UTF-8');
    $input['warehouseAddress'] = mb_substr($warehouse, 0, 255, 'UTF-8');
    $input['legalName'] = mb_substr(trim((string)($input['legalName'] ?? $input['legal_name'] ?? '')), 0, 191, 'UTF-8');
    $input['city'] = mb_substr(trim((string)($input['city'] ?? '')), 0, 120, 'UTF-8');
    $input['description'] = mb_substr(trim((string)($input['description'] ?? '')), 0, 3000, 'UTF-8');
    $input['minimumOrder'] = mb_substr(trim((string)($input['minimumOrder'] ?? $input['minimum_order'] ?? '')), 0, 64, 'UTF-8');
    $input['returnPolicy'] = mb_substr(trim((string)($input['returnPolicy'] ?? $input['return_policy'] ?? '')), 0, 1000, 'UTF-8');
    $input['returnDays'] = max(0, min(30, (int)($input['returnDays'] ?? $input['return_days'] ?? 14)));
    $input['pickupPublic'] = !empty($input['pickupPublic'] ?? $input['pickup_public']);
    $input['geoLat'] = kareta_geo_number($input['geoLat'] ?? $input['latitude'] ?? null);
    $input['geoLng'] = kareta_geo_number($input['geoLng'] ?? $input['longitude'] ?? null);
    $input['geoSource'] = in_array(strtolower(trim((string)($input['geoSource'] ?? 'manual'))),['manual','gps','geocoder','organization'],true)?strtolower(trim((string)($input['geoSource'] ?? 'manual'))):'manual';
    if(!kareta_geo_coords_valid($input['geoLat'],$input['geoLng']))kareta_json(['ok'=>false,'error'=>'seller_geo_coordinates_invalid'],422);
    if($input['pickupPublic']&&($input['geoLat']===null||$input['geoLng']===null))kareta_json(['ok'=>false,'error'=>'seller_pickup_coordinates_required'],422);
    foreach (['categoryTags','deliveryModes','paymentMethods'] as $field) {
        $values = is_array($input[$field] ?? null) ? $input[$field] : [];
        $input[$field] = array_values(array_unique(array_slice(array_map(static fn($value) => mb_substr(trim((string)$value), 0, 64, 'UTF-8'), $values), 0, 50)));
    }
    return $input;
}
function seller_product_values(array $user, array $input): array {
    $status=(string)($input['status']??'active');
    if(!in_array($status,['draft','active','paused'],true)) $status='draft';
    return [
        'seller_phone'=>(string)($user['phone']??''),
        'sku'=>strtoupper(trim((string)($input['sku']??''))),
        'oem_number'=>trim((string)($input['oem_number']??'')),
        'name'=>trim((string)($input['name']??'')),
        'category'=>trim((string)($input['category']??'other')) ?: 'other',
        'condition_code'=>in_array((string)($input['condition_code']??$input['conditionCode']??'new'),['new','restored'],true)?(string)($input['condition_code']??$input['conditionCode']??'new'):'new',
        'exchange_available'=>!empty($input['exchange_available']??$input['exchangeAvailable'])?1:0,
        'exchange_note'=>trim((string)($input['exchange_note']??$input['exchangeNote']??'')),
        'brand'=>trim((string)($input['brand']??'')),
        'price'=>max(0,(float)($input['price']??0)),
        'old_price'=>max(0,(float)($input['old_price']??0)),
        'stock_qty'=>max(0,(int)($input['stock_qty']??0)),
        'status'=>$status,
        'description'=>trim((string)($input['description']??'')),
        'image_url'=>trim((string)($input['image_url']??'')),
        'fitment_json'=>json_encode(is_array($input['fitment']??null)?$input['fitment']:[],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES) ?: '[]',
    ];
}
function seller_platform_product_id(string $partId): string {
    return 'catalog_' . substr(trim($partId), 0, 52);
}
function seller_price_from_label(string $label): float {
    $digits = preg_replace('~[^0-9]+~', '', $label) ?: '0';
    return max(0, (float)$digits);
}
function seller_stock_from_catalog(array $part): int {
    if (array_key_exists('stock_qty', $part) || array_key_exists('stockQty', $part)) {
        return max(0, (int)($part['stock_qty'] ?? $part['stockQty'] ?? 0));
    }
    $stock = (int)($part['stock'] ?? 0) > 0 ? 1 : 0;
    $note = (string)($part['note'] ?? '');
    if (preg_match('~Остаток\s*:\s*(\d+)~ui', $note, $match)) return max(0, (int)$match[1]);
    return $stock;
}
function seller_ensure_platform_profile(PDO $pdo): void {
    $pdo->prepare("INSERT INTO `seller_profiles`
        (`user_id`,`user_phone`,`store_name`,`legal_name`,`contact_phone`,`country_code`,`city`,`warehouse_address`,`description`,`assortment`,`category_tags`,`delivery_modes`,`payment_methods`,`minimum_order`,`return_days`,`moderation_status`,`active`)
        VALUES (0,'platform','KARETA.KZ / GlobalTuning','KARETA.KZ','','KZ','Усть-Каменогорск','Склад KARETA.KZ','Основной товарный каталог платформы KARETA.KZ.','Автозвук, автоэлектрика и автомобильные запчасти',JSON_ARRAY('parts','audio','electrical'),JSON_ARRAY('pickup','courier','transport'),JSON_ARRAY('cash','transfer'),'',14,'approved',1)
        ON DUPLICATE KEY UPDATE store_name=VALUES(store_name), legal_name=VALUES(legal_name), moderation_status='approved', active=1, updated_at=CURRENT_TIMESTAMP")
        ->execute();
}
function seller_sync_catalog_product(PDO $pdo, array $part): void {
    $partId = trim((string)($part['id'] ?? ''));
    if ($partId === '') return;
    seller_ensure_platform_profile($pdo);
    $priceLabel = (string)($part['priceLabel'] ?? $part['price_label'] ?? '');
    $typedPrice = (float)($part['price'] ?? 0);
    $price = $typedPrice > 0 ? $typedPrice : seller_price_from_label($priceLabel);
    $stockQty = seller_stock_from_catalog($part);
    $active = (int)(bool)($part['active'] ?? true);
    $status = ($active === 1 && $stockQty > 0 && $price > 0) ? 'active' : 'paused';
    $sku = strtoupper(trim((string)($part['sku'] ?? ''))) ?: strtoupper($partId);
    $fitments = $part['fitments'] ?? $part['fitmentsText'] ?? $part['fitments_json'] ?? [];
    if (is_array($fitments)) $fitments = json_encode($fitments, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '[]';
    $pdo->prepare("INSERT INTO `seller_products`
        (`id`,`seller_user_id`,`seller_phone`,`sku`,`oem_number`,`name`,`category`,`condition_code`,`exchange_available`,`exchange_note`,`brand`,`price`,`old_price`,`stock_qty`,`status`,`description`,`image_url`,`fitment_json`)
        VALUES (?,?,?,?,?,?,?,'new',0,'',?,?,0,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE sku=VALUES(sku),oem_number=VALUES(oem_number),name=VALUES(name),category=VALUES(category),condition_code='new',exchange_available=0,exchange_note='',brand=VALUES(brand),price=VALUES(price),stock_qty=VALUES(stock_qty),status=VALUES(status),description=VALUES(description),image_url=VALUES(image_url),fitment_json=VALUES(fitment_json),updated_at=CURRENT_TIMESTAMP")
        ->execute([
            seller_platform_product_id($partId), 0, 'platform', $sku,
            (string)($part['oem'] ?? ''), (string)($part['name'] ?? ''),
            (string)($part['cat'] ?? $part['category'] ?? 'other'),
            (string)($part['brand'] ?? $part['manufacturer'] ?? ''),
            $price, $stockQty, $status, (string)($part['note'] ?? ''),
            (string)($part['image_url'] ?? $part['imageUrl'] ?? $part['image'] ?? ''), (string)$fitments,
        ]);
}
function seller_archive_catalog_product(PDO $pdo, string $partId): void {
    if ($partId === '') return;
    $pdo->prepare("UPDATE `seller_products` SET status='archived', stock_qty=0, updated_at=NOW() WHERE id=? AND seller_user_id=0")
        ->execute([seller_platform_product_id($partId)]);
}

function seller_sync_platform_catalog(PDO $pdo, bool $force = false): int {
    if (!kareta_table_exists($pdo, 'parts_catalog') || !kareta_table_exists($pdo, 'seller_products') || !kareta_table_exists($pdo, 'seller_profiles')) return 0;
    $partsCount = (int)($pdo->query("SELECT COUNT(*) FROM `parts_catalog`")->fetchColumn() ?: 0);
    $shopCount = (int)($pdo->query("SELECT COUNT(*) FROM `seller_products` WHERE seller_user_id=0 AND status<>'archived'")->fetchColumn() ?: 0);
    if (!$force && $partsCount === $shopCount && $partsCount > 0) return 0;
    seller_ensure_platform_profile($pdo);
    $rows = $pdo->query("SELECT id,cat,name,sku,brand,oem,price_label AS priceLabel,price,stock,stock_qty,note,image_url,fitments_json AS fitmentsText,active FROM `parts_catalog`")->fetchAll(PDO::FETCH_ASSOC) ?: [];
    foreach ($rows as $row) seller_sync_catalog_product($pdo, $row);
    return count($rows);
}

function seller_ensure_platform_catalog_available(PDO $pdo): void {
    if (!kareta_table_exists($pdo, 'seller_products')) return;
    $available = (int)($pdo->query("SELECT COUNT(*) FROM `seller_products` WHERE seller_user_id=0 AND status IN ('active','paused')")->fetchColumn() ?: 0);
    if ($available > 0) return;
    // Recovery only: regular synchronization belongs to migrations/import actions, never to catalog reads.
    seller_sync_platform_catalog($pdo, true);
}

function seller_dashboard(?PDO $pdo): void {
    if(!$pdo) kareta_json(['ok'=>false,'error'=>'db_unavailable'],503);
    $user=seller_actor($pdo); $uid=seller_require_actor_id($user);
    $profile=seller_profile_row($pdo,$uid);
    $hydrateProducts=static function(array $rows): array {
        foreach($rows as &$product){
            $product['fitment']=seller_decode_json_field($product['fitment_json']??null);
            unset($product['fitment_json']);
        }
        unset($product);
        return $rows;
    };
    $productSql="SELECT id,sku,oem_number,name,category,condition_code,exchange_available,exchange_note,brand,price,old_price,stock_qty,status,description,image_url,fitment_json,updated_at FROM seller_products WHERE seller_user_id=? AND status<>'archived' ORDER BY updated_at DESC LIMIT 150";
    $st=$pdo->prepare($productSql); $st->execute([$uid]); $products=$hydrateProducts($st->fetchAll(PDO::FETCH_ASSOC)?:[]);
    $archiveSql="SELECT id,sku,oem_number,name,category,condition_code,exchange_available,exchange_note,brand,price,old_price,stock_qty,status,description,image_url,fitment_json,updated_at FROM seller_products WHERE seller_user_id=? AND status='archived' ORDER BY updated_at DESC LIMIT 100";
    $st=$pdo->prepare($archiveSql); $st->execute([$uid]); $archivedProducts=$hydrateProducts($st->fetchAll(PDO::FETCH_ASSOC)?:[]);
    $st=$pdo->prepare("SELECT id,client_user_id,customer_name,customer_phone,status,payment_status,delivery_type,delivery_address,subtotal,delivery_price,total,comment,created_at,updated_at FROM seller_orders WHERE seller_user_id=? ORDER BY created_at DESC LIMIT 100"); $st->execute([$uid]); $orders=$st->fetchAll(PDO::FETCH_ASSOC)?:[];
    if($orders){
        $orderIds=array_values(array_map(static fn(array $row): string => (string)$row['id'],$orders));
        $placeholders=implode(',',array_fill(0,count($orderIds),'?'));
        $itemSt=$pdo->prepare("SELECT order_id,product_id,sku,name,qty,price,total FROM seller_order_items WHERE order_id IN ($placeholders) ORDER BY id ASC");
        $itemSt->execute($orderIds);
        $itemsByOrder=[];
        foreach(($itemSt->fetchAll(PDO::FETCH_ASSOC)?:[]) as $item) $itemsByOrder[(string)$item['order_id']][]=$item;
        foreach($orders as &$order) $order['items']=$itemsByOrder[(string)$order['id']]??[];
        unset($order);
    }
    $st=$pdo->prepare("SELECT COUNT(*) products, SUM(stock_qty>0) in_stock, SUM(stock_qty<=3) low_stock FROM seller_products WHERE seller_user_id=? AND status<>'archived'"); $st->execute([$uid]); $metrics=$st->fetch(PDO::FETCH_ASSOC)?:[];
    $st=$pdo->prepare("SELECT COUNT(*) archived_products FROM seller_products WHERE seller_user_id=? AND status='archived'");$st->execute([$uid]);$metrics=array_merge($metrics,$st->fetch(PDO::FETCH_ASSOC)?:[]);
    $st=$pdo->prepare("SELECT SUM(status='new') new_orders, COALESCE(SUM(CASE WHEN status='delivered' THEN total ELSE 0 END),0) revenue FROM seller_orders WHERE seller_user_id=?"); $st->execute([$uid]); $metrics=array_merge($metrics,$st->fetch(PDO::FETCH_ASSOC)?:[]);
    $categories=kareta_product_categories_rows($pdo, true);
    kareta_json(['ok'=>true,'profile'=>$profile,'products'=>$products,'archivedProducts'=>$archivedProducts,'orders'=>$orders,'metrics'=>$metrics,'categories'=>$categories]);
}
function seller_profile_save(?PDO $pdo,array $body): void {
    if(!$pdo) kareta_json(['ok'=>false,'error'=>'db_unavailable'],503);
    $user=seller_actor($pdo,['profile.manage']);
    seller_require_actor_id($user);
    $input=is_array($body['profile']??null)?$body['profile']:[];
    $input=seller_clean_profile_input($input);
    $profileUser=$user;
    $profileUser['city']=trim((string)($input['city']??$user['city']??''));
    $previous=seller_profile_row($pdo,(int)$user['id']);
    $profile=kareta_upsert_seller_profile($pdo,$profileUser,$input);
    $profileId=(string)($profile['id']??'');
    if($profileId!==''&&kareta_table_exists($pdo,'geo_points')){
        $lat=$input['geoLat']??null;$lng=$input['geoLng']??null;$city=(string)($input['city']??'');$address=(string)($input['warehouseAddress']??'');$label=(string)($input['storeName']??'Магазин');
        if($lat!==null&&$lng!==null){
            kareta_geo_upsert_point($pdo,['ownerType'=>'shop','ownerId'=>$profileId,'kind'=>'warehouse','label'=>$label,'city'=>$city,'address'=>$address,'latitude'=>$lat,'longitude'=>$lng,'source'=>$input['geoSource']??'manual','visibility'=>'hidden','active'=>true]);
            if(!empty($input['pickupPublic'])){
                kareta_geo_upsert_point($pdo,['ownerType'=>'shop','ownerId'=>$profileId,'kind'=>'pickup','label'=>$label,'city'=>$city,'address'=>$address,'latitude'=>$lat,'longitude'=>$lng,'source'=>$input['geoSource']??'manual','visibility'=>'exact','active'=>true,'metadata'=>['pickup'=>true,'sellerUserId'=>(int)($user['id']??0)]]);
            }else{kareta_geo_set_owner_kind_active($pdo,'shop',$profileId,'pickup',false);}
        }elseif(empty($input['pickupPublic'])){kareta_geo_set_owner_kind_active($pdo,'shop',$profileId,'pickup',false);}
        $profile=seller_profile_row($pdo,(int)$user['id'])?:$profile;
    }
    if(($previous['moderation_status']??'')==='rejected') {
        $pdo->prepare("UPDATE seller_profiles SET moderation_status='pending', moderation_reason='', updated_at=NOW() WHERE user_id=? AND moderation_status='rejected'")->execute([(int)$user['id']]);
        $profile=seller_profile_row($pdo,(int)$user['id']);
    }
    kareta_log_audit($pdo,'seller.profile.save',['sellerUserId'=>(int)($user['id']??0),'moderationStatus'=>(string)($profile['moderation_status']??'pending')]);
    kareta_json(['ok'=>true,'profile'=>$profile]);
}
function seller_product_save(?PDO $pdo,array $body): void {
    if(!$pdo) kareta_json(['ok'=>false,'error'=>'db_unavailable'],503);
    $user=seller_actor($pdo,['market.products.manage']);
    $uid=seller_require_actor_id($user);
    $input=is_array($body['product']??null)?$body['product']:[];
    $values=seller_product_values($user,$input);
    if($values['name']===''||$values['sku']==='') kareta_json(['ok'=>false,'error'=>'name_sku_required','message'=>'Название и SKU обязательны'],422);
    if(!kareta_product_category_is_active($pdo,(string)$values['category'])) kareta_json(['ok'=>false,'error'=>'invalid_product_category','message'=>'Выберите действующую категорию товара'],422);

    $requestedId=trim((string)($input['id']??''));
    $id='';
    if($requestedId!=='') {
        $ownerCheck=$pdo->prepare("SELECT id FROM seller_products WHERE id=? AND seller_user_id=? LIMIT 1");
        $ownerCheck->execute([$requestedId,$uid]);
        $owned=$ownerCheck->fetch();
        if(!$owned) kareta_json(['ok'=>false,'error'=>'product_not_found'],404);
        $id=(string)$owned['id'];
    } else {
        $bySku=$pdo->prepare("SELECT id FROM seller_products WHERE seller_user_id=? AND sku=? LIMIT 1");
        $bySku->execute([$uid,$values['sku']]);
        $existing=$bySku->fetch();
        $id=$existing ? (string)$existing['id'] : 'spr_'.substr(hash('sha256',$uid.'|'.$values['sku'].'|'.microtime(true)),0,20);
    }

    try {
        $existingCheck=$pdo->prepare("SELECT id FROM seller_products WHERE id=? AND seller_user_id=? LIMIT 1");
        $existingCheck->execute([$id,$uid]);
        if($existingCheck->fetch()) {
            $sql="UPDATE seller_products SET seller_phone=:seller_phone,sku=:sku,oem_number=:oem_number,name=:name,category=:category,condition_code=:condition_code,exchange_available=:exchange_available,exchange_note=:exchange_note,brand=:brand,price=:price,old_price=:old_price,stock_qty=:stock_qty,status=:status,description=:description,image_url=:image_url,fitment_json=:fitment_json,updated_at=NOW() WHERE id=:id AND seller_user_id=:seller_user_id";
            $pdo->prepare($sql)->execute($values+['id'=>$id,'seller_user_id'=>$uid]);
        } else {
            $sql="INSERT INTO seller_products(id,seller_user_id,seller_phone,sku,oem_number,name,category,condition_code,exchange_available,exchange_note,brand,price,old_price,stock_qty,status,description,image_url,fitment_json) VALUES(:id,:seller_user_id,:seller_phone,:sku,:oem_number,:name,:category,:condition_code,:exchange_available,:exchange_note,:brand,:price,:old_price,:stock_qty,:status,:description,:image_url,:fitment_json)";
            $pdo->prepare($sql)->execute(['id'=>$id,'seller_user_id'=>$uid]+$values);
        }
    } catch(PDOException $e) {
        if((string)$e->getCode()==='23000') kareta_json(['ok'=>false,'error'=>'seller_sku_conflict','message'=>'SKU уже используется в вашем магазине'],409);
        throw $e;
    }
    kareta_log_audit($pdo,'seller.products.save',['id'=>$id,'sku'=>$values['sku'],'sellerUserId'=>$uid]);
    kareta_json(['ok'=>true,'id'=>$id]);
}
function seller_product_delete(?PDO $pdo,array $body): void {
    if(!$pdo) kareta_json(['ok'=>false,'error'=>'db_unavailable'],503);
    $user=seller_actor($pdo,['market.products.manage']); $id=trim((string)($body['id']??'')); if($id==='') kareta_json(['ok'=>false,'error'=>'id_required'],422);
    $st=$pdo->prepare("UPDATE seller_products SET status='archived',updated_at=NOW() WHERE id=? AND seller_user_id=?"); $st->execute([$id,(int)$user['id']]);
    if(!$st->rowCount()) kareta_json(['ok'=>false,'error'=>'not_found'],404);
    kareta_log_audit($pdo,'seller.products.delete',['id'=>$id]); kareta_json(['ok'=>true]);
}
function seller_product_restore(?PDO $pdo,array $body): void {
    if(!$pdo) kareta_json(['ok'=>false,'error'=>'db_unavailable'],503);
    $user=seller_actor($pdo,['market.products.manage']);$uid=seller_require_actor_id($user);
    $id=trim((string)($body['id']??''));if($id==='')kareta_json(['ok'=>false,'error'=>'id_required'],422);
    $st=$pdo->prepare("UPDATE seller_products SET status='draft',updated_at=NOW() WHERE id=? AND seller_user_id=? AND status='archived'");$st->execute([$id,$uid]);
    if(!$st->rowCount())kareta_json(['ok'=>false,'error'=>'archived_product_not_found'],404);
    kareta_log_audit($pdo,'seller.products.restore',['id'=>$id,'sellerUserId'=>$uid]);
    kareta_json(['ok'=>true,'id'=>$id,'status'=>'draft']);
}
function seller_product_stock(?PDO $pdo,array $body): void {
    if(!$pdo) kareta_json(['ok'=>false,'error'=>'db_unavailable'],503);
    $user=seller_actor($pdo,['warehouse.stock.manage','market.products.manage']);$uid=seller_require_actor_id($user);
    $id=trim((string)($body['id']??''));if($id==='')kareta_json(['ok'=>false,'error'=>'id_required'],422);
    $st=$pdo->prepare("SELECT stock_qty,status FROM seller_products WHERE id=? AND seller_user_id=? LIMIT 1");$st->execute([$id,$uid]);$row=$st->fetch(PDO::FETCH_ASSOC);
    if(!$row||((string)$row['status']==='archived'))kareta_json(['ok'=>false,'error'=>'product_not_available_for_stock'],404);
    if(array_key_exists('stockQty',$body)||array_key_exists('stock_qty',$body))$next=max(0,min(999999,(int)($body['stockQty']??$body['stock_qty']??0)));
    else{$delta=max(-9999,min(9999,(int)($body['delta']??0)));if($delta===0)kareta_json(['ok'=>false,'error'=>'stock_delta_required'],422);$next=max(0,min(999999,(int)$row['stock_qty']+$delta));}
    $update=$pdo->prepare("UPDATE seller_products SET stock_qty=?,updated_at=NOW() WHERE id=? AND seller_user_id=? AND status<>'archived'");$update->execute([$next,$id,$uid]);
    kareta_log_audit($pdo,'seller.products.stock',['id'=>$id,'stockQty'=>$next,'sellerUserId'=>$uid]);
    kareta_json(['ok'=>true,'id'=>$id,'stockQty'=>$next,'status'=>(string)$row['status']]);
}
function seller_order_update_status(?PDO $pdo,array $body): void {
    if(!$pdo) kareta_json(['ok'=>false,'error'=>'db_unavailable'],503);
    $user=seller_actor($pdo,['market.orders.fulfill','market.orders.manage']);
    $uid=seller_require_actor_id($user);
    $id=trim((string)($body['id']??''));
    $status=trim((string)($body['status']??''));
    $allowed=['new','confirmed','packed','shipped','delivered','cancelled','returned'];
    if($id===''||!in_array($status,$allowed,true)) kareta_json(['ok'=>false,'error'=>'invalid_order_status'],422);
    $check=$pdo->prepare("SELECT status FROM seller_orders WHERE id=? AND seller_user_id=? LIMIT 1");
    $check->execute([$id,$uid]);
    $row=$check->fetch();
    if(!$row) kareta_json(['ok'=>false,'error'=>'order_not_found'],404);
    if((string)$row['status']===$status) kareta_json(['ok'=>true,'unchanged'=>true,'status'=>$status]);
    $st=$pdo->prepare("UPDATE seller_orders SET status=?,updated_at=NOW() WHERE id=? AND seller_user_id=?");
    $st->execute([$status,$id,$uid]);
    kareta_log_audit($pdo,'seller.orders.status',['id'=>$id,'status'=>$status,'sellerUserId'=>$uid]);
    kareta_json(['ok'=>true,'status'=>$status]);
}

function shop_storefront(?PDO $pdo,array $input): void {
    if(!$pdo)kareta_json(['ok'=>false,'error'=>'db_unavailable'],503);
    $sellerId=(int)($input['sellerId']??$input['seller_id']??0);
    if($sellerId<0)kareta_json(['ok'=>false,'error'=>'invalid_seller_id'],422);
    $profileSt=$pdo->prepare("SELECT user_id,store_name,legal_name,city,warehouse_address,description,assortment,category_tags,delivery_modes,payment_methods,minimum_order,return_days,return_policy,created_at,updated_at FROM seller_profiles WHERE user_id=? AND active=1 AND moderation_status='approved' LIMIT 1");
    $profileSt->execute([$sellerId]);$profile=$profileSt->fetch(PDO::FETCH_ASSOC);
    if(!$profile)kareta_json(['ok'=>false,'error'=>'store_not_found'],404);
    foreach(['category_tags','delivery_modes','payment_methods'] as $field)$profile[$field]=seller_decode_json_field($profile[$field]??null);
    $profile['category_labels']=[];
    try {
        $selected=array_map('strval',is_array($profile['category_tags']??null)?$profile['category_tags']:[]);
        foreach(kareta_product_categories_rows($pdo,true) as $categoryRow) {
            if(in_array((string)($categoryRow['key']??''),$selected,true))$profile['category_labels'][]=(string)($categoryRow['name']??$categoryRow['key']??'');
        }
    } catch(Throwable $e) {}
    $productSt=$pdo->prepare("SELECT id,sku,oem_number,name,category,condition_code,exchange_available,brand,price,old_price,stock_qty,description,image_url,updated_at FROM seller_products WHERE seller_user_id=? AND status='active' AND stock_qty>0 ORDER BY updated_at DESC LIMIT 100");
    $productSt->execute([$sellerId]);$products=$productSt->fetchAll(PDO::FETCH_ASSOC)?:[];
    $trust=['activeProducts'=>count($products),'deliveredOrders'=>0,'reviewCount'=>0,'reviewAverage'=>0.0];
    try{$q=$pdo->prepare("SELECT COUNT(*) FROM seller_orders WHERE seller_user_id=? AND status='delivered'");$q->execute([$sellerId]);$trust['deliveredOrders']=(int)($q->fetchColumn()?:0);}catch(Throwable $e){}
    try{
        if(function_exists('kareta_table_exists')&&kareta_table_exists($pdo,'product_reviews')){
            $q=$pdo->prepare("SELECT COUNT(*) review_count,COALESCE(AVG(r.rating),0) review_average FROM product_reviews r INNER JOIN seller_products p ON p.id=r.product_id WHERE p.seller_user_id=? AND r.status='published'");$q->execute([$sellerId]);$rv=$q->fetch(PDO::FETCH_ASSOC)?:[];$trust['reviewCount']=(int)($rv['review_count']??0);$trust['reviewAverage']=round((float)($rv['review_average']??0),1);
        }
    }catch(Throwable $e){}
    header('Cache-Control: private, max-age=30, stale-while-revalidate=120');
    kareta_json(['ok'=>true,'data'=>['profile'=>$profile,'products'=>$products,'trust'=>$trust]]);
}

function shop_catalog(?PDO $pdo, array $body): void {
    if (!$pdo) {
        $fallback = kareta_fallback_products($body);
        header('X-Kareta-Catalog-Mode: no-db-fallback');
        kareta_json(array_merge(['ok'=>true], $fallback, ['degraded'=>true, 'source'=>'storage-fallback']));
    }

    try {
        try {
            seller_ensure_platform_catalog_available($pdo);
            kareta_product_categories_ensure_available($pdo);
        } catch (Throwable $e) {
            kareta_log_error('SHOP_CATALOG_RECOVERY', $e->getMessage());
        }

        $search=trim((string)($body['search']??''));
        $category=trim((string)($body['category']??''));
        $limit=max(1,min(100,(int)($body['limit']??60)));
        $where=["p.status='active'","p.stock_qty>0","sp.active=1","sp.moderation_status='approved'"];
        $params=[];
        if($category!=='' && $category!=='all') { $where[]='p.category=?'; $params[]=$category; }
        if($search!=='') {
            $where[]='(p.name LIKE ? OR p.sku LIKE ? OR p.oem_number LIKE ? OR p.brand LIKE ?)';
            $like='%'.$search.'%'; array_push($params,$like,$like,$like,$like);
        }
        $countSql="SELECT COUNT(*) FROM seller_products p INNER JOIN seller_profiles sp ON sp.user_id=p.seller_user_id WHERE ".implode(' AND ',$where);
        $countSt=$pdo->prepare($countSql); $countSt->execute($params); $total=(int)($countSt->fetchColumn() ?: 0);
        $sql="SELECT p.id,p.seller_user_id,p.sku,p.oem_number,p.name,p.category,p.condition_code,p.exchange_available,p.exchange_note,p.brand,p.price,p.old_price,p.stock_qty,p.description,p.image_url,p.fitment_json,p.updated_at,sp.store_name,sp.city,sp.warehouse_address,sp.delivery_modes,sp.payment_methods,sp.return_days,sp.moderation_status FROM seller_products p INNER JOIN seller_profiles sp ON sp.user_id=p.seller_user_id WHERE ".implode(' AND ',$where)." ORDER BY p.updated_at DESC LIMIT ".$limit;
        $st=$pdo->prepare($sql); $st->execute($params); $products=$st->fetchAll();
        foreach($products as &$row) {
            $row['fitment']=seller_decode_json_field($row['fitment_json']??null); unset($row['fitment_json']);
            $row['delivery_modes']=seller_decode_json_field($row['delivery_modes']??null);
            $row['payment_methods']=seller_decode_json_field($row['payment_methods']??null);
        }
        unset($row);
        $categories=[];
        $catRows=$pdo->query("SELECT pc.category_key AS `key`,pc.name,pc.icon,pc.group_key AS `groupKey`,pc.group_name AS `groupName`,COALESCE(x.cnt,0) AS `count`,pc.sort FROM product_categories pc LEFT JOIN (SELECT p.category,COUNT(*) cnt FROM seller_products p INNER JOIN seller_profiles sp ON sp.user_id=p.seller_user_id WHERE p.status='active' AND p.stock_qty>0 AND sp.active=1 AND sp.moderation_status='approved' GROUP BY p.category) x ON x.category=pc.category_key WHERE pc.active=1 ORDER BY pc.sort,pc.name")->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach($catRows as $row) $categories[]=[
            'key'=>(string)$row['key'], 'name'=>(string)$row['name'], 'icon'=>(string)$row['icon'],
            'groupKey'=>(string)$row['groupKey'], 'groupName'=>(string)$row['groupName'], 'count'=>(int)$row['count'],
        ];
        if(!$products && $total===0){
            $fallback=kareta_fallback_products($body);
            header('X-Kareta-Catalog-Mode: storage-fallback');
            kareta_json(array_merge(['ok'=>true], $fallback, ['source'=>'storage-fallback']));
        }
        header('Cache-Control: private, max-age=30, stale-while-revalidate=120');
        header('X-Kareta-Catalog-Mode: read-only');
        kareta_json(['ok'=>true,'products'=>$products,'categories'=>$categories,'total'=>$total,'source'=>'mysql']);
    } catch (Throwable $e) {
        kareta_log_error('SHOP_CATALOG_FATAL_RECOVERY', $e->getMessage());
        $fallback = kareta_fallback_products($body);
        header('X-Kareta-Catalog-Mode: schema-fallback');
        kareta_json(array_merge(
            ['ok'=>true],
            $fallback,
            [
                'degraded'=>true,
                'source'=>'storage-fallback',
                'code'=>'SHOP_CATALOG_DEGRADED',
                'message'=>'Каталог загружен в резервном режиме.'
            ]
        ), 200);
    }
}

function shop_create_order(?PDO $pdo, array $body): void {
    if(!$pdo) kareta_json(['ok'=>false,'error'=>'db_unavailable'],503);
    $input=is_array($body['order']??null)?$body['order']:[];
    $items=is_array($input['items']??null)?$input['items']:[];
    if(!$items || count($items)>50) kareta_json(['ok'=>false,'error'=>'cart_items_required'],422);
    $sessionUser=kareta_session_user()??[];
    $customerName=trim((string)($input['customerName']??$input['customer_name']??$sessionUser['name']??''));
    $customerPhone=kareta_normalize_phone((string)($input['customerPhone']??$input['customer_phone']??$sessionUser['phone']??''));
    if($customerName==='') kareta_json(['ok'=>false,'error'=>'customer_name_required'],422);
    if($customerPhone==='') kareta_json(['ok'=>false,'error'=>'customer_phone_required'],422);
    $deliveryType=trim((string)($input['deliveryType']??$input['delivery_type']??'pickup'));
    if(!in_array($deliveryType,['pickup','courier','transport'],true)) $deliveryType='pickup';
    $deliveryAddress=trim((string)($input['deliveryAddress']??$input['delivery_address']??''));
    if($deliveryType!=='pickup' && $deliveryAddress==='') kareta_json(['ok'=>false,'error'=>'delivery_address_required'],422);
    $comment=trim((string)($input['comment']??''));

    $normalized=[];
    foreach($items as $item) {
        if(!is_array($item)) continue;
        $productId=trim((string)($item['productId']??$item['product_id']??$item['id']??''));
        $qty=max(1,min(99,(int)($item['qty']??1)));
        if($productId!=='') $normalized[$productId]=($normalized[$productId]??0)+$qty;
    }
    if(!$normalized) kareta_json(['ok'=>false,'error'=>'cart_items_required'],422);

    try {
        $pdo->beginTransaction();
        $productStmt=$pdo->prepare("SELECT p.id,p.seller_user_id,p.seller_phone,p.sku,p.name,p.price,p.stock_qty,p.status,sp.active AS seller_active FROM seller_products p INNER JOIN seller_profiles sp ON sp.user_id=p.seller_user_id WHERE p.id=? FOR UPDATE");
        $groups=[];
        foreach($normalized as $productId=>$qty) {
            $productStmt->execute([$productId]); $product=$productStmt->fetch();
            if(!$product || (string)$product['status']!=='active' || (int)$product['seller_active']!==1) throw new RuntimeException('product_unavailable:'.$productId);
            if((int)$product['stock_qty']<$qty) throw new RuntimeException('stock_insufficient:'.$productId);
            $sellerId=(int)$product['seller_user_id'];
            if(!isset($groups[$sellerId])) $groups[$sellerId]=['phone'=>(string)$product['seller_phone'],'items'=>[],'subtotal'=>0.0];
            $lineTotal=round((float)$product['price']*$qty,2);
            $groups[$sellerId]['items'][]=['product'=>$product,'qty'=>$qty,'total'=>$lineTotal];
            $groups[$sellerId]['subtotal']+=$lineTotal;
        }
        $orders=[];
        $insertOrder=$pdo->prepare("INSERT INTO seller_orders(id,seller_user_id,seller_phone,client_user_id,customer_name,customer_phone,status,payment_status,delivery_type,delivery_address,subtotal,delivery_price,total,comment) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
        $insertItem=$pdo->prepare("INSERT INTO seller_order_items(order_id,product_id,sku,name,qty,price,total) VALUES(?,?,?,?,?,?,?)");
        $decrement=$pdo->prepare("UPDATE seller_products SET stock_qty=stock_qty-?,updated_at=NOW() WHERE id=? AND seller_user_id=? AND stock_qty>=?");
        foreach($groups as $sellerId=>$group) {
            $orderId='sord_'.substr(hash('sha256',$sellerId.'|'.$customerPhone.'|'.microtime(true).'|'.random_int(1,PHP_INT_MAX)),0,22);
            $subtotal=round((float)$group['subtotal'],2); $deliveryPrice=0.0; $total=$subtotal+$deliveryPrice;
            $insertOrder->execute([$orderId,$sellerId,$group['phone'],(int)($sessionUser['id']??0)?:null,$customerName,$customerPhone,'new','pending',$deliveryType,$deliveryAddress,$subtotal,$deliveryPrice,$total,$comment]);
            foreach($group['items'] as $line) {
                $p=$line['product']; $qty=(int)$line['qty'];
                $decrement->execute([$qty,(string)$p['id'],$sellerId,$qty]);
                if($decrement->rowCount()!==1) throw new RuntimeException('stock_insufficient:'.(string)$p['id']);
                $insertItem->execute([$orderId,(string)$p['id'],(string)$p['sku'],(string)$p['name'],$qty,(float)$p['price'],(float)$line['total']]);
            }
            $orders[]=['id'=>$orderId,'sellerUserId'=>$sellerId,'subtotal'=>$subtotal,'total'=>$total,'status'=>'new'];
        }
        $pdo->commit();
        kareta_log_audit($pdo,'shop.order.create',['orderIds'=>array_column($orders,'id'),'customerPhone'=>$customerPhone]);
        kareta_json(['ok'=>true,'orders'=>$orders,'orderCount'=>count($orders)]);
    } catch(RuntimeException $e) {
        if($pdo->inTransaction()) $pdo->rollBack();
        $message=$e->getMessage();
        if(str_starts_with($message,'stock_insufficient:')) kareta_json(['ok'=>false,'error'=>'stock_insufficient','productId'=>substr($message,19)],409);
        if(str_starts_with($message,'product_unavailable:')) kareta_json(['ok'=>false,'error'=>'product_unavailable','productId'=>substr($message,20)],409);
        throw $e;
    } catch(Throwable $e) {
        if($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function seller_moderate(?PDO $pdo, array $body): void {
    if(!$pdo) kareta_json(['ok'=>false,'error'=>'db_unavailable'],503);
    kareta_require_role('admin');
    $userId=(int)($body['userId']??$body['user_id']??0);
    $status=trim((string)($body['status']??''));
    $reason=mb_substr(trim((string)($body['reason']??$body['moderationReason']??'')),0,500,'UTF-8');
    if($userId<=0 || !in_array($status,['pending','approved','rejected','suspended'],true)) kareta_json(['ok'=>false,'error'=>'invalid_moderation_request'],422);
    if(!in_array($status,['rejected','suspended'],true))$reason='';
    $st=$pdo->prepare("UPDATE seller_profiles SET moderation_status=?,moderation_reason=?,active=?,updated_at=NOW() WHERE user_id=?");
    $st->execute([$status,$reason,$status==='suspended'?0:1,$userId]);
    if(!$st->rowCount()) kareta_json(['ok'=>false,'error'=>'seller_not_found_or_unchanged'],404);
    kareta_log_audit($pdo,'seller.moderate',['sellerUserId'=>$userId,'status'=>$status,'reason'=>$reason]);
    kareta_json(['ok'=>true,'userId'=>$userId,'status'=>$status]);
}
