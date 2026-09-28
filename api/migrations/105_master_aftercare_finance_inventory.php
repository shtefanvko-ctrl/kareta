<?php
declare(strict_types=1);

return [
    'version' => 105,
    'note' => 'R188.5.5.6.19: warranty return workflow, warehouse issue/return, actual costs and master financial result',
    'run' => static function (PDO $pdo): void {
        $hasColumn = static function (string $table, string $column) use ($pdo): bool {
            $st = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");
            $st->execute([$table, $column]);
            return (int)$st->fetchColumn() > 0;
        };
        $hasIndex = static function (string $table, string $index) use ($pdo): bool {
            $st = $pdo->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?");
            $st->execute([$table, $index]);
            return (int)$st->fetchColumn() > 0;
        };

        if (!$hasColumn('market_products', 'cost_price')) {
            $pdo->exec("ALTER TABLE `market_products` ADD COLUMN `cost_price` DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER `price`");
        }
        $reservationColumns = [
            'claim_id' => "VARCHAR(64) NOT NULL DEFAULT '' AFTER `order_id`",
            'warehouse_id' => "BIGINT UNSIGNED NULL AFTER `supplier_label`",
            'product_id' => "BIGINT UNSIGNED NULL AFTER `warehouse_id`",
            'cost_unit_price' => "DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER `unit_price`",
            'qty_issued' => "DECIMAL(12,3) NOT NULL DEFAULT 0 AFTER `qty_reserved`",
            'qty_returned' => "DECIMAL(12,3) NOT NULL DEFAULT 0 AFTER `qty_issued`",
            'stock_status' => "VARCHAR(24) NOT NULL DEFAULT 'none' AFTER `status`",
            'movement_key' => "VARCHAR(80) NOT NULL DEFAULT '' AFTER `stock_status`",
        ];
        foreach ($reservationColumns as $column => $definition) {
            if (!$hasColumn('work_order_part_reservations', $column)) {
                $pdo->exec("ALTER TABLE `work_order_part_reservations` ADD COLUMN `{$column}` {$definition}");
            }
        }
        if (!$hasIndex('work_order_part_reservations', 'idx_work_order_inventory_link')) {
            $pdo->exec("ALTER TABLE `work_order_part_reservations` ADD INDEX `idx_work_order_inventory_link` (`warehouse_id`,`product_id`,`stock_status`,`claim_id`)");
        }

        $pdo->exec("CREATE TABLE IF NOT EXISTS `master_finance_settings` (
            `master_id` VARCHAR(64) NOT NULL PRIMARY KEY,
            `owner_user_id` BIGINT UNSIGNED NULL,
            `labor_cost_per_hour` DECIMAL(14,2) NOT NULL DEFAULT 0,
            `overhead_percent` DECIMAL(7,3) NOT NULL DEFAULT 0,
            `warranty_reserve_percent` DECIMAL(7,3) NOT NULL DEFAULT 0,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY `idx_master_finance_owner` (`owner_user_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `work_order_cost_entries` (
            `id` VARCHAR(64) NOT NULL PRIMARY KEY,
            `order_id` VARCHAR(64) NOT NULL,
            `claim_id` VARCHAR(64) NOT NULL DEFAULT '',
            `master_id` VARCHAR(64) NOT NULL DEFAULT '',
            `sto_id` VARCHAR(64) NOT NULL DEFAULT '',
            `cost_type` VARCHAR(32) NOT NULL,
            `source_type` VARCHAR(32) NOT NULL DEFAULT 'manual',
            `source_key` VARCHAR(128) NOT NULL,
            `title` VARCHAR(255) NOT NULL,
            `quantity` DECIMAL(12,3) NOT NULL DEFAULT 1,
            `unit_cost` DECIMAL(14,2) NOT NULL DEFAULT 0,
            `total_cost` DECIMAL(14,2) NOT NULL DEFAULT 0,
            `note` VARCHAR(500) NOT NULL DEFAULT '',
            `actor_user_id` BIGINT UNSIGNED NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY `uq_work_order_cost_source` (`order_id`,`source_type`,`source_key`,`cost_type`),
            KEY `idx_work_order_cost_order` (`order_id`,`cost_type`),
            KEY `idx_work_order_cost_claim` (`claim_id`,`cost_type`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `work_order_financial_results` (
            `order_id` VARCHAR(64) NOT NULL PRIMARY KEY,
            `master_id` VARCHAR(64) NOT NULL DEFAULT '',
            `sto_id` VARCHAR(64) NOT NULL DEFAULT '',
            `revenue_total` DECIMAL(14,2) NOT NULL DEFAULT 0,
            `labor_revenue` DECIMAL(14,2) NOT NULL DEFAULT 0,
            `parts_revenue` DECIMAL(14,2) NOT NULL DEFAULT 0,
            `other_revenue` DECIMAL(14,2) NOT NULL DEFAULT 0,
            `direct_cost_total` DECIMAL(14,2) NOT NULL DEFAULT 0,
            `labor_cost` DECIMAL(14,2) NOT NULL DEFAULT 0,
            `parts_cost` DECIMAL(14,2) NOT NULL DEFAULT 0,
            `consumables_cost` DECIMAL(14,2) NOT NULL DEFAULT 0,
            `outsourced_cost` DECIMAL(14,2) NOT NULL DEFAULT 0,
            `overhead_cost` DECIMAL(14,2) NOT NULL DEFAULT 0,
            `warranty_cost` DECIMAL(14,2) NOT NULL DEFAULT 0,
            `gross_profit` DECIMAL(14,2) NOT NULL DEFAULT 0,
            `margin_percent` DECIMAL(8,3) NOT NULL DEFAULT 0,
            `calculated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY `idx_work_order_finance_master` (`master_id`,`calculated_at`),
            KEY `idx_work_order_finance_sto` (`sto_id`,`calculated_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `work_order_warranty_claims` (
            `id` VARCHAR(64) NOT NULL PRIMARY KEY,
            `order_id` VARCHAR(64) NOT NULL,
            `warranty_id` VARCHAR(64) NOT NULL DEFAULT '',
            `claim_no` INT UNSIGNED NOT NULL DEFAULT 1,
            `client_user_id` BIGINT UNSIGNED NULL,
            `client_phone` VARCHAR(32) NOT NULL DEFAULT '',
            `master_id` VARCHAR(64) NOT NULL DEFAULT '',
            `sto_id` VARCHAR(64) NOT NULL DEFAULT '',
            `issue_text` TEXT NOT NULL,
            `symptoms` TEXT NULL,
            `requested_resolution` VARCHAR(24) NOT NULL DEFAULT 'repair',
            `status` VARCHAR(24) NOT NULL DEFAULT 'submitted',
            `decision` VARCHAR(24) NOT NULL DEFAULT 'pending',
            `covered` TINYINT(1) NULL,
            `rejection_reason` TEXT NULL,
            `inspection_notes` TEXT NULL,
            `root_cause` TEXT NULL,
            `repair_notes` TEXT NULL,
            `quality_result` VARCHAR(24) NOT NULL DEFAULT 'pending',
            `quality_notes` TEXT NULL,
            `opened_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `accepted_at` DATETIME NULL,
            `repair_started_at` DATETIME NULL,
            `repair_completed_at` DATETIME NULL,
            `closed_at` DATETIME NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY `uq_warranty_claim_number` (`order_id`,`claim_no`),
            KEY `idx_warranty_claim_order` (`order_id`,`status`),
            KEY `idx_warranty_claim_master` (`master_id`,`status`),
            KEY `idx_warranty_claim_sto` (`sto_id`,`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `work_order_warranty_claim_events` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            `claim_id` VARCHAR(64) NOT NULL,
            `order_id` VARCHAR(64) NOT NULL,
            `event_type` VARCHAR(64) NOT NULL,
            `actor_user_id` BIGINT UNSIGNED NULL,
            `actor_role` VARCHAR(32) NOT NULL DEFAULT '',
            `meta_json` JSON NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY `idx_warranty_claim_event` (`claim_id`,`created_at`),
            KEY `idx_warranty_claim_order_event` (`order_id`,`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    },
];
