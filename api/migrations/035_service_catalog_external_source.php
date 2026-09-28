<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/catalog/service_catalog.php';

return [
    'version' => 35,
    'note' => 'move 109 services from api source code into protected catalog source and normalized service tables',
    'run' => static function (PDO $pdo): void {
        kareta_service_catalog_import($pdo);
    },
];
