<?php
declare(strict_types=1);

function kareta_storage_json(string $relative, array $fallback = []): array {
    $path = dirname(__DIR__) . '/storage/catalog/' . ltrim($relative, '/');
    if (!is_file($path) || !is_readable($path)) return $fallback;
    $raw = file_get_contents($path);
    if ($raw === false || $raw === '') return $fallback;
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : $fallback;
}

function kareta_fallback_products(array $query = []): array {
    $payload = kareta_storage_json('products_globaltuning.json', []);
    $rows = is_array($payload['products'] ?? null) ? $payload['products'] : (array_is_list($payload) ? $payload : []);
    $categoriesPayload = kareta_storage_json('product_categories.json', []);
    $categoryRows = is_array($categoriesPayload['categories'] ?? null) ? $categoriesPayload['categories'] : (array_is_list($categoriesPayload) ? $categoriesPayload : []);
    $groupRows = is_array($categoriesPayload['groups'] ?? null) ? $categoriesPayload['groups'] : [];
    $groupMap=[]; foreach($groupRows as $group){ if(is_array($group)) $groupMap[(string)($group['key']??'')]=(string)($group['name']??'Прочее'); }
    $lower = static fn(string $value): string => function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value);
    $search = $lower(trim((string)($query['search'] ?? '')));
    $category = trim((string)($query['category'] ?? 'all'));
    $limit = max(1, min(100, (int)($query['limit'] ?? 60)));
    $counts = [];
    $products = [];
    foreach ($rows as $row) {
        if (!is_array($row)) continue;
        $cat = trim((string)($row['category'] ?? $row['cat'] ?? 'other')) ?: 'other';
        $stock = (int)($row['stock_qty'] ?? $row['qty'] ?? $row['stock'] ?? 0);
        if ($stock <= 0) continue;
        $counts[$cat] = ($counts[$cat] ?? 0) + 1;
        if ($category !== '' && $category !== 'all' && $cat !== $category) continue;
        $haystack = $lower(implode(' ', [
            (string)($row['name'] ?? ''), (string)($row['sku'] ?? ''),
            (string)($row['oem_number'] ?? $row['oem'] ?? ''), (string)($row['brand'] ?? '')
        ]));
        if ($search !== '' && !str_contains($haystack, $search)) continue;
        $products[] = [
            'id'=>(string)($row['id'] ?? ''), 'seller_user_id'=>0,
            'sku'=>(string)($row['sku'] ?? ''), 'oem_number'=>(string)($row['oem_number'] ?? $row['oem'] ?? ''),
            'name'=>(string)($row['name'] ?? 'Товар'), 'category'=>$cat, 'brand'=>(string)($row['brand'] ?? ''),
            'price'=>(float)($row['price'] ?? $row['retail_price'] ?? 0), 'old_price'=>(float)($row['old_price'] ?? 0),
            'stock_qty'=>$stock, 'description'=>(string)($row['description'] ?? $row['note'] ?? ''),
            'image_url'=>(string)($row['image_url'] ?? $row['image'] ?? ''), 'fitment'=>[],
            'store_name'=>'KARETA.KZ / GlobalTuning', 'city'=>'Усть-Каменогорск',
            'warehouse_address'=>'', 'delivery_modes'=>['pickup'], 'payment_methods'=>['cash','card'],
            'return_days'=>14, 'moderation_status'=>'approved',
        ];
    }
    $total = count($products);
    $products = array_slice($products, 0, $limit);
    $categories = [];
    foreach ($categoryRows as $row) {
        if (!is_array($row) || (isset($row['active']) && !$row['active'])) continue;
        $key = (string)($row['key'] ?? $row['category_key'] ?? 'other');
        $categories[] = [
            'key'=>$key, 'name'=>(string)($row['name'] ?? $key), 'icon'=>(string)($row['icon'] ?? '◇'),
            'groupKey'=>(string)($row['groupKey'] ?? $row['group_key'] ?? $row['group'] ?? 'other'),
            'groupName'=>(string)($row['groupName'] ?? $row['group_name'] ?? ($groupMap[(string)($row['group']??'')] ?? 'Прочее')),
            'count'=>(int)($counts[$key] ?? 0),
        ];
    }
    return ['products'=>$products,'categories'=>$categories,'total'=>$total,'source'=>'storage/catalog/products_globaltuning.json'];
}

function kareta_fallback_news(array $query = []): array {
    $payload = kareta_storage_json('news.json', ['items'=>[]]);
    $rows = is_array($payload['items'] ?? null) ? $payload['items'] : [];
    $category = trim((string)($query['category'] ?? 'all'));
    $limit = max(1, min(100, (int)($query['limit'] ?? 50)));
    if ($category !== '' && $category !== 'all') $rows = array_values(array_filter($rows, static fn($r)=>is_array($r) && (string)($r['category'] ?? '') === $category));
    return ['items'=>array_slice($rows,0,$limit),'source'=>'storage/catalog/news.json'];
}

function kareta_fallback_work_posts(array $query = []): array {
    $payload = kareta_storage_json('work_posts.json', ['items'=>[]]);
    $rows = is_array($payload['items'] ?? null) ? $payload['items'] : [];
    $map = ['masterId'=>'masterId','stoId'=>'stoId','vehicleId'=>'vehicleId','type'=>'type'];
    foreach ($map as $input=>$field) {
        $value = trim((string)($query[$input] ?? ''));
        if ($value !== '') $rows = array_values(array_filter($rows, static fn($r)=>is_array($r) && (string)($r[$field] ?? '') === $value));
    }
    $limit = max(1, min(60, (int)($query['limit'] ?? 24)));
    return ['items'=>array_slice($rows,0,$limit),'total'=>count($rows),'source'=>'storage/catalog/work_posts.json'];
}

function kareta_fallback_work_post(string $id): ?array {
    $payload = kareta_fallback_work_posts(['limit'=>60]);
    foreach ($payload['items'] as $row) if ((string)($row['id'] ?? '') === $id) return $row;
    return null;
}
