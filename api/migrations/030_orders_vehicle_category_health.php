<?php
return [
    'version' => 30,
    'note' => 'Orders vehicle binding category source columns and collation stabilization',
    'run' => static function (PDO $pdo): void {
        kareta_ensure_column($pdo, 'orders', 'category',
            "ALTER TABLE `orders` ADD COLUMN `category` VARCHAR(64) NOT NULL DEFAULT 'service' AFTER `priority`");
        kareta_ensure_column($pdo, 'orders', 'source',
            "ALTER TABLE `orders` ADD COLUMN `source` VARCHAR(64) NOT NULL DEFAULT '' AFTER `category`");
        kareta_ensure_column($pdo, 'orders', 'client_vehicle_id',
            "ALTER TABLE `orders` ADD COLUMN `client_vehicle_id` VARCHAR(64) NULL AFTER `client_user_id`");
        kareta_ensure_column($pdo, 'orders', 'vehicle_title',
            "ALTER TABLE `orders` ADD COLUMN `vehicle_title` VARCHAR(191) NOT NULL DEFAULT '' AFTER `client_vehicle_id`");
        kareta_ensure_column($pdo, 'orders', 'vehicle_vin',
            "ALTER TABLE `orders` ADD COLUMN `vehicle_vin` VARCHAR(64) NOT NULL DEFAULT '' AFTER `vehicle_title`");
        kareta_ensure_column($pdo, 'orders', 'vehicle_plate',
            "ALTER TABLE `orders` ADD COLUMN `vehicle_plate` VARCHAR(64) NOT NULL DEFAULT '' AFTER `vehicle_vin`");

        kareta_ensure_index($pdo, 'orders', 'idx_orders_category_status',
            "ALTER TABLE `orders` ADD INDEX `idx_orders_category_status` (`category`,`status`)");
        kareta_ensure_index($pdo, 'orders', 'idx_orders_source_created',
            "ALTER TABLE `orders` ADD INDEX `idx_orders_source_created` (`source`,`created_at`)");
        kareta_ensure_index($pdo, 'orders', 'idx_orders_vehicle_status',
            "ALTER TABLE `orders` ADD INDEX `idx_orders_vehicle_status` (`client_vehicle_id`,`status`)");

        try {
            $pdo->exec("UPDATE `orders` SET `category` = CASE
                WHEN `type`='parts_request' THEN 'parts'
                WHEN COALESCE(`category`,'')='' THEN 'service'
                ELSE `category`
            END");
        } catch (Throwable $e) { kareta_log_error('migration_030_orders_category_backfill', $e->getMessage()); }

        foreach (['orders','clients','masters','users','chats','messages','client_vehicles','parts_catalog'] as $table) {
            if (!kareta_table_exists($pdo, $table)) continue;
            try { $pdo->exec("ALTER TABLE `{$table}` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"); }
            catch (Throwable $e) { kareta_log_error('migration_030_collation_' . $table, $e->getMessage()); }
        }
    },
];
