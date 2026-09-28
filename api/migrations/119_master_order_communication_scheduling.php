<?php
declare(strict_types=1);
return [
    'version' => 119,
    'note' => 'R188.5.5.6.66: accepted exchange scheduling, conflict audit and master communication SLA',
    'run' => static function (PDO $pdo): void {
        $hasColumn=static function(string $table,string $column)use($pdo):bool{$q=$pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");$q->execute([$table,$column]);return (int)$q->fetchColumn()>0;};
        if(!$hasColumn('master_exchange_responses','accepted_at'))$pdo->exec("ALTER TABLE `master_exchange_responses` ADD COLUMN `accepted_at` DATETIME NULL AFTER `response_status`");
        if(!$hasColumn('master_schedule_preferences','response_sla_min'))$pdo->exec("ALTER TABLE `master_schedule_preferences` ADD COLUMN `response_sla_min` INT NOT NULL DEFAULT 15 AFTER `default_repair_min`");
        if(!$hasColumn('master_order_plans','source'))$pdo->exec("ALTER TABLE `master_order_plans` ADD COLUMN `source` VARCHAR(32) NOT NULL DEFAULT 'manual' AFTER `status`");
        if(!$hasColumn('master_order_plans','conflict_override'))$pdo->exec("ALTER TABLE `master_order_plans` ADD COLUMN `conflict_override` TINYINT(1) NOT NULL DEFAULT 0 AFTER `source`");
        try{$pdo->exec("ALTER TABLE `master_exchange_responses` ADD KEY `idx_exchange_accepted_at` (`master_id`,`response_status`,`accepted_at`)");}catch(Throwable $_){}
    },
];
