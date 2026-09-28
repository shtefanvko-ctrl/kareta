<?php
declare(strict_types=1);

return [
    'version' => 106,
    'note' => 'R188.5.5.6.20: operational finance, STO cash desk, client receivables, master payroll and profitability analytics',
    'run' => static function (PDO $pdo): void {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `sto_cash_accounts` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            `sto_id` VARCHAR(64) NOT NULL,
            `title` VARCHAR(160) NOT NULL,
            `account_type` VARCHAR(24) NOT NULL DEFAULT 'cash',
            `currency` CHAR(3) NOT NULL DEFAULT 'KZT',
            `active` TINYINT(1) NOT NULL DEFAULT 1,
            `is_default` TINYINT(1) NOT NULL DEFAULT 0,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY `uq_sto_cash_account_title` (`sto_id`,`title`),
            KEY `idx_sto_cash_account_active` (`sto_id`,`active`,`account_type`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `sto_cash_movements` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            `movement_key` VARCHAR(64) NOT NULL,
            `sto_id` VARCHAR(64) NOT NULL,
            `account_id` BIGINT UNSIGNED NULL,
            `order_id` VARCHAR(64) NOT NULL DEFAULT '',
            `master_id` VARCHAR(64) NOT NULL DEFAULT '',
            `movement_type` VARCHAR(16) NOT NULL,
            `category` VARCHAR(48) NOT NULL,
            `amount` DECIMAL(14,2) NOT NULL DEFAULT 0,
            `payment_method` VARCHAR(24) NOT NULL DEFAULT 'cash',
            `reference_type` VARCHAR(48) NOT NULL DEFAULT '',
            `reference_key` VARCHAR(128) NOT NULL DEFAULT '',
            `description` VARCHAR(500) NOT NULL DEFAULT '',
            `actor_user_id` BIGINT UNSIGNED NULL,
            `occurred_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY `uq_sto_cash_movement_key` (`movement_key`),
            KEY `idx_sto_cash_period` (`sto_id`,`occurred_at`,`movement_type`),
            KEY `idx_sto_cash_order` (`order_id`,`occurred_at`),
            KEY `idx_sto_cash_reference` (`reference_type`,`reference_key`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `work_order_receivables` (
            `order_id` VARCHAR(64) NOT NULL PRIMARY KEY,
            `sto_id` VARCHAR(64) NOT NULL DEFAULT '',
            `master_id` VARCHAR(64) NOT NULL DEFAULT '',
            `client_user_id` BIGINT UNSIGNED NULL,
            `client_phone` VARCHAR(32) NOT NULL DEFAULT '',
            `total_amount` DECIMAL(14,2) NOT NULL DEFAULT 0,
            `paid_amount` DECIMAL(14,2) NOT NULL DEFAULT 0,
            `balance_amount` DECIMAL(14,2) NOT NULL DEFAULT 0,
            `status` VARCHAR(24) NOT NULL DEFAULT 'open',
            `due_at` DATETIME NULL,
            `last_payment_at` DATETIME NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY `idx_receivable_sto_status` (`sto_id`,`status`,`due_at`),
            KEY `idx_receivable_master_status` (`master_id`,`status`,`due_at`),
            KEY `idx_receivable_client` (`client_user_id`,`client_phone`,`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `sto_master_payroll_rules` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            `sto_id` VARCHAR(64) NOT NULL,
            `master_id` VARCHAR(64) NOT NULL,
            `calculation_mode` VARCHAR(32) NOT NULL DEFAULT 'gross_profit_percent',
            `base_percent` DECIMAL(7,3) NOT NULL DEFAULT 0,
            `hourly_rate` DECIMAL(14,2) NOT NULL DEFAULT 0,
            `fixed_monthly` DECIMAL(14,2) NOT NULL DEFAULT 0,
            `parts_bonus_percent` DECIMAL(7,3) NOT NULL DEFAULT 0,
            `active` TINYINT(1) NOT NULL DEFAULT 1,
            `effective_from` DATE NULL,
            `effective_to` DATE NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY `uq_sto_master_payroll_rule` (`sto_id`,`master_id`),
            KEY `idx_payroll_rule_active` (`sto_id`,`active`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `sto_payroll_periods` (
            `id` VARCHAR(64) NOT NULL PRIMARY KEY,
            `sto_id` VARCHAR(64) NOT NULL,
            `period_key` CHAR(7) NOT NULL,
            `status` VARCHAR(24) NOT NULL DEFAULT 'draft',
            `orders_count` INT UNSIGNED NOT NULL DEFAULT 0,
            `masters_count` INT UNSIGNED NOT NULL DEFAULT 0,
            `gross_amount` DECIMAL(14,2) NOT NULL DEFAULT 0,
            `paid_amount` DECIMAL(14,2) NOT NULL DEFAULT 0,
            `closed_by_user_id` BIGINT UNSIGNED NULL,
            `closed_at` DATETIME NULL,
            `paid_at` DATETIME NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY `uq_sto_payroll_period` (`sto_id`,`period_key`),
            KEY `idx_sto_payroll_status` (`sto_id`,`status`,`period_key`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `sto_payroll_accruals` (
            `id` VARCHAR(64) NOT NULL PRIMARY KEY,
            `period_id` VARCHAR(64) NOT NULL,
            `sto_id` VARCHAR(64) NOT NULL,
            `period_key` CHAR(7) NOT NULL,
            `master_id` VARCHAR(64) NOT NULL,
            `order_id` VARCHAR(64) NOT NULL DEFAULT '',
            `accrual_type` VARCHAR(32) NOT NULL DEFAULT 'order',
            `base_amount` DECIMAL(14,2) NOT NULL DEFAULT 0,
            `hours_worked` DECIMAL(12,3) NOT NULL DEFAULT 0,
            `rate_value` DECIMAL(14,3) NOT NULL DEFAULT 0,
            `amount` DECIMAL(14,2) NOT NULL DEFAULT 0,
            `status` VARCHAR(24) NOT NULL DEFAULT 'accrued',
            `paid_at` DATETIME NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY `uq_payroll_accrual_source` (`period_id`,`master_id`,`order_id`,`accrual_type`),
            KEY `idx_payroll_accrual_master` (`master_id`,`period_key`,`status`),
            KEY `idx_payroll_accrual_sto` (`sto_id`,`period_key`,`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    },
];
