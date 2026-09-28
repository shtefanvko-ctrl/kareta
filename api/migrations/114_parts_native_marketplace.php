<?php
declare(strict_types=1);

return [
    'version' => 114,
    'note' => 'R188.5.5.6.58: unified native parts marketplace with new/used/restored/exchange states',
    'run' => static function (PDO $pdo): void {
        $hasColumn = static function (string $table, string $column) use ($pdo): bool {
            $st=$pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");
            $st->execute([$table,$column]);
            return (int)$st->fetchColumn()>0;
        };
        $hasIndex = static function (string $table, string $index) use ($pdo): bool {
            $st=$pdo->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?");
            $st->execute([$table,$index]);
            return (int)$st->fetchColumn()>0;
        };

        if ($pdo->query("SHOW TABLES LIKE 'seller_products'")->fetchColumn()) {
            if (!$hasColumn('seller_products','condition_code')) $pdo->exec("ALTER TABLE seller_products ADD COLUMN condition_code VARCHAR(24) NOT NULL DEFAULT 'new' AFTER category");
            if (!$hasColumn('seller_products','exchange_available')) $pdo->exec("ALTER TABLE seller_products ADD COLUMN exchange_available TINYINT(1) NOT NULL DEFAULT 0 AFTER condition_code");
            if (!$hasColumn('seller_products','exchange_note')) $pdo->exec("ALTER TABLE seller_products ADD COLUMN exchange_note VARCHAR(500) NOT NULL DEFAULT '' AFTER exchange_available");
            if (!$hasIndex('seller_products','idx_seller_products_condition')) $pdo->exec("ALTER TABLE seller_products ADD KEY idx_seller_products_condition(condition_code,status,stock_qty)");
            $pdo->exec("UPDATE seller_products SET condition_code='new' WHERE condition_code IS NULL OR condition_code='' OR condition_code NOT IN ('new','restored')");
        }

        if ($pdo->query("SHOW TABLES LIKE 'used_market_listings'")->fetchColumn()) {
            if (!$hasColumn('used_market_listings','listing_type')) $pdo->exec("ALTER TABLE used_market_listings ADD COLUMN listing_type VARCHAR(24) NOT NULL DEFAULT 'used' AFTER category");
            if (!$hasColumn('used_market_listings','source_vehicle_id')) $pdo->exec("ALTER TABLE used_market_listings ADD COLUMN source_vehicle_id VARCHAR(64) NOT NULL DEFAULT '' AFTER vehicle");
            if (!$hasColumn('used_market_listings','exchange_note')) $pdo->exec("ALTER TABLE used_market_listings ADD COLUMN exchange_note VARCHAR(500) NOT NULL DEFAULT '' AFTER description");
            if (!$hasIndex('used_market_listings','idx_used_market_type')) $pdo->exec("ALTER TABLE used_market_listings ADD KEY idx_used_market_type(listing_type,status,created_at)");
            $pdo->exec("UPDATE used_market_listings SET listing_type=CASE WHEN condition_code='new' THEN 'new' ELSE 'used' END WHERE listing_type IS NULL OR listing_type='' OR listing_type NOT IN ('new','used','restored','exchange')");
        }
    },
];
