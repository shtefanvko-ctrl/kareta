<?php
declare(strict_types=1);

return [
    'version' => 145,
    'note' => 'Ensure STO order assignment history table required by readiness',
    'run' => static function (PDO $pdo): void {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `order_assignments` (
            `id` VARCHAR(64) NOT NULL PRIMARY KEY,
            `order_id` VARCHAR(64) NOT NULL,
            `sto_id` VARCHAR(64) DEFAULT NULL,
            `master_id` VARCHAR(64) DEFAULT NULL,
            `assigned_by` INT DEFAULT NULL,
            `assigned_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `status` VARCHAR(32) NOT NULL DEFAULT 'active',
            `comment` TEXT DEFAULT NULL,
            INDEX `idx_oa_order` (`order_id`),
            INDEX `idx_oa_master` (`master_id`),
            INDEX `idx_oa_sto_status` (`sto_id`, `status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $columns = [
            'sto_id' => "ALTER TABLE `order_assignments` ADD COLUMN `sto_id` VARCHAR(64) DEFAULT NULL",
            'master_id' => "ALTER TABLE `order_assignments` ADD COLUMN `master_id` VARCHAR(64) DEFAULT NULL",
            'assigned_by' => "ALTER TABLE `order_assignments` ADD COLUMN `assigned_by` INT DEFAULT NULL",
            'assigned_at' => "ALTER TABLE `order_assignments` ADD COLUMN `assigned_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            'status' => "ALTER TABLE `order_assignments` ADD COLUMN `status` VARCHAR(32) NOT NULL DEFAULT 'active'",
            'comment' => "ALTER TABLE `order_assignments` ADD COLUMN `comment` TEXT DEFAULT NULL",
        ];
        foreach ($columns as $name => $sql) {
            kareta_ensure_column($pdo, 'order_assignments', $name, $sql);
            if (!kareta_column_exists($pdo, 'order_assignments', $name)) {
                throw new RuntimeException('order_assignments column missing: ' . $name);
            }
        }
        $indexes = [
            'idx_oa_order' => "ALTER TABLE `order_assignments` ADD INDEX `idx_oa_order` (`order_id`)",
            'idx_oa_master' => "ALTER TABLE `order_assignments` ADD INDEX `idx_oa_master` (`master_id`)",
            'idx_oa_sto_status' => "ALTER TABLE `order_assignments` ADD INDEX `idx_oa_sto_status` (`sto_id`, `status`)",
        ];
        $query = $pdo->prepare("SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='order_assignments' AND index_name=?");
        foreach ($indexes as $name => $sql) {
            $query->execute([$name]);
            if (!(int)$query->fetchColumn()) $pdo->exec($sql);
        }
    },
];
