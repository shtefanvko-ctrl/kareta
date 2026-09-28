<?php
declare(strict_types=1);

return [
    'version' => 72,
    'note' => 'R186.5 stage 1: parallel identity core schema',
    'run' => static function (PDO $pdo): void {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `accounts` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `phone` VARCHAR(32) NOT NULL,
            `status` ENUM('active','blocked','deleted') NOT NULL DEFAULT 'active',
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_accounts_phone` (`phone`),
            KEY `idx_accounts_status` (`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `persons` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `account_id` BIGINT UNSIGNED NOT NULL,
            `fullname` VARCHAR(190) NOT NULL DEFAULT '',
            `avatar` VARCHAR(500) NULL,
            `settings` JSON NULL,
            `locale` VARCHAR(16) NOT NULL DEFAULT 'ru-KZ',
            `timezone` VARCHAR(64) NOT NULL DEFAULT 'Asia/Almaty',
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_persons_account` (`account_id`),
            CONSTRAINT `fk_persons_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `person_profiles` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `person_id` BIGINT UNSIGNED NOT NULL,
            `profile_type` VARCHAR(48) NOT NULL,
            `status` ENUM('draft','active','suspended','archived') NOT NULL DEFAULT 'draft',
            `legacy_entity_type` VARCHAR(48) NULL,
            `legacy_entity_id` BIGINT UNSIGNED NULL,
            `payload_json` JSON NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_person_profile_type` (`person_id`,`profile_type`),
            KEY `idx_person_profiles_status` (`profile_type`,`status`),
            CONSTRAINT `fk_person_profiles_person` FOREIGN KEY (`person_id`) REFERENCES `persons` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `capability_sets` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `code` VARCHAR(96) NOT NULL,
            `title` VARCHAR(190) NOT NULL,
            `scope_type` ENUM('system','personal','profile','organization') NOT NULL DEFAULT 'system',
            `is_system` TINYINT(1) NOT NULL DEFAULT 0,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_capability_sets_code` (`code`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `capabilities` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `capability_set_id` BIGINT UNSIGNED NOT NULL,
            `capability_key` VARCHAR(128) NOT NULL,
            `effect` ENUM('allow','deny') NOT NULL DEFAULT 'allow',
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_capability_set_key` (`capability_set_id`,`capability_key`),
            KEY `idx_capabilities_key` (`capability_key`),
            CONSTRAINT `fk_capabilities_set` FOREIGN KEY (`capability_set_id`) REFERENCES `capability_sets` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `contexts` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `context_key` VARCHAR(128) NOT NULL,
            `context_type` ENUM('personal','profile','organization') NOT NULL,
            `account_id` BIGINT UNSIGNED NULL,
            `person_id` BIGINT UNSIGNED NULL,
            `profile_id` BIGINT UNSIGNED NULL,
            `organization_id` BIGINT UNSIGNED NULL,
            `capability_set_id` BIGINT UNSIGNED NULL,
            `status` ENUM('active','suspended','archived') NOT NULL DEFAULT 'active',
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_contexts_key` (`context_key`),
            KEY `idx_contexts_account` (`account_id`,`status`),
            KEY `idx_contexts_person` (`person_id`,`status`),
            KEY `idx_contexts_organization` (`organization_id`,`status`),
            CONSTRAINT `fk_contexts_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE,
            CONSTRAINT `fk_contexts_person` FOREIGN KEY (`person_id`) REFERENCES `persons` (`id`) ON DELETE CASCADE,
            CONSTRAINT `fk_contexts_profile` FOREIGN KEY (`profile_id`) REFERENCES `person_profiles` (`id`) ON DELETE CASCADE,
            CONSTRAINT `fk_contexts_capability_set` FOREIGN KEY (`capability_set_id`) REFERENCES `capability_sets` (`id`) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `context_members` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `context_id` BIGINT UNSIGNED NOT NULL,
            `account_id` BIGINT UNSIGNED NOT NULL,
            `person_id` BIGINT UNSIGNED NOT NULL,
            `capability_set_id` BIGINT UNSIGNED NULL,
            `membership_status` ENUM('invited','active','suspended','revoked') NOT NULL DEFAULT 'active',
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_context_member` (`context_id`,`account_id`),
            KEY `idx_context_members_account` (`account_id`,`membership_status`),
            CONSTRAINT `fk_context_members_context` FOREIGN KEY (`context_id`) REFERENCES `contexts` (`id`) ON DELETE CASCADE,
            CONSTRAINT `fk_context_members_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE,
            CONSTRAINT `fk_context_members_person` FOREIGN KEY (`person_id`) REFERENCES `persons` (`id`) ON DELETE CASCADE,
            CONSTRAINT `fk_context_members_capability_set` FOREIGN KEY (`capability_set_id`) REFERENCES `capability_sets` (`id`) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `auth_sessions` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `session_key` CHAR(64) NOT NULL,
            `token_hash` CHAR(64) NOT NULL,
            `account_id` BIGINT UNSIGNED NOT NULL,
            `current_context_id` BIGINT UNSIGNED NULL,
            `device_id` VARCHAR(128) NULL,
            `user_agent_hash` CHAR(64) NULL,
            `ip_prefix` VARCHAR(64) NULL,
            `last_seen_at` DATETIME NULL,
            `expires_at` DATETIME NOT NULL,
            `revoked_at` DATETIME NULL,
            `rotated_from_session_id` BIGINT UNSIGNED NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_auth_sessions_key` (`session_key`),
            UNIQUE KEY `uq_auth_sessions_token_hash` (`token_hash`),
            KEY `idx_auth_sessions_account_active` (`account_id`,`revoked_at`,`expires_at`),
            KEY `idx_auth_sessions_context` (`current_context_id`),
            CONSTRAINT `fk_auth_sessions_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE,
            CONSTRAINT `fk_auth_sessions_context` FOREIGN KEY (`current_context_id`) REFERENCES `contexts` (`id`) ON DELETE SET NULL,
            CONSTRAINT `fk_auth_sessions_rotated_from` FOREIGN KEY (`rotated_from_session_id`) REFERENCES `auth_sessions` (`id`) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `auth_challenges` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `challenge_key` CHAR(64) NOT NULL,
            `phone` VARCHAR(32) NOT NULL,
            `code_hash` CHAR(64) NOT NULL,
            `purpose` ENUM('login','phone_change','recovery') NOT NULL DEFAULT 'login',
            `attempts` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
            `max_attempts` SMALLINT UNSIGNED NOT NULL DEFAULT 5,
            `expires_at` DATETIME NOT NULL,
            `consumed_at` DATETIME NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_auth_challenges_key` (`challenge_key`),
            KEY `idx_auth_challenges_phone` (`phone`,`purpose`,`expires_at`),
            KEY `idx_auth_challenges_cleanup` (`expires_at`,`consumed_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $sets = [
            ['personal.client', 'Базовый клиентский контекст', 'personal', 1],
            ['profile.master', 'Профессиональный профиль мастера', 'profile', 1],
            ['profile.seller', 'Профессиональный профиль продавца', 'profile', 1],
            ['organization.member', 'Базовый участник организации', 'organization', 1],
        ];
        $setStmt = $pdo->prepare("INSERT INTO capability_sets(code,title,scope_type,is_system) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE title=VALUES(title),scope_type=VALUES(scope_type),is_system=VALUES(is_system)");
        foreach ($sets as $set) $setStmt->execute($set);

        $personalCapabilities = [
            'vehicle.read','vehicle.edit','order.create','order.read',
            'calendar.manage_own','finance.read_own','crm.read_own','notifications.read'
        ];
        $setId = (int)$pdo->query("SELECT id FROM capability_sets WHERE code='personal.client' LIMIT 1")->fetchColumn();
        if ($setId > 0) {
            $capStmt = $pdo->prepare("INSERT INTO capabilities(capability_set_id,capability_key,effect) VALUES(?,?,'allow') ON DUPLICATE KEY UPDATE effect='allow'");
            foreach ($personalCapabilities as $capability) $capStmt->execute([$setId, $capability]);
        }
    },
];
