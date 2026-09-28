<?php
declare(strict_types=1);

return [
    'version' => 15,
    'note' => 'server first soft delete visibility and owner level pull access',
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
