<?php
return [
    'version' => 19,
    'note'    => 'master_posts, master_reviews, master_metrics_cache, masters profile fields',
    'run'     => function(PDO $pdo): void {

        // 1. master_posts
        $pdo->exec("CREATE TABLE IF NOT EXISTS `master_posts` (
            `id`           VARCHAR(64)   NOT NULL,
            `master_id`    VARCHAR(64)   NOT NULL,
            `type`         VARCHAR(32)   NOT NULL DEFAULT 'case',
            `title`        VARCHAR(255)  NOT NULL DEFAULT '',
            `preview`      VARCHAR(500)  NOT NULL DEFAULT '',
            `body`         TEXT          NOT NULL,
            `photos_json`  JSON          NULL,
            `tags`         VARCHAR(500)  NOT NULL DEFAULT '',
            `status`       VARCHAR(20)   NOT NULL DEFAULT 'draft',
            `published_at` DATETIME      NULL,
            `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_mp_master` (`master_id`),
            KEY `idx_mp_status` (`status`),
            KEY `idx_mp_type`   (`type`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        // 2. master_reviews
        $pdo->exec("CREATE TABLE IF NOT EXISTS `master_reviews` (
            `id`                   VARCHAR(64)  NOT NULL,
            `master_id`            VARCHAR(64)  NOT NULL,
            `order_id`             VARCHAR(64)  NULL,
            `author_name`          VARCHAR(160) NOT NULL DEFAULT '',
            `author_phone`         VARCHAR(32)  NOT NULL DEFAULT '',
            `rating`               TINYINT      NOT NULL DEFAULT 5,
            `quality_rating`       TINYINT      NULL,
            `timing_rating`        TINYINT      NULL,
            `neatness_rating`      TINYINT      NULL,
            `communication_rating` TINYINT      NULL,
            `text`                 TEXT         NOT NULL,
            `master_reply`         TEXT         NULL,
            `status`               VARCHAR(20)  NOT NULL DEFAULT 'published',
            `created_at`           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_mr_master` (`master_id`),
            KEY `idx_mr_order`  (`order_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        // 3. master_metrics_cache
        $pdo->exec("CREATE TABLE IF NOT EXISTS `master_metrics_cache` (
            `id`               VARCHAR(64)    NOT NULL,
            `master_id`        VARCHAR(64)    NOT NULL,
            `metric_date`      DATE           NOT NULL,
            `profile_views`    INT            NOT NULL DEFAULT 0,
            `profile_clicks`   INT            NOT NULL DEFAULT 0,
            `modal_opens`      INT            NOT NULL DEFAULT 0,
            `wa_clicks`        INT            NOT NULL DEFAULT 0,
            `order_proposals`  INT            NOT NULL DEFAULT 0,
            `completed_orders` INT            NOT NULL DEFAULT 0,
            `avg_check`        DECIMAL(12,2)  NOT NULL DEFAULT 0,
            `repeat_clients`   INT            NOT NULL DEFAULT 0,
            `updated_at`       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `ux_mmc` (`master_id`, `metric_date`),
            KEY `idx_mmc_master` (`master_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        // 4. Расширяем таблицу masters — новые поля профиля
        $existing = [];
        foreach ($pdo->query("SHOW COLUMNS FROM `masters`")->fetchAll(PDO::FETCH_ASSOC) as $col) {
            $existing[] = $col['Field'];
        }
        $add = [
            'offer_text'       => "ALTER TABLE `masters` ADD COLUMN `offer_text`       VARCHAR(255) NULL DEFAULT NULL",
            'work_mode'        => "ALTER TABLE `masters` ADD COLUMN `work_mode`        VARCHAR(64)  NULL DEFAULT NULL",
            'district'         => "ALTER TABLE `masters` ADD COLUMN `district`         VARCHAR(120) NULL DEFAULT NULL",
            'primary_services' => "ALTER TABLE `masters` ADD COLUMN `primary_services` JSON         NULL",
            'availability'     => "ALTER TABLE `masters` ADD COLUMN `availability`     VARCHAR(20)  NOT NULL DEFAULT 'online'",
            'profile_visible'  => "ALTER TABLE `masters` ADD COLUMN `profile_visible`  TINYINT(1)  NOT NULL DEFAULT 1",
        ];
        foreach ($add as $col => $sql) {
            if (!in_array($col, $existing, true)) {
                $pdo->exec($sql);
            }
        }
    },
];
