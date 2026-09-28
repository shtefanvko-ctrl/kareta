<?php
declare(strict_types=1);
return [
    'version' => 118,
    'note' => 'R188.5.5.6.65: master exchange idempotent responses and matching-notification receipts',
    'run' => static function (PDO $pdo): void {
        $hasColumn=static function(string $table,string $column)use($pdo):bool{$q=$pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");$q->execute([$table,$column]);return (int)$q->fetchColumn()>0;};
        if(!$hasColumn('master_exchange_responses','payload_hash'))$pdo->exec("ALTER TABLE `master_exchange_responses` ADD COLUMN `payload_hash` CHAR(64) NOT NULL DEFAULT '' AFTER `response_status`");
        $pdo->exec("CREATE TABLE IF NOT EXISTS `master_exchange_notification_receipts` (
            `master_id` VARCHAR(64) NOT NULL,
            `request_id` VARCHAR(64) NOT NULL,
            `event_type` VARCHAR(64) NOT NULL DEFAULT 'matching_request',
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`master_id`,`request_id`,`event_type`),
            KEY `idx_master_exchange_notice_created` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    },
];
