<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/catalog/service_catalog.php';

return [
    'version' => 40,
    'note' => 'repair empty or inactive service catalog and categories',
    'run' => static function (PDO $pdo): void {
        kareta_service_catalog_import($pdo);
        $services = (int)($pdo->query("SELECT COUNT(*) FROM `service_catalog` WHERE `active`=1")->fetchColumn() ?: 0);
        $categories = (int)($pdo->query("SELECT COUNT(*) FROM `service_categories` WHERE `active`=1")->fetchColumn() ?: 0);
        if ($services < 109 || $categories < 1) {
            throw new RuntimeException('service_catalog_repair_incomplete:' . $services . ':' . $categories);
        }
    },
];
