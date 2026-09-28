<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/catalog/product_catalog.php';

return [
    'version' => 34,
    'note' => 'move 725 GlobalTuning products from api source code into protected catalog source and typed MySQL columns',
    'run' => static function (PDO $pdo): void {
        kareta_product_catalog_import($pdo, true);
    },
];
