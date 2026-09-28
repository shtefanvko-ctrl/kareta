<?php
declare(strict_types=1);

return [
    'version' => 107,
    'note' => 'R188.5.5.6.21: client order exchange production scale, bidding rounds, deadlines, response caps and indexed client marketplace',
    'run' => static function (PDO $pdo): void {
        $cols = [
            'exchange_status' => "ALTER TABLE `orders` ADD COLUMN `exchange_status` VARCHAR(24) NOT NULL DEFAULT 'open' AFTER `status`",
            'exchange_round' => "ALTER TABLE `orders` ADD COLUMN `exchange_round` INT UNSIGNED NOT NULL DEFAULT 1 AFTER `exchange_status`",
            'exchange_published_at' => "ALTER TABLE `orders` ADD COLUMN `exchange_published_at` DATETIME NULL AFTER `exchange_round`",
            'exchange_deadline_at' => "ALTER TABLE `orders` ADD COLUMN `exchange_deadline_at` DATETIME NULL AFTER `exchange_published_at`",
            'exchange_max_responses' => "ALTER TABLE `orders` ADD COLUMN `exchange_max_responses` SMALLINT UNSIGNED NOT NULL DEFAULT 20 AFTER `exchange_deadline_at`",
            'exchange_budget_from' => "ALTER TABLE `orders` ADD COLUMN `exchange_budget_from` DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER `exchange_max_responses`",
            'exchange_budget_to' => "ALTER TABLE `orders` ADD COLUMN `exchange_budget_to` DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER `exchange_budget_from`",
        ];
        foreach ($cols as $name => $sql) {
            $st=$pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='orders' AND COLUMN_NAME=?");
            $st->execute([$name]);
            if ((int)$st->fetchColumn() === 0) $pdo->exec($sql);
        }
        foreach ([
            'idx_orders_client_exchange' => "ALTER TABLE `orders` ADD INDEX `idx_orders_client_exchange` (`client_user_id`,`status`,`exchange_status`,`created_at`)",
            'idx_orders_phone_exchange' => "ALTER TABLE `orders` ADD INDEX `idx_orders_phone_exchange` (`client_phone`,`status`,`exchange_status`,`created_at`)",
            'idx_orders_exchange_feed' => "ALTER TABLE `orders` ADD INDEX `idx_orders_exchange_feed` (`status`,`exchange_status`,`exchange_deadline_at`,`created_at`)",
        ] as $idx=>$sql) {
            $st=$pdo->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='orders' AND INDEX_NAME=?");
            $st->execute([$idx]);
            if ((int)$st->fetchColumn() === 0) $pdo->exec($sql);
        }
        foreach ([
            'idx_exchange_request_status_price' => "ALTER TABLE `master_exchange_responses` ADD INDEX `idx_exchange_request_status_price` (`request_id`,`active`,`response_status`,`price_from`,`updated_at`)",
            'idx_exchange_master_status_time' => "ALTER TABLE `master_exchange_responses` ADD INDEX `idx_exchange_master_status_time` (`master_id`,`active`,`response_status`,`updated_at`)",
        ] as $idx=>$sql) {
            $st=$pdo->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='master_exchange_responses' AND INDEX_NAME=?");
            $st->execute([$idx]);
            if ((int)$st->fetchColumn() === 0) $pdo->exec($sql);
        }
        $pdo->exec("UPDATE `orders` SET exchange_published_at=COALESCE(exchange_published_at,created_at), exchange_deadline_at=COALESCE(exchange_deadline_at,DATE_ADD(created_at, INTERVAL 3 DAY)), exchange_status=CASE WHEN status IN ('new','waiting_responses') THEN 'open' ELSE 'closed' END WHERE status IN ('new','waiting_responses','process','accepted','assigned','in_progress','completed','done','cancelled')");
    },
];
