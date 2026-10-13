<?php
declare(strict_types=1);

return [
    'version' => 146,
    'note' => 'Restore parts_request_offers required by readiness and parts-request persistence',
    'run' => static function (PDO $pdo): void {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `parts_request_offers` (
            `id` VARCHAR(64) NOT NULL PRIMARY KEY,
            `order_id` VARCHAR(64) NOT NULL,
            `source_part_id` VARCHAR(64) NULL DEFAULT NULL,
            `sku` VARCHAR(120) NULL DEFAULT NULL,
            `oem` VARCHAR(120) NULL DEFAULT NULL,
            `name` VARCHAR(255) NULL DEFAULT NULL,
            `brand` VARCHAR(120) NULL DEFAULT NULL,
            `price_label` VARCHAR(120) NULL DEFAULT NULL,
            `supplier_label` VARCHAR(255) NULL DEFAULT NULL,
            `score` INT NOT NULL DEFAULT 0,
            `status` VARCHAR(32) NOT NULL DEFAULT 'draft',
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY `idx_parts_request_offers_order` (`order_id`),
            KEY `idx_parts_request_offers_oem` (`oem`),
            KEY `idx_parts_request_offers_sku` (`sku`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        if (!kareta_table_exists($pdo, 'parts_request_offers')) {
            throw new RuntimeException('parts_request_offers table is still missing');
        }

        $requiredColumns = [
            'id', 'order_id', 'source_part_id', 'sku', 'oem', 'name',
            'brand', 'price_label', 'supplier_label', 'score', 'status', 'created_at',
        ];
        $columnQuery = $pdo->prepare(
            "SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'parts_request_offers'
               AND COLUMN_NAME = ?"
        );
        foreach ($requiredColumns as $column) {
            $columnQuery->execute([$column]);
            if (!(int)$columnQuery->fetchColumn()) {
                throw new RuntimeException('parts_request_offers column missing: ' . $column);
            }
        }

        $indexQuery = $pdo->prepare(
            "SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'parts_request_offers'
               AND INDEX_NAME = ?"
        );
        foreach (['PRIMARY', 'idx_parts_request_offers_order', 'idx_parts_request_offers_oem', 'idx_parts_request_offers_sku'] as $index) {
            $indexQuery->execute([$index]);
            if (!(int)$indexQuery->fetchColumn()) {
                throw new RuntimeException('parts_request_offers index missing: ' . $index);
            }
        }
    },
];
