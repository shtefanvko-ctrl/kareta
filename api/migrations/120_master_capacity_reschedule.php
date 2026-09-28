<?php
declare(strict_types=1);
return [
    'version' => 120,
    'note' => 'R188.5.5.6.67: master free-slot capacity and client-confirmed reschedule workflow',
    'run' => static function (PDO $pdo): void {
        $hasColumn=static function(string $table,string $column)use($pdo):bool{$q=$pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");$q->execute([$table,$column]);return (int)$q->fetchColumn()>0;};
        if(!$hasColumn('master_schedule_preferences','slot_step_min'))$pdo->exec("ALTER TABLE `master_schedule_preferences` ADD COLUMN `slot_step_min` INT NOT NULL DEFAULT 30 AFTER `response_sla_min`");
        if(!$hasColumn('master_schedule_preferences','capacity_warn_pct'))$pdo->exec("ALTER TABLE `master_schedule_preferences` ADD COLUMN `capacity_warn_pct` INT NOT NULL DEFAULT 90 AFTER `slot_step_min`");
        $pdo->exec("CREATE TABLE IF NOT EXISTS `master_reschedule_proposals` (
            `id` VARCHAR(64) NOT NULL PRIMARY KEY,
            `order_id` VARCHAR(64) NOT NULL,
            `master_id` VARCHAR(64) NOT NULL,
            `client_user_id` BIGINT UNSIGNED NULL,
            `proposed_start` DATETIME NOT NULL,
            `proposed_end` DATETIME NOT NULL,
            `duration_min` INT NOT NULL DEFAULT 120,
            `buffer_min` INT NOT NULL DEFAULT 0,
            `reason` VARCHAR(500) NOT NULL DEFAULT '',
            `status` VARCHAR(24) NOT NULL DEFAULT 'pending',
            `decision_note` VARCHAR(500) NOT NULL DEFAULT '',
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `responded_at` DATETIME NULL,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY `idx_reschedule_order_status` (`order_id`,`status`,`created_at`),
            KEY `idx_reschedule_master_status` (`master_id`,`status`,`proposed_start`),
            KEY `idx_reschedule_client_status` (`client_user_id`,`status`,`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    },
];
