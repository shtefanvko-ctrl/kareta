<?php
return [
    'version' => 24,
    'note'    => 'STO-master link table + sto_profiles enhancements',
    'run'     => function(PDO $pdo): void {
        // Таблица связи СТО ↔ Мастер
        $pdo->exec("CREATE TABLE IF NOT EXISTS `sto_master_links` (
            `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `sto_id`     VARCHAR(64)  NOT NULL,
            `master_id`  VARCHAR(64)  NOT NULL,
            `status`     ENUM('pending','active','rejected') NOT NULL DEFAULT 'pending'
                         COMMENT 'pending=запрос отправлен, active=мастер принял, rejected=отклонён',
            `invited_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `accepted_at` DATETIME    NULL DEFAULT NULL,
            `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_sto_master` (`sto_id`,`master_id`),
            KEY `idx_sto_id`    (`sto_id`),
            KEY `idx_master_id` (`master_id`),
            KEY `idx_status`    (`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        // Расширяем sto_profiles
        $existing = array_column(
            $pdo->query("SHOW COLUMNS FROM `sto_profiles`")->fetchAll(PDO::FETCH_ASSOC),
            'Field'
        );
        $add = [
            'description'   => "ALTER TABLE `sto_profiles` ADD COLUMN `description`   TEXT          NULL DEFAULT NULL AFTER `name`",
            'logo_url'      => "ALTER TABLE `sto_profiles` ADD COLUMN `logo_url`       VARCHAR(512)  NULL DEFAULT NULL",
            'master_limit'  => "ALTER TABLE `sto_profiles` ADD COLUMN `master_limit`   TINYINT UNSIGNED NOT NULL DEFAULT 10",
            'rating'        => "ALTER TABLE `sto_profiles` ADD COLUMN `rating`         DECIMAL(3,1) NOT NULL DEFAULT 0",
            'orders_count'  => "ALTER TABLE `sto_profiles` ADD COLUMN `orders_count`   INT UNSIGNED NOT NULL DEFAULT 0",
        ];
        foreach ($add as $col => $sql) {
            if (!in_array($col, $existing, true)) {
                try { $pdo->exec($sql); } catch(Throwable $_e) {}
            }
        }
    },
];
