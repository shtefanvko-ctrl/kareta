<?php
declare(strict_types=1);

return [
    'version' => 13,
    'note' => 'server first finalize: safe indexes only in bootstrap migration stage',
    'run' => static function (PDO $pdo): void {
        if (kareta_column_exists($pdo, 'masters', 'active')) {
            kareta_ensure_index($pdo, 'masters', 'idx_masters_active_name', "ALTER TABLE `masters` ADD INDEX `idx_masters_active_name` (`active`,`name`)");
        }
        if (kareta_column_exists($pdo, 'services', 'sort') && kareta_column_exists($pdo, 'services', 'active')) {
            kareta_ensure_index($pdo, 'services', 'idx_services_active_sort', "ALTER TABLE `services` ADD INDEX `idx_services_active_sort` (`active`,`sort`)");
        }
        if (kareta_column_exists($pdo, 'parts_catalog', 'cat') && kareta_column_exists($pdo, 'parts_catalog', 'active') && kareta_column_exists($pdo, 'parts_catalog', 'sort')) {
            kareta_ensure_index($pdo, 'parts_catalog', 'idx_parts_catalog_cat_active_sort', "ALTER TABLE `parts_catalog` ADD INDEX `idx_parts_catalog_cat_active_sort` (`cat`,`active`,`sort`)");
        }
    },
];
