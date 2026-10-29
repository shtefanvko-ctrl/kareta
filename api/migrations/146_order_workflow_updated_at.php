<?php
declare(strict_types=1);

return [
    'version' => 146,
    'note' => 'Idempotently reconcile orders.updated_at required by repair lifecycle',
    'run' => static function (PDO $pdo): void {
        if (!kareta_table_exists($pdo, 'orders')) {
            throw new RuntimeException('orders table is missing');
        }
        if (!kareta_column_exists($pdo, 'orders', 'updated_at')) {
            $pdo->exec("ALTER TABLE `orders` ADD COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        }
        if (!kareta_column_exists($pdo, 'orders', 'updated_at')) {
            throw new RuntimeException('orders.updated_at missing after reconciliation');
        }
    },
];
