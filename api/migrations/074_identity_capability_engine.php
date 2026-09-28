<?php
declare(strict_types=1);

return [
    'version' => 74,
    'note' => 'R186.5 stage 3: centralized capability engine, overrides and authorization audit',
    'run' => static function (PDO $pdo): void {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `context_capability_overrides` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `context_id` BIGINT UNSIGNED NOT NULL,
            `account_id` BIGINT UNSIGNED NULL,
            `capability_key` VARCHAR(128) NOT NULL,
            `effect` ENUM('allow','deny') NOT NULL DEFAULT 'allow',
            `expires_at` DATETIME NULL,
            `created_by_account_id` BIGINT UNSIGNED NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_context_capability_override` (`context_id`,`account_id`,`capability_key`),
            KEY `idx_context_capability_effective` (`context_id`,`account_id`,`expires_at`),
            CONSTRAINT `fk_context_capability_context` FOREIGN KEY (`context_id`) REFERENCES `contexts` (`id`) ON DELETE CASCADE,
            CONSTRAINT `fk_context_capability_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE,
            CONSTRAINT `fk_context_capability_created_by` FOREIGN KEY (`created_by_account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `capability_check_audit` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `account_id` BIGINT UNSIGNED NOT NULL,
            `context_id` BIGINT UNSIGNED NOT NULL,
            `capability_key` VARCHAR(128) NOT NULL,
            `decision` ENUM('allow','deny') NOT NULL,
            `source` VARCHAR(64) NOT NULL DEFAULT 'engine',
            `resource_type` VARCHAR(64) NULL,
            `resource_key` VARCHAR(128) NULL,
            `request_id` VARCHAR(64) NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_capability_audit_account` (`account_id`,`created_at`),
            KEY `idx_capability_audit_context` (`context_id`,`created_at`),
            KEY `idx_capability_audit_denied` (`decision`,`created_at`),
            CONSTRAINT `fk_capability_audit_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE,
            CONSTRAINT `fk_capability_audit_context` FOREIGN KEY (`context_id`) REFERENCES `contexts` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $sets = [
            'personal.client' => [
                'vehicle.read','vehicle.edit','order.create','order.read','booking.create','booking.cancel_own',
                'calendar.read_own','finance.read_own','payment.create_own','crm.read_own','notifications.read','chat.use','profile.edit_own'
            ],
            'profile.master' => [
                'vehicle.read','order.read','work_order.read','work_order.edit','work_order.status.update',
                'calendar.read','calendar.manage_own','crm.read_assigned','notifications.read','chat.use','profile.edit_own'
            ],
            'profile.seller' => [
                'market.catalog.read','market.product.manage_own','market.order.read_own','market.order.fulfill_own',
                'warehouse.read_own','warehouse.adjust_own','finance.read_own','notifications.read','chat.use','profile.edit_own'
            ],
            'organization.member' => [
                'organization.read','work_order.read','calendar.read','crm.read','notifications.read','chat.use'
            ],
        ];
        $findSet = $pdo->prepare("SELECT id FROM capability_sets WHERE code=? LIMIT 1");
        $insertCap = $pdo->prepare("INSERT INTO capabilities(capability_set_id,capability_key,effect) VALUES(?,?,'allow') ON DUPLICATE KEY UPDATE effect='allow'");
        foreach ($sets as $code => $keys) {
            $findSet->execute([$code]);
            $setId = (int)($findSet->fetchColumn() ?: 0);
            if ($setId <= 0) continue;
            foreach ($keys as $key) $insertCap->execute([$setId,$key]);
        }
    },
];
