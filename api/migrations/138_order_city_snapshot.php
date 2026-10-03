<?php
declare(strict_types=1);
return [
    'version'=>138,
    'note'=>'Explicit city identity snapshot for service orders; no inferred backfill',
    'run'=>static function(PDO $pdo): void {
        $columns=array_column($pdo->query('SHOW COLUMNS FROM orders')->fetchAll(PDO::FETCH_ASSOC),'Field');
        if(!in_array('city',$columns,true))$pdo->exec("ALTER TABLE orders ADD COLUMN city VARCHAR(120) NOT NULL DEFAULT ''");
        if(!in_array('city_id',$columns,true))$pdo->exec("ALTER TABLE orders ADD COLUMN city_id VARCHAR(64) NOT NULL DEFAULT ''");
    },
];
