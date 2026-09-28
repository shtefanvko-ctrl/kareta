<?php
declare(strict_types=1);

return static function(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `work_post_comments` (
        `id` VARCHAR(64) NOT NULL PRIMARY KEY,
        `post_id` VARCHAR(64) NOT NULL,
        `user_id` INT NULL DEFAULT NULL,
        `author_name` VARCHAR(160) NOT NULL DEFAULT '',
        `author_role` VARCHAR(24) NOT NULL DEFAULT 'client',
        `body` TEXT NOT NULL,
        `active` TINYINT(1) NOT NULL DEFAULT 1,
        `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY `idx_work_post_comments_post` (`post_id`,`active`,`created_at`),
        KEY `idx_work_post_comments_user` (`user_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    try { kareta_ensure_column($pdo, 'reviews_public', 'order_id', "ALTER TABLE `reviews_public` ADD COLUMN `order_id` VARCHAR(64) NULL DEFAULT NULL"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'reviews_public', 'master_id', "ALTER TABLE `reviews_public` ADD COLUMN `master_id` VARCHAR(64) NULL DEFAULT NULL"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'reviews_public', 'master_name', "ALTER TABLE `reviews_public` ADD COLUMN `master_name` VARCHAR(160) NULL DEFAULT NULL"); } catch (Throwable $_) {}
    try { kareta_ensure_index($pdo, 'reviews_public', 'uq_reviews_order_active', "ALTER TABLE `reviews_public` ADD UNIQUE KEY `uq_reviews_order_active` (`order_id`,`active`)"); } catch (Throwable $_) {}
};
