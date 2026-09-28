<?php
declare(strict_types=1);

function kareta_detail_id(array $input): string {
    return trim((string)($input['id'] ?? ''));
}

function kareta_provider_detail_fallback_provider(PDO $pdo, string $type, string $id): ?array {
    $table = $type === 'sto' ? 'sto_profiles' : 'masters';
    if (function_exists('kareta_table_exists') && !kareta_table_exists($pdo, $table)) return null;
    try {
        $st = $pdo->prepare("SELECT * FROM `{$table}` WHERE id=? LIMIT 1");
        $st->execute([$id]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        if (!$row) return null;
        if (array_key_exists('active', $row) && !(bool)$row['active']) return null;
        $row['type'] = $type;
        if ($type === 'master') {
            $row['profile_visible'] = !array_key_exists('profile_visible', $row) || (bool)$row['profile_visible'];
            $row['rating'] = isset($row['rating']) ? max(0, min(5, (float)$row['rating'])) : 0.0;
            $row['orders_count'] = (int)($row['orders_count'] ?? 0);
            $row['offers_count'] = (int)($row['offers_count'] ?? 0);
            $row['min_price'] = isset($row['min_price']) && $row['min_price'] !== null ? (float)$row['min_price'] : null;
            foreach (['resume','primary_services'] as $jsonField) {
                if (is_string($row[$jsonField] ?? null) && trim((string)$row[$jsonField]) !== '') {
                    $decoded = json_decode((string)$row[$jsonField], true);
                    if (json_last_error() === JSON_ERROR_NONE) $row[$jsonField] = $decoded;
                }
                if (!is_array($row[$jsonField] ?? null)) $row[$jsonField] = [];
            }
        }
        return $row;
    } catch (Throwable $e) {
        if (function_exists('kareta_log_error')) kareta_log_error('PROVIDER_DETAIL_PROVIDER_FALLBACK_FAIL', $e->getMessage());
        return null;
    }
}

function kareta_provider_detail_log_optional(string $channel, Throwable $e): void {
    if (function_exists('kareta_log_error')) kareta_log_error($channel, $e->getMessage());
}

function kareta_provider_detail_catalog_fallback(string $type, string $id): ?array {
    if (!function_exists('kareta_fallback_work_posts')) return null;
    $key = $type === 'sto' ? 'stoId' : 'masterId';
    $payload = kareta_fallback_work_posts([$key=>$id,'limit'=>1]);
    $work = is_array($payload['items'][0] ?? null) ? $payload['items'][0] : null;
    if (!$work) return null;
    $name = trim((string)($type === 'sto' ? ($work['stoName'] ?? '') : ($work['masterName'] ?? '')));
    $service = trim((string)($work['serviceLabel'] ?? ''));
    return [
        'id'=>$id,'type'=>$type,'name'=>$name !== '' ? $name : ($type === 'sto' ? 'Автосервис' : 'Мастер'),
        'spec'=>$service,'description'=>(string)($work['summary'] ?? ''),'city'=>'','active'=>1,
        'profile_visible'=>true,'rating'=>0.0,'reviews_count'=>0,'orders_count'=>0,'offers_count'=>0,
        'resume'=>[],'primary_services'=>$service !== '' ? [$service] : [],'catalog_fallback'=>true,
    ];
}

function kareta_product_detail(?PDO $pdo, array $input): void {
    if (!$pdo) kareta_json(['ok'=>false,'error'=>'db_unavailable'],503);
    $id = kareta_detail_id($input);
    if ($id === '') kareta_json(['ok'=>false,'error'=>'product_id_required'],422);
    $sql = "SELECT p.id,p.seller_user_id,p.sku,p.oem_number,p.name,p.category,p.condition_code,p.exchange_available,p.exchange_note,p.brand,p.price,p.old_price,p.stock_qty,p.description,p.image_url,p.fitment_json,p.updated_at,
            sp.store_name,sp.legal_name,sp.city,sp.warehouse_address,sp.delivery_modes,sp.payment_methods,sp.minimum_order,sp.return_days,sp.return_policy,sp.description AS store_description
            FROM seller_products p INNER JOIN seller_profiles sp ON sp.user_id=p.seller_user_id
            WHERE p.id=? AND p.status='active' AND sp.active=1 AND sp.moderation_status='approved' LIMIT 1";
    $st=$pdo->prepare($sql); $st->execute([$id]); $row=$st->fetch(PDO::FETCH_ASSOC);
    if(!$row) kareta_json(['ok'=>false,'error'=>'product_not_found'],404);
    $row['fitment']=seller_decode_json_field($row['fitment_json']??null); unset($row['fitment_json']);
    $row['delivery_modes']=seller_decode_json_field($row['delivery_modes']??null);
    $row['payment_methods']=seller_decode_json_field($row['payment_methods']??null);
    $reviews=[];$questions=[];
    try{$rv=$pdo->prepare("SELECT author_name,rating,body,created_at FROM product_reviews WHERE product_id=? AND status='published' ORDER BY created_at DESC LIMIT 20");$rv->execute([$id]);$reviews=$rv->fetchAll(PDO::FETCH_ASSOC)?:[];}catch(Throwable $e){}
    try{$qq=$pdo->prepare("SELECT author_name,body,answer,created_at FROM product_questions WHERE product_id=? AND status='published' ORDER BY created_at DESC LIMIT 20");$qq->execute([$id]);$questions=$qq->fetchAll(PDO::FETCH_ASSOC)?:[];}catch(Throwable $e){}
    $row['reviews']=$reviews;$row['questions']=$questions;
    $installations=[];
    try{
        if(function_exists('kareta_table_exists') && kareta_table_exists($pdo,'market_products') && kareta_table_exists($pdo,'work_order_part_reservations') && kareta_table_exists($pdo,'work_posts')){
            $marketProductId=0;
            $map=$pdo->prepare("SELECT id FROM market_products WHERE status='active' AND (product_key=? OR (owner_user_id=? AND sku=? AND ?<>'')) ORDER BY (product_key=? ) DESC LIMIT 1");
            $map->execute([$id,(int)$row['seller_user_id'],(string)($row['sku']??''),(string)($row['sku']??''),$id]);$marketProductId=(int)($map->fetchColumn()?:0);
            if($marketProductId>0){
                $iq=$pdo->prepare("SELECT wp.id AS work_post_id,wp.vehicle_label,wp.service_label,wp.master_name,wp.sto_name,wp.published_at,pr.qty_issued,pr.qty_returned FROM work_order_part_reservations pr JOIN work_posts wp ON wp.order_id=pr.order_id AND wp.status='published' AND wp.visibility='public' AND wp.client_consent=1 WHERE pr.product_id=? AND (COALESCE(pr.qty_issued,0)>COALESCE(pr.qty_returned,0) OR pr.status='issued') ORDER BY wp.published_at DESC LIMIT 20");
                $iq->execute([$marketProductId]);$installations=$iq->fetchAll(PDO::FETCH_ASSOC)?:[];
            }
        }
    }catch(Throwable $e){$installations=[];if(function_exists('kareta_log_error'))kareta_log_error('product_detail_installations_failsoft',$e->getMessage());}
    $row['realInstallations']=$installations;$row['installationCount']=count($installations);
    kareta_json(['ok'=>true,'data'=>$row]);
}

function kareta_service_detail(?PDO $pdo, array $input): void {
    $id = kareta_detail_id($input);
    if ($id === '') kareta_json(['ok'=>false,'error'=>'service_id_required'],422);
    $payload = kareta_service_catalog_public_payload($pdo);
    $service = null;
    foreach (($payload['services'] ?? []) as $row) if ((string)($row['id'] ?? '') === $id) { $service=$row; break; }
    if (!$service) kareta_json(['ok'=>false,'error'=>'service_not_found'],404);
    $offers=[];
    $providerIndex=['master'=>[],'sto'=>[]];
    if ($pdo) {
        try {
            if (function_exists('kareta_masters_catalog_payload')) {
                $providers = kareta_masters_catalog_payload($pdo);
                foreach (($providers['masters'] ?? []) as $row) {
                    $providerIndex['master'][(string)($row['id'] ?? '')] = $row;
                }
                foreach (($providers['stos'] ?? []) as $row) {
                    $providerIndex['sto'][(string)($row['id'] ?? '')] = $row;
                }
            }
        } catch (Throwable $providerError) {
            if (function_exists('kareta_log_error')) kareta_log_error('SERVICE_DETAIL_PROVIDER_ENRICH', $providerError->getMessage());
        }
        foreach (kareta_service_offers_public($pdo) as $offer) {
            if ((string)($offer['serviceId'] ?? '') !== $id) continue;
            $type = strtolower((string)($offer['ownerType'] ?? 'master'));
            $providerId = (string)($offer['ownerEntityId'] ?? '');
            $profile = $providerIndex[$type][$providerId] ?? [];
            $offer['provider'] = [
                'type'=>$type,
                'id'=>$providerId,
                'name'=>(string)($profile['name'] ?? $offer['ownerName'] ?? ($type==='sto'?'СТО':'Мастер')),
                'avatarUrl'=>(string)($profile['logo_url'] ?? $profile['avatar_url'] ?? ''),
                'city'=>(string)($profile['city'] ?? $offer['city'] ?? ''),
                'address'=>(string)($profile['address'] ?? $profile['service_address'] ?? ''),
                'rating'=>(float)($profile['rating'] ?? 0),
                'ordersCount'=>(int)($profile['orders_count'] ?? 0),
                'availability'=>(string)($profile['availability'] ?? $offer['availabilityStatus'] ?? ''),
                'receptionStatus'=>(string)($profile['receptionStatus'] ?? $profile['reception_status'] ?? ($type==='sto'?'open':'')),
                'workHours'=>(string)($profile['work_hours'] ?? ''),
            ];
            $offers[]=$offer;
        }
    }
    usort($offers, static function(array $a,array $b): int {
        $typeOrder = ['sto'=>0,'master'=>1];
        $ta = $typeOrder[strtolower((string)($a['ownerType'] ?? 'master'))] ?? 2;
        $tb = $typeOrder[strtolower((string)($b['ownerType'] ?? 'master'))] ?? 2;
        if ($ta !== $tb) return $ta <=> $tb;
        $pa = (string)($a['priceType'] ?? '') === 'agreement' ? PHP_FLOAT_MAX : (float)($a['price'] ?? 0);
        $pb = (string)($b['priceType'] ?? '') === 'agreement' ? PHP_FLOAT_MAX : (float)($b['price'] ?? 0);
        return $pa <=> $pb;
    });
    kareta_json(['ok'=>true,'data'=>['service'=>$service,'offers'=>$offers,'meta'=>$payload['meta']??[]]]);
}

function kareta_provider_detail(?PDO $pdo, array $input): void {
    if (!$pdo) kareta_json(['ok'=>false,'error'=>'db_unavailable'],503);
    $id = kareta_detail_id($input);
    $type = strtolower(trim((string)($input['type'] ?? 'master')));
    if (!in_array($type, ['master','sto'], true)) kareta_json(['ok'=>false,'error'=>'provider_type_invalid'],422);
    if ($id === '') kareta_json(['ok'=>false,'error'=>'provider_id_required'],422);

    // Public provider detail must not fail because an optional catalog/social table is stale.
    // Try to self-heal the service catalog schema, but never make profile availability depend on ALTER privileges.
    try {
        if (function_exists('kareta_service_catalog_ensure_schema')) kareta_service_catalog_ensure_schema($pdo);
    } catch (Throwable $schemaError) {
        kareta_provider_detail_log_optional('PROVIDER_DETAIL_SERVICE_SCHEMA_FAILSOFT', $schemaError);
    }

    $catalog = ['masters'=>[], 'stos'=>[]];
    try {
        $catalog = kareta_masters_catalog_payload($pdo);
    } catch (Throwable $catalogError) {
        kareta_provider_detail_log_optional('PROVIDER_DETAIL_CATALOG_FAILSOFT', $catalogError);
    }
    $rows = $type === 'sto' ? ($catalog['stos'] ?? []) : ($catalog['masters'] ?? []);
    $provider = null;
    foreach ($rows as $row) {
        if ((string)($row['id'] ?? '') === $id) { $provider = $row; break; }
    }
    if (!$provider) $provider = kareta_provider_detail_fallback_provider($pdo, $type, $id);
    if (!$provider) $provider = kareta_provider_detail_catalog_fallback($type, $id);
    if (!$provider) kareta_json(['ok'=>false,'error'=>'provider_not_found'],404);
    if ($type === 'master' && array_key_exists('profile_visible',$provider) && !$provider['profile_visible']) {
        kareta_json(['ok'=>false,'error'=>'provider_profile_hidden','message'=>'Публичный профиль мастера скрыт.'],404);
    }

    $offers = [];
    try {
        if (!function_exists('kareta_table_exists') || kareta_table_exists($pdo, 'service_offers')) {
            // Use the normalized public offer API when possible. Any schema drift here is optional for the profile shell.
            $allOffers = function_exists('kareta_service_offers_public') ? kareta_service_offers_public($pdo) : [];
            $serviceById = [];
            $categoryByKey = [];
            try {
                $servicePayload = function_exists('kareta_service_catalog_public_payload') ? kareta_service_catalog_public_payload($pdo) : [];
                foreach (($servicePayload['categories'] ?? []) as $category) {
                    $key = (string)($category['key'] ?? $category['category_key'] ?? '');
                    if ($key !== '') $categoryByKey[$key] = (string)($category['name'] ?? $key);
                }
                foreach (($servicePayload['services'] ?? []) as $service) {
                    $serviceId = (string)($service['id'] ?? '');
                    if ($serviceId !== '') $serviceById[$serviceId] = $service;
                }
            } catch (Throwable $serviceMetaError) {
                kareta_provider_detail_log_optional('PROVIDER_DETAIL_SERVICE_META_FAILSOFT', $serviceMetaError);
            }
            foreach ($allOffers as $offer) {
                if ((string)($offer['ownerType'] ?? $offer['owner_type'] ?? '') !== $type) continue;
                if ((string)($offer['ownerEntityId'] ?? $offer['owner_entity_id'] ?? '') !== $id) continue;
                $serviceId = (string)($offer['serviceId'] ?? $offer['service_id'] ?? '');
                $service = $serviceById[$serviceId] ?? [];
                $categoryKey = (string)($service['cat'] ?? $service['category_key'] ?? '');
                $offer['service_id'] = $serviceId;
                $offer['service_name'] = (string)($service['name'] ?? $serviceId);
                $offer['service_icon'] = (string)($service['icon'] ?? '');
                $offer['service_description'] = (string)($service['shortDesc'] ?? $service['short_desc'] ?? '');
                $offer['service_category_name'] = $categoryByKey[$categoryKey] ?? $categoryKey;
                $offer['price_type'] = (string)($offer['priceType'] ?? $offer['price_type'] ?? 'fixed');
                $offer['price_max'] = (float)($offer['priceMax'] ?? $offer['price_max'] ?? 0);
                $offer['duration_min'] = (int)($offer['durationMin'] ?? $offer['duration_min'] ?? 0);
                $offer['duration_max_min'] = (int)($offer['durationMaxMin'] ?? $offer['duration_max_min'] ?? 0);
                $offer['warranty_days'] = (int)($offer['warrantyDays'] ?? $offer['warranty_days'] ?? 0);
                $offers[] = $offer;
            }
            usort($offers, static fn(array $a,array $b): int => ((float)($a['price'] ?? 0)) <=> ((float)($b['price'] ?? 0)));
        }
    } catch (Throwable $offerError) {
        kareta_provider_detail_log_optional('PROVIDER_DETAIL_OFFERS_FAILSOFT', $offerError);
        $offers = [];
    }

    $reviews = [];
    if ($type === 'master') {
        try {
            if (function_exists('kareta_table_exists') && kareta_table_exists($pdo,'master_reviews')) {
                $hasOrders = kareta_table_exists($pdo,'orders');
                $sql = "SELECT mr.id,mr.order_id,mr.author_name,mr.rating,mr.quality_rating,mr.timing_rating,mr.neatness_rating,mr.communication_rating,mr.text,mr.master_reply,mr.master_reply_at,mr.created_at FROM master_reviews mr";
                if ($hasOrders) $sql .= " JOIN orders o ON o.id=mr.order_id AND o.status='done'";
                $sql .= " WHERE mr.master_id=? AND mr.status='published' ORDER BY mr.created_at DESC LIMIT 100";
                $rv = $pdo->prepare($sql);
                $rv->execute([$id]);
                $reviews = $rv->fetchAll(PDO::FETCH_ASSOC) ?: [];
            }
        } catch (Throwable $reviewError) {
            kareta_provider_detail_log_optional('PROVIDER_DETAIL_REVIEWS_FAILSOFT', $reviewError);
            $reviews = [];
        }
    }
    $reviewSummary=['average'=>0.0,'count'=>count($reviews),'verified'=>0,'breakdown'=>['5'=>0,'4'=>0,'3'=>0,'2'=>0,'1'=>0],'dimensions'=>[]];
    if($reviews){
      $sum=0.0;$dimensionSums=['quality_rating'=>0.0,'timing_rating'=>0.0,'neatness_rating'=>0.0,'communication_rating'=>0.0];$dimensionCounts=array_fill_keys(array_keys($dimensionSums),0);
      foreach($reviews as $review){
        $rating=max(1,min(5,(int)($review['rating']??5)));$sum+=$rating;$reviewSummary['breakdown'][(string)$rating]++;
        if(trim((string)($review['order_id']??''))!=='')$reviewSummary['verified']++;
        foreach(array_keys($dimensionSums) as $key){if(($review[$key]??null)!==null && ($review[$key]??'')!==''){$dimensionSums[$key]+=(float)$review[$key];$dimensionCounts[$key]++;}}
      }
      $reviewSummary['average']=round($sum/count($reviews),1);
      foreach($dimensionSums as $key=>$value){if($dimensionCounts[$key]>0)$reviewSummary['dimensions'][$key]=round($value/$dimensionCounts[$key],1);}
    }

    $works=[];
    try {
        if(function_exists('kareta_table_exists') && kareta_table_exists($pdo,'work_posts')){
          $commentsExpr=kareta_table_exists($pdo,'work_post_comments')
            ? "(SELECT COUNT(*) FROM work_post_comments wpc WHERE wpc.post_id=work_posts.id AND wpc.active=1)"
            : "0";
          $wk=$pdo->prepare("SELECT id,title,summary,cover_url AS coverUrl,vehicle_label AS vehicleLabel,service_label AS serviceLabel,published_at AS publishedAt,views_count AS viewsCount,likes_count AS likesCount,{$commentsExpr} AS commentsCount FROM work_posts WHERE ".($type==='sto'?"sto_id":"master_id")."=? AND status='published' AND visibility='public' ORDER BY published_at DESC LIMIT 30");
          $wk->execute([$id]);$works=$wk->fetchAll(PDO::FETCH_ASSOC)?:[];
        }
    } catch (Throwable $worksError) {
        kareta_provider_detail_log_optional('PROVIDER_DETAIL_WORKS_FAILSOFT', $worksError);
        $works=[];
    }
    if (!$works && function_exists('kareta_fallback_work_posts')) {
        $fallbackWorks = kareta_fallback_work_posts([
            $type === 'sto' ? 'stoId' : 'masterId' => $id,
            'limit' => 30,
        ]);
        $works = is_array($fallbackWorks['items'] ?? null) ? array_values($fallbackWorks['items']) : [];
    }

    $news=[];
    try {
        if(function_exists('kareta_table_exists') && kareta_table_exists($pdo,'news_articles')){
          $authorUserId=(int)($provider['user_id']??$provider['userId']??0);
          if($authorUserId>0){
            $nw=$pdo->prepare("SELECT id,slug,title,intro,body,cover_url,published_at,created_at,views_count FROM news_articles WHERE author_user_id=? AND active=1 ORDER BY published_at DESC,created_at DESC LIMIT 30");
            $nw->execute([$authorUserId]);$news=$nw->fetchAll(PDO::FETCH_ASSOC)?:[];
          }
        }
    } catch (Throwable $newsError) {
        kareta_provider_detail_log_optional('PROVIDER_DETAIL_NEWS_FAILSOFT', $newsError);
        $news=[];
    }

    $wallPosts=[];
    if($type==='master'){
      try{
        if(function_exists('kareta_master_wall_social_ensure'))kareta_master_wall_social_ensure($pdo);
        if(function_exists('kareta_table_exists')&&kareta_table_exists($pdo,'master_wall_posts')){
          $mw=$pdo->prepare("SELECT id,post_type AS kind,title,preview,text,photos_json AS photosJson,video_url AS videoUrl,linked_product_id AS linkedProductId,COALESCE(published_at,created_at) AS publishedAt FROM master_wall_posts WHERE master_id=? AND active=1 AND COALESCE(visibility,'public')='public' ORDER BY COALESCE(published_at,created_at) DESC LIMIT 12");
          $mw->execute([$id]);$wallPosts=$mw->fetchAll(PDO::FETCH_ASSOC)?:[];
        }
      }catch(Throwable $wallError){kareta_provider_detail_log_optional('PROVIDER_DETAIL_WALL_FAILSOFT',$wallError);}
    }

    $socialState=['following'=>false,'liked'=>false,'followNews'=>true,'followWorks'=>true];
    $socialCounts=['followers'=>0,'likes'=>0];
    try {
      if($type==='sto' && function_exists('kareta_sto_social_states')){
        $states=kareta_sto_social_states($pdo,[$id]);$counts=function_exists('kareta_sto_social_counts')?kareta_sto_social_counts($pdo,[$id]):[];
        $socialState=$states[$id]??['following'=>false,'followNews'=>true,'followWorks'=>true];$socialCounts=$counts[$id]??['followers'=>0];
      } elseif($type==='master' && function_exists('kareta_master_social_states')) {
        $states=kareta_master_social_states($pdo,[$id]);$counts=function_exists('kareta_master_social_counts')?kareta_master_social_counts($pdo,[$id]):[];
        $socialState=$states[$id]??$socialState;$socialCounts=$counts[$id]??$socialCounts;
      }
    } catch(Throwable $socialError) {
      kareta_provider_detail_log_optional('PROVIDER_DETAIL_SOCIAL_FAILSOFT',$socialError);
    }

    kareta_json(['ok'=>true,'data'=>[
      'type'=>$type,'provider'=>$provider,'offers'=>$offers,'reviews'=>$reviews,'reviewSummary'=>$reviewSummary,
      'works'=>$works,'news'=>$news,'wallPosts'=>$wallPosts,'socialState'=>$socialState,'socialCounts'=>$socialCounts
    ]]);
}
