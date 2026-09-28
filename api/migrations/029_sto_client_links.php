<?php
return [
    'version' => 29,
    'note' => 'Scoped STO client links for manual clients before order creation',
    'run' => static function (PDO $pdo): void {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `sto_client_links` (
            `id` VARCHAR(64) NOT NULL PRIMARY KEY,
            `sto_id` VARCHAR(64) NOT NULL,
            `client_id` VARCHAR(64) NOT NULL,
            `client_phone` VARCHAR(32) DEFAULT NULL,
            `source` VARCHAR(32) NOT NULL DEFAULT 'manual',
            `created_by` INT DEFAULT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY `uq_sto_client_link` (`sto_id`,`client_id`),
            KEY `idx_sto_client_links_sto` (`sto_id`),
            KEY `idx_sto_client_links_client` (`client_id`),
            KEY `idx_sto_client_links_phone` (`client_phone`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    },
];
