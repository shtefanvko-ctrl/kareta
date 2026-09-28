<?php
return [
    'version' => 28,
    'note' => 'DB unique constraints against duplicate responses reviews messages and stages',
    'run' => static function (PDO $pdo): void {
        // master_exchange_responses already has uq_master_exchange_response in the base schema.
        // Keep this migration idempotent for older databases and copied dumps.
        kareta_ensure_index($pdo, 'master_exchange_responses', 'uq_master_exchange_response',
            "ALTER TABLE `master_exchange_responses` ADD UNIQUE KEY `uq_master_exchange_response` (`request_id`,`master_id`)");

        // Messages: client-generated message id prevents duplicate message rows on retry/bad network.
        kareta_ensure_column($pdo, 'messages', 'client_message_id',
            "ALTER TABLE `messages` ADD COLUMN `client_message_id` VARCHAR(96) NULL DEFAULT NULL AFTER `id`");
        kareta_ensure_index($pdo, 'messages', 'uq_messages_client_message_id',
            "ALTER TABLE `messages` ADD UNIQUE KEY `uq_messages_client_message_id` (`chat_id`,`from_role`,`client_message_id`)");

        // Public service reviews: one active service review per order/client.
        kareta_ensure_column($pdo, 'reviews_public', 'master_id',
            "ALTER TABLE `reviews_public` ADD COLUMN `master_id` VARCHAR(64) NULL DEFAULT NULL AFTER `text`");
        kareta_ensure_column($pdo, 'reviews_public', 'master_name',
            "ALTER TABLE `reviews_public` ADD COLUMN `master_name` VARCHAR(160) NULL DEFAULT NULL AFTER `master_id`");
        kareta_ensure_column($pdo, 'reviews_public', 'review_type',
            "ALTER TABLE `reviews_public` ADD COLUMN `review_type` VARCHAR(24) NULL DEFAULT 'service' AFTER `master_name`");
        kareta_ensure_column($pdo, 'reviews_public', 'order_id',
            "ALTER TABLE `reviews_public` ADD COLUMN `order_id` VARCHAR(64) NULL DEFAULT NULL AFTER `review_type`");
        kareta_ensure_column($pdo, 'reviews_public', 'product_id',
            "ALTER TABLE `reviews_public` ADD COLUMN `product_id` VARCHAR(64) NULL DEFAULT NULL AFTER `order_id`");
        kareta_ensure_column($pdo, 'reviews_public', 'product_name',
            "ALTER TABLE `reviews_public` ADD COLUMN `product_name` VARCHAR(191) NULL DEFAULT NULL AFTER `product_id`");
        kareta_ensure_column($pdo, 'reviews_public', 'client_id',
            "ALTER TABLE `reviews_public` ADD COLUMN `client_id` VARCHAR(64) NULL DEFAULT NULL AFTER `product_name`");
        // Normalize duplicate active rows before adding the unique guard: keep the newest active row.
        try {
            $pdo->exec("UPDATE `reviews_public` rp
                INNER JOIN (
                    SELECT `review_type`,`order_id`,`client_id`, MAX(`created_at`) AS keep_created
                    FROM `reviews_public`
                    WHERE `active`=1 AND `review_type`='service' AND COALESCE(`order_id`,'')<>'' AND COALESCE(`client_id`,'')<>''
                    GROUP BY `review_type`,`order_id`,`client_id`
                    HAVING COUNT(*) > 1
                ) d ON d.`review_type`=rp.`review_type` AND d.`order_id`=rp.`order_id` AND d.`client_id`=rp.`client_id`
                SET rp.`active`=0
                WHERE rp.`active`=1 AND rp.`created_at` < d.`keep_created`");
        } catch (Throwable $e) { kareta_log_error('migration_028_reviews_dedupe', $e->getMessage()); }
        kareta_ensure_column($pdo, 'reviews_public', 'active_service_review_key',
            "ALTER TABLE `reviews_public` ADD COLUMN `active_service_review_key` VARCHAR(255) GENERATED ALWAYS AS (CASE WHEN `active`=1 AND `review_type`='service' AND COALESCE(`order_id`,'')<>'' AND COALESCE(`client_id`,'')<>'' THEN CONCAT(`review_type`,':',`order_id`,':',`client_id`) ELSE NULL END) STORED");
        kareta_ensure_index($pdo, 'reviews_public', 'uq_reviews_public_active_service_review_key',
            "ALTER TABLE `reviews_public` ADD UNIQUE KEY `uq_reviews_public_active_service_review_key` (`active_service_review_key`)");

        // Master profile reviews: one published order review per master/order pair when order_id is known.
        try {
            $pdo->exec("UPDATE `master_reviews` mr
                INNER JOIN (
                    SELECT `master_id`,`order_id`, MAX(`created_at`) AS keep_created
                    FROM `master_reviews`
                    WHERE COALESCE(`order_id`,'')<>'' AND `status`='published'
                    GROUP BY `master_id`,`order_id`
                    HAVING COUNT(*) > 1
                ) d ON d.`master_id`=mr.`master_id` AND d.`order_id`=mr.`order_id`
                SET mr.`status`='archived'
                WHERE mr.`status`='published' AND mr.`created_at` < d.`keep_created`");
        } catch (Throwable $e) { kareta_log_error('migration_028_master_reviews_dedupe', $e->getMessage()); }
        kareta_ensure_column($pdo, 'master_reviews', 'published_order_review_key',
            "ALTER TABLE `master_reviews` ADD COLUMN `published_order_review_key` VARCHAR(255) GENERATED ALWAYS AS (CASE WHEN `status`='published' AND COALESCE(`order_id`,'')<>'' THEN CONCAT(`master_id`,':',`order_id`) ELSE NULL END) STORED");
        kareta_ensure_index($pdo, 'master_reviews', 'uq_master_reviews_published_order_key',
            "ALTER TABLE `master_reviews` ADD UNIQUE KEY `uq_master_reviews_published_order_key` (`published_order_review_key`)");

        // Repair stages table: each stage may appear only once per order.
        $pdo->exec("CREATE TABLE IF NOT EXISTS `order_stages` (
            `id` VARCHAR(64) NOT NULL PRIMARY KEY,
            `order_id` VARCHAR(64) NOT NULL,
            `stage_key` VARCHAR(64) NOT NULL DEFAULT 'diagnostic',
            `stage_label` VARCHAR(160) NOT NULL DEFAULT '',
            `stage_icon` VARCHAR(16) NOT NULL DEFAULT '🔧',
            `status` VARCHAR(32) NOT NULL DEFAULT 'in_progress',
            `comment` TEXT DEFAULT NULL,
            `parts_json` TEXT DEFAULT NULL,
            `photos_json` TEXT DEFAULT NULL,
            `created_by` INT DEFAULT NULL,
            `master_id` VARCHAR(64) DEFAULT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX `idx_order_stages_order` (`order_id`),
            INDEX `idx_order_stages_key` (`stage_key`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        try {
            $pdo->exec("DELETE s1 FROM `order_stages` s1
                INNER JOIN `order_stages` s2
                ON s1.`order_id`=s2.`order_id` AND s1.`stage_key`=s2.`stage_key` AND (s1.`created_at` < s2.`created_at` OR (s1.`created_at` = s2.`created_at` AND s1.`id` < s2.`id`))");
        } catch (Throwable $e) { kareta_log_error('migration_028_order_stages_dedupe', $e->getMessage()); }
        kareta_ensure_index($pdo, 'order_stages', 'uq_order_stages_order_stage',
            "ALTER TABLE `order_stages` ADD UNIQUE KEY `uq_order_stages_order_stage` (`order_id`,`stage_key`)");
    },
];
