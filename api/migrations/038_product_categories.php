<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/catalog/product_categories.php';

return [
    'version' => 38,
    'note' => 'normalized product categories for storefront filters and seller product forms',
    'run' => static function (PDO $pdo): void {
        kareta_product_categories_import($pdo);
    },
];
