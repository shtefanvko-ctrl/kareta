<?php
return [
    'version' => 18,
    'note' => 'car handover confirmation columns',
    'run' => static function (PDO $pdo): void {
        $cols = [];
        $st = $pdo->query("SHOW COLUMNS FROM `orders`");
        foreach (($st ? $st->fetchAll(PDO::FETCH_ASSOC) : []) as $col) {
            $cols[] = $col['Field'];
        }
        if (!in_array('car_handover_pending', $cols, true)) {
            $pdo->exec("ALTER TABLE `orders` ADD COLUMN `car_handover_pending` TINYINT(1) NOT NULL DEFAULT 0");
        }
        if (!in_array('car_handover_confirmed', $cols, true)) {
            $pdo->exec("ALTER TABLE `orders` ADD COLUMN `car_handover_confirmed` TINYINT(1) NULL DEFAULT NULL");
        }
    },
];
