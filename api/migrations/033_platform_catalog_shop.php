<?php
declare(strict_types=1);

return [
    'version' => 33,
    'note' => 'publish services and parts catalog in database-driven storefront',
    'run' => function(PDO $pdo): void {
        if (kareta_table_exists($pdo, 'parts_catalog')) {
            kareta_ensure_column($pdo, 'parts_catalog', 'brand', "ALTER TABLE `parts_catalog` ADD COLUMN `brand` VARCHAR(120) NOT NULL DEFAULT '' AFTER `sku`");
            kareta_ensure_column($pdo, 'parts_catalog', 'oem', "ALTER TABLE `parts_catalog` ADD COLUMN `oem` VARCHAR(120) NOT NULL DEFAULT '' AFTER `brand`");
            kareta_ensure_column($pdo, 'parts_catalog', 'fitments_json', "ALTER TABLE `parts_catalog` ADD COLUMN `fitments_json` JSON NULL AFTER `note`");
        }
        if (!kareta_table_exists($pdo, 'parts_catalog') || !kareta_table_exists($pdo, 'seller_profiles') || !kareta_table_exists($pdo, 'seller_products')) {
            return;
        }

        $pdo->prepare("INSERT INTO `seller_profiles`
            (`user_id`,`user_phone`,`store_name`,`legal_name`,`contact_phone`,`country_code`,`city`,`warehouse_address`,`description`,`assortment`,`category_tags`,`delivery_modes`,`payment_methods`,`minimum_order`,`return_days`,`moderation_status`,`active`)
            VALUES (0,'platform','KARETA.KZ / GlobalTuning','KARETA.KZ','','KZ','Усть-Каменогорск','Склад KARETA.KZ','Основной товарный каталог платформы KARETA.KZ.','Автозвук, автоэлектрика и автомобильные запчасти',JSON_ARRAY('parts','audio','electrical'),JSON_ARRAY('pickup','courier','transport'),JSON_ARRAY('cash','transfer'),'',14,'approved',1)
            ON DUPLICATE KEY UPDATE store_name=VALUES(store_name), legal_name=VALUES(legal_name), moderation_status='approved', active=1, updated_at=CURRENT_TIMESTAMP")
            ->execute();

        $rows = $pdo->query("SELECT id,cat,name,sku,brand,oem,price_label,stock,note,fitments_json,active FROM `parts_catalog`")->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $upsert = $pdo->prepare("INSERT INTO `seller_products`
            (`id`,`seller_user_id`,`seller_phone`,`sku`,`oem_number`,`name`,`category`,`brand`,`price`,`old_price`,`stock_qty`,`status`,`description`,`image_url`,`fitment_json`)
            VALUES (?,?,?,?,?,?,?,?,?,0,?,?,?,'',?)
            ON DUPLICATE KEY UPDATE sku=VALUES(sku),oem_number=VALUES(oem_number),name=VALUES(name),category=VALUES(category),brand=VALUES(brand),price=VALUES(price),stock_qty=VALUES(stock_qty),status=VALUES(status),description=VALUES(description),fitment_json=VALUES(fitment_json),updated_at=CURRENT_TIMESTAMP");

        foreach ($rows as $row) {
            $label = (string)($row['price_label'] ?? '');
            $digits = preg_replace('~[^0-9]+~', '', $label) ?: '0';
            $price = (float)$digits;
            $note = (string)($row['note'] ?? '');
            $stockQty = (int)($row['stock'] ?? 0) > 0 ? 1 : 0;
            if (preg_match('~Остаток\s*:\s*(\d+)~ui', $note, $match)) $stockQty = max(0, (int)$match[1]);
            $partId = (string)($row['id'] ?? '');
            if ($partId === '') continue;
            $sku = trim((string)($row['sku'] ?? '')) ?: strtoupper($partId);
            $status = ((int)($row['active'] ?? 0) === 1 && $stockQty > 0 && $price > 0) ? 'active' : 'paused';
            $upsert->execute([
                'catalog_' . substr($partId, 0, 52),
                0,
                'platform',
                $sku,
                (string)($row['oem'] ?? ''),
                (string)($row['name'] ?? ''),
                (string)($row['cat'] ?? 'other'),
                (string)($row['brand'] ?? ''),
                $price,
                $stockQty,
                $status,
                $note,
                (string)($row['fitments_json'] ?? '[]'),
            ]);
        }
    },
];
