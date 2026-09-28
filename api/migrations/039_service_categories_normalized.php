<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/catalog/service_catalog.php';

return [
    'version' => 39,
    'note' => 'normalize 109 services into dedicated service categories and reimport catalog',
    'run' => static function (PDO $pdo): void {
        kareta_service_catalog_import($pdo);
    },
];
