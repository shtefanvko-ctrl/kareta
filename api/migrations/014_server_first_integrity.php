<?php
declare(strict_types=1);

return [
    'version' => 14,
    'note' => 'server first integrity: rebuild stats and normalize active flags',
    'run' => static function (PDO $pdo): void {
        if (kareta_column_exists($pdo, 'services', 'active')) {
            $pdo->exec("UPDATE `services` SET active=1 WHERE active IS NULL");
        }
        if (kareta_column_exists($pdo, 'masters', 'active')) {
            $pdo->exec("UPDATE `masters` SET active=1 WHERE active IS NULL");
        }
        if (kareta_column_exists($pdo, 'parts_catalog', 'active')) {
            $pdo->exec("UPDATE `parts_catalog` SET active=1 WHERE active IS NULL");
        }
        kareta_rebuild_user_stats($pdo);
    },
];
