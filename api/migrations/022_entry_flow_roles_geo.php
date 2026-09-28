<?php
return [
    'version' => 22,
    'note'    => 'entry flow fields on users + sto_profiles table',
    'run'     => function(PDO $pdo): void {
        $existing = [];
        foreach ($pdo->query("SHOW COLUMNS FROM `users`")->fetchAll(PDO::FETCH_ASSOC) as $col) {
            $existing[] = $col['Field'];
        }
        $add = [
            'entry_role' => "ALTER TABLE `users` ADD COLUMN `entry_role` VARCHAR(32) NOT NULL DEFAULT 'client' AFTER `role`",
            'onboarding_stage' => "ALTER TABLE `users` ADD COLUMN `onboarding_stage` VARCHAR(32) NOT NULL DEFAULT '' AFTER `entry_role`",
            'onboarded' => "ALTER TABLE `users` ADD COLUMN `onboarded` TINYINT(1) NOT NULL DEFAULT 0 AFTER `onboarding_stage`",
            'onboarded_at' => "ALTER TABLE `users` ADD COLUMN `onboarded_at` DATETIME NULL DEFAULT NULL AFTER `onboarded`",
            'country_code' => "ALTER TABLE `users` ADD COLUMN `country_code` VARCHAR(8) NOT NULL DEFAULT 'KZ' AFTER `onboarded_at`",
            'city' => "ALTER TABLE `users` ADD COLUMN `city` VARCHAR(120) NOT NULL DEFAULT '' AFTER `country_code`",
        ];
        foreach ($add as $col => $sql) {
            if (!in_array($col, $existing, true)) {
                $pdo->exec($sql);
            }
        }

        $pdo->exec("CREATE TABLE IF NOT EXISTS `sto_profiles` (
            `id`            VARCHAR(64)  NOT NULL,
            `user_id`       BIGINT UNSIGNED NULL,
            `user_phone`    VARCHAR(20)  NOT NULL DEFAULT '',
            `name`          VARCHAR(191) NOT NULL DEFAULT '',
            `contact_phone` VARCHAR(20)  NOT NULL DEFAULT '',
            `country_code`  VARCHAR(8)   NOT NULL DEFAULT 'KZ',
            `city`          VARCHAR(120) NOT NULL DEFAULT '',
            `address`       VARCHAR(255) NOT NULL DEFAULT '',
            `work_hours`    VARCHAR(191) NOT NULL DEFAULT '',
            `reception_status` VARCHAR(24) NOT NULL DEFAULT 'open',
            `active`        TINYINT(1)   NOT NULL DEFAULT 1,
            `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_sto_user_phone` (`user_phone`),
            KEY `idx_sto_city` (`city`),
            KEY `idx_sto_user_id` (`user_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    },
];
