<?php
return [
    'version' => 31,
    'note' => 'seller onboarding role and isolated parts shop tables',
    'run' => function(PDO $pdo): void {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `seller_profiles` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            `user_id` BIGINT UNSIGNED NULL,
            `user_phone` VARCHAR(20) NOT NULL DEFAULT '',
            `store_name` VARCHAR(191) NOT NULL DEFAULT '',
            `legal_name` VARCHAR(191) NOT NULL DEFAULT '',
            `bin_iin` VARCHAR(12) NOT NULL DEFAULT '',
            `contact_phone` VARCHAR(20) NOT NULL DEFAULT '',
            `email` VARCHAR(191) NOT NULL DEFAULT '',
            `country_code` VARCHAR(8) NOT NULL DEFAULT 'KZ',
            `city` VARCHAR(120) NOT NULL DEFAULT '',
            `warehouse_address` VARCHAR(255) NOT NULL DEFAULT '',
            `description` TEXT NULL,
            `assortment` VARCHAR(255) NOT NULL DEFAULT '',
            `category_tags` JSON NULL,
            `delivery_modes` JSON NULL,
            `payment_methods` JSON NULL,
            `minimum_order` VARCHAR(64) NOT NULL DEFAULT '',
            `return_days` SMALLINT UNSIGNED NOT NULL DEFAULT 14,
            `moderation_status` VARCHAR(24) NOT NULL DEFAULT 'pending',
            `active` TINYINT(1) NOT NULL DEFAULT 1,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY `uq_seller_user_phone` (`user_phone`),
            UNIQUE KEY `uq_seller_user_id` (`user_id`),
            KEY `idx_seller_city_active` (`city`,`active`),
            KEY `idx_seller_moderation` (`moderation_status`,`active`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $pdo->exec("CREATE TABLE IF NOT EXISTS `seller_products` (
            `id` VARCHAR(64) NOT NULL PRIMARY KEY, `seller_user_id` BIGINT UNSIGNED NOT NULL, `seller_phone` VARCHAR(20) NOT NULL DEFAULT '',
            `sku` VARCHAR(64) NOT NULL DEFAULT '', `oem_number` VARCHAR(96) NOT NULL DEFAULT '', `name` VARCHAR(191) NOT NULL DEFAULT '',
            `category` VARCHAR(64) NOT NULL DEFAULT 'other', `brand` VARCHAR(120) NOT NULL DEFAULT '', `price` DECIMAL(12,2) NOT NULL DEFAULT 0,
            `old_price` DECIMAL(12,2) NOT NULL DEFAULT 0, `stock_qty` INT NOT NULL DEFAULT 0, `status` VARCHAR(24) NOT NULL DEFAULT 'draft',
            `description` TEXT NULL, `image_url` TEXT NULL, `fitment_json` JSON NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY `uq_seller_product_sku` (`seller_user_id`,`sku`), KEY `idx_seller_products_owner` (`seller_user_id`,`status`,`updated_at`),
            KEY `idx_seller_products_catalog` (`category`,`status`,`stock_qty`), KEY `idx_seller_products_oem` (`oem_number`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $pdo->exec("CREATE TABLE IF NOT EXISTS `seller_orders` (
            `id` VARCHAR(64) NOT NULL PRIMARY KEY, `seller_user_id` BIGINT UNSIGNED NOT NULL, `seller_phone` VARCHAR(20) NOT NULL DEFAULT '',
            `client_user_id` BIGINT UNSIGNED NULL, `customer_name` VARCHAR(191) NOT NULL DEFAULT '', `customer_phone` VARCHAR(20) NOT NULL DEFAULT '',
            `status` VARCHAR(24) NOT NULL DEFAULT 'new', `payment_status` VARCHAR(24) NOT NULL DEFAULT 'pending', `delivery_type` VARCHAR(32) NOT NULL DEFAULT 'pickup',
            `delivery_address` VARCHAR(255) NOT NULL DEFAULT '', `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0, `delivery_price` DECIMAL(12,2) NOT NULL DEFAULT 0,
            `total` DECIMAL(12,2) NOT NULL DEFAULT 0, `comment` TEXT NULL, `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY `idx_seller_orders_owner` (`seller_user_id`,`status`,`created_at`), KEY `idx_seller_orders_customer` (`customer_phone`,`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $pdo->exec("CREATE TABLE IF NOT EXISTS `seller_order_items` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, `order_id` VARCHAR(64) NOT NULL, `product_id` VARCHAR(64) NOT NULL,
            `sku` VARCHAR(64) NOT NULL DEFAULT '', `name` VARCHAR(191) NOT NULL DEFAULT '', `qty` INT UNSIGNED NOT NULL DEFAULT 1,
            `price` DECIMAL(12,2) NOT NULL DEFAULT 0, `total` DECIMAL(12,2) NOT NULL DEFAULT 0,
            KEY `idx_seller_order_items_order` (`order_id`), KEY `idx_seller_order_items_product` (`product_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    },
];
