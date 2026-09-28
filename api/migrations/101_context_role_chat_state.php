<?php
declare(strict_types=1);

return [
    'version'=>101,
    'note'=>'R188.5.5.3: active Identity-role chat state, seller read markers and participant delivery tables',
    'run'=>static function(PDO $pdo): void {
        $columnExists=static function(string $table,string $column) use($pdo): bool {
            $statement=$pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?');
            $statement->execute([$table,$column]);
            return (int)$statement->fetchColumn()>0;
        };
        if(!$columnExists('chats','unread_seller'))$pdo->exec("ALTER TABLE `chats` ADD COLUMN `unread_seller` INT NOT NULL DEFAULT 0");
        if(!$columnExists('messages','read_seller_at'))$pdo->exec("ALTER TABLE `messages` ADD COLUMN `read_seller_at` DATETIME NULL DEFAULT NULL");
        if(!$columnExists('messages','edited_at'))$pdo->exec("ALTER TABLE `messages` ADD COLUMN `edited_at` DATETIME NULL DEFAULT NULL");
        if(!$columnExists('messages','deleted_at'))$pdo->exec("ALTER TABLE `messages` ADD COLUMN `deleted_at` DATETIME NULL DEFAULT NULL");
        $pdo->exec("CREATE TABLE IF NOT EXISTS `chat_participants`(
            `chat_id` VARCHAR(64) NOT NULL,`user_id` BIGINT UNSIGNED NOT NULL,`role` VARCHAR(32) NOT NULL,
            `unread_count` INT UNSIGNED NOT NULL DEFAULT 0,`joined_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `last_read_at` DATETIME NULL,`left_at` DATETIME NULL,
            PRIMARY KEY (`chat_id`,`user_id`),KEY `idx_cp_user` (`user_id`,`left_at`),KEY `idx_cp_chat` (`chat_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $pdo->exec("CREATE TABLE IF NOT EXISTS `chat_message_reads`(
            `message_id` VARCHAR(96) NOT NULL,`chat_id` VARCHAR(64) NOT NULL,`user_id` BIGINT UNSIGNED NOT NULL,
            `read_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`message_id`,`user_id`),KEY `idx_cmr_chat_user` (`chat_id`,`user_id`),KEY `idx_cmr_message` (`message_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    },
];
