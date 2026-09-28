<?php
declare(strict_types=1);

/**
 * Protected product-catalog source loader and MySQL importer.
 *
 * The JSON file is only an import source. Runtime reads products from MySQL.
 */

function kareta_product_catalog_source_path(): string
{
    $root = defined('KARETA_STORAGE_ROOT') ? KARETA_STORAGE_ROOT : dirname(__DIR__, 2) . '/storage';
    return $root . '/catalog/products_globaltuning.json';
}

function kareta_product_catalog_load_source(): array
{
    $path = kareta_product_catalog_source_path();
    if (!is_file($path) || !is_readable($path)) {
        throw new RuntimeException('product_catalog_source_missing');
    }

    $raw = file_get_contents($path);
    if ($raw === false || trim($raw) === '') {
        throw new RuntimeException('product_catalog_source_empty');
    }

    $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($decoded) || (int)($decoded['schema_version'] ?? 0) !== 1) {
        throw new RuntimeException('product_catalog_schema_invalid');
    }

    $products = $decoded['products'] ?? null;
    if (!is_array($products)) {
        throw new RuntimeException('product_catalog_products_invalid');
    }

    $source = is_array($decoded['source'] ?? null) ? $decoded['source'] : [];
    $expectedCount = (int)($source['records'] ?? count($products));
    if ($expectedCount !== count($products)) {
        throw new RuntimeException('product_catalog_record_count_mismatch');
    }

    $canonical = json_encode(array_values($products), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $actualHash = $canonical === false ? '' : hash('sha256', $canonical);
    $expectedHash = strtolower(trim((string)($source['products_sha256'] ?? '')));
    if ($expectedHash !== '' && !hash_equals($expectedHash, $actualHash)) {
        throw new RuntimeException('product_catalog_checksum_mismatch');
    }

    return [
        'schema_version' => 1,
        'source' => $source,
        'products' => array_values($products),
        'checksum' => $actualHash,
    ];
}

function kareta_product_catalog_text(mixed $value, int $max): string
{
    $text = trim((string)$value);
    if (function_exists('mb_substr')) return mb_substr($text, 0, $max, 'UTF-8');
    return substr($text, 0, $max);
}

function kareta_product_catalog_normalize_product(array $row, array $source): array
{
    $id = kareta_product_catalog_text($row['id'] ?? $row['source_product_id'] ?? '', 32);
    $sku = strtoupper(kareta_product_catalog_text($row['sku'] ?? '', 64));
    $name = kareta_product_catalog_text($row['name'] ?? '', 191);
    if ($id === '' || $sku === '' || $name === '') {
        throw new RuntimeException('product_catalog_required_field_missing');
    }

    $stockQty = max(0, (int)($row['stock_qty'] ?? 0));
    $retailPrice = max(0, (float)($row['retail_price'] ?? 0));
    $wholesalePrice = max(0, (float)($row['wholesale_price'] ?? 0));
    $active = !empty($row['active']) && $retailPrice > 0;
    $fitments = is_array($row['fitments'] ?? null) ? array_values($row['fitments']) : [];
    $sourceKey = kareta_product_catalog_text($source['key'] ?? 'external', 64);
    $sourceDate = trim((string)($source['price_list_date'] ?? ''));
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $sourceDate)) $sourceDate = date('Y-m-d');

    return [
        'id' => $id,
        'cat' => kareta_product_catalog_text($row['category'] ?? 'other', 32) ?: 'other',
        'name' => $name,
        'sku' => $sku,
        'brand' => kareta_product_catalog_text($row['brand'] ?? '', 120),
        'oem' => kareta_product_catalog_text($row['oem'] ?? '', 120),
        'image_url' => kareta_product_catalog_text($row['image_url'] ?? $row['image'] ?? '', 500),
        'price_label' => kareta_product_catalog_text($row['retail_price_label'] ?? '', 96),
        'price' => $retailPrice,
        'wholesale_price' => $wholesalePrice,
        'stock' => $stockQty > 0 ? 1 : 0,
        'stock_qty' => $stockQty,
        'note' => kareta_product_catalog_text($row['description'] ?? '', 4000),
        'sort' => max(0, (int)($row['sort'] ?? 0)),
        'active' => $active ? 1 : 0,
        'fitments_json' => json_encode($fitments, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '[]',
        'source_key' => $sourceKey,
        'source_hash' => hash('sha256', json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: ''),
        'source_date' => $sourceDate,
    ];
}

function kareta_product_catalog_legacy_rows(): array
{
    $source = kareta_product_catalog_load_source();
    $rows = [];
    foreach ($source['products'] as $raw) {
        if (!is_array($raw)) continue;
        $row = kareta_product_catalog_normalize_product($raw, $source['source']);
        $rows[] = [
            $row['id'], $row['cat'], $row['name'], $row['sku'], $row['price_label'],
            $row['stock'], $row['note'], $row['sort'], $row['brand'],
        ];
    }
    return $rows;
}

function kareta_product_catalog_column_exists(PDO $pdo, string $table, string $column): bool
{
    $st = $pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?');
    $st->execute([$table, $column]);
    return (int)$st->fetchColumn() > 0;
}

function kareta_product_catalog_index_exists(PDO $pdo, string $table, string $index): bool
{
    $st = $pdo->prepare('SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?');
    $st->execute([$table, $index]);
    return (int)$st->fetchColumn() > 0;
}

function kareta_product_catalog_ensure_schema(PDO $pdo): void
{
    $columns = [
        'price' => "ALTER TABLE `parts_catalog` ADD COLUMN `price` DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER `price_label`",
        'wholesale_price' => "ALTER TABLE `parts_catalog` ADD COLUMN `wholesale_price` DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER `price`",
        'stock_qty' => "ALTER TABLE `parts_catalog` ADD COLUMN `stock_qty` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `stock`",
        'image_url' => "ALTER TABLE `parts_catalog` ADD COLUMN `image_url` VARCHAR(500) NOT NULL DEFAULT '' AFTER `note`",
        'source_key' => "ALTER TABLE `parts_catalog` ADD COLUMN `source_key` VARCHAR(64) NOT NULL DEFAULT '' AFTER `active`",
        'source_hash' => "ALTER TABLE `parts_catalog` ADD COLUMN `source_hash` CHAR(64) NOT NULL DEFAULT '' AFTER `source_key`",
        'source_updated_at' => "ALTER TABLE `parts_catalog` ADD COLUMN `source_updated_at` DATETIME NULL AFTER `source_hash`",
    ];
    foreach ($columns as $column => $sql) {
        if (!kareta_product_catalog_column_exists($pdo, 'parts_catalog', $column)) $pdo->exec($sql);
    }

    if (!kareta_product_catalog_column_exists($pdo, 'parts_catalog', 'brand')) {
        $pdo->exec("ALTER TABLE `parts_catalog` ADD COLUMN `brand` VARCHAR(120) NOT NULL DEFAULT '' AFTER `sku`");
    }
    if (!kareta_product_catalog_column_exists($pdo, 'parts_catalog', 'oem')) {
        $pdo->exec("ALTER TABLE `parts_catalog` ADD COLUMN `oem` VARCHAR(120) NOT NULL DEFAULT '' AFTER `brand`");
    }
    if (!kareta_product_catalog_column_exists($pdo, 'parts_catalog', 'fitments_json')) {
        $pdo->exec("ALTER TABLE `parts_catalog` ADD COLUMN `fitments_json` LONGTEXT NULL AFTER `note`");
    }

    // Product descriptions exceed the original 255-character legacy limit.
    $pdo->exec("ALTER TABLE `parts_catalog` MODIFY COLUMN `note` TEXT NOT NULL");

    if (!kareta_product_catalog_index_exists($pdo, 'parts_catalog', 'idx_parts_catalog_source')) {
        $pdo->exec("ALTER TABLE `parts_catalog` ADD INDEX `idx_parts_catalog_source` (`source_key`,`active`,`sort`)");
    }
    if (!kareta_product_catalog_index_exists($pdo, 'parts_catalog', 'idx_parts_catalog_stock_qty')) {
        $pdo->exec("ALTER TABLE `parts_catalog` ADD INDEX `idx_parts_catalog_stock_qty` (`stock_qty`,`active`)");
    }
}

function kareta_product_catalog_table_exists(PDO $pdo, string $table): bool
{
    if (function_exists('kareta_table_exists')) return kareta_table_exists($pdo, $table);
    $st = $pdo->prepare('SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?');
    $st->execute([$table]);
    return (int)$st->fetchColumn() > 0;
}

function kareta_product_catalog_sync_platform_profile(PDO $pdo): void
{
    if (!kareta_product_catalog_table_exists($pdo, 'seller_profiles')) return;
    $pdo->prepare("INSERT INTO `seller_profiles`
        (`user_id`,`user_phone`,`store_name`,`legal_name`,`contact_phone`,`country_code`,`city`,`warehouse_address`,`description`,`assortment`,`category_tags`,`delivery_modes`,`payment_methods`,`minimum_order`,`return_days`,`moderation_status`,`active`)
        VALUES (0,'platform','KARETA.KZ / GlobalTuning','KARETA.KZ','','KZ','Усть-Каменогорск','Склад KARETA.KZ','Основной товарный каталог платформы KARETA.KZ.','Автозвук, автоэлектрика и автомобильные запчасти',JSON_ARRAY('parts','audio','electrical'),JSON_ARRAY('pickup','courier','transport'),JSON_ARRAY('cash','transfer'),'',14,'approved',1)
        ON DUPLICATE KEY UPDATE store_name=VALUES(store_name), legal_name=VALUES(legal_name), moderation_status='approved', active=1, updated_at=CURRENT_TIMESTAMP")
        ->execute();
}

function kareta_product_catalog_import(PDO $pdo, bool $syncStorefront = true): array
{
    if (!kareta_product_catalog_table_exists($pdo, 'parts_catalog')) {
        throw new RuntimeException('parts_catalog_table_missing');
    }

    kareta_product_catalog_ensure_schema($pdo);
    $source = kareta_product_catalog_load_source();
    $sourceMeta = $source['source'];
    $sourceKey = kareta_product_catalog_text($sourceMeta['key'] ?? 'external', 64);
    $startedTransaction = !$pdo->inTransaction();
    if ($startedTransaction) $pdo->beginTransaction();

    $upsertPart = $pdo->prepare("INSERT INTO `parts_catalog`
        (`id`,`cat`,`name`,`sku`,`brand`,`oem`,`price_label`,`price`,`wholesale_price`,`stock`,`stock_qty`,`note`,`image_url`,`sort`,`active`,`fitments_json`,`source_key`,`source_hash`,`source_updated_at`,`created_at`)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE
            `cat`=VALUES(`cat`),`name`=VALUES(`name`),`sku`=VALUES(`sku`),`brand`=VALUES(`brand`),`oem`=VALUES(`oem`),
            `price_label`=VALUES(`price_label`),`price`=VALUES(`price`),`wholesale_price`=VALUES(`wholesale_price`),
            `stock`=VALUES(`stock`),`stock_qty`=VALUES(`stock_qty`),`note`=VALUES(`note`),`image_url`=VALUES(`image_url`),`sort`=VALUES(`sort`),
            `active`=VALUES(`active`),`fitments_json`=VALUES(`fitments_json`),`source_key`=VALUES(`source_key`),
            `source_hash`=VALUES(`source_hash`),`source_updated_at`=VALUES(`source_updated_at`)");

    $syncSeller = $syncStorefront
        && kareta_product_catalog_table_exists($pdo, 'seller_profiles')
        && kareta_product_catalog_table_exists($pdo, 'seller_products');
    if ($syncSeller) kareta_product_catalog_sync_platform_profile($pdo);

    $upsertSeller = $syncSeller ? $pdo->prepare("INSERT INTO `seller_products`
        (`id`,`seller_user_id`,`seller_phone`,`sku`,`oem_number`,`name`,`category`,`brand`,`price`,`old_price`,`stock_qty`,`status`,`description`,`image_url`,`fitment_json`)
        VALUES (?,?,?,?,?,?,?,?,?,0,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE
            `sku`=VALUES(`sku`),`oem_number`=VALUES(`oem_number`),`name`=VALUES(`name`),`category`=VALUES(`category`),
            `brand`=VALUES(`brand`),`price`=VALUES(`price`),`stock_qty`=VALUES(`stock_qty`),`status`=VALUES(`status`),
            `description`=VALUES(`description`),`image_url`=VALUES(`image_url`),`fitment_json`=VALUES(`fitment_json`),`updated_at`=CURRENT_TIMESTAMP") : null;

    $importedIds = [];
    $count = 0;
    try {
        foreach ($source['products'] as $raw) {
            if (!is_array($raw)) continue;
            $row = kareta_product_catalog_normalize_product($raw, $sourceMeta);
            $importedIds[$row['id']] = true;
            $upsertPart->execute([
                $row['id'], $row['cat'], $row['name'], $row['sku'], $row['brand'], $row['oem'],
                $row['price_label'], $row['price'], $row['wholesale_price'], $row['stock'], $row['stock_qty'],
                $row['note'], $row['image_url'], $row['sort'], $row['active'], $row['fitments_json'], $row['source_key'],
                $row['source_hash'], $row['source_date'] . ' 00:00:00', $row['source_date'],
            ]);

            if ($upsertSeller) {
                $status = ($row['active'] === 1 && $row['stock_qty'] > 0 && $row['price'] > 0) ? 'active' : 'paused';
                $upsertSeller->execute([
                    'catalog_' . substr($row['id'], 0, 52), 0, 'platform', $row['sku'], $row['oem'],
                    $row['name'], $row['cat'], $row['brand'], $row['price'], $row['stock_qty'],
                    $status, $row['note'], $row['image_url'], $row['fitments_json'],
                ]);
            }
            $count++;
        }

        $archived = 0;
        $existing = $pdo->prepare("SELECT `id` FROM `parts_catalog` WHERE `source_key`=? AND `active`=1");
        $existing->execute([$sourceKey]);
        $archivePart = $pdo->prepare("UPDATE `parts_catalog` SET `active`=0,`stock`=0,`stock_qty`=0 WHERE `id`=? AND `source_key`=?");
        $archiveSeller = $syncSeller ? $pdo->prepare("UPDATE `seller_products` SET `status`='archived',`stock_qty`=0,`updated_at`=CURRENT_TIMESTAMP WHERE `id`=? AND `seller_user_id`=0") : null;
        foreach ($existing->fetchAll(PDO::FETCH_COLUMN) ?: [] as $existingId) {
            $existingId = (string)$existingId;
            if (isset($importedIds[$existingId])) continue;
            $archivePart->execute([$existingId, $sourceKey]);
            if ($archiveSeller) $archiveSeller->execute(['catalog_' . substr($existingId, 0, 52)]);
            $archived++;
        }

        if ($startedTransaction) $pdo->commit();
        return [
            'source' => $sourceKey,
            'sourceDate' => (string)($sourceMeta['price_list_date'] ?? ''),
            'records' => $count,
            'archived' => $archived,
            'storefrontSynced' => $syncSeller,
            'checksum' => $source['checksum'],
        ];
    } catch (Throwable $e) {
        if ($startedTransaction && $pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}
