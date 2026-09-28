<?php
declare(strict_types=1);

/**
 * KARETA vehicle catalog v1.
 * Stable IDs are intentionally human-readable and never derived from array order.
 */
function kareta_vehicle_catalog_seed(): array {
    return [
      ['id'=>'toyota','name'=>'Toyota','popular'=>1,'models'=>[
        ['id'=>'camry','name'=>'Camry','generations'=>[
          ['id'=>'xv30','name'=>'XV30','from'=>2001,'to'=>2006],['id'=>'xv40','name'=>'XV40','from'=>2006,'to'=>2011],['id'=>'xv50','name'=>'XV50','from'=>2011,'to'=>2018],['id'=>'xv70','name'=>'XV70','from'=>2017,'to'=>2024],['id'=>'xv80','name'=>'XV80','from'=>2024,'to'=>2030],
        ]],
        ['id'=>'corolla','name'=>'Corolla'],['id'=>'rav4','name'=>'RAV4'],['id'=>'land-cruiser','name'=>'Land Cruiser'],['id'=>'prado','name'=>'Land Cruiser Prado'],['id'=>'highlander','name'=>'Highlander'],['id'=>'hilux','name'=>'Hilux']]],
      ['id'=>'lexus','name'=>'Lexus','popular'=>1,'models'=>[['id'=>'rx','name'=>'RX'],['id'=>'lx','name'=>'LX'],['id'=>'gx','name'=>'GX'],['id'=>'es','name'=>'ES'],['id'=>'nx','name'=>'NX'],['id'=>'is','name'=>'IS']]],
      ['id'=>'hyundai','name'=>'Hyundai','popular'=>1,'models'=>[['id'=>'accent','name'=>'Accent'],['id'=>'elantra','name'=>'Elantra'],['id'=>'sonata','name'=>'Sonata'],['id'=>'tucson','name'=>'Tucson'],['id'=>'santa-fe','name'=>'Santa Fe'],['id'=>'palisade','name'=>'Palisade']]],
      ['id'=>'kia','name'=>'Kia','popular'=>1,'models'=>[['id'=>'rio','name'=>'Rio'],['id'=>'cerato','name'=>'Cerato'],['id'=>'k5','name'=>'K5'],['id'=>'sportage','name'=>'Sportage'],['id'=>'sorento','name'=>'Sorento'],['id'=>'carnival','name'=>'Carnival']]],
      ['id'=>'chevrolet','name'=>'Chevrolet','popular'=>1,'models'=>[['id'=>'cobalt','name'=>'Cobalt'],['id'=>'nexia','name'=>'Nexia'],['id'=>'malibu','name'=>'Malibu'],['id'=>'tracker','name'=>'Tracker'],['id'=>'captiva','name'=>'Captiva'],['id'=>'tahoe','name'=>'Tahoe']]],
      ['id'=>'lada','name'=>'LADA','popular'=>1,'models'=>[['id'=>'granta','name'=>'Granta'],['id'=>'vesta','name'=>'Vesta'],['id'=>'niva','name'=>'Niva'],['id'=>'largus','name'=>'Largus'],['id'=>'priora','name'=>'Priora'],['id'=>'kalina','name'=>'Kalina']]],
      ['id'=>'volkswagen','name'=>'Volkswagen','popular'=>1,'models'=>[['id'=>'polo','name'=>'Polo'],['id'=>'passat','name'=>'Passat'],['id'=>'tiguan','name'=>'Tiguan'],['id'=>'touareg','name'=>'Touareg'],['id'=>'golf','name'=>'Golf'],['id'=>'jetta','name'=>'Jetta']]],
      ['id'=>'nissan','name'=>'Nissan','popular'=>1,'models'=>[['id'=>'qashqai','name'=>'Qashqai'],['id'=>'x-trail','name'=>'X-Trail'],['id'=>'murano','name'=>'Murano'],['id'=>'patrol','name'=>'Patrol'],['id'=>'teana','name'=>'Teana'],['id'=>'almera','name'=>'Almera']]],
      ['id'=>'honda','name'=>'Honda','models'=>[['id'=>'cr-v','name'=>'CR-V'],['id'=>'accord','name'=>'Accord'],['id'=>'civic','name'=>'Civic'],['id'=>'pilot','name'=>'Pilot'],['id'=>'fit','name'=>'Fit']]],
      ['id'=>'mazda','name'=>'Mazda','models'=>[['id'=>'3','name'=>'3'],['id'=>'6','name'=>'6'],['id'=>'cx-5','name'=>'CX-5'],['id'=>'cx-7','name'=>'CX-7'],['id'=>'cx-9','name'=>'CX-9']]],
      ['id'=>'mitsubishi','name'=>'Mitsubishi','models'=>[['id'=>'outlander','name'=>'Outlander'],['id'=>'pajero','name'=>'Pajero'],['id'=>'pajero-sport','name'=>'Pajero Sport'],['id'=>'lancer','name'=>'Lancer'],['id'=>'asx','name'=>'ASX']]],
      ['id'=>'subaru','name'=>'Subaru','models'=>[['id'=>'forester','name'=>'Forester'],['id'=>'outback','name'=>'Outback'],['id'=>'legacy','name'=>'Legacy'],['id'=>'impreza','name'=>'Impreza'],['id'=>'xv','name'=>'XV']]],
      ['id'=>'renault','name'=>'Renault','models'=>[['id'=>'logan','name'=>'Logan'],['id'=>'duster','name'=>'Duster'],['id'=>'sandero','name'=>'Sandero'],['id'=>'kaptur','name'=>'Kaptur'],['id'=>'koleos','name'=>'Koleos']]],
      ['id'=>'skoda','name'=>'Škoda','models'=>[['id'=>'octavia','name'=>'Octavia'],['id'=>'rapid','name'=>'Rapid'],['id'=>'kodiaq','name'=>'Kodiaq'],['id'=>'superb','name'=>'Superb'],['id'=>'karoq','name'=>'Karoq']]],
      ['id'=>'ford','name'=>'Ford','models'=>[['id'=>'focus','name'=>'Focus'],['id'=>'mondeo','name'=>'Mondeo'],['id'=>'kuga','name'=>'Kuga'],['id'=>'explorer','name'=>'Explorer'],['id'=>'transit','name'=>'Transit']]],
      ['id'=>'mercedes-benz','name'=>'Mercedes-Benz','models'=>[['id'=>'c-class','name'=>'C-Class'],['id'=>'e-class','name'=>'E-Class'],['id'=>'s-class','name'=>'S-Class'],['id'=>'gle','name'=>'GLE'],['id'=>'glc','name'=>'GLC'],['id'=>'g-class','name'=>'G-Class']]],
      ['id'=>'bmw','name'=>'BMW','models'=>[['id'=>'3-series','name'=>'3 Series'],['id'=>'5-series','name'=>'5 Series'],['id'=>'7-series','name'=>'7 Series'],['id'=>'x3','name'=>'X3'],['id'=>'x5','name'=>'X5'],['id'=>'x6','name'=>'X6']]],
      ['id'=>'audi','name'=>'Audi','models'=>[['id'=>'a4','name'=>'A4'],['id'=>'a6','name'=>'A6'],['id'=>'a8','name'=>'A8'],['id'=>'q5','name'=>'Q5'],['id'=>'q7','name'=>'Q7'],['id'=>'q8','name'=>'Q8']]],
      ['id'=>'geely','name'=>'Geely','models'=>[['id'=>'coolray','name'=>'Coolray'],['id'=>'atlas','name'=>'Atlas'],['id'=>'tugella','name'=>'Tugella'],['id'=>'emgrand','name'=>'Emgrand']]],
      ['id'=>'chery','name'=>'Chery','models'=>[['id'=>'tiggo-4','name'=>'Tiggo 4'],['id'=>'tiggo-7','name'=>'Tiggo 7'],['id'=>'tiggo-8','name'=>'Tiggo 8'],['id'=>'arrizo-8','name'=>'Arrizo 8']]],
      ['id'=>'haval','name'=>'Haval','models'=>[['id'=>'jolion','name'=>'Jolion'],['id'=>'f7','name'=>'F7'],['id'=>'dargo','name'=>'Dargo'],['id'=>'h9','name'=>'H9']]],
      ['id'=>'jac','name'=>'JAC','models'=>[['id'=>'s3','name'=>'S3'],['id'=>'s5','name'=>'S5'],['id'=>'js4','name'=>'JS4'],['id'=>'js6','name'=>'JS6'],['id'=>'t8','name'=>'T8']]],
      ['id'=>'byd','name'=>'BYD','models'=>[['id'=>'song-plus','name'=>'Song Plus'],['id'=>'han','name'=>'Han'],['id'=>'seal','name'=>'Seal'],['id'=>'atto-3','name'=>'Atto 3']]],
      ['id'=>'suzuki','name'=>'Suzuki','models'=>[['id'=>'vitara','name'=>'Vitara'],['id'=>'grand-vitara','name'=>'Grand Vitara'],['id'=>'sx4','name'=>'SX4'],['id'=>'jimny','name'=>'Jimny']]],
      ['id'=>'peugeot','name'=>'Peugeot','models'=>[['id'=>'206','name'=>'206'],['id'=>'307','name'=>'307'],['id'=>'308','name'=>'308'],['id'=>'408','name'=>'408'],['id'=>'3008','name'=>'3008']]],
      ['id'=>'opel','name'=>'Opel','models'=>[['id'=>'astra','name'=>'Astra'],['id'=>'vectra','name'=>'Vectra'],['id'=>'zafira','name'=>'Zafira'],['id'=>'insignia','name'=>'Insignia']]],
      ['id'=>'gaz','name'=>'ГАЗ','models'=>[['id'=>'gazelle','name'=>'Газель'],['id'=>'sobol','name'=>'Соболь'],['id'=>'volga','name'=>'Волга']]],
      ['id'=>'uaz','name'=>'УАЗ','models'=>[['id'=>'patriot','name'=>'Patriot'],['id'=>'hunter','name'=>'Hunter'],['id'=>'profi','name'=>'Profi']]],
    ];
}

function kareta_vehicle_catalog_normalize(string $value): string {
    $value=trim(preg_replace('/\s+/u',' ',$value) ?: '');
    return function_exists('mb_strtolower') ? mb_strtolower($value,'UTF-8') : strtolower($value);
}

function kareta_vehicle_catalog_payload(PDO $pdo): array {
    $brands=$pdo->query("SELECT id,name,popular,sort_order FROM vehicle_catalog_brands WHERE active=1 ORDER BY popular DESC,sort_order ASC,name ASC")->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $models=$pdo->query("SELECT brand_id,id,name,sort_order FROM vehicle_catalog_models WHERE active=1 ORDER BY brand_id,sort_order,id")->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $generations=$pdo->query("SELECT brand_id,model_id,id,name,year_from,year_to,sort_order FROM vehicle_catalog_generations WHERE active=1 ORDER BY brand_id,model_id,sort_order,id")->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $modelMap=[];
    foreach($models as $row){$row['generations']=[];$modelMap[(string)$row['brand_id']][(string)$row['id']]=$row;}
    foreach($generations as $row){$bid=(string)$row['brand_id'];$mid=(string)$row['model_id'];if(isset($modelMap[$bid][$mid]))$modelMap[$bid][$mid]['generations'][]=['id'=>(string)$row['id'],'name'=>(string)$row['name'],'from'=>(int)$row['year_from'],'to'=>(int)$row['year_to']];}
    $out=[];
    foreach($brands as $brand){$bid=(string)$brand['id'];$out[]=['id'=>$bid,'name'=>(string)$brand['name'],'popular'=>!empty($brand['popular']),'models'=>array_values($modelMap[$bid]??[])];}
    return ['version'=>'vehicle-catalog-v1','brands'=>$out,'brandCount'=>count($out),'generatedAt'=>gmdate('c')];
}

function kareta_vehicle_catalog_list(PDO $pdo): void {
    kareta_json(['ok'=>true,'data'=>kareta_vehicle_catalog_payload($pdo)]);
}

function kareta_vehicle_catalog_resolve(PDO $pdo,array $vehicle,bool $strictFirstFlow=false): array {
    $brandId=trim((string)($vehicle['brandId']??$vehicle['brand_id']??''));
    $modelId=trim((string)($vehicle['modelId']??$vehicle['model_id']??''));
    $generationId=trim((string)($vehicle['generationId']??$vehicle['generation_id']??''));
    $brand=trim((string)($vehicle['brand']??''));$model=trim((string)($vehicle['model']??''));$generation=trim((string)($vehicle['generation']??''));

    if($brandId!==''&&!in_array($brandId,['legacy-edit'],true)){
        $st=$pdo->prepare("SELECT id,name FROM vehicle_catalog_brands WHERE id=? AND active=1 LIMIT 1");$st->execute([$brandId]);$row=$st->fetch(PDO::FETCH_ASSOC);
        if(!$row){if($strictFirstFlow)kareta_json(['ok'=>false,'error'=>'invalid_vehicle_brand','message'=>'Выберите марку из каталога'],422);$brandId='';}
        else{$brandId=(string)$row['id'];$brand=(string)$row['name'];}
    }elseif($brand!==''){
        $st=$pdo->prepare("SELECT id,name FROM vehicle_catalog_brands WHERE normalized_name=? AND active=1 LIMIT 1");$st->execute([kareta_vehicle_catalog_normalize($brand)]);if($row=$st->fetch(PDO::FETCH_ASSOC)){$brandId=(string)$row['id'];$brand=(string)$row['name'];}
    }

    if($modelId!==''&&!in_array($modelId,['custom','legacy-edit'],true)&&$brandId!==''){
        $st=$pdo->prepare("SELECT id,name FROM vehicle_catalog_models WHERE brand_id=? AND id=? AND active=1 LIMIT 1");$st->execute([$brandId,$modelId]);$row=$st->fetch(PDO::FETCH_ASSOC);
        if(!$row){if($strictFirstFlow)kareta_json(['ok'=>false,'error'=>'invalid_vehicle_model','message'=>'Выберите модель из каталога или укажите свою'],422);$modelId='';}
        else{$modelId=(string)$row['id'];$model=(string)$row['name'];}
    }elseif($brandId!==''&&$model!==''){
        $st=$pdo->prepare("SELECT id,name FROM vehicle_catalog_models WHERE brand_id=? AND normalized_name=? AND active=1 LIMIT 1");$st->execute([$brandId,kareta_vehicle_catalog_normalize($model)]);if($row=$st->fetch(PDO::FETCH_ASSOC)){$modelId=(string)$row['id'];$model=(string)$row['name'];}
    }
    if($modelId==='custom'||$modelId==='legacy-edit')$modelId='';
    if($brandId==='legacy-edit')$brandId='';

    if($generationId!==''&&$brandId!==''&&$modelId!==''){
        $st=$pdo->prepare("SELECT id,name,year_from,year_to FROM vehicle_catalog_generations WHERE brand_id=? AND model_id=? AND id=? AND active=1 LIMIT 1");$st->execute([$brandId,$modelId,$generationId]);$row=$st->fetch(PDO::FETCH_ASSOC);
        if(!$row){$generationId='';}
        else{$generationId=(string)$row['id'];$generation=(string)$row['name'];$year=(int)($vehicle['year']??$vehicle['yearLabel']??0);if($year>0&&(($row['year_from']&&$year<(int)$row['year_from'])||($row['year_to']&&$year>(int)$row['year_to'])))$generationId='';}
    }elseif($brandId!==''&&$modelId!==''&&$generation!==''){
        $st=$pdo->prepare("SELECT id,name FROM vehicle_catalog_generations WHERE brand_id=? AND model_id=? AND normalized_name=? AND active=1 LIMIT 1");$st->execute([$brandId,$modelId,kareta_vehicle_catalog_normalize($generation)]);if($row=$st->fetch(PDO::FETCH_ASSOC)){$generationId=(string)$row['id'];$generation=(string)$row['name'];}
    }
    return ['brandId'=>$brandId,'modelId'=>$modelId,'generationId'=>$generationId,'brand'=>$brand,'model'=>$model,'generation'=>$generation];
}

/** VIN adapter contract. External provider integration is intentionally optional. */
function kareta_vehicle_vin_decode(PDO $pdo,array $body): void {
    $vin=strtoupper(preg_replace('/[^A-HJ-NPR-Z0-9]/i','',(string)($body['vin']??'')) ?: '');
    if(!preg_match('/^[A-HJ-NPR-Z0-9]{17}$/',$vin))kareta_json(['ok'=>false,'error'=>'invalid_vehicle_vin','message'=>'VIN должен содержать 17 символов без I, O и Q'],422);
    $provider=trim((string)(getenv('KARETA_VIN_PROVIDER')?:''));
    // Adapter is present now; concrete providers can be connected without changing UI/API.
    kareta_json(['ok'=>true,'data'=>['vin'=>$vin,'status'=>'unavailable','provider'=>$provider!==''?$provider:'none','canDecode'=>false,'fields'=>[]]]);
}
