<?php
return [
    'version' => 27,
    'note' => 'server-side idempotency key storage',
    'run' => static function (PDO $pdo): void {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `idempotency_keys` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            `action` VARCHAR(96) NOT NULL,
            `key_hash` CHAR(64) NOT NULL,
            `actor_hash` CHAR(64) NOT NULL,
            `request_hash` CHAR(64) NOT NULL DEFAULT '',
            `status` VARCHAR(24) NOT NULL DEFAULT 'processing',
            `response_status` SMALLINT UNSIGNED NULL,
            `response_json` MEDIUMTEXT NULL,
            `entity_type` VARCHAR(32) NOT NULL DEFAULT '',
            `entity_id` VARCHAR(96) NOT NULL DEFAULT '',
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY `uq_idempotency_scope` (`action`,`actor_hash`,`key_hash`),
            KEY `idx_idempotency_status` (`status`,`updated_at`),
            KEY `idx_idempotency_entity` (`entity_type`,`entity_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    },
];
