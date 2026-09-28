<?php
declare(strict_types=1);

return [
    'version' => 117,
    'note' => 'R188.5.5.6.64: master request visibility and per-master workplace window preferences',
    'run' => static function (PDO $pdo): void {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `master_workplace_preferences` (
            `master_id` VARCHAR(64) NOT NULL,
            `account_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
            `windows_json` LONGTEXT NULL,
            `params_json` LONGTEXT NULL,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`master_id`),
            KEY `idx_master_workplace_preferences_account` (`account_id`,`updated_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    },
];
