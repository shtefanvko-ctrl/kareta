<?php
declare(strict_types=1);

return [
    'version' => 104,
    'note' => 'R188.5.5.6.18: master order full lifecycle, warranty and automatic publication',
    'run' => static function (PDO $pdo): void {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `master_order_diagnostics` (
            `id` VARCHAR(64) NOT NULL PRIMARY KEY,
            `order_id` VARCHAR(64) NOT NULL,
            `complaints` TEXT NULL,
            `findings` MEDIUMTEXT NULL,
            `recommendations` MEDIUMTEXT NULL,
            `measurements_json` JSON NULL,
            `parts_required` TINYINT(1) NOT NULL DEFAULT 0,
            `status` VARCHAR(24) NOT NULL DEFAULT 'draft',
            `diagnosed_by_user_id` BIGINT UNSIGNED NULL,
            `diagnosed_by_context_id` BIGINT UNSIGNED NULL,
            `completed_at` DATETIME NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY `uq_master_order_diagnostics_order` (`order_id`),
            KEY `idx_master_order_diagnostics_status` (`status`,`updated_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `work_order_part_reservations` (
            `id` VARCHAR(64) NOT NULL PRIMARY KEY,
            `order_id` VARCHAR(64) NOT NULL,
            `part_key` VARCHAR(96) NOT NULL DEFAULT '',
            `part_name` VARCHAR(255) NOT NULL,
            `sku` VARCHAR(120) NOT NULL DEFAULT '',
            `oem` VARCHAR(120) NOT NULL DEFAULT '',
            `supplier_label` VARCHAR(191) NOT NULL DEFAULT '',
            `qty_requested` DECIMAL(12,3) NOT NULL DEFAULT 1,
            `qty_reserved` DECIMAL(12,3) NOT NULL DEFAULT 0,
            `unit_price` DECIMAL(14,2) NOT NULL DEFAULT 0,
            `status` VARCHAR(24) NOT NULL DEFAULT 'requested',
            `note` VARCHAR(500) NOT NULL DEFAULT '',
            `reserved_by_user_id` BIGINT UNSIGNED NULL,
            `reserved_at` DATETIME NULL,
            `expires_at` DATETIME NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY `uq_work_order_part_reservation` (`order_id`,`part_key`),
            KEY `idx_work_order_part_reservation_status` (`order_id`,`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `work_order_quality_checks` (
            `id` VARCHAR(64) NOT NULL PRIMARY KEY,
            `order_id` VARCHAR(64) NOT NULL,
            `attempt_no` INT UNSIGNED NOT NULL DEFAULT 1,
            `result` VARCHAR(24) NOT NULL DEFAULT 'pending',
            `road_test` TINYINT(1) NOT NULL DEFAULT 0,
            `no_leaks` TINYINT(1) NOT NULL DEFAULT 0,
            `no_fault_codes` TINYINT(1) NOT NULL DEFAULT 0,
            `fasteners_checked` TINYINT(1) NOT NULL DEFAULT 0,
            `client_request_verified` TINYINT(1) NOT NULL DEFAULT 0,
            `notes` TEXT NULL,
            `checked_by_user_id` BIGINT UNSIGNED NULL,
            `checked_by_context_id` BIGINT UNSIGNED NULL,
            `checked_at` DATETIME NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY `idx_work_order_quality_order` (`order_id`,`attempt_no`),
            KEY `idx_work_order_quality_result` (`result`,`checked_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `work_order_handovers` (
            `id` VARCHAR(64) NOT NULL PRIMARY KEY,
            `order_id` VARCHAR(64) NOT NULL,
            `status` VARCHAR(24) NOT NULL DEFAULT 'draft',
            `payment_status` VARCHAR(24) NOT NULL DEFAULT 'not_required',
            `odometer_km` INT UNSIGNED NULL,
            `fuel_level` VARCHAR(24) NOT NULL DEFAULT '',
            `keys_count` INT UNSIGNED NOT NULL DEFAULT 1,
            `documents_json` JSON NULL,
            `notes` TEXT NULL,
            `prepared_by_user_id` BIGINT UNSIGNED NULL,
            `prepared_at` DATETIME NULL,
            `accepted_by_user_id` BIGINT UNSIGNED NULL,
            `accepted_at` DATETIME NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY `uq_work_order_handover_order` (`order_id`),
            KEY `idx_work_order_handover_status` (`status`,`updated_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `work_order_warranties` (
            `id` VARCHAR(64) NOT NULL PRIMARY KEY,
            `order_id` VARCHAR(64) NOT NULL,
            `master_id` VARCHAR(64) NOT NULL DEFAULT '',
            `sto_id` VARCHAR(64) NOT NULL DEFAULT '',
            `warranty_days` INT UNSIGNED NOT NULL DEFAULT 0,
            `scope_text` TEXT NULL,
            `exclusions_text` TEXT NULL,
            `status` VARCHAR(24) NOT NULL DEFAULT 'draft',
            `starts_at` DATETIME NULL,
            `ends_at` DATETIME NULL,
            `activated_by_user_id` BIGINT UNSIGNED NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY `uq_work_order_warranty_order` (`order_id`),
            KEY `idx_work_order_warranty_active` (`status`,`ends_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `work_order_publication_policies` (
            `id` VARCHAR(64) NOT NULL PRIMARY KEY,
            `order_id` VARCHAR(64) NOT NULL,
            `client_consent` TINYINT(1) NOT NULL DEFAULT 0,
            `auto_publish` TINYINT(1) NOT NULL DEFAULT 0,
            `anonymize_client` TINYINT(1) NOT NULL DEFAULT 1,
            `consented_by_user_id` BIGINT UNSIGNED NULL,
            `consented_at` DATETIME NULL,
            `published_post_id` VARCHAR(64) NOT NULL DEFAULT '',
            `published_at` DATETIME NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY `uq_work_order_publication_policy_order` (`order_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    },
];
