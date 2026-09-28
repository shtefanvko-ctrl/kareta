<?php
return [
    'version' => 26,
    'note' => 'master exchange server state storage',
    'run' => static function (PDO $pdo): void {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `master_exchange_responses` (
            `id` VARCHAR(64) NOT NULL PRIMARY KEY,
            `request_id` VARCHAR(64) NOT NULL,
            `master_id` VARCHAR(64) NOT NULL DEFAULT '',
            `master_user_id` BIGINT UNSIGNED NULL,
            `request_title` VARCHAR(191) NOT NULL DEFAULT '',
            `price_type` VARCHAR(16) NOT NULL DEFAULT 'fixed',
            `price_from` INT NOT NULL DEFAULT 0,
            `price_to` INT NOT NULL DEFAULT 0,
            `start_time` VARCHAR(64) NOT NULL DEFAULT '',
            `work_format` VARCHAR(120) NOT NULL DEFAULT '',
            `includes_text` TEXT NULL,
            `extra_costs` TEXT NULL,
            `need_diagnostics` VARCHAR(8) NOT NULL DEFAULT 'no',
            `duration_text` VARCHAR(120) NOT NULL DEFAULT '',
            `warranty_text` VARCHAR(120) NOT NULL DEFAULT '',
            `arrival_time` VARCHAR(64) NOT NULL DEFAULT '',
            `field_service_price` INT NOT NULL DEFAULT 0,
            `need_tow` VARCHAR(8) NOT NULL DEFAULT 'no',
            `can_fix_on_site` VARCHAR(8) NOT NULL DEFAULT 'yes',
            `comment` TEXT NULL,
            `response_status` VARCHAR(24) NOT NULL DEFAULT 'pending',
            `active` TINYINT(1) NOT NULL DEFAULT 1,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY `uq_master_exchange_response` (`request_id`,`master_id`),
            KEY `idx_master_exchange_response_master` (`master_id`,`created_at`),
            KEY `idx_master_exchange_response_user` (`master_user_id`,`created_at`),
            KEY `idx_master_exchange_response_request` (`request_id`,`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `master_exchange_saved` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            `request_id` VARCHAR(64) NOT NULL,
            `master_id` VARCHAR(64) NOT NULL DEFAULT '',
            `master_user_id` BIGINT UNSIGNED NULL,
            `active` TINYINT(1) NOT NULL DEFAULT 1,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY `uq_master_exchange_saved` (`request_id`,`master_id`),
            KEY `idx_master_exchange_saved_master` (`master_id`,`created_at`),
            KEY `idx_master_exchange_saved_user` (`master_user_id`,`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `master_exchange_hidden` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            `request_id` VARCHAR(64) NOT NULL,
            `master_id` VARCHAR(64) NOT NULL DEFAULT '',
            `master_user_id` BIGINT UNSIGNED NULL,
            `active` TINYINT(1) NOT NULL DEFAULT 1,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY `uq_master_exchange_hidden` (`request_id`,`master_id`),
            KEY `idx_master_exchange_hidden_master` (`master_id`,`created_at`),
            KEY `idx_master_exchange_hidden_user` (`master_user_id`,`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    },
];
