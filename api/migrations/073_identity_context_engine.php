<?php
declare(strict_types=1);

return [
    'version' => 73,
    'note' => 'R186.5 stage 2: current context engine and context switch audit',
    'run' => static function (PDO $pdo): void {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `context_switch_audit` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `account_id` BIGINT UNSIGNED NOT NULL,
            `session_id` BIGINT UNSIGNED NULL,
            `from_context_id` BIGINT UNSIGNED NULL,
            `to_context_id` BIGINT UNSIGNED NOT NULL,
            `request_id` VARCHAR(64) NULL,
            `ip_prefix` VARCHAR(64) NULL,
            `user_agent_hash` CHAR(64) NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_context_switch_account_created` (`account_id`,`created_at`),
            KEY `idx_context_switch_to_context` (`to_context_id`,`created_at`),
            CONSTRAINT `fk_context_switch_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE,
            CONSTRAINT `fk_context_switch_session` FOREIGN KEY (`session_id`) REFERENCES `auth_sessions` (`id`) ON DELETE SET NULL,
            CONSTRAINT `fk_context_switch_from` FOREIGN KEY (`from_context_id`) REFERENCES `contexts` (`id`) ON DELETE SET NULL,
            CONSTRAINT `fk_context_switch_to` FOREIGN KEY (`to_context_id`) REFERENCES `contexts` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    },
];
