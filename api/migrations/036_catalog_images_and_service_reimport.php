<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/catalog/product_catalog.php';
require_once dirname(__DIR__) . '/catalog/service_catalog.php';

return [
    'version' => 36,
    'note' => 'restore GlobalTuning product image links and force service catalog import into normalized tables',
    'run' => static function (PDO $pdo): void {
        kareta_product_catalog_import($pdo, true);
        kareta_service_catalog_import($pdo);
    },
];
